"""Policy routes: upload (full pipeline), list/history, detail, delete, dashboard, compare."""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, Policy, Analysis, RiskAnalysis, Verification
from app.schemas import PolicySummary, PolicyDetail, AnalysisOut, RiskOut, VerificationOut, CompareRequest
from app.auth import get_current_user
from app import ocr, ipfs, blockchain, ai

router = APIRouter(prefix="/policies", tags=["policies"])

ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
CATEGORIES = {"health", "vehicle", "home", "travel", "life"}


def _analysis_out(a: Analysis | None):
    return AnalysisOut.model_validate(a) if a else None


def _risk_out(r: RiskAnalysis | None):
    return RiskOut.model_validate(r) if r else None


def _verif_out(v: Verification | None):
    return VerificationOut.model_validate(v) if v else None


async def _load_full(db: AsyncSession, policy_id: str, user_id: str) -> Policy:
    result = await db.execute(select(Policy).where(Policy.id == policy_id, Policy.user_id == user_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found.")
    await db.refresh(policy, ["analysis", "risk", "verification"])
    return policy


@router.post("/upload", response_model=PolicyDetail)
async def upload_policy(
    category: str = Form(...),
    policy_name: str = Form(""),
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = category.lower().strip()
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid insurance category.")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, JPEG or PNG.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 15MB).")

    # 1. Extract text (PDF text layer or Tesseract OCR)
    text = ocr.extract_text(data, file.filename, file.content_type)
    if not text or len(text.strip()) < 20:
        raise HTTPException(status_code=422, detail="Could not extract readable text from this document. Please upload a clearer policy file.")

    # 2. AI analysis + explainable risk
    ai_result = await ai.analyze_policy(text, category)
    a = ai_result["analysis"]
    r = ai_result["risk"]

    # 3. Multilingual simple explanations
    simple_en = a.get("simple_explanation", "")
    simple_hi = await ai.translate_text(simple_en, "hi")
    simple_mr = await ai.translate_text(simple_en, "mr")

    # 4. SHA-256 hash + 5. IPFS storage (real CID) + 6. Blockchain record
    document_hash = blockchain.sha256_hex(data)
    cid = ipfs.add(data)
    receipt = blockchain.record_on_chain(document_hash, cid)

    # 7. Persist to PostgreSQL (linked by IDs)
    policy = Policy(
        user_id=current.id,
        policy_name=(policy_name or file.filename or "Policy").strip(),
        category=category,
        file_name=file.filename or "document",
        file_type=ext.lstrip("."),
        file_size=len(data),
        extracted_text=text[:200000],
        ipfs_cid=cid,
        document_hash=document_hash,
    )
    db.add(policy)
    await db.flush()

    analysis = Analysis(
        policy_id=policy.id,
        summary=a.get("summary", ""),
        insurance_type=a.get("insurance_type", category),
        benefits=a.get("benefits", []),
        coverage=a.get("coverage", []),
        exclusions=a.get("exclusions", []),
        waiting_period=a.get("waiting_period", ""),
        claim_conditions=a.get("claim_conditions", []),
        limitations=a.get("limitations", []),
        important_terms=a.get("important_terms", []),
        premium_info=a.get("premium_info", ""),
        recommendations=a.get("recommendations", []),
        simple_explanation_en=simple_en,
        simple_explanation_hi=simple_hi,
        simple_explanation_mr=simple_mr,
    )
    risk = RiskAnalysis(
        policy_id=policy.id,
        overall_score=r["overall_score"],
        risk_level=r["risk_level"],
        breakdown=r["breakdown"],
        reasons=r["reasons"],
        concerns=r["concerns"],
    )
    verification = Verification(
        policy_id=policy.id,
        document_hash=document_hash,
        ipfs_cid=cid,
        tx_hash=receipt["tx_hash"],
        block_number=receipt["block_number"],
        contract_address=receipt["contract_address"],
        network=receipt["network"],
        status="VERIFIED",
    )
    db.add_all([analysis, risk, verification])
    await db.commit()

    policy = await _load_full(db, policy.id, current.id)
    return PolicyDetail(
        id=policy.id, policy_name=policy.policy_name, category=policy.category,
        upload_date=policy.upload_date, file_name=policy.file_name, file_type=policy.file_type,
        file_size=policy.file_size, ipfs_cid=policy.ipfs_cid, document_hash=policy.document_hash,
        analysis=_analysis_out(policy.analysis), risk=_risk_out(policy.risk), verification=_verif_out(policy.verification),
    )


@router.get("", response_model=list[PolicySummary])
async def list_policies(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy).where(Policy.user_id == current.id).order_by(Policy.upload_date.desc()))
    policies = result.scalars().all()
    out = []
    for p in policies:
        await db.refresh(p, ["risk", "verification"])
        out.append(PolicySummary(
            id=p.id, policy_name=p.policy_name, category=p.category, upload_date=p.upload_date,
            document_hash=p.document_hash, ipfs_cid=p.ipfs_cid,
            risk_score=p.risk.overall_score if p.risk else None,
            risk_level=p.risk.risk_level if p.risk else None,
            verification_status=p.verification.status if p.verification else None,
        ))
    return out


@router.get("/dashboard")
async def dashboard(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy).where(Policy.user_id == current.id).order_by(Policy.upload_date.desc()))
    policies = result.scalars().all()
    total = len(policies)
    verified = 0
    scores = []
    category_dist = {}
    level_dist = {"Low": 0, "Medium": 0, "High": 0}
    recent = []
    for p in policies:
        await db.refresh(p, ["risk", "verification"])
        if p.verification and p.verification.status == "VERIFIED":
            verified += 1
        if p.risk:
            scores.append(p.risk.overall_score)
            level_dist[p.risk.risk_level] = level_dist.get(p.risk.risk_level, 0) + 1
        category_dist[p.category] = category_dist.get(p.category, 0) + 1
    for p in policies[:5]:
        recent.append({
            "id": p.id, "policy_name": p.policy_name, "category": p.category,
            "upload_date": p.upload_date.isoformat(),
            "risk_score": p.risk.overall_score if p.risk else None,
            "risk_level": p.risk.risk_level if p.risk else None,
            "verification_status": p.verification.status if p.verification else None,
        })
    avg = round(sum(scores) / len(scores)) if scores else 0
    return {
        "total_policies": total,
        "verified_policies": verified,
        "average_risk_score": avg,
        "category_distribution": [{"name": k, "value": v} for k, v in category_dist.items()],
        "risk_level_distribution": [{"name": k, "value": v} for k, v in level_dist.items()],
        "recent_policies": recent,
    }


@router.get("/{policy_id}", response_model=PolicyDetail)
async def get_policy(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _load_full(db, policy_id, current.id)
    return PolicyDetail(
        id=p.id, policy_name=p.policy_name, category=p.category, upload_date=p.upload_date,
        file_name=p.file_name, file_type=p.file_type, file_size=p.file_size,
        ipfs_cid=p.ipfs_cid, document_hash=p.document_hash,
        analysis=_analysis_out(p.analysis), risk=_risk_out(p.risk), verification=_verif_out(p.verification),
    )


@router.delete("/{policy_id}")
async def delete_policy(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _load_full(db, policy_id, current.id)
    await db.delete(p)
    await db.commit()
    return {"deleted": policy_id}


@router.get("/{policy_id}/document")
async def get_document(policy_id: str, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await _load_full(db, policy_id, current.id)
    data = ipfs.get(p.ipfs_cid)
    if data is None:
        raise HTTPException(status_code=404, detail="Document not found in IPFS store.")
    media = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(p.file_type, "application/octet-stream")
    return Response(content=data, media_type=media, headers={"Content-Disposition": f'inline; filename="{p.file_name}"'})


@router.post("/compare")
async def compare(payload: CompareRequest, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pa = await _load_full(db, payload.policy_a_id, current.id)
    pb = await _load_full(db, payload.policy_b_id, current.id)

    def pack(p: Policy):
        return {
            "policy_name": p.policy_name, "category": p.category,
            "summary": p.analysis.summary if p.analysis else "",
            "coverage": p.analysis.coverage if p.analysis else [],
            "exclusions": p.analysis.exclusions if p.analysis else [],
            "waiting_period": p.analysis.waiting_period if p.analysis else "",
            "claim_conditions": p.analysis.claim_conditions if p.analysis else [],
            "limitations": p.analysis.limitations if p.analysis else [],
            "premium_info": p.analysis.premium_info if p.analysis else "",
            "risk_score": p.risk.overall_score if p.risk else None,
        }

    comparison = await ai.compare_policies(pack(pa), pack(pb))
    return {
        "policy_a": {"id": pa.id, "name": pa.policy_name, "risk_score": pa.risk.overall_score if pa.risk else None},
        "policy_b": {"id": pb.id, "name": pb.policy_name, "risk_score": pb.risk.overall_score if pb.risk else None},
        "comparison": comparison,
    }
