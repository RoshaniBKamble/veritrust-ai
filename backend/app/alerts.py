"""Fraud (hash-mismatch) alerts and renewal reminders.

Everything here is derived from the logged-in user's real policies: integrity is
re-checked by re-hashing the stored document against the on-chain record, and renewal
reminders come from the policy's own expiry date. Nothing is seeded or simulated.
"""
from datetime import date, datetime, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Policy, Alert, VerificationLog
from app import ipfs, blockchain

RENEWAL_WINDOWS = (7, 15, 30)


def days_to_expiry(end: date | None) -> int | None:
    return (end - date.today()).days if end else None


def serialize(a: Alert) -> dict:
    return {
        "id": a.id, "policy_id": a.policy_id, "type": a.type, "severity": a.severity,
        "title": a.title, "message": a.message, "status": a.status, "meta": a.meta or {},
        "created_at": a.created_at.isoformat(), "read_at": a.read_at.isoformat() if a.read_at else None,
    }


async def _find(db: AsyncSession, user_id: str, dedupe_key: str) -> Alert | None:
    r = await db.execute(select(Alert).where(Alert.user_id == user_id, Alert.dedupe_key == dedupe_key))
    return r.scalar_one_or_none()


async def raise_alert(db, user_id, policy, type_, severity, title, message, dedupe_key, meta) -> tuple[Alert, bool]:
    """Create an alert once per dedupe_key. Returns (alert, created). Dismissed alerts stay dismissed."""
    meta = {**meta, "policy_name": policy.policy_name, "category": policy.category}
    existing = await _find(db, user_id, dedupe_key)
    if existing:
        if existing.status == "RESOLVED":
            existing.status, existing.meta, existing.read_at = "ACTIVE", meta, None
            existing.created_at = datetime.now(timezone.utc)
            return existing, True
        return existing, False
    a = Alert(user_id=user_id, policy_id=policy.id, type=type_, severity=severity, title=title,
              message=message, dedupe_key=dedupe_key, meta=meta)
    db.add(a)
    return a, True


async def run_integrity_sweep(db: AsyncSession, user: User) -> int:
    """Re-hash every stored document and compare with its on-chain record. Flags mismatches."""
    result = await db.execute(select(Policy).where(Policy.user_id == user.id))
    flagged = 0
    for p in result.scalars().all():
        await db.refresh(p, ["verification"])
        v = p.verification
        if not v:
            continue
        data = ipfs.get(p.ipfs_cid)
        if data is None:
            integrity = {"matches": False, "current_hash": ""}
        else:
            integrity = blockchain.verify_integrity(p.document_hash, data)
        key = f"fraud:{p.id}"
        if not integrity["matches"]:
            v.status = "DOCUMENT_MODIFIED"
            _, created = await raise_alert(
                db, user.id, p, "FRAUD", "critical",
                f"Hash mismatch detected: {p.policy_name}",
                "The stored document's SHA-256 fingerprint no longer matches its immutable on-chain record. "
                "This document may have been altered — do not rely on it until re-verified with the insurer.",
                key, {"stored_hash": p.document_hash, "current_hash": integrity["current_hash"], "source": "AUTO_SWEEP"},
            )
            if created:
                db.add(VerificationLog(user_id=user.id, policy_id=p.id, policy_name=p.policy_name, source="AUTO_SWEEP",
                                       stored_hash=p.document_hash, current_hash=integrity["current_hash"], result="DOCUMENT_MODIFIED"))
            flagged += 1
        else:
            if v.status == "DOCUMENT_MODIFIED":
                v.status = "VERIFIED"
            existing = await _find(db, user.id, key)
            if existing and existing.status == "ACTIVE":
                existing.status = "RESOLVED"
    await db.commit()
    return flagged


async def run_renewal_check(db: AsyncSession, user: User) -> int:
    result = await db.execute(select(Policy).where(Policy.user_id == user.id, Policy.policy_end_date.is_not(None)))
    raised = 0
    for p in result.scalars().all():
        d = days_to_expiry(p.policy_end_date)
        end = p.policy_end_date.isoformat()
        if d < 0:
            key, sev, window = f"renewal:{p.id}:expired", "critical", 0
            title = f"{p.policy_name} has expired"
            msg = f"This policy ended on {end}. You are no longer covered — renew or replace it as soon as possible."
        else:
            window = next((w for w in RENEWAL_WINDOWS if d <= w), None)
            if window is None:
                continue
            key = f"renewal:{p.id}:{window}"
            sev = {7: "high", 15: "medium", 30: "low"}[window]
            title = f"{p.policy_name} expires " + ("today" if d == 0 else f"in {d} day{'s' if d != 1 else ''}")
            msg = f"Your renewal window is open — this policy ends on {end}. Renew before then to avoid a coverage gap."
        _, created = await raise_alert(db, user.id, p, "RENEWAL", sev, title, msg, key,
                                       {"days_left": d, "end_date": end, "window": window})
        raised += int(created)
        # a tighter window supersedes earlier reminders for the same policy
        others = await db.execute(select(Alert).where(Alert.policy_id == p.id, Alert.type == "RENEWAL",
                                                      Alert.status == "ACTIVE", Alert.dedupe_key != key))
        for o in others.scalars().all():
            o.status = "RESOLVED"
    await db.commit()
    return raised


async def reset_renewal_alerts(db: AsyncSession, policy_id: str):
    """Called when the user edits a policy's dates so reminders are recomputed from scratch."""
    await db.execute(delete(Alert).where(Alert.policy_id == policy_id, Alert.type == "RENEWAL"))
