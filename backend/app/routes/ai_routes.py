"""AI Q&A route (Ask VeriTrust AI) grounded in the user's uploaded policy."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Policy, ChatMessage, ClaimCheck
from app.schemas import AskRequest, ClaimCheckRequest
from app.auth import get_current_user
from app import ai

router = APIRouter(prefix="/ai", tags=["ai"])

CLAIM_DISCLAIMER = "AI policy guidance based only on your uploaded document — not a guarantee of insurer claim approval."


def _policy_context(p: Policy) -> str:
    parts = [f"Policy: {p.policy_name} ({p.category} insurance)"]
    if p.analysis:
        a = p.analysis
        parts += [f"Summary: {a.summary}", f"Coverage: {a.coverage}", f"Exclusions: {a.exclusions}",
                  f"Waiting period: {a.waiting_period}", f"Claim conditions: {a.claim_conditions}",
                  f"Limitations: {a.limitations}", f"Premium: {a.premium_info}"]
    return "\n".join(parts)


def _claim_out(c: ClaimCheck) -> dict:
    return {
        "id": c.id, "policy_id": c.policy_id, "situation": c.situation, "language": c.language, "verdict": c.verdict,
        "reason": c.reason, "clauses": c.clauses or [], "conditions": c.conditions or [], "next_steps": c.next_steps or [],
        "disclaimer": CLAIM_DISCLAIMER, "created_at": c.created_at.isoformat(),
    }


async def _own_policy(db, policy_id, user_id) -> Policy:
    result = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == user_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found.")
    return p


@router.post("/ask/{policy_id}")
async def ask(policy_id: str, payload: AskRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _own_policy(db, policy_id, current.id)
    await db.refresh(p, ["analysis", "risk"])

    context_parts = [f"Policy: {p.policy_name} ({p.category} insurance)"]
    if p.analysis:
        context_parts.append(f"Summary: {p.analysis.summary}")
        context_parts.append(f"Coverage: {p.analysis.coverage}")
        context_parts.append(f"Exclusions: {p.analysis.exclusions}")
        context_parts.append(f"Waiting period: {p.analysis.waiting_period}")
        context_parts.append(f"Claim conditions: {p.analysis.claim_conditions}")
        context_parts.append(f"Limitations: {p.analysis.limitations}")
        context_parts.append(f"Premium: {p.analysis.premium_info}")
    if p.risk:
        context_parts.append(f"Risk score: {p.risk.overall_score}/100 ({p.risk.risk_level}). Concerns: {p.risk.concerns}")
    context_parts.append(f"Raw policy text: {p.extracted_text[:8000]}")
    context = "\n".join(context_parts)

    answer = await ai.answer_question(payload.question, context, payload.language)

    db.add(ChatMessage(policy_id=p.id, user_id=current.id, role="user", content=payload.question))
    db.add(ChatMessage(policy_id=p.id, user_id=current.id, role="assistant", content=answer))
    await db.commit()
    return {"question": payload.question, "answer": answer}


@router.get("/history/{policy_id}")
async def chat_history(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _own_policy(db, policy_id, current.id)
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.policy_id == policy_id, ChatMessage.user_id == current.id).order_by(ChatMessage.created_at.asc())
    )
    msgs = result.scalars().all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in msgs]


@router.post("/claim-check/{policy_id}")
async def claim_check(policy_id: str, payload: ClaimCheckRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _own_policy(db, policy_id, current.id)
    await db.refresh(p, ["analysis"])
    result = await ai.claim_check(payload.situation, _policy_context(p), p.extracted_text or "", payload.language)
    check = ClaimCheck(
        user_id=current.id, policy_id=p.id, situation=payload.situation.strip(), language=payload.language,
        verdict=result["verdict"], reason=result["reason"], clauses=result["clauses"],
        conditions=result["conditions"], next_steps=result["next_steps"],
    )
    db.add(check)
    await db.commit()
    await db.refresh(check)
    return _claim_out(check)


@router.get("/claim-checks/{policy_id}")
async def claim_checks(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _own_policy(db, policy_id, current.id)
    r = await db.execute(select(ClaimCheck).where(ClaimCheck.policy_id == policy_id, ClaimCheck.user_id == current.id).order_by(ClaimCheck.created_at.desc()))
    return [_claim_out(c) for c in r.scalars().all()]
