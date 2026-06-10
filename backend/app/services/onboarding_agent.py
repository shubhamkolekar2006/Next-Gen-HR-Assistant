"""
Onboarding Automation Agent - Manages employee onboarding workflows
"""
import json
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.core.config import settings
from app.core.database import get_database
from app.services.email_service import send_email
from app.services.document_generation_agent import DocumentGenerationAgent
from app.services.llama_client import LlamaModel
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL
model = LlamaModel(model_name=LLAMA_MODEL_NAME)

class OnboardingAgent:
    """Agent for automating onboarding processes"""
    
    def __init__(self):
        self.model = model
        self.doc_gen = DocumentGenerationAgent()
    
    async def create_onboarding_plan(self, employee_id: str, employee_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create personalized onboarding plan"""
        db = get_database()
        
        # Generate onboarding plan using AI
        prompt = f"""Create a comprehensive onboarding plan for a new employee. Include:

1. Pre-joining tasks (document collection, background checks)
2. Day 1 activities (welcome, orientation, workspace setup)
3. Week 1 tasks (team introductions, training, access setup)
4. Month 1 goals (training completion, first projects)
5. Required documents and forms
6. Training modules and schedules
7. Buddy/mentor assignment
8. Check-in milestones

Employee Information:
{json.dumps(employee_data, indent=2)}

Generate a structured onboarding plan in JSON format:"""

        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            text = re.sub(r'```json\s*', '', text)
            text = re.sub(r'```\s*', '', text)
            
            plan_data = json.loads(text)
        except Exception as e:
            logger.error(f"Error generating plan: {e}")
            # Default plan
            plan_data = {
                "tasks": [
                    {"task": "Complete documentation", "due_date": "Day 1", "status": "pending"},
                    {"task": "Attend orientation", "due_date": "Day 1", "status": "pending"},
                    {"task": "Set up workspace", "due_date": "Day 1", "status": "pending"},
                    {"task": "Complete training modules", "due_date": "Week 1", "status": "pending"},
                    {"task": "Meet with team", "due_date": "Week 1", "status": "pending"}
                ]
            }
        
        # Create onboarding record
        onboarding = {
            "employee_id": employee_id,
            "employee_name": employee_data.get("name", ""),
            "employee_email": employee_data.get("email", ""),
            "department": employee_data.get("department", ""),
            "position": employee_data.get("position", ""),
            "start_date": employee_data.get("start_date", datetime.now().isoformat()),
            "plan": plan_data,
            "tasks": plan_data.get("tasks", []),
            "status": "active",
            "completion_percentage": 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        result = await db["Onboarding"].insert_one(onboarding)
        onboarding["_id"] = str(result.inserted_id)
        
        # Also add to the main employee list if not already there
        existing_emp = await db["employee"].find_one({
            "$or": [{"Employee_ID": employee_id}, {"EmployeeID": employee_id}]
        })
        
        if not existing_emp:
            emp_record = {
                "Employee_ID": employee_id,
                "EmployeeID": employee_id,
                "Name": employee_data.get("name", ""),
                "Email": employee_data.get("email", ""),
                "Department": employee_data.get("department", ""),
                "Position": employee_data.get("position", ""),
                "Status": "Onboarding",
                "JoinDate": employee_data.get("start_date", datetime.now().isoformat())
            }
            if "salary" in employee_data:
                emp_record["Salary"] = employee_data.get("salary")
                
            await db["employee"].insert_one(emp_record)
            logger.info(f"Added {employee_data.get('name', 'employee')} to the main employee collection.")
        
        # Generate and send welcome email
        await self._send_welcome_email(employee_data)
        
        # Generate offer letter if not exists
        if employee_data.get("generate_offer_letter"):
            await self.doc_gen.generate_offer_letter(
                employee_data,
                {"job_id": employee_data.get("job_id", "")},
                {"salary": employee_data.get("salary", "")}
            )
        
        return onboarding
    
    async def _send_welcome_email(self, employee_data: Dict[str, Any]):
        """Send welcome email to new employee"""
        subject = f"Welcome to the Team - {employee_data.get('name', 'New Employee')}!"
        body = f"""Dear {employee_data.get('name', 'New Employee')},

Welcome to our organization! We are excited to have you join our team.

Your onboarding process has been initiated. Here's what to expect:

1. You will receive your employee ID and credentials
2. Complete required documentation
3. Attend orientation session
4. Meet your team and manager
5. Begin training modules

Your start date: {employee_data.get('start_date', 'TBD')}
Position: {employee_data.get('position', 'N/A')}
Department: {employee_data.get('department', 'N/A')}

If you have any questions, please don't hesitate to reach out.

Best regards,
TalentFlow HR Team"""
        
        await send_email(
            employee_data.get("email", ""),
            subject,
            body
        )
    
    async def update_task_status(self, onboarding_id: str, task_id: str, status: str) -> Dict[str, Any]:
        """Update onboarding task status"""
        db = get_database()
        
        onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        tasks = onboarding.get("tasks", [])
        for task in tasks:
            if task.get("id") == task_id or task.get("task") == task_id:
                task["status"] = status
                task["completed_at"] = datetime.now().isoformat() if status == "completed" else None
                break
        
        # Calculate completion percentage
        total_tasks = len(tasks)
        completed_tasks = sum(1 for t in tasks if t.get("status") == "completed")
        completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Update status if all tasks complete
        if completion_percentage == 100:
            onboarding["status"] = "completed"
        
        onboarding["tasks"] = tasks
        onboarding["completion_percentage"] = completion_percentage
        onboarding["updated_at"] = datetime.now().isoformat()
        
        await db["Onboarding"].update_one(
            {"_id": onboarding_id},
            {"$set": onboarding}
        )
        
        return {
            "success": True,
            "onboarding": onboarding
        }
    
    async def assign_buddy(self, onboarding_id: str, buddy_employee_id: str) -> Dict[str, Any]:
        """Assign a buddy/mentor to new employee"""
        db = get_database()
        
        onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        buddy = await db["employee"].find_one({"Employee_ID": buddy_employee_id})
        if not buddy:
            return {"error": "Buddy employee not found"}
        
        # Update onboarding
        await db["Onboarding"].update_one(
            {"_id": onboarding_id},
            {
                "$set": {
                    "buddy_id": buddy_employee_id,
                    "buddy_name": buddy.get("Name", ""),
                    "buddy_email": buddy.get("Email", ""),
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        # Notify buddy
        subject = f"Onboarding Buddy Assignment - {onboarding.get('employee_name', 'New Employee')}"
        body = f"""Dear {buddy.get('Name', 'Colleague')},

You have been assigned as an onboarding buddy for:

Name: {onboarding.get('employee_name', 'New Employee')}
Position: {onboarding.get('position', 'N/A')}
Department: {onboarding.get('department', 'N/A')}
Start Date: {onboarding.get('start_date', 'TBD')}

Please help them get acclimated to the team and organization.

Best regards,
TalentFlow HR Team"""
        
        await send_email(buddy.get("Email", ""), subject, body)
        
        return {"success": True, "buddy": buddy}
    
    async def send_orientation_availability_email(self, onboarding_id: str) -> Dict[str, Any]:
        """Send email to check employee availability for orientation"""
        db = get_database()
        
        try:
            onboarding = await db["Onboarding"].find_one({"_id": ObjectId(onboarding_id)})
        except Exception:
            onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        employee_email = onboarding.get("employee_email", "")
        employee_name = onboarding.get("employee_name", "New Employee")
        
        subject = "Orientation Session - Please Confirm Your Availability"
        body = f"""Dear {employee_name},

We would like to schedule your orientation session. Please reply to this email with your preferred dates and times for the orientation.

Suggested dates (please let us know which works best):
- Option 1: {datetime.now().strftime('%B %d, %Y')} at 10:00 AM
- Option 2: {(datetime.now() + timedelta(days=1)).strftime('%B %d, %Y')} at 2:00 PM
- Option 3: {(datetime.now() + timedelta(days=2)).strftime('%B %d, %Y')} at 10:00 AM

Or suggest your preferred date and time.

Please reply within 48 hours so we can finalize the schedule.

Best regards,
TalentFlow HR Team"""
        
        await send_email(employee_email, subject, body)
        
        # Update onboarding record
        try:
            obj_id = ObjectId(onboarding_id)
        except Exception:
            obj_id = onboarding_id
        await db["Onboarding"].update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "orientation_email_sent": True,
                    "orientation_email_sent_at": datetime.now().isoformat(),
                    "orientation_status": "awaiting_response",
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Orientation availability email sent successfully"
        }
    
    async def schedule_orientation_meeting(self, onboarding_id: str, preferred_date: str, preferred_time: str) -> Dict[str, Any]:
        """Schedule orientation meeting based on employee response"""
        from app.services.meeting_scheduler_agent import MeetingSchedulerAgent
        
        db = get_database()
        try:
            onboarding = await db["Onboarding"].find_one({"_id": ObjectId(onboarding_id)})
        except Exception:
            onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        employee_email = onboarding.get("employee_email", "")
        employee_name = onboarding.get("employee_name", "New Employee")
        
        # Use meeting scheduler agent
        scheduler = MeetingSchedulerAgent()
        
        schedule_info = {
            "meeting_type": "orientation",
            "participants": [employee_email, "hr@company.com"],
            "duration_minutes": 120,  # 2 hours for orientation
            "subject": f"Orientation Session - {employee_name}",
            "preferred_date": preferred_date,
            "preferred_time": preferred_time,
            "notes": "New employee orientation session"
        }
        
        # Find available slots
        slots = await scheduler.find_available_slots(
            schedule_info.get("participants", []),
            schedule_info.get("duration_minutes", 120),
            preferred_date
        )
        
        if not slots:
            return {"error": "No available slots found for the requested date"}
        
        # Schedule meeting
        meeting = await scheduler.schedule_meeting(schedule_info, slots[0])
        
        # Update onboarding record
        try:
            obj_id = ObjectId(onboarding_id)
        except Exception:
            obj_id = onboarding_id
        await db["Onboarding"].update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "orientation_scheduled": True,
                    "orientation_date": meeting.get("InterviewDate"),
                    "orientation_time": meeting.get("InterviewTime"),
                    "orientation_meeting_id": meeting.get("_id"),
                    "orientation_status": "scheduled",
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "meeting": meeting,
            "message": "Orientation meeting scheduled successfully"
        }
    
    async def send_document_guidance(self, onboarding_id: str) -> Dict[str, Any]:
        """Send email with required documents list and guidance"""
        db = get_database()
        
        try:
            onboarding = await db["Onboarding"].find_one({"_id": ObjectId(onboarding_id)})
        except Exception:
            onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        employee_email = onboarding.get("employee_email", "")
        employee_name = onboarding.get("employee_name", "New Employee")
        
        required_documents = [
            "Government-issued ID (Passport/Driver's License)",
            "Social Security Card or equivalent",
            "Educational certificates and transcripts",
            "Previous employment references",
            "Bank account details for payroll",
            "Emergency contact information",
            "Signed employment contract",
            "Tax forms (W-4 or equivalent)"
        ]
        
        subject = "Required Documents for Onboarding - Action Required"
        body = f"""Dear {employee_name},

To complete your onboarding process, please submit the following required documents:

{chr(10).join([f"{i+1}. {doc}" for i, doc in enumerate(required_documents)])}

Please submit these documents:
- Via email: Send scanned copies to hr@company.com
- In person: Bring original documents on your first day
- Deadline: Before your start date: {onboarding.get('start_date', 'TBD')}

You can track your document submission status in your onboarding portal.

If you have any questions about these documents, please don't hesitate to contact us.

Best regards,
TalentFlow HR Team"""
        
        await send_email(employee_email, subject, body)
        
        # Initialize document tracking
        document_tracking = {
            doc: {"status": "pending", "submitted_at": None, "verified": False}
            for doc in required_documents
        }
        
        # Update onboarding record
        try:
            obj_id = ObjectId(onboarding_id)
        except Exception:
            obj_id = onboarding_id
        await db["Onboarding"].update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "document_guidance_sent": True,
                    "document_guidance_sent_at": datetime.now().isoformat(),
                    "required_documents": required_documents,
                    "document_tracking": document_tracking,
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Document guidance email sent successfully",
            "required_documents": required_documents
        }
    
    async def update_document_status(self, onboarding_id: str, document_name: str, status: str) -> Dict[str, Any]:
        """Update document submission status"""
        db = get_database()
        
        try:
            onboarding = await db["Onboarding"].find_one({"_id": ObjectId(onboarding_id)})
        except Exception:
            onboarding = await db["Onboarding"].find_one({"_id": onboarding_id})
        if not onboarding:
            return {"error": "Onboarding record not found"}
        
        document_tracking = onboarding.get("document_tracking", {})
        
        if document_name not in document_tracking:
            return {"error": f"Document '{document_name}' not found in tracking list"}
        
        document_tracking[document_name]["status"] = status
        if status == "submitted":
            document_tracking[document_name]["submitted_at"] = datetime.now().isoformat()
        elif status == "verified":
            document_tracking[document_name]["verified"] = True
            document_tracking[document_name]["verified_at"] = datetime.now().isoformat()
        
        # Calculate document completion
        total_docs = len(document_tracking)
        submitted_docs = sum(1 for doc in document_tracking.values() if doc.get("status") == "submitted")
        verified_docs = sum(1 for doc in document_tracking.values() if doc.get("verified") == True)
        
        document_completion = (verified_docs / total_docs * 100) if total_docs > 0 else 0
        
        # Update onboarding record
        try:
            obj_id = ObjectId(onboarding_id)
        except Exception:
            obj_id = onboarding_id
        await db["Onboarding"].update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "document_tracking": document_tracking,
                    "document_completion_percentage": document_completion,
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "document_tracking": document_tracking,
            "document_completion_percentage": document_completion
        }

