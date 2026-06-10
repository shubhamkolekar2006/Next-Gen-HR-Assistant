from fastapi import APIRouter, Query
from app.core.database import get_database

router = APIRouter()

@router.get("/summary")
async def get_analytics_summary():
    """Get dashboard summary metrics"""
    db = get_database()
    
    # Total employees (assuming active status field)
    try:
        total_employees = await db["employee"].count_documents({})
    except:
        total_employees = 0
    
    # Average salary
    try:
        pipeline = [
            {"$match": {"Salary": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": None, "avg_salary": {"$avg": "$Salary"}}}
        ]
        avg_result = await db["employee"].aggregate(pipeline).to_list(length=1)
        avg_salary = round(avg_result[0]["avg_salary"] / 1000) if avg_result and avg_result[0].get("avg_salary") else 0
    except:
        avg_salary = 0
    
    # High risk count (from attrition predictions)
    try:
        # Check if AttritionRisk field exists, if not calculate from Attrition collection
        high_risk = await db["Attrition"].count_documents({"AttritionRisk": {"$gt": 0.7}}) if "AttritionRisk" in (await db["Attrition"].find_one({}) or {}) else 0
    except:
        high_risk = 0
    
    # Attrition rate (simplified - you can calculate from actual data)
    attrition_rate = 12.5  # Placeholder - calculate from your data
    
    return {
        "success": True,
        "data": {
            "totalEmployees": total_employees,
            "avgSalary": avg_salary,
            "highRiskCount": high_risk,
            "attritionRate": attrition_rate
        }
    }

@router.get("/department-distribution")
async def get_department_distribution():
    """Get employee count by department"""
    db = get_database()
    
    try:
        pipeline = [
            {"$group": {"_id": "$Department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        results = await db["employee"].aggregate(pipeline).to_list(length=None)
        
        data = [
            {"department": r["_id"] or "Unknown", "count": r["count"]}
            for r in results
        ]
        
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": True, "data": []}

@router.get("/attrition-risk")
async def get_attrition_risk_distribution():
    """Get attrition risk distribution"""
    db = get_database()
    
    try:
        # This requires Attrition collection with AttritionRisk field
        # If not available, return placeholder
        pipeline = [
            {
                "$addFields": {
                    "risk_category": {
                        "$switch": {
                            "branches": [
                                {"case": {"$gte": ["$AttritionRisk", 0.7]}, "then": "High"},
                                {"case": {"$gte": ["$AttritionRisk", 0.4]}, "then": "Medium"},
                            ],
                            "default": "Low"
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": "$risk_category",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        results = await db["Attrition"].aggregate(pipeline).to_list(length=None)
        
        data = [
            {"category": r["_id"], "count": r["count"]}
            for r in results
        ]
        
        return {"success": True, "data": data}
    except:
        return {"success": True, "data": []}

@router.get("/performance-trend")
async def get_performance_trend(periods: int = Query(6, ge=1, le=12)):
    """Get performance trend data from ARIMA models for dashboard"""
    from app.services.ml_service import get_performance_trend_data
    
    try:
        trend_data = await get_performance_trend_data(periods=periods)
        return {"success": True, "data": trend_data}
    except Exception as e:
        # Return empty data if model not available
        return {"success": True, "data": []}

