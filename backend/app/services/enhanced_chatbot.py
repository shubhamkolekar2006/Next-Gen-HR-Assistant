"""
Enhanced Chatbot Service - Handles general Q&A, database queries, and logs all interactions
"""
import asyncio
import json
import re
from datetime import datetime
from typing import Literal, Dict, Any
from langgraph.graph import StateGraph
from app.core.config import settings
from app.core.database import get_database
from app.services.email_service import send_email
from app.services.ml_service import attrition_model, label_encoders, feature_columns, MODEL_LOADED
from app.services.llama_client import LlamaModel
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL
model = LlamaModel(model_name=LLAMA_MODEL_NAME)

async def log_chatbot_query(user_query: str, response: str, query_type: str, metadata: Dict = None):
    """Log all chatbot queries for analytics and improvement"""
    db = get_database()
    
    log_entry = {
        "user_query": user_query,
        "response": response,
        "query_type": query_type,  # 'database', 'general_qa', 'email', 'attrition', 'resume_screening', 'scheduling'
        "timestamp": datetime.now().isoformat(),
        "metadata": metadata or {}
    }
    
    try:
        await db["Chatbot_Logs"].insert_one(log_entry)
    except Exception as e:
        logger.error(f"Error logging chatbot query: {e}")

async def determine_query_type(user_query: str) -> str:
    """Determine what type of query this is"""
    query_lower = user_query.lower()
    
    # Database query keywords
    db_keywords = ["show", "find", "list", "get", "display", "employee", "department", "salary", "performance", "leave", "balance"]
    if any(keyword in query_lower for keyword in db_keywords):
        # But check if it's a general question first
        question_words = ["what", "why", "how", "when", "where", "who", "explain", "tell me about", "describe"]
        if any(word in query_lower[:20] for word in question_words):
            return "general_qa"
        return "database"
    
    # Email keywords
    email_keywords = ["email", "mail", "send", "email id:", "subject:"]
    if any(keyword in query_lower for keyword in email_keywords):
        return "email"
    
    # Attrition keywords
    attrition_keywords = ["attrition", "risk", "predict", "high risk", "likely to leave", "churn"]
    if any(keyword in query_lower for keyword in attrition_keywords):
        return "attrition"
    
    # Resume screening keywords
    resume_keywords = ["screen resume", "review resume", "evaluate candidate", "resume screening", "applicant"]
    if any(keyword in query_lower for keyword in resume_keywords):
        return "resume_screening"
    
    # Scheduling keywords
    schedule_keywords = ["schedule", "book meeting", "set up interview", "arrange meeting", "calendar", "appointment"]
    if any(keyword in query_lower for keyword in schedule_keywords):
        return "scheduling"
    
    # Document generation keywords
    document_keywords = ["generate", "create", "offer letter", "contract", "certificate", "document"]
    if any(keyword in query_lower for keyword in document_keywords):
        return "document_generation"
    
    # Onboarding keywords
    onboarding_keywords = ["onboard", "onboarding", "new hire", "welcome", "setup employee"]
    if any(keyword in query_lower for keyword in onboarding_keywords):
        return "onboarding"
    
    # Default to general Q&A
    return "general_qa"

async def handle_general_qa(state: dict):
    """Handle general questions using Gemini with HR context"""
    updates = {"answer": ""}
    user_query = state.get("user_query", "")
    
    try:
        # Get recent context from database
        db = get_database()
        
        # Get some company/HR context
        total_employees = await db["employee"].count_documents({})
        departments = await db["employee"].aggregate([
            {"$group": {"_id": "$Department", "count": {"$sum": 1}}},
            {"$limit": 5}
        ]).to_list(length=5)
        dept_list = ", ".join([d["_id"] for d in departments if d.get("_id")])
        
        context_prompt = f"""You are an AI HR assistant for TalentFlow HR Management Platform.

Company Context:
- Total Employees: {total_employees}
- Departments: {dept_list}
- Available Collections: employee, Leave_Attendance, Performance, Attrition, Candidates, Interviews, Jobs, Onboarding

Capabilities:
- Answer HR-related questions
- Query employee database
- Send emails
- Predict attrition risks
- Screen resumes
- Schedule meetings

User Query: "{user_query}"

Provide a helpful, professional answer. If the question requires database access, suggest how the user can query it.
If it's about the company or HR processes, answer naturally.

Respond in a friendly, professional tone:"""

        response = model.generate_content(context_prompt)
        answer = response.text.strip()
        
        updates["answer"] = answer
        
        # Log the query
        await log_chatbot_query(user_query, answer, "general_qa")
        
    except Exception as e:
        logger.error(f"General Q&A error: {e}")
        updates["answer"] = f"⚠️ Error processing your question: {e}"
        await log_chatbot_query(user_query, str(e), "general_qa", {"error": True})
    
    return updates

async def route_query_enhanced(state: dict):
    """Enhanced routing that includes general Q&A"""
    user_query = state.get("user_query", "")
    query_type = await determine_query_type(user_query)
    
    routing_map = {
        "general_qa": "handle_general_qa",
        "database": "handle_db_operations",
        "email": "handle_send_mail",
        "attrition": "handle_attrition_prediction",
        "resume_screening": "handle_resume_screening",
        "scheduling": "handle_schedule_meeting",
        "document_generation": "handle_document_generation",
        "onboarding": "handle_onboarding"
    }
    
    return routing_map.get(query_type, "handle_general_qa")

# Import existing handlers
from app.services.ai_service import (
    handle_db_operations,
    handle_send_mail,
    handle_attrition_prediction,
    handle_resume_screening,
    handle_schedule_meeting,
    match_db_fields_async,
    format_natural_language
)

# Enhanced handlers with logging
async def handle_db_operations_logged(state: dict):
    """Database operations with logging"""
    result = await handle_db_operations(state)
    await log_chatbot_query(
        state.get("user_query", ""),
        result.get("answer", ""),
        "database"
    )
    return result

async def handle_send_mail_logged(state: dict):
    """Email sending with logging"""
    result = await handle_send_mail(state)
    await log_chatbot_query(
        state.get("user_query", ""),
        result.get("answer", ""),
        "email"
    )
    return result

async def handle_attrition_prediction_logged(state: dict):
    """Attrition prediction with logging"""
    result = await handle_attrition_prediction(state)
    await log_chatbot_query(
        state.get("user_query", ""),
        result.get("answer", ""),
        "attrition"
    )
    return result

async def handle_resume_screening_logged(state: dict):
    """Resume screening with logging"""
    result = await handle_resume_screening(state)
    await log_chatbot_query(
        state.get("user_query", ""),
        result.get("answer", ""),
        "resume_screening"
    )
    return result

async def handle_schedule_meeting_logged(state: dict):
    """Meeting scheduling with logging"""
    result = await handle_schedule_meeting(state)
    await log_chatbot_query(
        state.get("user_query", ""),
        result.get("answer", ""),
        "scheduling"
    )
    return result

async def handle_document_generation(state: dict):
    """Handle document generation requests"""
    updates = {"answer": ""}
    user_query = state.get("user_query", "")
    
    try:
        from app.services.document_generation_agent import DocumentGenerationAgent
        
        # Parse document type and requirements
        prompt = f"""Extract document generation request from: "{user_query}"

        Return JSON:
        {{
            "document_type": "offer_letter" | "contract" | "experience_certificate" | "salary_certificate",
            "employee_name": "name",
            "employee_id": "id or null"
        }}

        Return ONLY JSON:"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        
        info = json.loads(text)
        
        agent = DocumentGenerationAgent()
        db = get_database()
        
        # Get employee data
        employee = await db["employee"].find_one({"Employee_ID": info.get("employee_id")} or {"Name": info.get("employee_name")})
        if not employee:
            updates["answer"] = "❌ Employee not found. Please provide valid employee ID or name."
            await log_chatbot_query(user_query, updates["answer"], "document_generation")
            return updates
        
        # Generate document based on type
        doc_type = info.get("document_type", "offer_letter")
        if doc_type == "offer_letter":
            result = await agent.generate_offer_letter(
                {"name": employee.get("Name"), "email": employee.get("Email", "")},
                {"job_id": employee.get("Position", "")},
                {"salary": employee.get("Salary", "")}
            )
        elif doc_type == "contract":
            result = await agent.generate_contract(
                {"employee_id": employee.get("Employee_ID"), "name": employee.get("Name")},
                {"position": employee.get("Position"), "salary": employee.get("Salary")}
            )
        elif doc_type == "experience_certificate":
            result = await agent.generate_experience_certificate(
                {"employee_id": employee.get("Employee_ID"), "name": employee.get("Name")},
                {"position": employee.get("Position"), "department": employee.get("Department")}
            )
        else:  # salary_certificate
            result = await agent.generate_salary_certificate(
                {"employee_id": employee.get("Employee_ID"), "name": employee.get("Name")},
                {"salary": employee.get("Salary"), "position": employee.get("Position")}
            )
        
        if result.get("success"):
            updates["answer"] = f"✅ {doc_type.replace('_', ' ').title()} generated successfully!\n\nDocument ID: {result['document']['_id']}\n\nDocument has been saved and can be sent to the employee."
        else:
            updates["answer"] = f"❌ Error generating document: {result.get('error', 'Unknown error')}"
            
    except Exception as e:
        logger.error(f"Document generation error: {e}")
        updates["answer"] = f"⚠️ Error: {e}"
    
    await log_chatbot_query(user_query, updates["answer"], "document_generation")
    return updates

async def handle_onboarding(state: dict):
    """Handle onboarding requests"""
    updates = {"answer": ""}
    user_query = state.get("user_query", "")
    
    try:
        from app.services.onboarding_agent import OnboardingAgent
        
        # Parse employee info
        prompt = f"""Extract employee information from: "{user_query}"

        Return JSON:
        {{
            "employee_id": "employee ID",
            "employee_name": "name",
            "action": "create" | "update" | "status"
        }}

        Return ONLY JSON:"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        
        info = json.loads(text)
        
        agent = OnboardingAgent()
        db = get_database()
        
        employee = await db["employee"].find_one({"Employee_ID": info.get("employee_id")})
        if not employee:
            updates["answer"] = "❌ Employee not found."
            await log_chatbot_query(user_query, updates["answer"], "onboarding")
            return updates
        
        if info.get("action") == "create":
            onboarding = await agent.create_onboarding_plan(
                employee.get("Employee_ID"),
                {
                    "name": employee.get("Name"),
                    "email": employee.get("Email", ""),
                    "department": employee.get("Department", ""),
                    "position": employee.get("Position", "")
                }
            )
            updates["answer"] = f"✅ Onboarding plan created for {employee.get('Name')}!\n\nPlan includes {len(onboarding.get('tasks', []))} tasks. Welcome email has been sent."
        else:
            # Get status
            onboarding = await db["Onboarding"].find_one({"employee_id": employee.get("Employee_ID")})
            if onboarding:
                completion = onboarding.get("completion_percentage", 0)
                updates["answer"] = f"📊 Onboarding Status for {employee.get('Name')}:\n\nCompletion: {completion}%\nStatus: {onboarding.get('status', 'N/A')}\nTasks: {len([t for t in onboarding.get('tasks', []) if t.get('status') == 'completed'])}/{len(onboarding.get('tasks', []))} completed"
            else:
                updates["answer"] = f"❌ No onboarding plan found for {employee.get('Name')}. Create one first."
                
    except Exception as e:
        logger.error(f"Onboarding error: {e}")
        updates["answer"] = f"⚠️ Error: {e}"
    
    await log_chatbot_query(user_query, updates["answer"], "onboarding")
    return updates

def build_enhanced_chatbot_graph():
    """Build enhanced chatbot with general Q&A and logging"""
    graph = StateGraph(dict)
    
    graph.add_node("handle_general_qa", handle_general_qa)
    graph.add_node("handle_db_operations", handle_db_operations_logged)
    graph.add_node("handle_send_mail", handle_send_mail_logged)
    graph.add_node("handle_attrition_prediction", handle_attrition_prediction_logged)
    graph.add_node("handle_resume_screening", handle_resume_screening_logged)
    graph.add_node("handle_schedule_meeting", handle_schedule_meeting_logged)
    graph.add_node("handle_document_generation", handle_document_generation)
    graph.add_node("handle_onboarding", handle_onboarding)

    graph.add_conditional_edges(
        "__start__",
        route_query_enhanced,
        {
            "handle_general_qa": "handle_general_qa",
            "handle_db_operations": "handle_db_operations",
            "handle_send_mail": "handle_send_mail",
            "handle_attrition_prediction": "handle_attrition_prediction",
            "handle_resume_screening": "handle_resume_screening",
            "handle_schedule_meeting": "handle_schedule_meeting",
            "handle_document_generation": "handle_document_generation",
            "handle_onboarding": "handle_onboarding"
        }
    )

    graph.add_edge("handle_general_qa", "__end__")
    graph.add_edge("handle_db_operations", "__end__")
    graph.add_edge("handle_send_mail", "__end__")
    graph.add_edge("handle_attrition_prediction", "__end__")
    graph.add_edge("handle_resume_screening", "__end__")
    graph.add_edge("handle_schedule_meeting", "__end__")
    graph.add_edge("handle_document_generation", "__end__")
    graph.add_edge("handle_onboarding", "__end__")

    return graph.compile()

