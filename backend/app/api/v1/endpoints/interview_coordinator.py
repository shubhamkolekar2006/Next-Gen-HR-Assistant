"""Interview Coordinator endpoints"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.services.interview_coordinator_agent import InterviewCoordinatorAgent, build_interview_coordinator_graph
from bson import ObjectId

router = APIRouter()

class CreateWorkflowRequest(BaseModel):
    candidate_id: str
    job_id: str
    rounds: Optional[List[str]] = None

class CollectFeedbackRequest(BaseModel):
    interview_id: str
    interviewer: str
    feedback: str

class ScheduleNextRoundRequest(BaseModel):
    workflow_id: str

@router.post("/interview/create-workflow")
async def create_interview_workflow(request: CreateWorkflowRequest):
    """Create multi-round interview workflow"""
    try:
        agent = InterviewCoordinatorAgent()
        workflow = await agent.create_interview_workflow(
            request.candidate_id,
            request.job_id,
            request.rounds
        )
        if workflow.get("error"):
            return {"success": False, "message": workflow.get("error"), "data": None}
        return {"success": True, "data": workflow}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SendReminderRequest(BaseModel):
    interview_id: str
    hours_before: Optional[int] = 24

@router.post("/interview/send-reminder")
async def send_interview_reminder(request: SendReminderRequest):
    """Send interview reminder"""
    try:
        agent = InterviewCoordinatorAgent()
        result = await agent.send_reminder(request.interview_id, request.hours_before)
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interview/collect-feedback")
async def collect_interview_feedback(request: CollectFeedbackRequest):
    """Collect and analyze interview feedback"""
    try:
        agent = InterviewCoordinatorAgent()
        result = await agent.collect_feedback(
            request.interview_id,
            {
                "interviewer": request.interviewer,
                "feedback": request.feedback
            }
        )
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interview/schedule-next")
async def schedule_next_round(request: ScheduleNextRoundRequest):
    """Schedule next round in interview workflow"""
    try:
        agent = InterviewCoordinatorAgent()
        result = await agent.schedule_next_round(request.workflow_id)
        if result.get("error"):
            return {"success": False, "message": result.get("error"), "data": None}
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interview/workflows")
async def get_workflows(
    candidate_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """Get interview workflows"""
    from app.core.database import get_database
    
    db = get_database()
    query = {}
    if candidate_id:
        query["candidate_id"] = candidate_id
    if status:
        query["status"] = status
    
    cursor = db["Interview_Workflows"].find(query).sort("created_at", -1)
    workflows = await cursor.to_list(length=100)
    
    for wf in workflows:
        wf["_id"] = str(wf["_id"])
    
    return {"success": True, "data": workflows}

@router.get("/interview/list")
async def list_interviews(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """List available interviews with their IDs"""
    from app.core.database import get_database
    
    db = get_database()
    query = {}
    if status:
        query["Status"] = status
    
    cursor = db["Interviews"].find(query).sort("InterviewDate", -1).limit(limit)
    interviews = await cursor.to_list(length=limit)
    
    result = []
    for interview in interviews:
        result.append({
            "_id": str(interview.get("_id")),
            "InterviewID": interview.get("InterviewID", "N/A"),
            "Subject": interview.get("Subject", "N/A"),
            "InterviewDate": interview.get("InterviewDate", "N/A"),
            "InterviewTime": interview.get("InterviewTime", "N/A"),
            "Status": interview.get("Status", "N/A"),
            "CandidateEmail": interview.get("CandidateEmail", "N/A"),
            "Duration": interview.get("Duration", 60)
        })
    
    return {"success": True, "data": result}

@router.get("/interview/debug-lookup")
async def debug_interview_lookup(interview_id: str = Query(..., description="Interview ID to lookup")):
    """Debug endpoint to test interview lookup"""
    from app.core.database import get_database
    import re
    
    db = get_database()
    interview_id = interview_id.strip()
    
    results = {
        "search_id": interview_id,
        "lookups": {}
    }
    
    # Try ObjectId
    try:
        obj_id_result = await db["Interviews"].find_one({"_id": ObjectId(interview_id)})
        results["lookups"]["ObjectId"] = {"found": obj_id_result is not None, "id": str(obj_id_result.get("_id")) if obj_id_result else None}
    except Exception as e:
        results["lookups"]["ObjectId"] = {"found": False, "error": str(e)}
    
    # Try InterviewID variations
    for field_name in ["InterviewID", "interviewID", "interview_id"]:
        result = await db["Interviews"].find_one({field_name: interview_id})
        results["lookups"][field_name] = {
            "found": result is not None,
            "id": str(result.get("_id")) if result else None,
            "value": result.get(field_name) if result else None
        }
    
    # Try case-insensitive regex
    regex_result = await db["Interviews"].find_one({
        "InterviewID": {"$regex": f"^{re.escape(interview_id)}$", "$options": "i"}
    })
    results["lookups"]["InterviewID_regex"] = {
        "found": regex_result is not None,
        "id": str(regex_result.get("_id")) if regex_result else None
    }
    
    # Get sample interview to show structure
    sample = await db["Interviews"].find_one({})
    if sample:
        results["sample_interview"] = {
            "fields": list(sample.keys()),
            "InterviewID_value": sample.get("InterviewID"),
            "InterviewID_type": type(sample.get("InterviewID")).__name__
        }
    
    return {"success": True, "data": results}

@router.get("/interview/inspect-db")
async def inspect_interviews_db(limit: int = Query(5, ge=1, le=50)):
    """Inspect Interviews collection structure and data"""
    from app.core.database import get_database
    
    db = get_database()
    
    # Get sample interviews
    interviews = await db["Interviews"].find({}).limit(limit).to_list(length=limit)
    
    result = {
        "total_found": len(interviews),
        "interviews": []
    }
    
    for interview in interviews:
        interview_data = {
            "_id": str(interview.get("_id")),
            "all_fields": {}
        }
        
        # Get all fields and their values/types
        for key, value in interview.items():
            interview_data["all_fields"][key] = {
                "value": str(value) if value is not None else None,
                "type": type(value).__name__,
                "raw_value": value
            }
        
        # Specifically check for ID-related fields
        id_fields = {}
        for field in ["InterviewID", "interviewID", "interview_id", "Interview_Id", "ID", "id"]:
            if field in interview:
                id_fields[field] = {
                    "value": interview[field],
                    "type": type(interview[field]).__name__
                }
        
        interview_data["id_fields"] = id_fields
        result["interviews"].append(interview_data)
    
    # Also get collection stats
    try:
        count = await db["Interviews"].count_documents({})
        result["total_in_collection"] = count
    except Exception as e:
        result["total_in_collection"] = f"Error: {str(e)}"
    
    return {"success": True, "data": result}

