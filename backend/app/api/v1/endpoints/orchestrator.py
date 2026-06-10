from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid

from app.services.langchain_orchestrator import generate_plan, execute_plan

router = APIRouter()

class OrchestratorRequest(BaseModel):
    query: str
    thread_id: Optional[str] = None

class ExecuteRequest(BaseModel):
    thread_id: str

@router.post("/plan")
async def create_plan(request: OrchestratorRequest):
    """
    Submits a query to the Master HR Orchestrator. 
    The agent formulates a plan (tool calls) and pauses.
    """
    thread_id = request.thread_id or str(uuid.uuid4())
    
    result = await generate_plan(request.query, thread_id)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("response"))
        
    return {
        "thread_id": thread_id,
        "status": result.get("status"),
        "reasoning": result.get("reasoning"),
        "tool_calls": result.get("tool_calls", [])
    }

@router.post("/execute")
async def execute_approved_plan(request: ExecuteRequest):
    """
    Resumes the agent from its paused state using the provided thread_id.
    Executes the tool calls and returns the final synthesized outcome.
    """
    result = await execute_plan(request.thread_id)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("response"))
        
    return {
        "thread_id": request.thread_id,
        "status": result.get("status"),
        "response": result.get("response")
    }
