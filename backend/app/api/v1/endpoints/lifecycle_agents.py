"""
Lifecycle agent endpoints: Policy Workflows, Probation Tracking, Intervention Playbooks, Controlled Actions
"""
from datetime import datetime, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.core.database import get_database
from bson import ObjectId

router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# --- Policy Workflows ---
class PolicyCampaignCreate(BaseModel):
    name: str
    policies: List[str] = Field(default_factory=list)
    employee_ids: Optional[List[str]] = None
    due_date: Optional[str] = None


class PolicyAcknowledge(BaseModel):
    campaign_id: str
    employee_id: str
    policy_name: str


@router.post("/policy-workflows/campaign")
async def create_policy_campaign(payload: PolicyCampaignCreate):
    """Create a policy acknowledgment campaign"""
    db = get_database()
    col = db["PolicyCampaign"]
    doc = {
        "name": payload.name,
        "policies": payload.policies or [],
        "employee_ids": payload.employee_ids or [],
        "due_date": payload.due_date,
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
    }
    r = await col.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return {"success": True, "data": serialize_doc(doc)}


@router.get("/policy-workflows/campaigns")
async def list_policy_campaigns(status: Optional[str] = None):
    """List policy campaigns"""
    db = get_database()
    col = db["PolicyCampaign"]
    q = {} if not status else {"status": status}
    cursor = col.find(q).sort("created_at", -1).limit(50)
    items = await cursor.to_list(length=50)
    for d in items:
        serialize_doc(d)
    return {"success": True, "data": items}


@router.post("/policy-workflows/acknowledge")
async def acknowledge_policy(payload: PolicyAcknowledge):
    """Record policy acknowledgment by employee"""
    db = get_database()
    col = db["PolicyAcknowledgment"]
    doc = {
        "campaign_id": payload.campaign_id,
        "employee_id": payload.employee_id,
        "policy_name": payload.policy_name,
        "status": "completed",
        "acknowledged_at": datetime.utcnow().isoformat(),
    }
    r = await col.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return {"success": True, "data": serialize_doc(doc)}


@router.get("/policy-workflows/status")
async def get_campaign_status(campaign_id: str):
    """Get campaign completion status"""
    db = get_database()
    campaign = await db["PolicyCampaign"].find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    acks = await db["PolicyAcknowledgment"].find({"campaign_id": campaign_id}).to_list(length=1000)
    total = len(campaign.get("policies", [])) * max(1, len(campaign.get("employee_ids", [])))
    completed = len(acks)
    serialize_doc(campaign)
    return {"success": True, "data": {"campaign": campaign, "completed": completed, "total": total}}


# --- Probation Tracking ---
PROBATION_DAYS = 90


@router.get("/probation/list")
async def list_probation_employees():
    """List employees currently in probation (joined within last 90 days)"""
    db = get_database()
    employees = await db["employee"].find({}).to_list(length=500)
    today = datetime.utcnow().date()
    results = []
    for emp in employees:
        join_raw = emp.get("DateOfJoining") or emp.get("dateOfJoining") or emp.get("JoiningDate")
        if not join_raw:
            continue
        try:
            if isinstance(join_raw, datetime):
                join_date = join_raw.date()
            else:
                join_date = datetime.fromisoformat(str(join_raw).replace("Z", "+00:00")).date()
        except Exception:
            continue
        prob_end = join_date + timedelta(days=PROBATION_DAYS)
        days_remaining = (prob_end - today).days
        if days_remaining < 0:
            continue  # past probation
        results.append({
            "employee_id": emp.get("Employee_ID") or emp.get("EmployeeID") or str(emp.get("_id")),
            "name": emp.get("Name", "Unknown"),
            "department": emp.get("Department", ""),
            "position": emp.get("Position", ""),
            "join_date": str(join_date),
            "probation_end": str(prob_end),
            "days_remaining": days_remaining,
        })
    results.sort(key=lambda x: x["days_remaining"])
    return {"success": True, "data": results}


@router.post("/probation/confirm")
async def confirm_probation(employee_id: str = Query(...)):
    """Mark employee as confirmed (passed probation)"""
    db = get_database()
    r = await db["employee"].update_one(
        {"$or": [{"Employee_ID": employee_id}, {"EmployeeID": employee_id}]},
        {"$set": {"ProbationStatus": "confirmed", "ProbationConfirmedAt": datetime.utcnow().isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"success": True, "message": f"Probation confirmed for {employee_id}"}


# --- Intervention Playbooks ---
PLAYBOOKS_BY_RISK = {
    "High": [
        {"id": "retention_package", "title": "Retention Package", "description": "Prepare retention offer (salary, role, benefits review)"},
        {"id": "exec_review", "title": "Executive Review", "description": "Schedule 1:1 with senior leadership"},
        {"id": "career_plan", "title": "Career Development Plan", "description": "Create structured career growth roadmap"},
        {"id": "checkin_weekly", "title": "Weekly Check-ins", "description": "Schedule recurring weekly 1:1s"},
    ],
    "Medium": [
        {"id": "checkin_biweekly", "title": "Bi-weekly Check-ins", "description": "Schedule 1:1 every 2 weeks"},
        {"id": "career_plan", "title": "Career Development Plan", "description": "Discuss growth opportunities"},
        {"id": "engagement_survey", "title": "Engagement Survey", "description": "Send pulse survey to understand concerns"},
    ],
    "Low": [
        {"id": "optional_checkin", "title": "Optional Check-in", "description": "Offer informal catch-up if needed"},
    ],
}


@router.get("/interventions/playbooks")
async def get_intervention_playbooks():
    """Get suggested intervention playbooks by risk level"""
    return {"success": True, "data": PLAYBOOKS_BY_RISK}


@router.get("/interventions/high-risk")
async def get_high_risk_employees():
    """Get high attrition-risk employees for intervention"""
    db = get_database()
    try:
        cursor = db["Attrition"].find({"AttritionRisk": {"$gte": 0.5}}).sort("AttritionRisk", -1).limit(50)
        items = await cursor.to_list(length=50)
    except Exception:
        items = []
    emp_ids = [d.get("EmployeeID") or d.get("Employee_ID") for d in items if d.get("EmployeeID") or d.get("Employee_ID")]
    emp_map = {}
    if emp_ids:
        cursor = db["employee"].find({"$or": [{"Employee_ID": {"$in": emp_ids}}, {"EmployeeID": {"$in": emp_ids}}]})
        emps = await cursor.to_list(length=100)
        for e in emps:
            eid = e.get("Employee_ID") or e.get("EmployeeID")
            emp_map[eid] = e.get("Name", "Unknown")
    results = []
    for d in items:
        eid = d.get("EmployeeID") or d.get("Employee_ID")
        risk = float(d.get("AttritionRisk", 0))
        results.append({
            "employee_id": eid,
            "name": emp_map.get(eid, "Unknown"),
            "risk_score": round(risk * 100, 1),
            "risk_level": "High" if risk >= 0.7 else "Medium" if risk >= 0.5 else "Low",
        })
    return {"success": True, "data": results}


class InterventionApply(BaseModel):
    employee_id: str
    intervention_type: str
    notes: Optional[str] = None


@router.post("/interventions/apply")
async def apply_intervention(payload: InterventionApply):
    """Record intervention applied to employee"""
    db = get_database()
    col = db["Intervention"]
    doc = {
        "employee_id": payload.employee_id,
        "intervention_type": payload.intervention_type,
        "notes": payload.notes,
        "status": "applied",
        "applied_at": datetime.utcnow().isoformat(),
    }
    r = await col.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return {"success": True, "data": serialize_doc(doc)}


# --- Controlled Actions (Approval Workflows) ---
class ActionRequestCreate(BaseModel):
    action_type: str = Field(..., description="salary_change, role_update, termination")
    employee_id: str
    payload: dict = Field(default_factory=dict)
    requested_by: Optional[str] = None


@router.post("/actions/request")
async def create_action_request(payload: ActionRequestCreate):
    """Create an action request requiring approval"""
    db = get_database()
    col = db["ActionRequest"]
    doc = {
        "action_type": payload.action_type,
        "employee_id": payload.employee_id,
        "payload": payload.payload,
        "requested_by": payload.requested_by or "system",
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    r = await col.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return {"success": True, "data": serialize_doc(doc)}


@router.get("/actions/pending")
async def list_pending_actions():
    """List pending action requests"""
    db = get_database()
    col = db["ActionRequest"]
    cursor = col.find({"status": "pending"}).sort("created_at", -1).limit(50)
    items = await cursor.to_list(length=50)
    for d in items:
        serialize_doc(d)
    return {"success": True, "data": items}


@router.post("/actions/{request_id}/approve")
async def approve_action(request_id: str, approved_by: Optional[str] = None):
    """Approve an action request"""
    db = get_database()
    col = db["ActionRequest"]
    r = await col.update_one(
        {"_id": ObjectId(request_id), "status": "pending"},
        {"$set": {"status": "approved", "approved_by": approved_by or "system", "approved_at": datetime.utcnow().isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    return {"success": True, "message": "Action approved"}


@router.post("/actions/{request_id}/reject")
async def reject_action(request_id: str, reason: Optional[str] = None):
    """Reject an action request"""
    db = get_database()
    col = db["ActionRequest"]
    r = await col.update_one(
        {"_id": ObjectId(request_id), "status": "pending"},
        {"$set": {"status": "rejected", "reject_reason": reason, "rejected_at": datetime.utcnow().isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    return {"success": True, "message": "Action rejected"}
