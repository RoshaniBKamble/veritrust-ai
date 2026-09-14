"""SQLAlchemy ORM models mapping the VeriTrust relational schema.

USER -> POLICIES -> (ANALYSIS, RISK_ANALYSIS, VERIFICATION)
All records are linked by IDs, exactly like the PostgreSQL architecture spec.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    preferred_language: Mapped[str] = mapped_column(String(10), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    policies: Mapped[list["Policy"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Policy(Base):
    __tablename__ = "policies"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    policy_name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(50), index=True)
    upload_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(50))
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    ipfs_cid: Mapped[str] = mapped_column(String(120), default="")
    document_hash: Mapped[str] = mapped_column(String(80), default="")

    user: Mapped["User"] = relationship(back_populates="policies")
    analysis: Mapped["Analysis"] = relationship(back_populates="policy", cascade="all, delete-orphan", uselist=False)
    risk: Mapped["RiskAnalysis"] = relationship(back_populates="policy", cascade="all, delete-orphan", uselist=False)
    verification: Mapped["Verification"] = relationship(back_populates="policy", cascade="all, delete-orphan", uselist=False)


class Analysis(Base):
    __tablename__ = "analysis"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    insurance_type: Mapped[str] = mapped_column(String(80), default="")
    benefits: Mapped[list] = mapped_column(JSON, default=list)
    coverage: Mapped[list] = mapped_column(JSON, default=list)
    exclusions: Mapped[list] = mapped_column(JSON, default=list)
    waiting_period: Mapped[str] = mapped_column(Text, default="")
    claim_conditions: Mapped[list] = mapped_column(JSON, default=list)
    limitations: Mapped[list] = mapped_column(JSON, default=list)
    important_terms: Mapped[list] = mapped_column(JSON, default=list)
    premium_info: Mapped[str] = mapped_column(Text, default="")
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    simple_explanation_en: Mapped[str] = mapped_column(Text, default="")
    simple_explanation_hi: Mapped[str] = mapped_column(Text, default="")
    simple_explanation_mr: Mapped[str] = mapped_column(Text, default="")

    policy: Mapped["Policy"] = relationship(back_populates="analysis")


class RiskAnalysis(Base):
    __tablename__ = "risk_analysis"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), index=True)
    overall_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="Low")
    breakdown: Mapped[list] = mapped_column(JSON, default=list)   # [{factor, score, weight, reason}]
    reasons: Mapped[list] = mapped_column(JSON, default=list)     # why this risk exists
    concerns: Mapped[list] = mapped_column(JSON, default=list)

    policy: Mapped["Policy"] = relationship(back_populates="risk")


class Verification(Base):
    __tablename__ = "verification"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), index=True)
    document_hash: Mapped[str] = mapped_column(String(80), default="")
    ipfs_cid: Mapped[str] = mapped_column(String(120), default="")
    tx_hash: Mapped[str] = mapped_column(String(80), default="")
    block_number: Mapped[int] = mapped_column(Integer, default=0)
    contract_address: Mapped[str] = mapped_column(String(80), default="")
    network: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(30), default="VERIFIED")
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    policy: Mapped["Policy"] = relationship(back_populates="verification")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
