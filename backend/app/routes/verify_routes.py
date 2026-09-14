"""Blockchain verification center routes + PDF report generation."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database import get_db
from app.models import User, Policy, Verification
from app.schemas import VerifyHashRequest
from app.auth import get_current_user
from app import ipfs, blockchain, report

router = APIRouter(tags=["verification"])


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
        "integrity_status": integrity["status"],
        "matches": integrity["matches"],
        "current_hash": integrity["current_hash"],
    }


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
