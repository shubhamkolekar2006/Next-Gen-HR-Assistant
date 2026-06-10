"""
Interview Coordinator Agent - Manages multi-round interviews, reminders, and feedback collection
"""
import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Literal
from langgraph.graph import StateGraph
from app.core.config import settings
from app.core.database import get_database
from app.services.email_service import send_email
from app.services.meeting_scheduler_agent import MeetingSchedulerAgent
from app.services.llama_client import LlamaModel
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL
model = LlamaModel(model_name=LLAMA_MODEL_NAME)

class InterviewCoordinatorAgent:
    """Agent for coordinating interview workflows"""
    
    def __init__(self):
        self.model = model
        self.meeting_scheduler = MeetingSchedulerAgent()
    
    async def create_interview_workflow(self, candidate_id: str, job_id: str, rounds: List[str] = None) -> Dict[str, Any]:
        """Create multi-round interview workflow"""
        db = get_database()
        
        # Get candidate info - try multiple lookup methods
        candidate = None
        
        # Try ObjectId first
        try:
            candidate = await db["Candidates"].find_one({"_id": ObjectId(candidate_id)})
        except Exception:
            pass
        
        # Try by Email field (case-insensitive)
        if not candidate:
            candidate = await db["Candidates"].find_one({
                "$or": [
                    {"Email": candidate_id},
                    {"email": candidate_id},
                    {"Email": {"$regex": candidate_id, "$options": "i"}},
                    {"email": {"$regex": candidate_id, "$options": "i"}}
                ]
            })
        
        # Try by Name field
        if not candidate:
            candidate = await db["Candidates"].find_one({
                "$or": [
                    {"Name": candidate_id},
                    {"name": candidate_id},
                    {"Name": {"$regex": candidate_id, "$options": "i"}},
                    {"name": {"$regex": candidate_id, "$options": "i"}}
                ]
            })
        
        # If candidate not found, create a basic candidate record from the provided ID/email
        if not candidate:
            # Check if it looks like an email
            if "@" in candidate_id:
                # Create a basic candidate record
                candidate = {
                    "Email": candidate_id,
                    "Name": candidate_id.split("@")[0].replace(".", " ").replace("_", " ").title(),
                    "Status": "Interview Scheduled",
                    "JobID": job_id,
                    "created_at": datetime.now().isoformat()
                }
                result = await db["Candidates"].insert_one(candidate)
                candidate["_id"] = result.inserted_id
                logger.info(f"Created new candidate record for {candidate_id}")
            else:
                return {"error": f"Candidate not found. Please provide a valid candidate email or ID. Provided: {candidate_id}"}
        
        # Default rounds if not provided
        if not rounds:
            rounds = ["Phone Screen", "Technical Interview", "Final Round"]
        
        # Create workflow
        workflow = {
            "candidate_id": candidate_id,
            "candidate_email": candidate.get("Email", ""),
            "candidate_name": candidate.get("Name", "Unknown"),
            "job_id": job_id,
            "status": "active",
            "current_round": 0,
            "total_rounds": len(rounds),
            "rounds": [
                {
                    "round_number": i + 1,
                    "round_name": round_name,
                    "status": "pending" if i > 0 else "scheduled",
                    "scheduled_date": None,
                    "feedback": None,
                    "decision": None
                }
                for i, round_name in enumerate(rounds)
            ],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Schedule first round automatically
        if workflow["rounds"]:
            first_round = workflow["rounds"][0]
            slots = await self.meeting_scheduler.find_available_slots(
                [candidate.get("Email", "")],
                60,  # 1 hour default
                None
            )
            if slots:
                schedule_info = {
                    "meeting_type": "interview",
                    "participants": [candidate.get("Email", ""), "hr@company.com"],
                    "duration_minutes": 60,
                    "subject": f"{first_round['round_name']} - {candidate.get('Name', 'Candidate')}"
                }
                meeting = await self.meeting_scheduler.schedule_meeting(schedule_info, slots[0])
                first_round["scheduled_date"] = meeting.get("InterviewDate")
                first_round["status"] = "scheduled"
        
        result = await db["Interview_Workflows"].insert_one(workflow)
        workflow["_id"] = str(result.inserted_id)
        
        return workflow
    
    async def send_reminder(self, interview_id: str, hours_before: int = 24):
        """Send interview reminder"""
        db = get_database()
        
        # Normalize the interview_id (trim whitespace)
        interview_id = interview_id.strip() if interview_id else ""
        logger.info(f"Looking up interview with ID: '{interview_id}'")
        
        # Try multiple lookup methods - PRIORITIZE InterviewID field first
        interview = None
        
        # PRIORITY 1: Try by InterviewID field first (e.g., "I001") - this is what users want to use
        # Try exact match first
        interview = await db["Interviews"].find_one({"InterviewID": interview_id})
        if not interview:
            interview = await db["Interviews"].find_one({"interviewID": interview_id})
        if not interview:
            interview = await db["Interviews"].find_one({"interview_id": interview_id})
        # Try case-insensitive
        if not interview:
            interview = await db["Interviews"].find_one({
                "InterviewID": {"$regex": f"^{re.escape(interview_id)}$", "$options": "i"}
            })
        # Try with trimmed value (in case database has extra spaces)
        if not interview:
            interview = await db["Interviews"].find_one({
                "$expr": {
                    "$eq": [
                        {"$trim": {"input": {"$ifNull": ["$InterviewID", ""]}}},
                        interview_id
                    ]
                }
            })
        # Final fallback: search all interviews manually (handles any edge cases)
        if not interview:
            try:
                all_interviews = await db["Interviews"].find({}).to_list(length=None)
                for i in all_interviews:
                    # Check all possible ID field names
                    for field_name in ["InterviewID", "interviewID", "interview_id"]:
                        if field_name in i:
                            field_value = str(i.get(field_name, "")).strip()
                            if field_value == interview_id or field_value.upper() == interview_id.upper():
                                interview = i
                                logger.info(f"Found interview by manual search: {field_name}='{field_value}' -> {interview.get('_id')}")
                                break
                    if interview:
                        break
            except Exception as e:
                logger.error(f"Error in manual InterviewID search: {e}")
        
        if interview:
            logger.info(f"✅ Found interview by InterviewID: {interview_id} -> {interview.get('_id')}")
        else:
            logger.warning(f"❌ InterviewID lookup failed for: {interview_id}")
        
        # PRIORITY 2: Try ObjectId (for backward compatibility)
        if not interview:
            try:
                interview = await db["Interviews"].find_one({"_id": ObjectId(interview_id)})
                if interview:
                    logger.info(f"Found interview by ObjectId: {interview_id}")
            except Exception:
                pass
        
        # PRIORITY 3: Try as string ID
        if not interview:
            try:
                interview = await db["Interviews"].find_one({"_id": interview_id})
            except Exception:
                pass
        
        # PRIORITY 4: Try partial ObjectId match (in case user enters first few characters)
        if not interview and len(interview_id) >= 8:
            try:
                # Search for ObjectIds that start with the provided string
                all_interviews = await db["Interviews"].find({}).to_list(length=None)
                for i in all_interviews:
                    if str(i.get("_id", "")).startswith(interview_id):
                        interview = i
                        break
            except Exception:
                pass
        
        # PRIORITY 5: Try by Subject (in case user provides interview subject)
        if not interview:
            interview = await db["Interviews"].find_one({
                "$or": [
                    {"Subject": interview_id},
                    {"Subject": {"$regex": interview_id, "$options": "i"}},
                    {"CandidateEmail": interview_id}
                ]
            })
        
        if not interview:
            logger.warning(f"Interview not found with ID: {interview_id}")
            # Get some sample interviews to help user
            sample_interviews = await db["Interviews"].find({}).limit(5).to_list(length=5)
            sample_ids = [str(i.get("_id")) for i in sample_interviews if i.get("_id")]
            sample_interview_ids = [i.get("InterviewID", "N/A") for i in sample_interviews if i.get("InterviewID")]
            # Also check what fields exist in sample interviews for debugging
            if sample_interviews:
                sample_fields = list(sample_interviews[0].keys())
                logger.info(f"Sample interview fields: {sample_fields}")
            error_msg = f"Interview not found with ID: {interview_id}\n\n"
            error_msg += "Please use a valid Interview ID. You can use:\n"
            error_msg += "- InterviewID field (e.g., 'I001')\n"
            error_msg += "- MongoDB ObjectId (e.g., '68d513146cbe7fcca696a4eb')\n"
            error_msg += "- Interview Subject or Candidate Email"
            if sample_ids:
                error_msg += f"\n\nSample Interview IDs from database:\n"
                for i, (obj_id, int_id) in enumerate(zip(sample_ids[:3], sample_interview_ids[:3])):
                    error_msg += f"  ObjectId: {obj_id}"
                    if int_id != "N/A":
                        error_msg += f" | InterviewID: {int_id}"
                    error_msg += "\n"
            return {"error": error_msg}
        
        interview_date = interview.get("InterviewDate")
        interview_time = interview.get("InterviewTime")
        
        # Check if reminder needed (24 hours before)
        interview_datetime = datetime.fromisoformat(f"{interview_date}T{interview_time}")
        if interview_datetime > datetime.now() + timedelta(hours=hours_before):
            return {"message": "Too early to send reminder"}
        
        # Send reminder email
        subject = f"Reminder: Interview Scheduled for {interview_date}"
        body = f"""Dear Participant,

This is a reminder about your upcoming interview:

Date: {interview_date}
Time: {interview_time}
Duration: {interview.get('Duration', 60)} minutes
Subject: {interview.get('Subject', 'Interview')}

Please ensure you are available at the scheduled time.

Best regards,
TalentFlow HR Team"""
        
        participants = interview.get("Participants", [])
        for participant in participants:
            if "@" in str(participant):
                await send_email(participant, subject, body)
        
        # Mark reminder sent (use the found interview's _id)
        await db["Interviews"].update_one(
            {"_id": interview["_id"]},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now().isoformat()}}
        )
        
        return {"success": True, "message": "Reminders sent"}
    
    async def collect_feedback(self, interview_id: str, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Collect and process interview feedback"""
        db = get_database()
        
        # Normalize the interview_id (trim whitespace)
        interview_id = interview_id.strip() if interview_id else ""
        logger.info(f"Looking up interview with ID: '{interview_id}'")
        
        # Try multiple lookup methods - PRIORITIZE InterviewID field first
        interview = None
        
        # PRIORITY 1: Try by InterviewID field first (e.g., "I001") - this is what users want to use
        # Try exact match first
        interview = await db["Interviews"].find_one({"InterviewID": interview_id})
        if not interview:
            interview = await db["Interviews"].find_one({"interviewID": interview_id})
        if not interview:
            interview = await db["Interviews"].find_one({"interview_id": interview_id})
        # Try case-insensitive
        if not interview:
            interview = await db["Interviews"].find_one({
                "InterviewID": {"$regex": f"^{re.escape(interview_id)}$", "$options": "i"}
            })
        # Try with trimmed value (in case database has extra spaces)
        if not interview:
            interview = await db["Interviews"].find_one({
                "$expr": {
                    "$eq": [
                        {"$trim": {"input": {"$ifNull": ["$InterviewID", ""]}}},
                        interview_id
                    ]
                }
            })
        # Final fallback: search all interviews manually (handles any edge cases)
        if not interview:
            try:
                all_interviews = await db["Interviews"].find({}).to_list(length=None)
                for i in all_interviews:
                    # Check all possible ID field names
                    for field_name in ["InterviewID", "interviewID", "interview_id"]:
                        if field_name in i:
                            field_value = str(i.get(field_name, "")).strip()
                            if field_value == interview_id or field_value.upper() == interview_id.upper():
                                interview = i
                                logger.info(f"Found interview by manual search: {field_name}='{field_value}' -> {interview.get('_id')}")
                                break
                    if interview:
                        break
            except Exception as e:
                logger.error(f"Error in manual InterviewID search: {e}")
        
        if interview:
            logger.info(f"✅ Found interview by InterviewID: {interview_id} -> {interview.get('_id')}")
        else:
            logger.warning(f"❌ InterviewID lookup failed for: {interview_id}")
        
        # PRIORITY 2: Try ObjectId (for backward compatibility)
        if not interview:
            try:
                interview = await db["Interviews"].find_one({"_id": ObjectId(interview_id)})
                if interview:
                    logger.info(f"Found interview by ObjectId: {interview_id}")
            except Exception:
                pass
        
        # PRIORITY 3: Try as string ID
        if not interview:
            try:
                interview = await db["Interviews"].find_one({"_id": interview_id})
            except Exception:
                pass
        
        # PRIORITY 4: Try partial ObjectId match (in case user enters first few characters)
        if not interview and len(interview_id) >= 8:
            try:
                # Search for ObjectIds that start with the provided string
                all_interviews = await db["Interviews"].find({}).to_list(length=None)
                for i in all_interviews:
                    if str(i.get("_id", "")).startswith(interview_id):
                        interview = i
                        break
            except Exception:
                pass
        
        # PRIORITY 5: Try by Subject or CandidateEmail
        if not interview:
            interview = await db["Interviews"].find_one({
                "$or": [
                    {"Subject": interview_id},
                    {"Subject": {"$regex": interview_id, "$options": "i"}},
                    {"CandidateEmail": interview_id}
                ]
            })
        
        if not interview:
            logger.warning(f"Interview not found with ID: {interview_id}")
            # Get some sample interviews to help user
            sample_interviews = await db["Interviews"].find({}).limit(5).to_list(length=5)
            sample_ids = [str(i.get("_id")) for i in sample_interviews if i.get("_id")]
            sample_interview_ids = [i.get("InterviewID", "N/A") for i in sample_interviews if i.get("InterviewID")]
            # Also check what fields exist in sample interviews for debugging
            if sample_interviews:
                sample_fields = list(sample_interviews[0].keys())
                logger.info(f"Sample interview fields: {sample_fields}")
            error_msg = f"Interview not found with ID: {interview_id}\n\n"
            error_msg += "Please use a valid Interview ID. You can use:\n"
            error_msg += "- InterviewID field (e.g., 'I001')\n"
            error_msg += "- MongoDB ObjectId (e.g., '68d513146cbe7fcca696a4eb')\n"
            error_msg += "- Interview Subject or Candidate Email"
            if sample_ids:
                error_msg += f"\n\nSample Interview IDs from database:\n"
                for i, (obj_id, int_id) in enumerate(zip(sample_ids[:3], sample_interview_ids[:3])):
                    error_msg += f"  ObjectId: {obj_id}"
                    if int_id != "N/A":
                        error_msg += f" | InterviewID: {int_id}"
                    error_msg += "\n"
            return {"error": error_msg}
        
        # Analyze feedback using AI
        feedback_text = feedback_data.get("feedback", "")
        
        analysis_prompt = f"""Analyze this interview feedback and return JSON:
        {{
            "overall_rating": number (1-5),
            "recommendation": "hire" | "maybe" | "reject",
            "strengths": ["strength1", "strength2"],
            "concerns": ["concern1", "concern2"],
            "summary": "brief summary"
        }}

        Feedback: {feedback_text}

        Return ONLY JSON:"""

        try:
            response = model.generate_content(analysis_prompt)
            text = response.text.strip()
            text = re.sub(r'```json\s*', '', text)
            text = re.sub(r'```\s*', '', text)
            
            analysis = json.loads(text)
        except Exception as e:
            logger.error(f"Error analyzing feedback: {e}")
            analysis = {
                "overall_rating": 3,
                "recommendation": "maybe",
                "summary": "Feedback collected"
            }
        
        # Save feedback (use the found interview's _id as string)
        feedback_record = {
            "interview_id": str(interview["_id"]),
            "interviewer": feedback_data.get("interviewer", "Unknown"),
            "feedback": feedback_text,
            "analysis": analysis,
            "submitted_at": datetime.now().isoformat()
        }
        
        await db["Interview_Feedback"].insert_one(feedback_record)
        
        # Update interview (use the found interview's _id)
        await db["Interviews"].update_one(
            {"_id": interview["_id"]},
            {"$set": {"feedback_collected": True, "feedback": analysis}}
        )
        
        # Update workflow if exists
        candidate_email = interview.get("CandidateEmail")
        if candidate_email:
            workflow = await db["Interview_Workflows"].find_one({
                "candidate_email": candidate_email,
                "status": "active"
            })
            
            if workflow:
                current_round_idx = workflow.get("current_round", 0)
                if current_round_idx < len(workflow.get("rounds", [])):
                    workflow["rounds"][current_round_idx]["feedback"] = analysis
                    workflow["rounds"][current_round_idx]["decision"] = analysis.get("recommendation")
                    
                    # Decide next step
                    if analysis.get("recommendation") == "hire" and current_round_idx < len(workflow["rounds"]) - 1:
                        # Move to next round
                        workflow["current_round"] += 1
                        workflow["rounds"][current_round_idx + 1]["status"] = "ready_to_schedule"
                    elif analysis.get("recommendation") == "reject":
                        workflow["status"] = "rejected"
                    elif current_round_idx >= len(workflow["rounds"]) - 1:
                        workflow["status"] = "completed"
                    
                    workflow["updated_at"] = datetime.now().isoformat()
                    try:
                        wf_id = ObjectId(workflow["_id"])
                    except Exception:
                        wf_id = workflow["_id"]
                    await db["Interview_Workflows"].update_one(
                        {"_id": wf_id},
                        {"$set": workflow}
                    )
        
        return {
            "success": True,
            "feedback": feedback_record,
            "analysis": analysis
        }
    
    async def schedule_next_round(self, workflow_id: str) -> Dict[str, Any]:
        """Schedule next round in interview workflow"""
        db = get_database()
        
        try:
            workflow = await db["Interview_Workflows"].find_one({"_id": ObjectId(workflow_id)})
        except Exception:
            workflow = await db["Interview_Workflows"].find_one({"_id": workflow_id})
        if not workflow:
            return {"error": "Workflow not found"}
        
        current_round_idx = workflow.get("current_round", 0)
        rounds = workflow.get("rounds", [])
        
        if current_round_idx >= len(rounds) - 1:
            return {"error": "All rounds completed"}
        
        next_round = rounds[current_round_idx + 1]
        if next_round["status"] != "ready_to_schedule":
            return {"error": "Next round not ready"}
        
        # Schedule next round
        slots = await self.meeting_scheduler.find_available_slots(
            [workflow.get("candidate_email", "")],
            60,
            None
        )
        
        if not slots:
            return {"error": "No available slots"}
        
        schedule_info = {
            "meeting_type": "interview",
            "participants": [workflow.get("candidate_email", ""), "hr@company.com"],
            "duration_minutes": 60,
            "subject": f"{next_round['round_name']} - {workflow.get('candidate_name', 'Candidate')}"
        }
        
        meeting = await self.meeting_scheduler.schedule_meeting(schedule_info, slots[0])
        
        # Update workflow
        next_round["scheduled_date"] = meeting.get("InterviewDate")
        next_round["status"] = "scheduled"
        workflow["current_round"] = current_round_idx + 1
        workflow["updated_at"] = datetime.now().isoformat()
        
        try:
            wf_id = ObjectId(workflow_id)
        except Exception:
            wf_id = workflow_id
        await db["Interview_Workflows"].update_one(
            {"_id": wf_id},
            {"$set": workflow}
        )
        
        return {
            "success": True,
            "meeting": meeting,
            "workflow": workflow
        }

# LangGraph Workflow
async def route_interview_coordination(state: dict):
    """Route interview coordination workflow"""
    action = state.get("action", "create_workflow")
    
    routing_map = {
        "create_workflow": "create_workflow",
        "send_reminder": "send_reminder",
        "collect_feedback": "collect_feedback",
        "schedule_next": "schedule_next"
    }
    
    return routing_map.get(action, "create_workflow")

async def create_workflow_node(state: dict):
    """Create interview workflow"""
    agent = InterviewCoordinatorAgent()
    candidate_id = state.get("candidate_id")
    job_id = state.get("job_id")
    rounds = state.get("rounds")
    
    workflow = await agent.create_interview_workflow(candidate_id, job_id, rounds)
    return {"workflow": workflow, "step": "__end__"}

async def send_reminder_node(state: dict):
    """Send interview reminder"""
    agent = InterviewCoordinatorAgent()
    interview_id = state.get("interview_id")
    
    result = await agent.send_reminder(interview_id)
    return {"result": result, "step": "__end__"}

async def collect_feedback_node(state: dict):
    """Collect interview feedback"""
    agent = InterviewCoordinatorAgent()
    interview_id = state.get("interview_id")
    feedback_data = state.get("feedback_data", {})
    
    result = await agent.collect_feedback(interview_id, feedback_data)
    return {"result": result, "step": "__end__"}

async def schedule_next_node(state: dict):
    """Schedule next round"""
    agent = InterviewCoordinatorAgent()
    workflow_id = state.get("workflow_id")
    
    result = await agent.schedule_next_round(workflow_id)
    return {"result": result, "step": "__end__"}

def build_interview_coordinator_graph():
    """Build LangGraph for interview coordination"""
    graph = StateGraph(dict)
    
    graph.add_node("create_workflow", create_workflow_node)
    graph.add_node("send_reminder", send_reminder_node)
    graph.add_node("collect_feedback", collect_feedback_node)
    graph.add_node("schedule_next", schedule_next_node)
    
    graph.add_conditional_edges(
        "__start__",
        route_interview_coordination,
        {
            "create_workflow": "create_workflow",
            "send_reminder": "send_reminder",
            "collect_feedback": "collect_feedback",
            "schedule_next": "schedule_next"
        }
    )
    
    graph.add_edge("create_workflow", "__end__")
    graph.add_edge("send_reminder", "__end__")
    graph.add_edge("collect_feedback", "__end__")
    graph.add_edge("schedule_next", "__end__")
    
    return graph.compile()

