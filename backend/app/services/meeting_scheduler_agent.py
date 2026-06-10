"""
Meeting Scheduler Agent - Automated interview and meeting scheduling
"""
import asyncio
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Literal
from langgraph.graph import StateGraph
from app.core.config import settings
from app.core.database import get_database
from app.services.email_service import send_email
from app.services.llama_client import LlamaModel
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL

class MeetingSchedulerAgent:
    """Agent for automated meeting scheduling"""
    
    def __init__(self):
        self.model = LlamaModel(model_name=LLAMA_MODEL_NAME)
    
    async def parse_schedule_request(self, user_query: str) -> Dict[str, Any]:
        """Parse natural language scheduling request"""
        prompt = f"""Extract scheduling information from this request. Return JSON:
        {{
            "meeting_type": "interview" | "meeting" | "review",
            "participants": ["email1", "email2"],
            "duration_minutes": number,
            "preferred_date": "YYYY-MM-DD" or null,
            "preferred_time": "HH:MM" or null,
            "timezone": "string",
            "subject": "meeting subject",
            "notes": "additional notes"
        }}

        Request: {user_query}

        Return ONLY JSON:"""

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            text = re.sub(r'```json\s*', '', text)
            text = re.sub(r'```\s*', '', text)
            
            import json
            return json.loads(text)
        except Exception as e:
            logger.error(f"Error parsing schedule request: {e}")
            return {}
    
    async def find_available_slots(self, participants: List[str], duration: int, preferred_date: str = None) -> List[Dict[str, Any]]:
        """Find available time slots for participants"""
        db = get_database()
        
        # Get existing meetings for participants
        existing_meetings = await db["Interviews"].find({
            "$or": [
                {"Interviewer": {"$in": participants}},
                {"CandidateEmail": {"$in": participants}}
            ],
            "Status": {"$ne": "Cancelled"}
        }).to_list(length=None)
        
        # Get busy slots
        busy_slots = []
        for meeting in existing_meetings:
            if "InterviewDate" in meeting and "InterviewTime" in meeting:
                busy_slots.append({
                    "date": meeting["InterviewDate"],
                    "time": meeting["InterviewTime"]
                })
        
        # Generate available slots (business hours: 9 AM - 5 PM)
        available_slots = []
        start_date = datetime.now()
        if preferred_date:
            try:
                start_date = datetime.strptime(preferred_date, "%Y-%m-%d")
            except:
                pass
        
        # Generate slots for next 7 days
        for day_offset in range(7):
            current_date = start_date + timedelta(days=day_offset)
            
            # Skip weekends
            if current_date.weekday() >= 5:
                continue
            
            # Generate hourly slots (9 AM to 4 PM, accounting for duration)
            for hour in range(9, 17 - (duration // 60)):
                slot_time = current_date.replace(hour=hour, minute=0)
                
                # Check if slot conflicts
                is_busy = any(
                    slot["date"] == current_date.strftime("%Y-%m-%d") and
                    slot["time"] == slot_time.strftime("%H:%M")
                    for slot in busy_slots
                )
                
                if not is_busy:
                    available_slots.append({
                        "date": current_date.strftime("%Y-%m-%d"),
                        "time": slot_time.strftime("%H:%M"),
                        "datetime": slot_time.isoformat()
                    })
                    
                    # Limit to 5 options
                    if len(available_slots) >= 5:
                        break
            
            if len(available_slots) >= 5:
                break
        
        return available_slots[:5]
    
    async def schedule_meeting(self, schedule_info: Dict[str, Any], selected_slot: Dict[str, Any] = None) -> Dict[str, Any]:
        """Schedule the meeting"""
        db = get_database()
        
        if not selected_slot:
            # Get first available slot
            slots = await self.find_available_slots(
                schedule_info.get("participants", []),
                schedule_info.get("duration_minutes", 60),
                schedule_info.get("preferred_date")
            )
            if slots:
                selected_slot = slots[0]
            else:
                return {"error": "No available slots found"}
        
        # Create meeting record
        meeting = {
            "InterviewDate": selected_slot["date"],
            "InterviewTime": selected_slot["time"],
            "Duration": schedule_info.get("duration_minutes", 60),
            "MeetingType": schedule_info.get("meeting_type", "meeting"),
            "Participants": schedule_info.get("participants", []),
            "Subject": schedule_info.get("subject", "Scheduled Meeting"),
            "Status": "Scheduled",
            "CreatedAt": datetime.now().isoformat(),
            "Notes": schedule_info.get("notes", "")
        }
        
        # If it's an interview, link to candidate
        if schedule_info.get("meeting_type") == "interview":
            candidate_email = schedule_info.get("participants", [])[0] if schedule_info.get("participants") else None
            if candidate_email:
                candidate = await db["Candidates"].find_one({"Email": candidate_email})
                if candidate:
                    meeting["CandidateID"] = candidate.get("_id")
                    meeting["CandidateEmail"] = candidate_email
        
        result = await db["Interviews"].insert_one(meeting)
        meeting["_id"] = str(result.inserted_id)
        
        # Send calendar invites to all participants
        await self._send_calendar_invites(meeting, schedule_info.get("participants", []))
        
        return meeting
    
    async def _send_calendar_invites(self, meeting: Dict[str, Any], participants: List[str]):
        """Send calendar invites to participants"""
        subject = f"Meeting Scheduled: {meeting.get('Subject', 'Meeting')}"
        body = f"""Dear Participant,

A meeting has been scheduled:

Date: {meeting.get('InterviewDate')}
Time: {meeting.get('InterviewTime')}
Duration: {meeting.get('Duration')} minutes
Subject: {meeting.get('Subject')}

Please add this to your calendar.

Best regards,
TalentFlow Scheduling System"""

        for participant in participants:
            if "@" in str(participant):  # Is email
                await send_email(participant, subject, body)

# LangGraph Workflow
async def route_scheduling(state: dict) -> Literal["parse_request", "find_slots", "schedule", "confirm"]:
    step = state.get("step", "parse_request")
    return step

async def parse_request_node(state: dict):
    """Parse scheduling request"""
    agent = MeetingSchedulerAgent()
    user_query = state.get("user_query", "")
    
    schedule_info = await agent.parse_schedule_request(user_query)
    return {"schedule_info": schedule_info, "step": "find_slots"}

async def find_slots_node(state: dict):
    """Find available slots"""
    agent = MeetingSchedulerAgent()
    schedule_info = state.get("schedule_info", {})
    
    slots = await agent.find_available_slots(
        schedule_info.get("participants", []),
        schedule_info.get("duration_minutes", 60),
        schedule_info.get("preferred_date")
    )
    
    return {"available_slots": slots, "step": "schedule"}

async def schedule_node(state: dict):
    """Schedule the meeting"""
    agent = MeetingSchedulerAgent()
    schedule_info = state.get("schedule_info", {})
    slots = state.get("available_slots", [])
    
    # Use first available slot or user-selected slot
    selected_slot = state.get("selected_slot") or (slots[0] if slots else None)
    
    if not selected_slot:
        return {"error": "No available slots", "step": "__end__"}
    
    meeting = await agent.schedule_meeting(schedule_info, selected_slot)
    return {"meeting": meeting, "step": "__end__"}

def build_scheduling_graph():
    """Build LangGraph for meeting scheduling"""
    graph = StateGraph(dict)
    
    graph.add_node("parse_request", parse_request_node)
    graph.add_node("find_slots", find_slots_node)
    graph.add_node("schedule", schedule_node)
    
    graph.add_conditional_edges(
        "__start__",
        route_scheduling,
        {
            "parse_request": "parse_request",
            "find_slots": "find_slots",
            "schedule": "schedule"
        }
    )
    
    graph.add_edge("parse_request", "find_slots")
    graph.add_edge("find_slots", "schedule")
    graph.add_edge("schedule", "__end__")
    
    return graph.compile()

