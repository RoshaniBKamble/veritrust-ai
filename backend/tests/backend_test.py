"""VeriTrust AI - Backend regression tests.

Covers: auth (register/login/me/update), policy list, dashboard, detail, verify,
AI ask + history, compare error handling, PDF report, auth protection.
The upload pipeline test is opt-in via RUN_UPLOAD=1 because it takes ~40-60s
(real Claude analysis + translations).
"""
import io
import os
import time
import uuid
import pytest
import requests
from reportlab.pdfgen import canvas

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://policy-simplify.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@veritrust.ai"
DEMO_PASSWORD = "demo123"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture(scope="session")
def first_policy_id(api, auth):
    r = api.get(f"{BASE_URL}/api/policies", headers=auth, timeout=30)
    assert r.status_code == 200
    items = r.json()
    if not items:
        pytest.skip("No seeded policies available for demo user")
    return items[0]["id"]


# ---------- health ----------
def test_health(api):
    r = api.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


# ---------- auth ----------
class TestAuth:
    def test_login_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == DEMO_EMAIL

    def test_login_bad_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_register_and_me(self, api):
        email = f"test_{uuid.uuid4().hex[:8]}@veritrust.ai"
        r = api.post(f"{BASE_URL}/api/auth/register", json={
            "full_name": "TEST User", "email": email, "password": "pass1234", "preferred_language": "en"
        }, timeout=30)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # duplicate email
        r2 = api.post(f"{BASE_URL}/api/auth/register", json={
            "full_name": "TEST User", "email": email, "password": "pass1234"
        }, timeout=30)
        assert r2.status_code == 400
        # me
        me = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == email
        # update profile
        upd = api.put(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"full_name": "TEST Updated", "preferred_language": "hi"},
                      timeout=15)
        assert upd.status_code == 200
        assert upd.json()["full_name"] == "TEST Updated"
        assert upd.json()["preferred_language"] == "hi"
        # verify persistence
        me2 = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert me2.json()["full_name"] == "TEST Updated"

    def test_me_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# ---------- policies ----------
class TestPolicies:
    def test_list(self, api, auth):
        r = api.get(f"{BASE_URL}/api/policies", headers=auth, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/policies", timeout=15)
        assert r.status_code in (401, 403)

    def test_dashboard(self, api, auth):
        r = api.get(f"{BASE_URL}/api/policies/dashboard", headers=auth, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_policies", "verified_policies", "average_risk_score",
                  "category_distribution", "risk_level_distribution", "recent_policies"):
            assert k in d
        assert isinstance(d["total_policies"], int)
        assert isinstance(d["recent_policies"], list)

    def test_get_detail(self, api, auth, first_policy_id):
        r = api.get(f"{BASE_URL}/api/policies/{first_policy_id}", headers=auth, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == first_policy_id
        assert d.get("document_hash") and len(d["document_hash"]) == 64
        assert d.get("ipfs_cid")
        assert d.get("analysis") is not None
        assert d.get("risk") is not None
        assert 0 <= d["risk"]["overall_score"] <= 100
        assert d["risk"]["risk_level"] in ("Low", "Medium", "High")
        assert d.get("verification") is not None
        # multilingual explanations must be present
        assert d["analysis"].get("simple_explanation_en")
        assert d["analysis"].get("simple_explanation_hi")
        assert d["analysis"].get("simple_explanation_mr")

    def test_get_not_found(self, api, auth):
        r = api.get(f"{BASE_URL}/api/policies/{uuid.uuid4()}", headers=auth, timeout=15)
        assert r.status_code == 404

    def test_document_download(self, api, auth, first_policy_id):
        r = api.get(f"{BASE_URL}/api/policies/{first_policy_id}/document", headers=auth, timeout=30)
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_compare_requires_two(self, api, auth, first_policy_id):
        # comparing same policy against itself must at least not 500
        r = api.post(f"{BASE_URL}/api/policies/compare", headers=auth,
                     json={"policy_a_id": first_policy_id, "policy_b_id": first_policy_id}, timeout=90)
        assert r.status_code in (200, 400), r.text

    def test_compare_invalid_id(self, api, auth, first_policy_id):
        r = api.post(f"{BASE_URL}/api/policies/compare", headers=auth,
                     json={"policy_a_id": first_policy_id, "policy_b_id": str(uuid.uuid4())}, timeout=30)
        assert r.status_code == 404


# ---------- verification ----------
class TestVerification:
    def test_verify_by_policy_id(self, api, auth, first_policy_id):
        r = api.post(f"{BASE_URL}/api/verify", headers=auth, json={"query": first_policy_id}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["policy_id"] == first_policy_id
        assert d["matches"] is True
        assert len(d["document_hash"]) == 64
        assert d["tx_hash"]
        assert d["ipfs_cid"]

    def test_verify_by_hash(self, api, auth, first_policy_id):
        detail = api.get(f"{BASE_URL}/api/policies/{first_policy_id}", headers=auth, timeout=15).json()
        h = detail["document_hash"]
        r = api.post(f"{BASE_URL}/api/verify", headers=auth, json={"query": h}, timeout=30)
        assert r.status_code == 200
        assert r.json()["matches"] is True

    def test_verify_not_found(self, api, auth):
        r = api.post(f"{BASE_URL}/api/verify", headers=auth, json={"query": "a" * 64}, timeout=15)
        assert r.status_code == 404

    def test_verification_details(self, api, auth, first_policy_id):
        r = api.get(f"{BASE_URL}/api/verify/{first_policy_id}", headers=auth, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "VERIFIED"
        assert d["contract_address"]

    def test_report_pdf(self, api, auth, first_policy_id):
        r = api.get(f"{BASE_URL}/api/report/{first_policy_id}", headers=auth, timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# ---------- AI Q&A ----------
class TestAI:
    def test_ask_and_history(self, api, auth, first_policy_id):
        r = api.post(f"{BASE_URL}/api/ai/ask/{first_policy_id}", headers=auth,
                     json={"question": "What is the waiting period?", "language": "en"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["question"]
        assert isinstance(d["answer"], str) and len(d["answer"]) > 5

        h = api.get(f"{BASE_URL}/api/ai/history/{first_policy_id}", headers=auth, timeout=15)
        assert h.status_code == 200
        msgs = h.json()
        assert any(m["role"] == "user" for m in msgs)
        assert any(m["role"] == "assistant" for m in msgs)


# ---------- Upload (slow - opt in) ----------
def _make_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 800, "TEST Health Insurance Policy")
    c.drawString(72, 780, "Sum insured: Rs 500000. Premium Rs 12000/yr.")
    c.drawString(72, 760, "Coverage: hospitalization, day-care, pre/post-hospitalization 30/60 days.")
    c.drawString(72, 740, "Exclusions: cosmetic surgery, self-inflicted injury, war, pre-existing 24 months.")
    c.drawString(72, 720, "Waiting period: 30 days initial, 24 months pre-existing conditions.")
    c.drawString(72, 700, "Claim conditions: intimation within 48 hours; cashless at network hospitals.")
    c.drawString(72, 680, "Limitations: room rent capped at 1% of sum insured per day.")
    c.showPage()
    c.save()
    return buf.getvalue()


@pytest.mark.skipif(os.environ.get("RUN_UPLOAD") != "1", reason="Slow: set RUN_UPLOAD=1")
def test_upload_full_pipeline(api, auth):
    files = {"file": ("test_health.pdf", _make_pdf(), "application/pdf")}
    data = {"category": "health", "policy_name": "TEST Upload Policy"}
    r = requests.post(f"{BASE_URL}/api/policies/upload",
                      headers={"Authorization": auth["Authorization"]},
                      files=files, data=data, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("document_hash") and len(d["document_hash"]) == 64
    assert d.get("analysis") and d.get("risk") and d.get("verification")
