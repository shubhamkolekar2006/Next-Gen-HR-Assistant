"""
Agent endpoints for agentic HR features
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.resume_screening_agent import ResumeScreeningAgent, build_screening_graph
from app.services.meeting_scheduler_agent import MeetingSchedulerAgent, build_scheduling_graph
from app.core.database import get_database
from app.services.ai_service import handle_db_operations, match_db_fields_async
from app.core.config import settings
from app.services.llama_client import LlamaModel
import json
import re
import logging

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL

router = APIRouter()

# Resume Screening
class ResumeScreeningRequest(BaseModel):
    resume_text: str
    job_id: Optional[str] = None
    job_role: Optional[str] = None
    department: Optional[str] = None


class ResumeItem(BaseModel):
    filename: str
    resume_text: str


class ResumeBatchScreeningRequest(BaseModel):
    resumes: List[ResumeItem]
    job_id: Optional[str] = None
    job_role: Optional[str] = None
    department: Optional[str] = None


class ScheduleMeetingRequest(BaseModel):
    user_query: str
    participants: Optional[List[str]] = None
    duration_minutes: Optional[int] = 60

@router.post("/agents/resume-screening")
async def screen_resume(request: ResumeScreeningRequest):
    """Screen a resume against job requirements"""
    try:
        agent = ResumeScreeningAgent()
        job_identifier = request.job_id or request.job_role
        department = (request.department or '').strip()
        if not job_identifier:
            db = get_database()
            if department and department.upper() != 'N/A':
                # Resolve by department
                doc = await db["Jobs"].find_one({"Department": department, "Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({"Department": department})
            else:
                # Fallback: pick any open job
                doc = await db["Jobs"].find_one({"Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({})
            if not doc:
                return {"success": False, "message": f"No jobs available for screening", "data": None}
            job_identifier = doc.get("JobID") or doc.get("Position") or str(doc.get("_id"))
            department = doc.get("Department", department)
        if not job_identifier:
            return {"success": False, "message": "No job selected. Provide job_id or department.", "data": None}

        result = await agent.screen_resume(
            request.resume_text,
            job_identifier,
            job_role=request.job_role,
            department=department or None
        )
        
        # Check if result contains an error
        if isinstance(result, dict) and result.get("error"):
            return {
                "success": False,
                "message": result.get("error"),
                "data": None
            }
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in screen_resume: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/resume-screening/batch")
async def screen_resumes_batch(request: ResumeBatchScreeningRequest):
    """Screen up to 50 resumes in one request and return ranked scores."""
    try:
        if not request.resumes:
            raise HTTPException(status_code=400, detail="No resumes provided")
        if len(request.resumes) < 2:
            raise HTTPException(status_code=400, detail="Bulk screening requires at least 2 resumes")
        if len(request.resumes) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 resumes allowed per batch")

        agent = ResumeScreeningAgent()
        job_identifier = request.job_id or request.job_role
        department = (request.department or "").strip()

        if not job_identifier:
            db = get_database()
            if department and department.upper() != "N/A":
                doc = await db["Jobs"].find_one({"Department": department, "Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({"Department": department})
            else:
                doc = await db["Jobs"].find_one({"Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({})
            if not doc:
                return {
                    "success": False,
                    "message": "No jobs available for screening",
                    "data": None,
                }
            job_identifier = doc.get("JobID") or doc.get("Position") or str(doc.get("_id"))
            department = doc.get("Department", department)

        if not job_identifier:
            return {
                "success": False,
                "message": "No job selected. Provide job_id or department.",
                "data": None,
            }

        results: List[Dict[str, Any]] = []

        for item in request.resumes:
            single = await agent.screen_resume(
                item.resume_text,
                job_identifier,
                job_role=request.job_role,
                department=department or None,
            )

            if isinstance(single, dict) and single.get("error"):
                results.append({
                    "filename": item.filename,
                    "error": single.get("error"),
                    "overall_score": None,
                    "candidate_name": None,
                    "candidate_email": None,
                    "screening_id": None,
                    "score": None,
                    "candidate_data": None,
                })
                continue

            score_dict = (single or {}).get("score") or {}
            overall_score = score_dict.get("overall_score", 0)
            results.append({
                "filename": item.filename,
                "overall_score": overall_score,
                "candidate_name": single.get("candidate_name")
                    or (single.get("candidate_data") or {}).get("name")
                    or "Unknown",
                "candidate_email": single.get("candidate_email")
                    or (single.get("candidate_data") or {}).get("email")
                    or "",
                "screening_id": single.get("_id"),
                "score": score_dict,
                "candidate_data": single.get("candidate_data"),
            })

        results_sorted = sorted(
            results,
            key=lambda r: (r["overall_score"] is not None, r.get("overall_score") or 0),
            reverse=True,
        )

        return {"success": True, "data": results_sorted}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in screen_resumes_batch: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agents/resume-screening/workflow")
async def screen_resume_workflow(request: ResumeScreeningRequest):
    """Screen resume using LangGraph workflow"""
    try:
        graph = build_screening_graph()
        job_id = request.job_id
        if not job_id:
            db = get_database()
            dept = (request.department or '').strip()
            if dept and dept.upper() != 'N/A':
                doc = await db["Jobs"].find_one({"Department": dept, "Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({"Department": dept})
            else:
                doc = await db["Jobs"].find_one({"Status": "Open"})
                if not doc:
                    doc = await db["Jobs"].find_one({})
            if doc:
                job_id = doc.get("JobID") or str(doc.get("_id"))
        state = {
            "resume_text": request.resume_text,
            "job_id": job_id or "",
            "step": "parse_resume"
        }
        
        result = await graph.ainvoke(state)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents/schedule-meeting")
async def schedule_meeting(request: ScheduleMeetingRequest):
    """Schedule a meeting using natural language"""
    try:
        agent = MeetingSchedulerAgent()
        
        # Parse request
        schedule_info = await agent.parse_schedule_request(request.user_query)
        
        # Override with explicit parameters if provided
        if request.participants:
            schedule_info["participants"] = request.participants
        if request.duration_minutes:
            schedule_info["duration_minutes"] = request.duration_minutes
        
        # Find slots
        slots = await agent.find_available_slots(
            schedule_info.get("participants", []),
            schedule_info.get("duration_minutes", 60),
            schedule_info.get("preferred_date")
        )
        
        # Schedule (use first available)
        if slots:
            meeting = await agent.schedule_meeting(schedule_info, slots[0])
            return {
                "success": True,
                "data": {
                    "meeting": meeting,
                    "available_slots": slots
                }
            }
        else:
            return {
                "success": False,
                "message": "No available slots found",
                "data": {"available_slots": []}
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents/schedule-meeting/workflow")
async def schedule_meeting_workflow(request: ScheduleMeetingRequest):
    """Schedule meeting using LangGraph workflow"""
    try:
        graph = build_scheduling_graph()
        state = {
            "user_query": request.user_query,
            "step": "parse_request"
        }
        
        result = await graph.ainvoke(state)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/screening-results")
async def get_screening_results(job_id: Optional[str] = None):
    """Get resume screening results"""
    db = get_database()
    query = {}
    if job_id:
        query["job_id"] = job_id
    
    cursor = db["Resume_screening"].find(query).sort("screening_date", -1)
    results = await cursor.to_list(length=100)
    
    for result in results:
        result["_id"] = str(result["_id"])
    
    return {
        "success": True,
        "data": results
    }

@router.get("/agents/scheduled-meetings")
async def get_scheduled_meetings(status: Optional[str] = None):
    """Get scheduled meetings"""
    db = get_database()
    query = {}
    if status:
        query["Status"] = status
    
    cursor = db["Interviews"].find(query).sort("InterviewDate", -1)
    meetings = await cursor.to_list(length=100)
    
    for meeting in meetings:
        meeting["_id"] = str(meeting["_id"])
    
    return {
        "success": True,
        "data": meetings
    }

# Database Manager Agent
class DatabaseQueryRequest(BaseModel):
    query: str
    show_mongodb_query: Optional[bool] = False

async def format_results_natural_language(docs: List[Dict], user_query: str, mongodb_query: Optional[Dict] = None) -> str:
    """Format database results into natural language using Gemini"""
    try:
        if not docs:
            return "No matching records found in the database."
        
        # Prepare data summary
        count = len(docs)
        if count > 10:
            # For large results, summarize
            sample_docs = docs[:5]
            data_summary = f"Found {count} records. Showing sample of 5 records:\n\n"
        else:
            sample_docs = docs
            data_summary = f"Found {count} record(s):\n\n"
        
        # Format sample documents
        formatted_docs = []
        for i, doc in enumerate(sample_docs, 1):
            # Remove _id and format
            doc_copy = {k: v for k, v in doc.items() if k != "_id"}
            formatted_docs.append(f"Record {i}: {json.dumps(doc_copy, indent=2, default=str)}")
        
        data_summary += "\n\n".join(formatted_docs)
        
        if count > 10:
            data_summary += f"\n\n... and {count - 5} more records."
        
        # Use Gemini to convert to natural language
        prompt = f"""Convert this database query result into a clear, natural language response.

User's original question: "{user_query}"

Database Results:
{data_summary}

Provide a clear, concise summary in natural language. Focus on answering the user's question directly.
If there are multiple records, summarize the key findings. Be specific with numbers and details.

Response (natural language only, no markdown):"""
        
        model = LlamaModel(model_name=LLAMA_MODEL_NAME)
        response = model.generate_content(prompt)
        natural_response = response.text.strip()
        
        # Clean up response
        natural_response = re.sub(r'```[a-z]*\n?', '', natural_response)
        natural_response = natural_response.strip()
        
        return natural_response
        
    except Exception as e:
        logger.error(f"Error formatting natural language: {e}")
        # Fallback to simple format
        if not docs:
            return "No matching records found."
        count = len(docs)
        return f"Found {count} record(s) matching your query."

@router.post("/agents/database-query")
async def execute_database_query(request: DatabaseQueryRequest):
    """Execute a natural language database query using Gemini to convert to MongoDB and return natural language results"""
    try:
        user_query = request.query.strip()
        if not user_query:
            return {
                "success": False,
                "message": "Query cannot be empty",
                "data": None
            }
        
        # Step 1: Convert natural language to MongoDB query using Gemini
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

        model = LlamaModel(model_name=LLAMA_MODEL_NAME)
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        
        # Clean JSON
        raw_text = re.sub(r'^```json\s*', '', raw_text)
        raw_text = re.sub(r'```\s*', '', raw_text)
        raw_text = raw_text.strip().strip('"')
        
        try:
            mongodb_query = json.loads(raw_text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if match:
                try:
                    mongodb_query = json.loads(match.group(0))
                except Exception:
                    return {
                        "success": False,
                        "message": "Failed to parse your request. Please try rephrasing.",
                        "data": None
                    }
            else:
                return {
                    "success": False,
                    "message": "Could not understand your request. Please try again.",
                    "data": None
                }
        
        operation = mongodb_query.get("operation")
        collection_name = mongodb_query.get("collection")
        filter_ = mongodb_query.get("filter") or mongodb_query.get("query") or {}
        document = mongodb_query.get("document")
        update_statement = mongodb_query.get("update")
        projection = mongodb_query.get("projection")
        
        if not operation or not collection_name:
            return {
                "success": False,
                "message": "Could not interpret your request. Please try rephrasing.",
                "data": None
            }
        
        # Step 2: Execute MongoDB query
        db = get_database()
        available_collections = await db.list_collection_names()
        if collection_name not in available_collections:
            return {
                "success": False,
                "message": f"Collection '{collection_name}' not found in database.",
                "data": None
            }
        
        collection = db[collection_name]
        
        filter_corrected = await match_db_fields_async(collection, filter_)
        projection_corrected = await match_db_fields_async(collection, projection) if projection else None
        document_corrected = await match_db_fields_async(collection, document) if document else None
        update_corrected = await match_db_fields_async(collection, update_statement) if update_statement else None
        
        result_data = None
        natural_language_result = ""
        
        if operation == "find":
            cursor = collection.find(filter_corrected, projection_corrected)
            docs = await cursor.to_list(length=100)  # Limit to 100 for performance
            # Convert ObjectId to string
            for doc in docs:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
            result_data = docs
            natural_language_result = await format_results_natural_language(docs, user_query, mongodb_query)
            
        elif operation == "insert":
            if not document_corrected:
                return {
                    "success": False,
                    "message": "Insert operation missing document data.",
                    "data": None
                }
            res = await collection.insert_one(document_corrected)
            natural_language_result = f"Successfully inserted new record with ID {res.inserted_id}."
            result_data = {"inserted_id": str(res.inserted_id)}
            
        elif operation == "update":
            if not filter_corrected:
                return {
                    "success": False,
                    "message": "Update requires identifying which record to update.",
                    "data": None
                }
            if update_corrected:
                if "$set" in update_corrected:
                    update_corrected["$set"] = await match_db_fields_async(collection, update_corrected["$set"])
                if "$inc" in update_corrected:
                    update_corrected["$inc"] = await match_db_fields_async(collection, update_corrected["$inc"])
            elif document_corrected:
                update_corrected = {"$set": document_corrected}
            res = await collection.update_one(filter_corrected, update_corrected)
            if res.matched_count > 0:
                natural_language_result = f"Successfully updated {res.modified_count} record(s)."
            else:
                natural_language_result = "No matching record found to update."
            result_data = {"matched": res.matched_count, "modified": res.modified_count}
            
        elif operation == "delete":
            if not filter_corrected:
                return {
                    "success": False,
                    "message": "Delete requires identifying which record to remove.",
                    "data": None
                }
            res = await collection.delete_one(filter_corrected)
            if res.deleted_count > 0:
                natural_language_result = "Successfully deleted 1 record."
            else:
                natural_language_result = "No matching record found."
            result_data = {"deleted": res.deleted_count}
        else:
            return {
                "success": False,
                "message": f"Operation '{operation}' is not supported.",
                "data": None
            }
        
        response_data = {
            "natural_language_result": natural_language_result,
            "result_count": len(result_data) if isinstance(result_data, list) else None,
            "operation": operation,
            "collection": collection_name
        }
        
        if request.show_mongodb_query:
            response_data["mongodb_query"] = mongodb_query
        
        if operation == "find" and result_data:
            response_data["results"] = result_data[:10]  # Limit to 10 for response size
            if len(result_data) > 10:
                response_data["total_count"] = len(result_data)
                response_data["message"] = f"Showing first 10 of {len(result_data)} results"
        
        return {
            "success": True,
            "data": response_data
        }
        
    except Exception as e:
        logger.error(f"Database query error: {e}", exc_info=True)
        return {
            "success": False,
            "message": f"An error occurred: {str(e)}",
            "data": None
        }

