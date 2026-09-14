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
  "recommendations": ["short actionable recommendation 1", "recommendation 2", ...],
  "simple_explanation": "One friendly paragraph (4-6 sentences) explaining this policy to a normal person with no insurance knowledge",
  "risk_factors": {{ {", ".join([f'"{f}": {{"score": <0-100 integer>, "reason": "why this score"}}' for f in factors])} }}
}}

Rules:
- risk score per factor: 0 = very safe/favorable for the customer, 100 = very risky/unfavorable.
- Base every value strictly on the ACTUAL policy text. If information is missing, say so and treat missing critical info as higher risk.
- Keep all "simple" explanations very short and jargon-free.

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
