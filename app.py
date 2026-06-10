# app.py
import asyncio
import json
import os
import re
from typing import Literal
from pymongo import MongoClient
import google.generativeai as genai
from langgraph.graph import StateGraph, START, END
import nest_asyncio
import smtplib
from email.message import EmailMessage
import pandas as pd
from sklearn.preprocessing import LabelEncoder
import joblib
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# ensure nest_asyncio patch for using asyncio loop inside Flask
nest_asyncio.apply()

app = Flask(__name__, template_folder="templates", static_folder="static")
CORS(app)

# -------------------------
# Gemini API Configuration (kept in file as requested)
# -------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")

if not GEMINI_API_KEY:
    raise RuntimeError("Set GEMINI_API_KEY environment variable before running app.py")

genai.configure(api_key=GEMINI_API_KEY)


class _GeminiResponse:
    def __init__(self, text: str):
        self.text = text


class _GeminiModel:
    def __init__(self, model_name: str):
        self.model_name = model_name
        self._model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 2048,
            },
        )

    def generate_content(self, prompt: str) -> _GeminiResponse:
        response = self._model.generate_content(prompt)
        text = (getattr(response, "text", None) or "").strip()
        if not text:
            raise RuntimeError("No response from Gemini API")
        return _GeminiResponse(text)

gemini_model = _GeminiModel(GEMINI_MODEL)

# -------------------------
# Email Configuration (kept in file as requested)
# -------------------------
SENDER_EMAIL = "sanamujawar1902@gmail.com"
SENDER_APP_PASSWORD = "zitwmwpbswjbuksa"

# -------------------------
# MongoDB Setup
# -------------------------
MONGO_URI = "mongodb+srv://sanamujawar1902:Sana2004@cluster-project.3zty3z8.mongodb.net/8"
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["HR_AGENT"]

# -------------------------
# ML Model Setup (GLOBAL)
# -------------------------
attrition_model = None
label_encoders = {}
feature_columns = []

def load_or_train_model():
    """Load existing model or mark as not present."""
    global attrition_model, label_encoders, feature_columns
    try:
        # Try local relative paths first (for deployment)
        attrition_model = joblib.load('attrition_model.pkl')
        label_encoders = joblib.load('label_encoders.pkl')
        feature_columns = joblib.load('feature_columns.pkl')
        print("✅ Loaded pre-trained attrition model from local files")
    except Exception:
        try:
            # Fallback to Colab paths (if you still have files mounted there)
            attrition_model = joblib.load('models/attrition_model.pkl')
            label_encoders = joblib.load('models/label_encoders (1).pkl')
            feature_columns = joblib.load('models/feature_columns.pkl')
            print("✅ Loaded pre-trained attrition model from Colab path")
        except Exception:
            print("⚠️ Model not found. Attrition prediction will be disabled until model files are available.")
            attrition_model = None

load_or_train_model()

# -------------------------
# Field Matching Utility
# -------------------------
def match_db_fields(collection, field_dict):
    """Match query/update/projection fields with MongoDB fields (case-insensitive)."""
    if not field_dict or not isinstance(field_dict, dict):
        return field_dict

    try:
        sample_doc = collection.find_one()
        if not sample_doc:
            return field_dict

        corrected = {}
        for user_field, value in field_dict.items():
            matched = False
            for db_field in sample_doc.keys():
                if db_field.lower() == str(user_field).lower():
                    corrected[db_field] = value
                    matched = True
                    break
            if not matched:
                uf_norm = re.sub(r"[\s_]+", "", str(user_field).lower())
                for db_field in sample_doc.keys():
                    db_norm = re.sub(r"[\s_]+", "", db_field.lower())
                    if uf_norm == db_norm:
                        corrected[db_field] = value
                        matched = True
                        break
            if not matched:
                corrected[user_field] = value
        return corrected
    except Exception as e:
        print(f"Field matching error: {e}")
        return field_dict

# -------------------------
# Summarization Utility
# -------------------------
def format_natural_language(docs, user_query=None):
    """Generate a readable summary of MongoDB results."""
    if not docs:
        return "No matching records found."

    if len(docs) > 1:
        count = len(docs)
        return f"Found {count} records in the database."

    doc = docs[0]

    def to_text(value):
        if isinstance(value, list):
            return f"{len(value)} items" if len(value) > 3 else str(value)
        return str(value)

    leave_keys = [k for k in doc.keys() if "leave" in k.lower() and "balance" in k.lower()]
    emp_keys = [k for k in doc.keys() if "employee" in k.lower() and "id" in k.lower()]
    emp_id = doc.get(emp_keys[0]) if emp_keys else None

    if leave_keys:
        leave_balance = doc.get(leave_keys[0])
        return f"The leave balance of employee {emp_id} is {leave_balance}."

    if user_query:
        query_lower = user_query.lower()

        if "salary" in query_lower and "Salary" in doc:
            return f"Employee {emp_id}'s salary is {doc['Salary']}."

        if "department" in query_lower and "Department" in doc:
            return f"Employee {emp_id} works in the {doc['Department']} department."

        if "position" in query_lower and "Position" in doc:
            return f"Employee {emp_id}'s position is {doc['Position']}."

        if "name" in query_lower and "Name" in doc:
            return f"Employee {emp_id}'s name is {doc['Name']}."

    if "Name" in doc and "Department" in doc:
        name = doc.get("Name", "Unknown")
        dept = doc.get("Department", "Unknown")
        position = doc.get("Position", "Unknown")
        return f"Employee {emp_id}: {name}, {position} in {dept} department."

    summary_fields = []
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, (list, dict)) and len(str(v)) > 50:
            continue
        summary_fields.append(f"{k}: {v}")
        if len(summary_fields) >= 3:
            break

    return "Information: " + ", ".join(summary_fields) if summary_fields else "Record found."

# -------------------------
# ROUTING NODE
# -------------------------
async def route_query(state: dict) -> Literal["handle_db_operations", "handle_send_mail", "handle_attrition_prediction"]:
    """Determine whether to route to database, email, or ML prediction"""
    user_query = state.get("user_query", "").lower()

    email_keywords = ["email", "mail", "send", "email id:", "subject:"]
    if any(keyword in user_query for keyword in email_keywords):
        return "handle_send_mail"

    attrition_keywords = ["attrition", "risk", "predict", "high risk", "likely to leave", "churn"]
    if any(keyword in user_query for keyword in attrition_keywords):
        return "handle_attrition_prediction"

    return "handle_db_operations"

# -------------------------
# Database Handler Node
# -------------------------
async def handle_db_operations(state: dict):
    updates = {"answer": ""}
    user_query = state.get("user_query", "")

    prompt = f"""You are a MongoDB command generator for an HR database.

Available collections:
- employee (Employee_ID, Name, Department, Position, Salary, etc.)
- Leave_Attendance (Employee_ID, LeaveBalance, Leave_Days, etc.)
- Performance (Employee_ID, Rating, Review_Date, etc.)
- Candidates, Interviews, Jobs, Onboarding, Attrition, Communication, Resume_screening, skill_courses

Generate a MongoDB command in JSON format. Operations: find, insert, update, delete.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations
2. Use "operation", "collection", "filter", "projection", "update", "document" keys
3. For "show all" or "list all" queries, use empty filter: {{"operation": "find", "collection": "employee", "filter": {{}}}}
4. For specific employee queries, use Employee_ID or EmployeeID field
5. Field names are case-sensitive

Now generate the MongoDB command for this query:
"{user_query}"

Return ONLY the JSON command:"""

    try:
        response = gemini_model.generate_content(prompt)
        raw_text = response.text.strip()

        # Clean common code fence artifacts and quotes
        raw_text = re.sub(r'^```', '', raw_text)
        raw_text = re.sub(r'```$', '', raw_text)
        raw_text = raw_text.strip().strip('"')

        try:
            cmd = json.loads(raw_text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                try:
                    cmd = json.loads(match.group(0))
                except Exception:
                    updates["answer"] = "❌ Failed to parse your request. Please try rephrasing."
                    return updates
            else:
                updates["answer"] = "❌ Could not understand your request. Please try again."
                return updates

        operation = cmd.get("operation")
        collection_name = cmd.get("collection")
        filter_ = cmd.get("filter") or cmd.get("query") or {}
        document = cmd.get("document")
        update_statement = cmd.get("update")
        projection = cmd.get("projection")

        if not operation or not collection_name:
            updates["answer"] = "❌ Could not interpret your request. Please try rephrasing."
            return updates

        available_collections = db.list_collection_names()
        if collection_name not in available_collections:
            updates["answer"] = f"❌ Collection '{collection_name}' not found in database."
            return updates

        collection = db[collection_name]

        filter_corrected = match_db_fields(collection, filter_)
        projection_corrected = match_db_fields(collection, projection)
        document_corrected = match_db_fields(collection, document)
        update_corrected = match_db_fields(collection, update_statement)

        if operation == "find":
            docs = list(collection.find(filter_corrected, projection_corrected))
            natural_text = format_natural_language(docs, user_query)

        elif operation == "insert":
            if not document_corrected:
                natural_text = "❌ Insert operation missing document data."
            else:
                res = collection.insert_one(document_corrected)
                natural_text = f"✅ Successfully inserted new record with ID {res.inserted_id}."

        elif operation == "update":
            if not filter_corrected:
                natural_text = "❌ Update requires identifying which record to update."
            else:
                if update_corrected:
                    if "$set" in update_corrected:
                        update_corrected["$set"] = match_db_fields(collection, update_corrected["$set"])
                    if "$inc" in update_corrected:
                        update_corrected["$inc"] = match_db_fields(collection, update_corrected["$inc"])
                elif document_corrected:
                    update_corrected = {"$set": document_corrected}
                res = collection.update_one(filter_corrected, update_corrected)
                natural_text = (
                    f"✅ Successfully updated {res.modified_count} record(s)."
                    if res.matched_count > 0
                    else "❌ No matching record found to update."
                )

        elif operation == "delete":
            if not filter_corrected:
                natural_text = "❌ Delete requires identifying which record to remove."
            else:
                res = collection.delete_one(filter_corrected)
                natural_text = "✅ Successfully deleted 1 record." if res.deleted_count > 0 else "❌ No matching record found."

        else:
            natural_text = f"❌ Operation '{operation}' is not supported."

        updates["answer"] = natural_text

    except Exception as e:
        print("DB node error:", e)
        updates["answer"] = "⚠️ An error occurred while processing your request. Please try again."

    return updates

# -------------------------
# Attrition Prediction Node (COMPLETE WITH NAME MAPPING)
# -------------------------
async def handle_attrition_prediction(state: dict):
    updates = {"answer": ""}
    user_query = state.get("user_query", "")

    try:
        if attrition_model is None:
            updates["answer"] = (
                "⚠️ Attrition Prediction Model Not Available.\n\n"
                "Please upload and train the model, then place the model files (attrition_model.pkl, label_encoders.pkl, feature_columns.pkl) in the server directory."
            )
            return updates

        # Extract number from query (e.g., "top 5")
        number_match = re.search(r'(\d+)', user_query)
        top_n = int(number_match.group(1)) if number_match else 5

        # Fetch attrition data
        attrition_collection = db["Attrition"]
        employee_docs = list(attrition_collection.find({}))

        if not employee_docs:
            updates["answer"] = "❌ No employee data found in Attrition collection."
            return updates

        # Convert to DataFrame
        df = pd.DataFrame(employee_docs)
        df = df.drop('_id', axis=1, errors='ignore')

        # Extract employee IDs - try multiple field names
        employee_ids = []
        id_field = None
        for field in ['EmployeeID', 'Employee_ID', 'EmployeeNumber', 'employee_id']:
            if field in df.columns:
                employee_ids = df[field].tolist()
                id_field = field
                break

        if not employee_ids:
            employee_ids = [f"EMP_{i}" for i in range(len(df))]

        # FETCH NAMES FROM EMPLOYEE COLLECTION
        employee_collection = db["employee"]
        name_mapping = {}

        try:
            all_employees = list(employee_collection.find(
                {},
                {
                    "EmployeeID": 1,
                    "Employee_ID": 1,
                    "EmployeeNumber": 1,
                    "Name": 1,
                    "EmployeeName": 1,
                    "Employee_Name": 1,
                    "_id": 0
                }
            ))

            for emp in all_employees:
                emp_id = (emp.get('EmployeeID') or emp.get('Employee_ID') or emp.get('EmployeeNumber'))
                emp_name = (emp.get('Name') or emp.get('EmployeeName') or emp.get('Employee_Name'))
                if emp_id and emp_name:
                    name_mapping[str(emp_id)] = emp_name
                    try:
                        if str(emp_id).isdigit():
                            name_mapping[int(emp_id)] = emp_name
                    except:
                        pass
        except Exception as e:
            print("Warning: Could not fetch employee names:", e)

        employee_names = []
        for emp_id in employee_ids:
            name = name_mapping.get(str(emp_id)) or name_mapping.get(emp_id)
            if name:
                employee_names.append(name)
            else:
                idx = employee_ids.index(emp_id)
                if 'Name' in df.columns:
                    employee_names.append(df.iloc[idx]['Name'])
                else:
                    employee_names.append(f"Employee {emp_id}")

        # Encode categorical variables
        df_encoded = df.copy()
        for col in df_encoded.select_dtypes(include=['object']).columns:
            if col in label_encoders:
                le = label_encoders[col]
                df_encoded[col] = df_encoded[col].apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else -1
                )
            else:
                le = LabelEncoder()
                df_encoded[col] = le.fit_transform(df_encoded[col].astype(str))

        # Ensure all features present
        for col in feature_columns:
            if col not in df_encoded.columns:
                df_encoded[col] = 0

        # Predict
        X_pred = df_encoded[feature_columns]
        attrition_probs = attrition_model.predict_proba(X_pred)[:, 1]

        results_df = pd.DataFrame({
            'EmployeeID': employee_ids,
            'Name': employee_names,
            'AttritionRisk': attrition_probs
        })
        results_df = results_df.sort_values('AttritionRisk', ascending=False)
        top_risks = results_df.head(top_n)

        # Format response
        response_text = f"🚨 Top {top_n} High-Risk Attrition Employees:\n\n"
        for idx, row in top_risks.iterrows():
            risk_score = row['AttritionRisk'] * 100
            if risk_score > 70:
                risk_level = "CRITICAL"
            elif risk_score > 50:
                risk_level = "HIGH"
            else:
                risk_level = "MODERATE"
            response_text += f"{risk_level} - {row['Name']} (ID: {row['EmployeeID']}) — {risk_score:.1f}%\n"

        response_text += f"\nAnalysis Summary:\n"
        response_text += f"• Total employees analyzed: {len(results_df)}\n"
        response_text += f"• Average risk score: {results_df['AttritionRisk'].mean() * 100:.1f}%\n"
        response_text += f"• High-risk employees (>50%): {(results_df['AttritionRisk'] > 0.5).sum()}\n"
        response_text += f"• Critical employees (>70%): {(results_df['AttritionRisk'] > 0.7).sum()}\n"

        updates["answer"] = response_text

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print("Attrition node error:", error_trace)
        updates["answer"] = f"⚠️ Prediction Error: {e}"

    return updates

# -------------------------
# Email Handler Node
# -------------------------
async def handle_send_mail(state: dict):
    updates = {"answer": ""}
    user_query = state.get("user_query", "")

    try:
        email_match = re.search(r"(?:email\s*id|to|email)\s*[:\-]?\s*(\S+@\S+)", user_query, re.IGNORECASE)
        subject_match = re.search(r"subject\s*[:\-]?\s*(.+?)(?:$|\n)", user_query, re.IGNORECASE)

        if not email_match:
            updates["answer"] = "❌ Email address not found.\n\n📝 Format: email id: recipient@example.com subject: Your Subject"
            return updates

        if not subject_match:
            updates["answer"] = "❌ Subject not found.\n\n📝 Format: email id: recipient@example.com subject: Your Subject"
            return updates

        recipient_email = email_match.group(1).strip()
        subject = subject_match.group(1).strip()

        prompt = f"""You are an HR assistant writing a professional email.

Email Details:
- Recipient: {recipient_email}
- Subject: {subject}
- Context: {user_query}

Write a complete, professional email body based on the subject line.
- Use proper greeting and closing
- Be professional and concise
- Match the tone to the subject
- Don't include the subject line in the body

Respond with ONLY the email body text."""

        response = gemini_model.generate_content(prompt)
        email_body = response.text.strip()

        msg = EmailMessage()
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.set_content(email_body)

        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
                smtp.send_message(msg)

            updates["answer"] = (
                f"✅ Email sent successfully!\n\nTo: {recipient_email}\nSubject: {subject}\n\n"
                f"Email Content:\n{email_body}\n\nDelivered via Gmail SMTP"
            )

        except smtplib.SMTPAuthenticationError:
            updates["answer"] = (
                f"⚠️ Authentication Failed. Could not send email to {recipient_email}.\n\n"
                f"Generated Email Content:\n{email_body}\n\nCheck SENDER_EMAIL and SENDER_APP_PASSWORD."
            )

        except Exception as smtp_error:
            updates["answer"] = f"⚠️ Email Sending Failed: {smtp_error}\n\nGenerated Content:\n{email_body}"

    except Exception as e:
        updates["answer"] = f"⚠️ Error: {e}"

    return updates

# -------------------------
# LangGraph Setup (same as Colab)
# -------------------------
graph = StateGraph(dict)
graph.add_node("handle_db_operations", handle_db_operations)
graph.add_node("handle_send_mail", handle_send_mail)
graph.add_node("handle_attrition_prediction", handle_attrition_prediction)

graph.add_conditional_edges(
    START,
    route_query,
    {
        "handle_db_operations": "handle_db_operations",
        "handle_send_mail": "handle_send_mail",
        "handle_attrition_prediction": "handle_attrition_prediction"
    }
)

graph.add_edge("handle_db_operations", END)
graph.add_edge("handle_send_mail", END)
graph.add_edge("handle_attrition_prediction", END)

compiled_graph = graph.compile()

# -------------------------
# Flask routes
# -------------------------
@app.route("/")
def index():
    # serve the provided chat frontend
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json() or {}
    user_query = data.get("query", "").strip()
    if not user_query:
        return jsonify({"success": False, "answer": "Please provide a query."}), 400

    try:
        # Run the langgraph compiled graph synchronously via asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        final_state = loop.run_until_complete(compiled_graph.ainvoke({"user_query": user_query}))
        answer = final_state.get("answer", "No response.")
        return jsonify({"success": True, "answer": answer})
    except Exception as e:
        print("Server ask error:", e)
        return jsonify({"success": False, "answer": f"Server error: {e}"}), 500

if __name__ == "__main__":
    # For dev; for production use a WSGI server (gunicorn/uvicorn) and proper env config
    app.run(host="0.0.0.0", port=5000, debug=True)
