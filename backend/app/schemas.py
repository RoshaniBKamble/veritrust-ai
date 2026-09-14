"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    preferred_language: str = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    preferred_language: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class UpdateProfile(BaseModel):
    full_name: Optional[str] = None
    preferred_language: Optional[str] = None


class AnalysisOut(BaseModel):
    summary: str
    insurance_type: str
    benefits: List[Any]
    coverage: List[Any]
    exclusions: List[Any]
    waiting_period: str
    claim_conditions: List[Any]
    limitations: List[Any]
    important_terms: List[Any]
    premium_info: str
    recommendations: List[Any]
    simple_explanation_en: str
    simple_explanation_hi: str
    simple_explanation_mr: str

    class Config:
        from_attributes = True


class RiskOut(BaseModel):
    overall_score: int
    risk_level: str
    breakdown: List[Any]
    reasons: List[Any]
    concerns: List[Any]

    class Config:
        from_attributes = True


class VerificationOut(BaseModel):
    document_hash: str
    ipfs_cid: str
    tx_hash: str
    block_number: int
    contract_address: str
    network: str
    status: str
    verified_at: datetime

    class Config:
        from_attributes = True


class PolicySummary(BaseModel):
    id: str
    policy_name: str
    category: str
    upload_date: datetime
    document_hash: str
    ipfs_cid: str
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    verification_status: Optional[str] = None


class PolicyDetail(BaseModel):
    id: str
    policy_name: str
    category: str
    upload_date: datetime
    file_name: str
    file_type: str
    file_size: int
    ipfs_cid: str
    document_hash: str
    analysis: Optional[AnalysisOut] = None
    risk: Optional[RiskOut] = None
    verification: Optional[VerificationOut] = None


class AskRequest(BaseModel):
    question: str
    language: str = "en"


class CompareRequest(BaseModel):
    policy_a_id: str
    policy_b_id: str


class VerifyHashRequest(BaseModel):
    query: str  # SHA-256 hash or policy id
