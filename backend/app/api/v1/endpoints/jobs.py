"""Jobs endpoints"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from app.core.database import get_database
from bson import ObjectId

router = APIRouter()

def serialize_document(doc):
    """Serialize MongoDB document"""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

@router.get("/jobs")
async def get_jobs(
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all jobs with optional filtering"""
    db = get_database()
    collection = db["Jobs"]
    
    # Build query
    query = {}
    if department:
        query["Department"] = {"$regex": department, "$options": "i"}
    if position:
        query["Position"] = {"$regex": position, "$options": "i"}
    if status:
        query["Status"] = status
    
    # Pagination
    skip = (page - 1) * limit
    
    # Fetch data
    cursor = collection.find(query).skip(skip).limit(limit).sort("JobID", 1)
    jobs = await cursor.to_list(length=limit)
    total = await collection.count_documents(query)
    
    # Serialize
    for job in jobs:
        serialize_document(job)
    
    return {
        "success": True,
        "data": jobs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }
    }

@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get single job by JobID or _id"""
    db = get_database()
    collection = db["Jobs"]
    
    # Try JobID first, then _id (cast to ObjectId when possible)
    job = await collection.find_one({"JobID": job_id})
    if not job:
        try:
            job = await collection.find_one({"_id": ObjectId(job_id)})
        except Exception:
            job = None
    
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    serialize_document(job)
    
    return {
        "success": True,
        "data": job
    }

@router.get("/jobs/ids/list")
async def list_job_ids():
    """Get list of all job IDs and basic info (for quick reference)"""
    db = get_database()
    collection = db["Jobs"]
    
    cursor = collection.find(
        {},
        {
            "JobID": 1,
            "Position": 1,
            "Department": 1,
            "Status": 1,
            "_id": 1
        }
    ).sort("JobID", 1)
    
    jobs = await cursor.to_list(length=1000)
    
    # Format for easy reading
    job_list = []
    for job in jobs:
        job_list.append({
            "job_id": job.get("JobID") or str(job.get("_id", "")),
            "position": job.get("Position", "N/A"),
            "department": job.get("Department", "N/A"),
            "status": job.get("Status", "N/A"),
            "_id": str(job.get("_id", ""))
        })
    
    return {
        "success": True,
        "data": job_list,
        "count": len(job_list)
    }

class JobCreate(BaseModel):
    JobID: Optional[str] = Field(default=None, description="Human-friendly JobID e.g., JOB123")
    Position: str
    Department: str
    RequiredSkills: List[str] = []
    ExperienceRequired: int = 0
    EducationRequired: Optional[str] = ""
    Status: str = "Open"

@router.post("/jobs")
async def create_job(job: JobCreate):
    """Create a new job (provides data for screening UI)."""
    db = get_database()
    collection = db["Jobs"]

    if job.JobID:
        existing = await collection.find_one({"JobID": job.JobID})
        if existing:
            raise HTTPException(status_code=400, detail=f"JobID {job.JobID} already exists")

    doc = job.dict()
    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    serialize_document(created)
    return {"success": True, "data": created}

@router.post("/jobs/seed-basic")
async def seed_basic_jobs():
    """Seed a few sample jobs if none exist (for quick start)."""
    db = get_database()
    collection = db["Jobs"]

    existing_count = await collection.count_documents({})
    if existing_count > 0:
        return {"success": True, "message": "Jobs already exist", "count": existing_count}

    samples = [
        {
            "JobID": "JOB-AI-001",
            "Position": "AI Engineer",
            "Department": "AI",
            "RequiredSkills": ["Python", "Machine Learning", "Deep Learning"],
            "ExperienceRequired": 3,
            "EducationRequired": "Bachelors in CS or related",
            "Status": "Open",
        },
        {
            "JobID": "JOB-DA-001",
            "Position": "Data Analyst",
            "Department": "Data Analytics",
            "RequiredSkills": ["SQL", "Excel", "PowerBI"],
            "ExperienceRequired": 2,
            "EducationRequired": "Bachelors in Statistics or related",
            "Status": "Open",
        },
        {
            "JobID": "JOB-DS-001",
            "Position": "Data Scientist",
            "Department": "Data Science",
            "RequiredSkills": ["Python", "Pandas", "ML"],
            "ExperienceRequired": 4,
            "EducationRequired": "Masters preferred",
            "Status": "Open",
        },
    ]

    await collection.insert_many(samples)
    count = await collection.count_documents({})
    return {"success": True, "message": "Seeded sample jobs", "count": count}
