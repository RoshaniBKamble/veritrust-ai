"""Professional PDF report generation using ReportLab."""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(name="H1v", fontSize=22, leading=26, textColor=colors.HexColor("#0C1427"), spaceAfter=6, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle(name="Sub", fontSize=10, textColor=colors.HexColor("#64748B"), spaceAfter=14))
    ss.add(ParagraphStyle(name="H2v", fontSize=13, leading=16, textColor=colors.HexColor("#059669"), spaceBefore=12, spaceAfter=6, fontName="Helvetica-Bold"))
    ss.add(ParagraphStyle(name="Bodyv", fontSize=9.5, leading=14, textColor=colors.HexColor("#1E293B")))
    ss.add(ParagraphStyle(name="Mono", fontSize=8, leading=11, textColor=colors.HexColor("#334155"), fontName="Courier"))
    return ss


def _list_flow(items, ss, key_simple=True):
    flow = []
    for it in items or []:
        if isinstance(it, dict):
            head = it.get("item") or it.get("term") or ""
            simple = it.get("simple") or ""
            txt = f"<b>{head}</b> — {simple}" if simple else f"<b>{head}</b>"
        else:
            txt = f"{it}"
        flow.append(Paragraph(f"• {txt}", ss["Bodyv"]))
        flow.append(Spacer(1, 2))
    if not flow:
        flow.append(Paragraph("None mentioned.", ss["Bodyv"]))
    return flow


def generate_report(policy, analysis, risk, verification, user) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=16 * mm, rightMargin=16 * mm)
    ss = _styles()
    story = []

    story.append(Paragraph("VeriTrust AI — Policy Analysis Report", ss["H1v"]))
    story.append(Paragraph("AI-Powered Insurance Intelligence &amp; Blockchain Verification", ss["Sub"]))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#10B981"), thickness=1.4))
    story.append(Spacer(1, 8))

    meta = [
        ["Policy Name", policy.policy_name, "Category", policy.category.title()],
        ["Owner", user.full_name, "Email", user.email],
        ["Upload Date", policy.upload_date.strftime("%d %b %Y %H:%M"), "Report Date", datetime.utcnow().strftime("%d %b %Y")],
    ]
    t = Table(meta, colWidths=[70, 160, 70, 160])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748B")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#64748B")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))

    story.append(Paragraph("AI Summary", ss["H2v"]))
    story.append(Paragraph(analysis.summary or "-", ss["Bodyv"]))

    story.append(Paragraph("Simple Explanation", ss["H2v"]))
    story.append(Paragraph(analysis.simple_explanation_en or "-", ss["Bodyv"]))

    story.append(Paragraph(f"Overall Risk Score: {risk.overall_score}/100  ({risk.risk_level} Risk)", ss["H2v"]))
    rows = [["Risk Factor", "Score", "Weight %"]]
    for b in risk.breakdown or []:
        rows.append([b.get("factor", ""), str(b.get("score", "")), str(b.get("weight", ""))])
    rt = Table(rows, colWidths=[200, 80, 80])
    rt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0C1427")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
    ]))
    story.append(rt)

    if risk.reasons:
        story.append(Paragraph("Why This Risk?", ss["H2v"]))
        story.extend(_list_flow(risk.reasons, ss))

    for title, items in [
        ("Key Benefits", analysis.benefits),
        ("Coverage", analysis.coverage),
        ("Exclusions", analysis.exclusions),
        ("Claim Conditions", analysis.claim_conditions),
        ("Limitations", analysis.limitations),
        ("Recommendations", analysis.recommendations),
    ]:
        story.append(Paragraph(title, ss["H2v"]))
        story.extend(_list_flow(items, ss))

    story.append(Paragraph("Waiting Period", ss["H2v"]))
    story.append(Paragraph(analysis.waiting_period or "None mentioned.", ss["Bodyv"]))
    story.append(Paragraph("Premium Information", ss["H2v"]))
    story.append(Paragraph(analysis.premium_info or "Not specified.", ss["Bodyv"]))

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#3B82F6"), thickness=1.2))
    story.append(Paragraph("Blockchain Verification", ss["H2v"]))
    story.append(Paragraph(f"Status: <b>{verification.status}</b>", ss["Bodyv"]))
    story.append(Paragraph(f"Network: {verification.network}", ss["Bodyv"]))
    story.append(Paragraph(f"Document Hash (SHA-256):", ss["Bodyv"]))
    story.append(Paragraph(verification.document_hash, ss["Mono"]))
    story.append(Paragraph("IPFS CID:", ss["Bodyv"]))
    story.append(Paragraph(verification.ipfs_cid, ss["Mono"]))
    story.append(Paragraph("Transaction Hash:", ss["Bodyv"]))
    story.append(Paragraph(verification.tx_hash, ss["Mono"]))
    story.append(Paragraph(f"Block Number: {verification.block_number}", ss["Bodyv"]))

    doc.build(story)
    buf.seek(0)
    return buf.read()
