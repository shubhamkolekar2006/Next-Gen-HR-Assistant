"""Onboarding automation endpoints"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.onboarding_agent import OnboardingAgent
from app.core.database import get_database

router = APIRouter()

class CreateOnboardingRequest(BaseModel):
    employee_id: str
    employee_data: Dict[str, Any]

class UpdateTaskRequest(BaseModel):
    onboarding_id: str
    task_id: str
    status: str

class AssignBuddyRequest(BaseModel):
    onboarding_id: str
    buddy_employee_id: str

class ScheduleOrientationRequest(BaseModel):
    onboarding_id: str
    preferred_date: str
    preferred_time: str

class UpdateDocumentRequest(BaseModel):
    onboarding_id: str
    document_name: str
    status: str  # pending, submitted, verified

@router.post("/onboarding/create")
async def create_onboarding(request: CreateOnboardingRequest):
    """Create onboarding plan for new employee"""
    try:
        agent = OnboardingAgent()
        onboarding = await agent.create_onboarding_plan(
            request.employee_id,
            request.employee_data
        )
        return {"success": True, "data": onboarding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/onboarding/update-task")
async def update_task(request: UpdateTaskRequest):
    """Update onboarding task status"""
    try:
        agent = OnboardingAgent()
        result = await agent.update_task_status(
            request.onboarding_id,
            request.task_id,
            request.status
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/onboarding/assign-buddy")
async def assign_buddy(request: AssignBuddyRequest):
    """Assign buddy/mentor to new employee"""
    try:
        agent = OnboardingAgent()
        result = await agent.assign_buddy(
            request.onboarding_id,
            request.buddy_employee_id
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SendOrientationEmailRequest(BaseModel):
    onboarding_id: str

@router.post("/onboarding/send-orientation-email")
async def send_orientation_availability_email(request: SendOrientationEmailRequest):
    """Send email to check employee availability for orientation"""
    try:
        agent = OnboardingAgent()
        result = await agent.send_orientation_availability_email(request.onboarding_id)
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/onboarding/schedule-orientation")
async def schedule_orientation(request: ScheduleOrientationRequest):
    """Schedule orientation meeting based on employee response"""
    try:
        agent = OnboardingAgent()
        result = await agent.schedule_orientation_meeting(
            request.onboarding_id,
            request.preferred_date,
            request.preferred_time
        )
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SendDocumentGuidanceRequest(BaseModel):
    onboarding_id: str

@router.post("/onboarding/send-document-guidance")
async def send_document_guidance(request: SendDocumentGuidanceRequest):
    """Send email with required documents list and guidance"""
    try:
        agent = OnboardingAgent()
        result = await agent.send_document_guidance(request.onboarding_id)
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/onboarding/update-document")
async def update_document_status(request: UpdateDocumentRequest):
    """Update document submission status"""
    try:
        agent = OnboardingAgent()
        result = await agent.update_document_status(
            request.onboarding_id,
            request.document_name,
            request.status
        )
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/onboarding")
async def get_onboarding(employee_id: Optional[str] = None, status: Optional[str] = None):
    """Get onboarding records"""
    db = get_database()
    
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    
    cursor = db["Onboarding"].find(query).sort("created_at", -1)
    onboarding_records = await cursor.to_list(length=100)
    
    for record in onboarding_records:
        record["_id"] = str(record["_id"])
    
    return {"success": True, "data": onboarding_records}

