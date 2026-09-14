"""Renewal comparison: link a real uploaded renewal quote to its expiring policy and compare side-by-side."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Policy, RenewalComparison
from app.schemas import RenewalCompareRequest, RenewalLinkRequest
from app.auth import get_current_user
from app import ai, alerts

router = APIRouter(prefix="/renewals", tags=["renewals"])

RENEWAL_DISCLAIMER = "AI guidance based only on your uploaded documents — not financial or insurance advice."


async def _own(db, policy_id, user_id) -> Policy:
    r = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == user_id))
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found.")
    return p


def _brief(p: Policy) -> dict:
    return {
        "id": p.id, "policy_name": p.policy_name, "category": p.category, "upload_date": p.upload_date.isoformat(),
        "policy_end_date": p.policy_end_date.isoformat() if p.policy_end_date else None,
        "days_to_expiry": alerts.days_to_expiry(p.policy_end_date),
        "risk_score": p.risk.overall_score if p.risk else None,
        "risk_level": p.risk.risk_level if p.risk else None,
        "premium_info": p.analysis.premium_info if p.analysis else "",
    }


def _pack(p: Policy) -> dict:
    a = p.analysis
    return {
        "policy_name": p.policy_name, "category": p.category,
        "policy_end_date": p.policy_end_date.isoformat() if p.policy_end_date else None,
        "summary": a.summary if a else "", "coverage": a.coverage if a else [], "exclusions": a.exclusions if a else [],
        "waiting_period": a.waiting_period if a else "", "claim_conditions": a.claim_conditions if a else [],
        "limitations": a.limitations if a else [], "premium_info": a.premium_info if a else "",
        "benefits": a.benefits if a else [], "risk_score": p.risk.overall_score if p.risk else None,
        "risk_level": p.risk.risk_level if p.risk else None,
    }


def _cmp_out(c: RenewalComparison, original: Policy, quote: Policy) -> dict:
    return {
        "id": c.id, "verdict": c.verdict, "reason": c.reason, "summary": c.summary, "rows": c.rows or [],
        "changes": c.changes or {"improved": [], "worse": [], "same": []}, "created_at": c.created_at.isoformat(),
        "original": _brief(original), "quote": _brief(quote), "disclaimer": RENEWAL_DISCLAIMER,
    }


@router.get("/overview")
async def overview(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Expiring policies (with candidates) + unlinked quotes, all from the user's own records."""
    r = await db.execute(select(Policy).where(Policy.user_id == current.id).order_by(Policy.upload_date.desc()))
    policies = r.scalars().all()
    for p in policies:
        await db.refresh(p, ["risk", "analysis"])
    by_id = {p.id: p for p in policies}
    latest = {}
    cr = await db.execute(select(RenewalComparison).where(RenewalComparison.user_id == current.id).order_by(RenewalComparison.created_at.desc()))
    for c in cr.scalars().all():
        latest.setdefault(c.original_policy_id, c)

    originals = []
    for p in policies:
        if p.renewal_of_policy_id:
            continue
        candidates = [_brief(q) for q in policies if q.renewal_of_policy_id == p.id]
        c = latest.get(p.id)
        originals.append({
            **_brief(p), "candidates": candidates,
            "latest_comparison": {"id": c.id, "verdict": c.verdict, "quote_id": c.quote_policy_id, "created_at": c.created_at.isoformat()} if c and c.quote_policy_id in by_id else None,
        })
    originals.sort(key=lambda x: (x["days_to_expiry"] is None, x["days_to_expiry"] if x["days_to_expiry"] is not None else 0))
    return {"policies": originals}


@router.post("/{original_id}/link")
async def link_quote(original_id: str, payload: RenewalLinkRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    original = await _own(db, original_id, current.id)
    quote = await _own(db, payload.quote_id, current.id)
    if original.id == quote.id:
        raise HTTPException(status_code=400, detail="A policy cannot be its own renewal quote.")
    if original.renewal_of_policy_id:
        raise HTTPException(status_code=400, detail="The selected policy is itself a renewal quote.")
    quote.renewal_of_policy_id = original.id
    await db.commit()
    return {"original_id": original.id, "quote_id": quote.id}


@router.post("/compare")
async def compare(payload: RenewalCompareRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    original = await _own(db, payload.original_id, current.id)
    quote = await _own(db, payload.quote_id, current.id)
    if original.id == quote.id:
        raise HTTPException(status_code=400, detail="Select two different policies.")
    await db.refresh(original, ["analysis", "risk"])
    await db.refresh(quote, ["analysis", "risk"])
    if not (original.analysis and quote.analysis):
        raise HTTPException(status_code=400, detail="Both policies must be fully analyzed.")
    if quote.renewal_of_policy_id != original.id:
        quote.renewal_of_policy_id = original.id

    result = await ai.renewal_compare(_pack(original), _pack(quote), alerts.days_to_expiry(original.policy_end_date))
    c = RenewalComparison(
        user_id=current.id, original_policy_id=original.id, quote_policy_id=quote.id,
        verdict=result["verdict"], reason=result.get("reason", ""), summary=result.get("summary", ""),
        rows=result["rows"], changes=result["changes"],
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _cmp_out(c, original, quote)


@router.get("/comparison/{original_id}")
async def latest_comparison(original_id: str, quote_id: str | None = None, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    original = await _own(db, original_id, current.id)
    q = select(RenewalComparison).where(RenewalComparison.user_id == current.id, RenewalComparison.original_policy_id == original.id)
    if quote_id:
        q = q.where(RenewalComparison.quote_policy_id == quote_id)
    r = await db.execute(q.order_by(RenewalComparison.created_at.desc()).limit(1))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="No comparison yet.")
    quote = await _own(db, c.quote_policy_id, current.id)
    await db.refresh(original, ["analysis", "risk"])
    await db.refresh(quote, ["analysis", "risk"])
    return _cmp_out(c, original, quote)
