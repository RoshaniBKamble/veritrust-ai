"""Authentication routes: register, login, current user, profile update."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, LoginRequest, AuthResponse, UserOut, UpdateProfile
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        preferred_language=payload.preferred_language or "en",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.email)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(user.id, user.email)
    return AuthResponse(token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current: User = Depends(get_current_user)):
    return UserOut.model_validate(current)


@router.put("/me", response_model=UserOut)
async def update_me(payload: UpdateProfile, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if payload.full_name is not None:
        current.full_name = payload.full_name.strip()
    if payload.preferred_language is not None:
        current.preferred_language = payload.preferred_language
    await db.commit()
    await db.refresh(current)
    return UserOut.model_validate(current)
