from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
import random
import base64
import ast
import re
from app.core.database import get_database
from bson import ObjectId
from bson.binary import Binary

router = APIRouter()

def serialize_document(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc and "_id" in doc:
        value = doc["_id"]
        if isinstance(value, ObjectId):
            doc["_id"] = str(value)
        elif isinstance(value, Binary):
            encoded = base64.urlsafe_b64encode(bytes(value)).decode('ascii')
            doc["_id"] = f"bin{value.subtype}:{encoded}"
        elif isinstance(value, (bytes, bytearray)):
            encoded = base64.urlsafe_b64encode(bytes(value)).decode('ascii')
            doc["_id"] = f"bin:{encoded}"
        else:
            doc["_id"] = str(value)
    return doc


class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Full name of the employee")
    department: str = Field(..., min_length=1, description="Department name")
    position: str = Field(..., min_length=1, description="Employee position or title")
    email: Optional[EmailStr] = Field(None, description="Corporate email address")
    phone: Optional[str] = Field(None, description="Contact phone number")
    date_of_joining: Optional[str] = Field(None, alias="dateOfJoining", description="Date of joining (ISO format)")
    employment_type: Optional[str] = Field(None, alias="employmentType", description="Employment type e.g. Full-time")
    manager: Optional[str] = Field(None, description="Manager name or ID")
    employee_id: Optional[str] = Field(None, alias="employeeId", description="Custom employee identifier")

    class Config:
        allow_population_by_field_name = True


class PerformancePredictionGenerateRequest(BaseModel):
    employee_ids: Optional[List[str]] = Field(
        default=None,
        description="Specific employee identifiers to regenerate forecasts for",
    )
    periods: int = Field(
        default=6,
        ge=1,
        le=12,
        description="Number of future periods (months) to forecast",
    )
    force_refresh: bool = Field(
        default=False,
        description="Force recalculation even if fresh predictions already exist",
    )


def generate_employee_id() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    suffix = random.randint(100, 999)
    return f"EMP-{timestamp}-{suffix}"

_BINARY_ID_PATTERN = re.compile(r"^bin(?:(\d+))?:(.+)$")


def _decode_binary_identifier(identifier: str) -> Optional[Binary | bytes]:
    if not identifier:
        return None
    match = _BINARY_ID_PATTERN.match(identifier)
    if match:
        subtype_raw, payload = match.groups()
        padding = '=' * (-len(payload) % 4)
        try:
            decoded = base64.urlsafe_b64decode(payload + padding)
        except Exception:
            return None
        if subtype_raw is not None:
            return Binary(decoded, int(subtype_raw))
        return decoded
    if identifier.startswith("b'") or identifier.startswith('b"'):
        try:
            value = ast.literal_eval(identifier)
            if isinstance(value, bytes):
                return value
        except (ValueError, SyntaxError):
            return None
    return None


def map_employee_to_document(payload: EmployeeCreate) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    document: Dict[str, Any] = {
        "Employee_ID": (payload.employee_id or generate_employee_id()).strip(),
        "Name": payload.name.strip(),
        "Department": payload.department.strip(),
        "Position": payload.position.strip(),
        "CreatedAt": now,
        "UpdatedAt": now,
    }

    if payload.email:
        document["Email"] = payload.email
    if payload.phone:
        document["Phone"] = payload.phone.strip()
    if payload.date_of_joining:
        document["DateOfJoining"] = payload.date_of_joining
    if payload.employment_type:
        document["EmploymentType"] = payload.employment_type.strip()
    if payload.manager:
        document["Manager"] = payload.manager.strip()

    return document


async def ensure_unique_employee(collection, document: Dict[str, Any]) -> None:
    existing = await collection.find_one({"Employee_ID": document["Employee_ID"]})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee with this identifier already exists",
        )
    if document.get("Email"):
        existing_email = await collection.find_one({"Email": document["Email"]})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee with this email already exists",
            )


@router.get("/employees")
async def get_employees(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(0, ge=0, le=1000)
):
    """Get all employees with optional filtering"""
    db = get_database()
    collection = db["employee"]
    
    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"Name": {"$regex": search, "$options": "i"}},
            {"Employee_ID": {"$regex": search, "$options": "i"}},
            {"Department": {"$regex": search, "$options": "i"}}
        ]
    if department:
        query["Department"] = department
    
    # Pagination / fetch strategy
    skip = (page - 1) * limit if limit > 0 else 0
    cursor = collection.find(query)
    if skip:
        cursor = cursor.skip(skip)
    if limit > 0:
        cursor = cursor.limit(limit)
        employees = await cursor.to_list(length=limit)
    else:
        employees = [emp async for emp in cursor]
    total = await collection.count_documents(query)
    
    # Serialize
    for emp in employees:
        serialize_document(emp)
    
    return {
        "success": True,
        "data": employees,
        "pagination": {
            "page": page if limit > 0 else 1,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if limit > 0 and total else 1
        }
    }


@router.get("/employees/roles")
async def list_employee_roles(department: Optional[str] = Query(None, description="Filter roles by department")):
    """List unique employee roles (positions) with optional department filter."""
    db = get_database()
    collection = db["employee"]

    pipeline: List[Dict[str, Any]] = [
        {
            "$project": {
                "role": {
                    "$ifNull": [
                        "$Role",
                        {
                            "$ifNull": ["$role", "$Position"]
                        },
                    ]
                },
                "department": {
                    "$ifNull": ["$Department", "N/A"]
                },
            }
        },
        {
            "$match": {
                "role": {"$ne": None, "$ne": ""},
            }
        },
    ]

    if department:
        pipeline.append(
            {
                "$match": {
                    "department": department
                }
            }
        )

    pipeline.extend(
        [
            {
                "$group": {
                    "_id": {
                        "role": "$role",
                        "department": "$department"
                    },
                    "role": {"$first": "$role"},
                    "department": {"$first": "$department"},
                    "count": {"$sum": 1},
                }
            },
            {
                "$sort": {
                    "role": 1,
                    "department": 1,
                }
            },
        ]
    )

    cursor = collection.aggregate(pipeline, allowDiskUse=True)
    results = await cursor.to_list(length=1000)

    role_list = [
        {
            "role": entry.get("role", "").strip(),
            "department": entry.get("department", "N/A") or "N/A",
            "count": entry.get("count", 0),
        }
        for entry in results
        if entry.get("role")
    ]

    return {
        "success": True,
        "data": role_list,
        "count": len(role_list),
    }


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: str):
    """Get single employee by ID, supporting multiple identifier formats"""
    db = get_database()
    collection = db["employee"]

    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")

    lookup_id = employee_id.strip()
    employee = None

    # Primary lookup keys
    for key in ["Employee_ID", "EmployeeID", "employee_id", "ID", "id"]:
        employee = await collection.find_one({key: lookup_id})
        if employee:
            break

    # Fallback to MongoDB ObjectId
    if not employee:
        try:
            object_id = ObjectId(lookup_id)
            employee = await collection.find_one({"_id": object_id})
        except Exception:
            employee = None

    if not employee:
        binary_value = _decode_binary_identifier(lookup_id)
        if isinstance(binary_value, Binary):
            employee = await collection.find_one({"_id": binary_value})
        elif isinstance(binary_value, (bytes, bytearray)):
            employee = await collection.find_one({"_id": binary_value})

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    serialize_document(employee)
    return {"success": True, "data": employee}


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(employee: EmployeeCreate):
    """Create a new employee record"""
    db = get_database()
    collection = db["employee"]

    document = map_employee_to_document(employee)
    await ensure_unique_employee(collection, document)

    inserted = await collection.insert_one(document)
    created = await collection.find_one({"_id": inserted.inserted_id})

    if not created:
        raise HTTPException(status_code=500, detail="Failed to create employee record")

    serialize_document(created)
    return {"success": True, "data": created}

@router.get("/employees/{employee_id}/attrition-risk")
async def get_employee_attrition_risk(employee_id: str):
    """Get attrition risk for specific employee"""
    from app.services.ml_service import predict_attrition_for_employee
    
    try:
        prediction = await predict_attrition_for_employee(employee_id)
        return {"success": True, "data": prediction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/employees/{employee_id}/performance-prediction")
async def get_employee_performance_prediction(
    employee_id: str,
    periods: int = Query(6, ge=1, le=12),
    force_refresh: bool = Query(False),
):
    """Get (and persist) performance prediction for an employee using database history."""
    from app.services.ml_service import predict_performance_for_employee

    try:
        prediction = await predict_performance_for_employee(
            employee_id,
            periods=periods,
            force_refresh=force_refresh,
        )
        return {"success": True, "data": prediction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/employees/performance-predictions/generate")
async def generate_performance_predictions(request: PerformancePredictionGenerateRequest):
    """Generate and store performance predictions for one or more employees."""
    from app.services.ml_service import generate_performance_predictions_bulk

    try:
        result = await generate_performance_predictions_bulk(
            employee_ids=request.employee_ids,
            periods=request.periods,
            force_refresh=request.force_refresh,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

