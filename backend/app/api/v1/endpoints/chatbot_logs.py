"""Chatbot logs endpoint"""
from fastapi import APIRouter, Query
from typing import Optional
from app.core.database import get_database
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/chatbot/logs")
async def get_chatbot_logs(
    query_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    days: int = Query(7, ge=1, le=90)
):
    """Get chatbot query logs"""
    db = get_database()
    
    query = {}
    if query_type:
        query["query_type"] = query_type
    
    # Filter by date
    cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
    query["timestamp"] = {"$gte": cutoff_date}
    
    cursor = db["Chatbot_Logs"].find(query).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    # Convert ObjectId to string
    for log in logs:
        log["_id"] = str(log["_id"])
    
    # Get statistics
    total_count = await db["Chatbot_Logs"].count_documents(query)
    
    # Query type distribution
    type_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$query_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    type_distribution = await db["Chatbot_Logs"].aggregate(type_pipeline).to_list(length=None)
    
    return {
        "success": True,
        "data": logs,
        "statistics": {
            "total": total_count,
            "query_type_distribution": type_distribution
        }
    }

