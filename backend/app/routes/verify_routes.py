"""Blockchain verification center routes + PDF report generation."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database import get_db
from app.models import User, Policy, Verification, VerificationLog
from app.schemas import VerifyHashRequest
from app.auth import get_current_user
from app import ipfs, blockchain, report, alerts

router = APIRouter(tags=["verification"])


def _log(db, user_id, policy: Policy, source: str, query: str, current_hash: str, result: str):
    db.add(VerificationLog(user_id=user_id, policy_id=policy.id, policy_name=policy.policy_name, source=source,
                           query=query, stored_hash=policy.document_hash, current_hash=current_hash, result=result))


@router.post("/verify")
async def verify_document(payload: VerifyHashRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Verify integrity by SHA-256 hash or policy id. Recomputes hash from the IPFS-stored
    document and compares with the immutable on-chain record -> genuine tamper detection."""
    q = payload.query.strip()
    result = await db.execute(
        select(Policy).where(Policy.user_id == current.id).where((Policy.document_hash == q) | (Policy.id == q))
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="No policy found for this hash or ID.")
    await db.refresh(policy, ["verification"])

    data = ipfs.get(policy.ipfs_cid)
    if data is None:
        integrity = {"status": "DOCUMENT_MODIFIED", "matches": False, "current_hash": "", "stored_hash": policy.document_hash}
    else:
        integrity = blockchain.verify_integrity(policy.document_hash, data)

    v = policy.verification
    _log(db, current.id, policy, "MANUAL", q, integrity["current_hash"], integrity["status"])
    if not integrity["matches"]:
        if v:
            v.status = "DOCUMENT_MODIFIED"
        await alerts.raise_alert(
            db, current.id, policy, "FRAUD", "critical", f"Hash mismatch detected: {policy.policy_name}",
            "Verification failed: the stored document's SHA-256 fingerprint no longer matches its on-chain record.",
            f"fraud:{policy.id}", {"stored_hash": policy.document_hash, "current_hash": integrity["current_hash"], "source": "MANUAL"},
        )
    await db.commit()
    return {
        "policy_id": policy.id,
        "policy_name": policy.policy_name,
        "document_hash": policy.document_hash,
        "ipfs_cid": policy.ipfs_cid,
        "tx_hash": v.tx_hash if v else "",
        "block_number": v.block_number if v else 0,
        "contract_address": v.contract_address if v else "",
        "network": v.network if v else "",
        "verified_at": v.verified_at.isoformat() if v else None,
        "ledger_mode": blockchain.MODE,
        "integrity_status": integrity["status"],
        "matches": integrity["matches"],
        "current_hash": integrity["current_hash"],
    }


@router.post("/verify/reupload")
async def verify_reupload(policy_id: str = Form(...), file: UploadFile = File(...), current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Re-verify a copy the user holds: hash the uploaded file and compare with the on-chain record."""
    result = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == current.id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    await db.refresh(policy, ["verification"])
    current_hash = blockchain.sha256_hex(data)
    on_chain = blockchain.lookup(policy.document_hash)
    matches = current_hash == policy.document_hash and on_chain is not None
    status = "VERIFIED" if matches else "DOCUMENT_MODIFIED"
    _log(db, current.id, policy, "REUPLOAD", file.filename or "", current_hash, status)
    if not matches:
        await alerts.raise_alert(
            db, current.id, policy, "FRAUD", "critical", f"Re-uploaded copy does not match: {policy.policy_name}",
            f"The file '{file.filename}' you re-uploaded has a different SHA-256 fingerprint than the version anchored on-chain. "
            "This copy may have been altered or is not the original document.",
            f"fraud:{policy.id}:reupload:{current_hash[:16]}",
            {"stored_hash": policy.document_hash, "current_hash": current_hash, "source": "REUPLOAD", "file_name": file.filename},
        )
    await db.commit()
    v = policy.verification
    return {
        "policy_id": policy.id, "policy_name": policy.policy_name, "file_name": file.filename,
        "document_hash": policy.document_hash, "current_hash": current_hash, "ipfs_cid": policy.ipfs_cid,
        "tx_hash": v.tx_hash if v else "", "block_number": v.block_number if v else 0,
        "contract_address": v.contract_address if v else "", "network": v.network if v else "",
        "verified_at": v.verified_at.isoformat() if v else None,
        "ledger_mode": blockchain.MODE,
        "integrity_status": status, "matches": matches,
    }


@router.get("/verify/history")
async def verification_history(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(VerificationLog).where(VerificationLog.user_id == current.id).order_by(VerificationLog.created_at.desc()).limit(100))
    return [{
        "id": l.id, "policy_id": l.policy_id, "policy_name": l.policy_name, "source": l.source, "query": l.query,
        "stored_hash": l.stored_hash, "current_hash": l.current_hash, "result": l.result, "created_at": l.created_at.isoformat(),
    } for l in r.scalars().all()]


@router.get("/verify/{policy_id}")
async def verification_details(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == current.id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")
    await db.refresh(policy, ["verification"])
    v = policy.verification
    if not v:
        raise HTTPException(status_code=404, detail="No verification record.")
    return {
        "policy_id": policy.id, "policy_name": policy.policy_name, "category": policy.category,
        "document_hash": v.document_hash, "ipfs_cid": v.ipfs_cid, "tx_hash": v.tx_hash,
        "block_number": v.block_number, "contract_address": v.contract_address,
        "network": v.network, "status": v.status, "verified_at": v.verified_at.isoformat(),
        "ledger_mode": blockchain.MODE,
    }


@router.get("/report/{policy_id}")
async def generate_report(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == current.id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")
    await db.refresh(policy, ["analysis", "risk", "verification"])
    if not (policy.analysis and policy.risk and policy.verification):
        raise HTTPException(status_code=400, detail="Policy analysis is incomplete.")
    pdf_bytes = report.generate_report(policy, policy.analysis, policy.risk, policy.verification, current)
    filename = f"VeriTrust_Report_{policy.policy_name.replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
