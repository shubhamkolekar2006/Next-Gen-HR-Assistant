import asyncio
import json
import re
from typing import Literal
from langgraph.graph import StateGraph
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from app.core.config import settings
from app.core.database import get_database
from app.services.ml_service import attrition_model, label_encoders, feature_columns, MODEL_LOADED
from app.services.email_service import send_email, extract_email_info
from app.services.llama_client import LlamaModel
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL


def _get_llama_model() -> LlamaModel:
    return LlamaModel(model_name=LLAMA_MODEL_NAME)

# -------------------------
# Field Matching Utility
# -------------------------
async def match_db_fields_async(collection, field_dict):
    """Match query/update/projection fields with MongoDB fields (case-insensitive)."""
    if not field_dict or not isinstance(field_dict, dict):
        return field_dict

    try:
        sample_doc = await collection.find_one()
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
        logger.error(f"Field matching error: {e}")
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
async def route_query(state: dict) -> Literal["handle_db_operations", "handle_send_mail", "handle_attrition_prediction", "handle_resume_screening", "handle_schedule_meeting"]:
    """Determine whether to route to database, email, ML prediction, or agentic workflows"""
    user_query = state.get("user_query", "").lower()

    email_keywords = ["email", "mail", "send", "email id:", "subject:"]
    if any(keyword in user_query for keyword in email_keywords):
        return "handle_send_mail"

    attrition_keywords = ["attrition", "risk", "predict", "high risk", "likely to leave", "churn"]
    if any(keyword in user_query for keyword in attrition_keywords):
        return "handle_attrition_prediction"

    # Resume screening keywords
    resume_keywords = ["screen resume", "review resume", "evaluate candidate", "resume screening", "applicant"]
    if any(keyword in user_query for keyword in resume_keywords):
        return "handle_resume_screening"

    # Meeting scheduling keywords
    schedule_keywords = ["schedule", "book meeting", "set up interview", "arrange meeting", "calendar", "appointment"]
    if any(keyword in user_query for keyword in schedule_keywords):
        return "handle_schedule_meeting"

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
        model = _get_llama_model()
        response = model.generate_content(prompt)
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

        db = get_database()
        available_collections = await db.list_collection_names()
        if collection_name not in available_collections:
            updates["answer"] = f"❌ Collection '{collection_name}' not found in database."
            return updates

        collection = db[collection_name]

        filter_corrected = await match_db_fields_async(collection, filter_)
        projection_corrected = await match_db_fields_async(collection, projection) if projection else None
        document_corrected = await match_db_fields_async(collection, document) if document else None
        update_corrected = await match_db_fields_async(collection, update_statement) if update_statement else None

        if operation == "find":
            cursor = collection.find(filter_corrected, projection_corrected)
            docs = await cursor.to_list(length=None)
            # Convert ObjectId to string
            for doc in docs:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
            natural_text = format_natural_language(docs, user_query)

        elif operation == "insert":
            if not document_corrected:
                natural_text = "❌ Insert operation missing document data."
            else:
                res = await collection.insert_one(document_corrected)
                natural_text = f"✅ Successfully inserted new record with ID {res.inserted_id}."

        elif operation == "update":
            if not filter_corrected:
                natural_text = "❌ Update requires identifying which record to update."
            else:
                if update_corrected:
                    if "$set" in update_corrected:
                        update_corrected["$set"] = await match_db_fields_async(collection, update_corrected["$set"])
                    if "$inc" in update_corrected:
                        update_corrected["$inc"] = await match_db_fields_async(collection, update_corrected["$inc"])
                elif document_corrected:
                    update_corrected = {"$set": document_corrected}
                res = await collection.update_one(filter_corrected, update_corrected)
                natural_text = (
                    f"✅ Successfully updated {res.modified_count} record(s)."
                    if res.matched_count > 0
                    else "❌ No matching record found to update."
                )

        elif operation == "delete":
            if not filter_corrected:
                natural_text = "❌ Delete requires identifying which record to remove."
            else:
                res = await collection.delete_one(filter_corrected)
                natural_text = "✅ Successfully deleted 1 record." if res.deleted_count > 0 else "❌ No matching record found."

        else:
            natural_text = f"❌ Operation '{operation}' is not supported."

        updates["answer"] = natural_text

    except Exception as e:
        logger.error(f"DB node error: {e}")
        updates["answer"] = "⚠️ An error occurred while processing your request. Please try again."

    return updates

# -------------------------
# Attrition Prediction Node
# -------------------------
async def handle_attrition_prediction(state: dict):
    updates = {"answer": ""}
    user_query = state.get("user_query", "")

    try:
        if not MODEL_LOADED or attrition_model is None:
            updates["answer"] = (
                "⚠️ Attrition Prediction Model Not Available.\n\n"
                "Please upload and train the model, then place the model files (attrition_model.pkl, label_encoders.pkl, feature_columns.pkl) in the models directory."
            )
            return updates

        # Extract number from query (e.g., "top 5")
        number_match = re.search(r'(\d+)', user_query)
        top_n = int(number_match.group(1)) if number_match else 5

        # Fetch attrition data
        db = get_database()
        attrition_collection = db["Attrition"]
        cursor = attrition_collection.find({})
        employee_docs = await cursor.to_list(length=None)

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
            cursor = employee_collection.find(
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
            )
            all_employees = await cursor.to_list(length=None)

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
            logger.warning(f"Could not fetch employee names: {e}")

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
        logger.error(f"Attrition node error: {error_trace}")
        updates["answer"] = f"⚠️ Prediction Error: {e}"

    return updates

# -------------------------
# Email Handler Node
# -------------------------
async def handle_send_mail(state: dict):
    updates = {"answer": ""}
    user_query = state.get("user_query", "")

    try:
        recipient_email, subject = extract_email_info(user_query)

        if not recipient_email:
            updates["answer"] = "❌ Email address not found.\n\n📝 Format: email id: recipient@example.com subject: Your Subject"
            return updates

        if not subject:
            updates["answer"] = "❌ Subject not found.\n\n📝 Format: email id: recipient@example.com subject: Your Subject"
            return updates

        result = await send_email(recipient_email, subject, user_query)

        if result["success"]:
            updates["answer"] = (
                f"✅ Email sent successfully!\n\nTo: {recipient_email}\nSubject: {subject}\n\n"
                f"Email Content:\n{result['content']}\n\nDelivered via Gmail SMTP"
            )
        else:
            updates["answer"] = (
                f"{result['message']}\n\n"
                f"Generated Email Content:\n{result.get('content', 'N/A')}"
            )

    except Exception as e:
        logger.error(f"Email handler error: {e}")
        updates["answer"] = f"⚠️ Error: {e}"

    return updates

# -------------------------
# Agentic Workflow Handlers
# -------------------------
async def handle_resume_screening(state: dict):
    """Handle resume screening requests"""
    from app.services.resume_screening_agent import ResumeScreeningAgent
    
    updates = {"answer": ""}
    user_query = state.get("user_query", "")
    
    try:
        model = _get_llama_model()
        
        # Extract job ID and resume text from query
        prompt = f"""Extract job ID from this query: "{user_query}"
        
        Return JSON with:
        {{
            "job_id": "job identifier or null if not found",
            "has_resume": true/false
        }}
        
        Return ONLY JSON:"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        
        info = json.loads(text)
        
        if not info.get("job_id"):
            updates["answer"] = "❌ Please provide a job ID for resume screening. Example: 'Screen resume for job JOB123'"
            return updates
        
        agent = ResumeScreeningAgent()
        # For now, use query as resume text (in production, upload separately)
        result = await agent.screen_resume(user_query, info["job_id"])
        
        score = result.get("score", {})
        updates["answer"] = (
            f"✅ Resume Screening Complete!\n\n"
            f"Overall Score: {score.get('overall_score', 0)}/100\n"
            f"Recommendation: {score.get('recommendation', 'maybe').upper()}\n"
            f"Reason: {score.get('reason', 'N/A')}\n\n"
            f"Strengths: {', '.join(score.get('strengths', [])) or 'None'}\n"
            f"Missing Skills: {', '.join(score.get('missing_skills', [])) or 'None'}"
        )
    except Exception as e:
        logger.error(f"Resume screening error: {e}")
        updates["answer"] = f"⚠️ Error screening resume: {e}"
    
    return updates

async def handle_schedule_meeting(state: dict):
    """Handle meeting scheduling requests"""
    from app.services.meeting_scheduler_agent import MeetingSchedulerAgent
    
    updates = {"answer": ""}
    user_query = state.get("user_query", "")
    
    try:
        agent = MeetingSchedulerAgent()
        
        schedule_info = await agent.parse_schedule_request(user_query)
        slots = await agent.find_available_slots(
            schedule_info.get("participants", []),
            schedule_info.get("duration_minutes", 60),
            schedule_info.get("preferred_date")
        )
        
        if slots:
            meeting = await agent.schedule_meeting(schedule_info, slots[0])
            updates["answer"] = (
                f"✅ Meeting Scheduled Successfully!\n\n"
                f"📅 Date: {meeting.get('InterviewDate')}\n"
                f"⏰ Time: {meeting.get('InterviewTime')}\n"
                f"⏱️ Duration: {meeting.get('Duration')} minutes\n"
                f"📝 Subject: {meeting.get('Subject')}\n\n"
                f"All participants have been notified via email."
            )
        else:
            updates["answer"] = "❌ No available slots found. Please try a different time range or check back later."
    except Exception as e:
        logger.error(f"Meeting scheduling error: {e}")
        updates["answer"] = f"⚠️ Error scheduling meeting: {e}"
    
    return updates

# -------------------------
# LangGraph Setup
# -------------------------
def build_chatbot_graph():
    """Build and compile the LangGraph chatbot"""
    graph = StateGraph(dict)
    graph.add_node("handle_db_operations", handle_db_operations)
    graph.add_node("handle_send_mail", handle_send_mail)
    graph.add_node("handle_attrition_prediction", handle_attrition_prediction)
    graph.add_node("handle_resume_screening", handle_resume_screening)
    graph.add_node("handle_schedule_meeting", handle_schedule_meeting)

    graph.add_conditional_edges(
        "__start__",
        route_query,
        {
            "handle_db_operations": "handle_db_operations",
            "handle_send_mail": "handle_send_mail",
            "handle_attrition_prediction": "handle_attrition_prediction",
            "handle_resume_screening": "handle_resume_screening",
            "handle_schedule_meeting": "handle_schedule_meeting"
        }
    )

    graph.add_edge("handle_db_operations", "__end__")
    graph.add_edge("handle_send_mail", "__end__")
    graph.add_edge("handle_attrition_prediction", "__end__")
    graph.add_edge("handle_resume_screening", "__end__")
    graph.add_edge("handle_schedule_meeting", "__end__")

    return graph.compile()

# Global chatbot instance
chatbot_graph = build_chatbot_graph()

class ChatbotService:
    """Chatbot service wrapper"""
    
    @staticmethod
    async def process_query(user_query: str) -> str:
        """Process a user query through the chatbot"""
        try:
            # Use enhanced chatbot if available
            try:
                from app.services.enhanced_chatbot import build_enhanced_chatbot_graph
                enhanced_graph = build_enhanced_chatbot_graph()
                result = await enhanced_graph.ainvoke({"user_query": user_query})
            except Exception:
                # Fallback to basic chatbot
                result = await chatbot_graph.ainvoke({"user_query": user_query})
            
            return result.get("answer", "No response")
        except Exception as e:
            logger.error(f"Chatbot error: {e}")
            return f"⚠️ An error occurred: {e}"

