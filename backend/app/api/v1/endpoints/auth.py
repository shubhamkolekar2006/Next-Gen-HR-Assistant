from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, Optional
from bson import ObjectId

from app.core.database import get_database
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token


router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


def sanitize_user(document: Dict[str, Any]) -> Dict[str, Any]:
    """Return user document without sensitive fields."""
    if not document:
        return {}
    user = {
        "id": str(document.get("_id")),
        "name": document.get("name", ""),
        "email": document.get("email", ""),
        "role": document.get("role", "HR Manager"),
        "created_at": document.get("created_at"),
        "last_login_at": document.get("last_login_at"),
        "avatar": document.get("avatar"),
    }
    return user


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    return await db["Users"].find_one({"email": email.lower()})


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()
    try:
        object_id = ObjectId(user_id)
    except Exception:
        return None
    return await db["Users"].find_one({"_id": object_id})


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register_user(payload: RegisterRequest):
    db = get_database()
    users = db["Users"]

    existing = await get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    now = datetime.utcnow().isoformat()
    user_document: Dict[str, Any] = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": get_password_hash(payload.password),
        "role": "HR Manager",
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
    }

    result = await users.insert_one(user_document)
    user_document["_id"] = result.inserted_id

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(result.inserted_id)},
        expires_delta=access_token_expires,
    )

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": sanitize_user(user_document),
        },
    }


@router.post("/auth/login")
async def login_user(payload: LoginRequest):
    user = await get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    db = get_database()
    await db["Users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login_at": datetime.utcnow().isoformat()}}
    )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["_id"])},
        expires_delta=access_token_expires,
    )

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": sanitize_user(user),
        },
    }


@router.get("/auth/me")
async def read_current_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {"success": True, "data": sanitize_user(current_user)}


