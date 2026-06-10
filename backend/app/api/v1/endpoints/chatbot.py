from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.ai_service import ChatbotService

router = APIRouter()

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User query for the chatbot")

class ChatResponse(BaseModel):
    success: bool
    answer: str

@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(request: ChatRequest):
    """Process a chatbot query"""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    try:
        answer = await ChatbotService.process_query(request.query)
        return ChatResponse(success=True, answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

