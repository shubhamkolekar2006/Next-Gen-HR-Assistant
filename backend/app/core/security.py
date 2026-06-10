from datetime import datetime, timedelta
from typing import Optional
import hashlib
import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Use bcrypt directly to avoid passlib initialization issues
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _prepare_password_for_bcrypt(password: str) -> bytes:
    """Prepare password for bcrypt (72-byte limit)
    If password is longer than 72 bytes, hash it with SHA-256 first"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # Hash with SHA-256 first (produces 32 bytes), then use that for bcrypt
        sha256_hash = hashlib.sha256(password_bytes).digest()
        return sha256_hash
    return password_bytes

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Prepare password (hash if > 72 bytes)
        prepared_password_bytes = _prepare_password_for_bcrypt(plain_password)
        # Use bcrypt directly
        return bcrypt.checkpw(prepared_password_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash a password"""
    # Prepare password (hash if > 72 bytes) before bcrypt
    prepared_password_bytes = _prepare_password_for_bcrypt(password)
    # Use bcrypt directly
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prepared_password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

