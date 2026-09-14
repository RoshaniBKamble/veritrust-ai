"""Fraud alerts, renewal reminders and the renewal calendar."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Policy, Alert
from app.auth import get_current_user
from app import alerts

router = APIRouter(tags=["alerts"])


async def _get_alert(db, alert_id, user_id) -> Alert:
    r = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == user_id))
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return a


@router.get("/alerts")
async def list_alerts(status: str = "ACTIVE", sweep: bool = True, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if sweep:
        await alerts.run_integrity_sweep(db, current)
        await alerts.run_renewal_check(db, current)
    q = select(Alert).where(Alert.user_id == current.id)
    if status.lower() != "all":
        q = q.where(Alert.status == status.upper())
    r = await db.execute(q.order_by(Alert.created_at.desc()))
    items = r.scalars().all()

    active_r = await db.execute(select(Alert).where(Alert.user_id == current.id, Alert.status == "ACTIVE"))
    active = active_r.scalars().all()
    return {
        "alerts": [alerts.serialize(a) for a in items],
        "counts": {
            "active": len(active),
            "unread": sum(1 for a in active if a.read_at is None),
            "fraud": sum(1 for a in active if a.type == "FRAUD"),
            "renewal": sum(1 for a in active if a.type == "RENEWAL"),
        },
    }


@router.post("/alerts/read-all")
async def read_all(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Alert).where(Alert.user_id == current.id, Alert.status == "ACTIVE", Alert.read_at.is_(None)))
    now = datetime.now(timezone.utc)
    for a in r.scalars().all():
        a.read_at = now
    await db.commit()
    return {"ok": True}


@router.post("/alerts/{alert_id}/read")
async def mark_read(alert_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await _get_alert(db, alert_id, current.id)
    a.read_at = a.read_at or datetime.now(timezone.utc)
    await db.commit()
    return alerts.serialize(a)


@router.post("/alerts/{alert_id}/dismiss")
async def dismiss(alert_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await _get_alert(db, alert_id, current.id)
    a.status = "DISMISSED"
    a.read_at = a.read_at or datetime.now(timezone.utc)
    await db.commit()
    return alerts.serialize(a)


@router.get("/renewals")
async def renewals(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Policy).where(Policy.user_id == current.id))
    upcoming, missing = [], []
    for p in r.scalars().all():
        if p.policy_end_date is None:
            missing.append({"id": p.id, "policy_name": p.policy_name, "category": p.category})
            continue
        d = alerts.days_to_expiry(p.policy_end_date)
        upcoming.append({
            "id": p.id, "policy_name": p.policy_name, "category": p.category,
            "policy_start_date": p.policy_start_date.isoformat() if p.policy_start_date else None,
            "policy_end_date": p.policy_end_date.isoformat(), "days_left": d,
            "status": "EXPIRED" if d < 0 else "DUE_SOON" if d <= 30 else "ACTIVE",
        })
    upcoming.sort(key=lambda x: x["days_left"])
    return {"upcoming": upcoming, "missing_dates": missing}
