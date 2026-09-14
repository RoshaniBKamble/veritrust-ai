"""AI policy intelligence using Emergent Universal LLM Key + Claude Sonnet 4.6.

Produces STRUCTURED analysis (JSON), simplified explanations, multilingual translations,
grounded policy Q&A and policy comparison. Risk scoring is explainable: the LLM assigns
per-factor risk (0-100) with reasons and Python computes a deterministic, category-weighted
overall score (never random).
"""
import os
import re
import json
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-6"

# Category-specific risk factor weights (sum to 1.0). Drives explainable scoring.
RISK_WEIGHTS = {
    "health": {"coverage": 0.20, "exclusions": 0.25, "waiting_period": 0.20, "claim_conditions": 0.20, "benefit_limitations": 0.15},
    "vehicle": {"coverage": 0.30, "deductibles": 0.25, "exclusions": 0.25, "claim_conditions": 0.20},
    "home": {"coverage": 0.30, "exclusions": 0.25, "limitations": 0.25, "claim_conditions": 0.20},
    "travel": {"coverage": 0.30, "exclusions": 0.30, "limitations": 0.20, "claim_conditions": 0.20},
    "life": {"coverage": 0.30, "exclusions": 0.30, "conditions": 0.20, "premium": 0.20},
}

LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}


async def _complete(system_message: str, user_text: str, session_id: str | None = None) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id or str(uuid.uuid4()),
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    parts: list[str] = []
    async for ev in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(ev, TextDelta):
            parts.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(parts).strip()


def _parse_json(text: str) -> dict:
    text = text.strip()
    # strip markdown code fences if present
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # grab the outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


async def analyze_policy(policy_text: str, category: str) -> dict:
    category = (category or "health").lower()
    factors = list(RISK_WEIGHTS.get(category, RISK_WEIGHTS["health"]).keys())
    snippet = policy_text[:16000] if policy_text else ""

    system = (
        "You are VeriTrust AI, an expert insurance policy analyst. You read complex insurance "
        "policy text and produce a STRUCTURED analysis that an ordinary person can understand. "
        "You translate legal jargon into very simple, short, friendly language. "
        "You ALWAYS respond with a single valid JSON object and NOTHING else."
    )
    prompt = f"""Analyze this {category.upper()} insurance policy text and return ONLY a JSON object with EXACTLY these keys:

{{
  "summary": "2-3 sentence plain-language summary of the whole policy",
  "insurance_type": "{category}",
  "benefits": ["key benefit 1", "key benefit 2", ...],
  "coverage": [{{"item": "what is covered", "simple": "very simple one-line explanation"}}],
  "exclusions": [{{"item": "what is NOT covered / legal wording", "simple": "very simple one-line explanation"}}],
  "waiting_period": "plain-language description of any waiting periods, or 'None mentioned'",
  "claim_conditions": [{{"item": "condition", "simple": "very simple explanation"}}],
  "limitations": [{{"item": "limitation / cap", "simple": "very simple explanation"}}],
  "important_terms": [{{"term": "term", "simple": "very simple explanation"}}],
  "premium_info": "premium details if present, else 'Not specified in document'",
  "policy_start_date": "YYYY-MM-DD if a policy start / commencement / inception date is stated in the text, else null",
  "policy_end_date": "YYYY-MM-DD if a policy end / expiry / maturity date is stated (or derivable from start date + policy term), else null",
  "recommendations": ["short actionable recommendation 1", "recommendation 2", ...],
  "simple_explanation": "One friendly paragraph (4-6 sentences) explaining this policy to a normal person with no insurance knowledge",
  "risk_factors": {{ {", ".join([f'"{f}": {{"score": <0-100 integer>, "reason": "why this score"}}' for f in factors])} }}
}}

Rules:
- risk score per factor: 0 = very safe/favorable for the customer, 100 = very risky/unfavorable.
- Base every value strictly on the ACTUAL policy text. If information is missing, say so and treat missing critical info as higher risk.
- Keep all "simple" explanations very short and jargon-free.
- NEVER invent dates. Use null for policy_start_date / policy_end_date unless the document clearly states them.

POLICY TEXT:
\"\"\"
{snippet}
\"\"\"
"""
    raw = await _complete(system, prompt)
    data = _parse_json(raw)

    # Deterministic, explainable overall risk score (weighted, never random).
    weights = RISK_WEIGHTS.get(category, RISK_WEIGHTS["health"])
    rf = data.get("risk_factors", {}) or {}
    breakdown = []
    weighted_sum = 0.0
    reasons = []
    for factor, weight in weights.items():
        entry = rf.get(factor, {}) if isinstance(rf.get(factor), dict) else {}
        score = entry.get("score", 50)
        try:
            score = max(0, min(100, int(round(float(score)))))
        except Exception:
            score = 50
        reason = entry.get("reason", "")
        weighted_sum += score * weight
        breakdown.append({
            "factor": factor.replace("_", " ").title(),
            "score": score,
            "weight": round(weight * 100),
            "reason": reason,
        })
        if score >= 60 and reason:
            reasons.append(reason)

    overall = int(round(weighted_sum))
    overall = max(0, min(100, overall))
    if overall <= 35:
        level = "Low"
    elif overall <= 69:
        level = "Medium"
    else:
        level = "High"

    concerns = [b["reason"] for b in sorted(breakdown, key=lambda x: -x["score"])[:3] if b["reason"]]

    return {
        "analysis": data,
        "risk": {
            "overall_score": overall,
            "risk_level": level,
            "breakdown": breakdown,
            "reasons": reasons or concerns,
            "concerns": concerns,
        },
    }


async def translate_text(text: str, target_lang: str) -> str:
    if not text or target_lang == "en":
        return text
    lang_name = LANG_NAMES.get(target_lang, "English")
    system = f"You are a translator. Translate the user's text into {lang_name}. Keep it simple, natural and easy to understand. Return ONLY the translation, no notes."
    return await _complete(system, text)


async def answer_question(question: str, policy_context: str, language: str = "en") -> str:
    lang_name = LANG_NAMES.get(language, "English")
    system = (
        "You are VeriTrust AI, a friendly insurance assistant. Answer the user's question using ONLY the "
        "provided policy information. If the policy does not mention it, clearly say the policy does not specify it. "
        f"Answer in {lang_name}. Keep the answer clear, short, simple and easy to understand."
    )
    prompt = f"POLICY INFORMATION:\n{policy_context[:14000]}\n\nUSER QUESTION: {question}"
    return await _complete(system, prompt)


async def compare_policies(a: dict, b: dict) -> dict:
    system = (
        "You are VeriTrust AI. Compare two insurance policies for a normal customer and return ONLY a JSON object: "
        '{"summary": "short comparison in simple words", "recommendation": "which is better and why, one sentence", '
        '"winner": "A" or "B" or "Tie", "rows": [{"factor": "Coverage", "a": "...", "b": "...", "better": "A|B|Tie"}]}. '
        "Cover factors: Coverage, Benefits, Exclusions, Waiting Period, Claim Conditions, Limitations, Premium, Risk Score."
    )
    prompt = f"POLICY A:\n{json.dumps(a)[:7000]}\n\nPOLICY B:\n{json.dumps(b)[:7000]}"
    raw = await _complete(system, prompt)
    try:
        return _parse_json(raw)
    except Exception:
        return {"summary": raw, "recommendation": "", "winner": "Tie", "rows": []}


CLAIM_VERDICTS = {"LIKELY_COVERED", "LIKELY_NOT_COVERED", "CONDITIONS_APPLY"}
RENEWAL_VERDICTS = {"RENEW", "RENEW_WITH_CAUTION", "LOOK_ELSEWHERE"}


async def claim_check(situation: str, policy_context: str, raw_text: str, language: str = "en") -> dict:
    """Claim readiness guidance grounded ONLY in the uploaded policy. Never guarantees approval."""
    lang_name = LANG_NAMES.get(language, "English")
    system = (
        "You are VeriTrust AI, a careful insurance claim-readiness assistant. You judge whether a described situation "
        "is LIKELY covered by the user's own policy, using ONLY the policy content provided. You never guarantee approval. "
        "You quote the exact clause text from the document. You ALWAYS respond with a single valid JSON object and NOTHING else."
    )
    prompt = f"""The user asks: "Can I claim for this?" Situation: \"\"\"{situation.strip()}\"\"\"

Return ONLY this JSON (all human-readable strings in {lang_name}; quoted clauses stay in the document's original wording):
{{
  "verdict": "LIKELY_COVERED" | "LIKELY_NOT_COVERED" | "CONDITIONS_APPLY",
  "reason": "ONE short, very simple sentence explaining the verdict",
  "clauses": [{{"clause": "exact sentence(s) copied verbatim from the POLICY TEXT that decide this", "simple": "what it means in one plain sentence"}}],
  "conditions": ["condition the user must meet or check (waiting period, limit, documents, time window) — short"],
  "next_steps": ["practical short step, e.g. 'Keep the hospital discharge summary'"]
}}

Rules:
- Use CONDITIONS_APPLY when coverage depends on waiting periods, sub-limits, network hospitals, prior approval, or missing details.
- Use LIKELY_NOT_COVERED when an exclusion clearly applies. Use LIKELY_COVERED only when the policy clearly covers it.
- If the policy does not mention the situation at all, use CONDITIONS_APPLY and say the policy does not specify it.
- Quote 1-3 clauses maximum, verbatim from POLICY TEXT. If no exact clause exists, return an empty clauses list — never invent text.
- Keep everything short and jargon-free.

STRUCTURED POLICY INFO:
{policy_context[:6000]}

POLICY TEXT:
\"\"\"
{raw_text[:14000]}
\"\"\"
"""
    raw = await _complete(system, prompt)
    try:
        data = _parse_json(raw)
    except Exception:
        data = {"verdict": "CONDITIONS_APPLY", "reason": raw[:400], "clauses": [], "conditions": [], "next_steps": []}
    if data.get("verdict") not in CLAIM_VERDICTS:
        data["verdict"] = "CONDITIONS_APPLY"
    for k in ("clauses", "conditions", "next_steps"):
        if not isinstance(data.get(k), list):
            data[k] = []
    data["reason"] = str(data.get("reason", ""))
    return data


async def renewal_compare(original: dict, quote: dict, days_left: int | None) -> dict:
    """Side-by-side of an expiring policy vs its renewal quote with a careful, plain-language verdict."""
    system = (
        "You are VeriTrust AI. A customer's current policy is expiring and they uploaded a renewal quote. Compare them for an "
        "ordinary person in very simple words, using ONLY the provided data. This is AI guidance, not financial advice. "
        "ALWAYS respond with a single valid JSON object and NOTHING else."
    )
    deadline = f"The current policy expires in {days_left} days." if days_left is not None else "Expiry date not confirmed."
    prompt = f"""{deadline}

Return ONLY this JSON:
{{
  "verdict": "RENEW" | "RENEW_WITH_CAUTION" | "LOOK_ELSEWHERE",
  "reason": "1-2 very simple sentences explaining the verdict",
  "summary": "2-3 simple sentences summarising how the renewal quote differs from the current policy",
  "rows": [
    {{"factor": "Coverage", "original": "short plain text", "quote": "short plain text", "better": "ORIGINAL" | "QUOTE" | "SAME"}},
    {{"factor": "Exclusions", ...}}, {{"factor": "Waiting Period", ...}}, {{"factor": "Claim Conditions", ...}},
    {{"factor": "Limits", ...}}, {{"factor": "Premium", ...}}, {{"factor": "Risk Score", ...}}
  ],
  "changes": {{
    "improved": ["short plain-language item that got better in the quote"],
    "worse": ["short item that got worse in the quote"],
    "same": ["short item that stayed the same"]
  }}
}}

Rules:
- Base every statement strictly on the data. If something is not specified, say 'Not specified'.
- RENEW when the quote is equal or better overall with no new serious gaps. RENEW_WITH_CAUTION when there are some downsides worth checking. LOOK_ELSEWHERE when coverage clearly got worse or the premium rose sharply without added value.
- Keep every string short and free of legal jargon.

CURRENT (EXPIRING) POLICY:
{json.dumps(original)[:7000]}

RENEWAL QUOTE:
{json.dumps(quote)[:7000]}
"""
    raw = await _complete(system, prompt)
    try:
        data = _parse_json(raw)
    except Exception:
        data = {"verdict": "RENEW_WITH_CAUTION", "reason": raw[:400], "summary": "", "rows": [], "changes": {}}
    if data.get("verdict") not in RENEWAL_VERDICTS:
        data["verdict"] = "RENEW_WITH_CAUTION"
    if not isinstance(data.get("rows"), list):
        data["rows"] = []
    ch = data.get("changes") if isinstance(data.get("changes"), dict) else {}
    data["changes"] = {k: (ch.get(k) if isinstance(ch.get(k), list) else []) for k in ("improved", "worse", "same")}
    return data
