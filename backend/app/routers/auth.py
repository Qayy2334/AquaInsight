"""Account registration and sign-in (username + password)."""

import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..services.auth import create_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MIN_PASSWORD = 6


class Register(BaseModel):
    username: str
    password: str
    display_name: str | None = None


class Login(BaseModel):
    username: str
    password: str


def _user(u: User) -> dict:
    return {"id": u.id, "username": u.username, "display_name": u.display_name or u.username}


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user_id = decode_token(creds.credentials) if creds else None
    user = db.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(401, "Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    return user


@router.post("/register")
def register(body: Register, db: Session = Depends(get_db)):
    username = body.username.strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(422, "Username must be 3–32 characters: letters, numbers, dot, dash or underscore.")
    if len(body.password) < MIN_PASSWORD:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD} characters.")
    if db.scalars(select(User).where(User.username == username)).first():
        raise HTTPException(409, "This username is already taken.")
    user = User(username=username, display_name=(body.display_name or "").strip() or None,
                password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return {"token": create_token(user.id), "user": _user(user)}


@router.post("/login")
def login(body: Login, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.username == body.username.strip())).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect username or password.")
    return {"token": create_token(user.id), "user": _user(user)}


@router.get("/me")
def me(user: User = Depends(require_user)):
    return _user(user)
