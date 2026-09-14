"""Backend tests for Claim Readiness + Renewal Compare features."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://policy-simplify.preview.emergentagent.com"
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@veritrust.ai"
DEMO_PW = "demo123"
SECUREHEALTH_ID = "0ac92545-f32c-4c46-97d7-ef04c4917f58"
TEST_UPLOAD_ID = "47182ca7-0b02-480e-afc2-f055a9cf56db"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PW}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture(scope="session")
def other_user_headers():
    email = f"testother_{int(time.time())}@veritrust.ai"
    r = requests.post(f"{API}/auth/register", json={
        "full_name": "Test Other", "email": email, "password": "test1234", "preferred_language": "en"
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    tok = r.json()["token"]
    return {"Authorization": f"Bearer {tok}"}, email


# ---------- Auth on new endpoints ----------
class TestAuthGates:
    def test_claim_check_requires_auth(self):
        r = requests.post(f"{API}/ai/claim-check/{SECUREHEALTH_ID}", json={"situation": "hello world test"}, timeout=15)
        assert r.status_code == 401

    def test_claim_history_requires_auth(self):
        r = requests.get(f"{API}/ai/claim-checks/{SECUREHEALTH_ID}", timeout=15)
        assert r.status_code == 401

    def test_renewals_overview_requires_auth(self):
        r = requests.get(f"{API}/renewals/overview", timeout=15)
        assert r.status_code == 401

    def test_renewals_compare_requires_auth(self):
        r = requests.post(f"{API}/renewals/compare", json={"original_id": "a", "quote_id": "b"}, timeout=15)
        assert r.status_code == 401

    def test_renewals_link_requires_auth(self):
        r = requests.post(f"{API}/renewals/{SECUREHEALTH_ID}/link", json={"quote_id": "x"}, timeout=15)
        assert r.status_code == 401

    def test_renewals_comparison_get_requires_auth(self):
        r = requests.get(f"{API}/renewals/comparison/{SECUREHEALTH_ID}", timeout=15)
        assert r.status_code == 401


# ---------- Claim check validation ----------
class TestClaimCheckValidation:
    def test_short_situation_422(self, demo_headers):
        r = requests.post(f"{API}/ai/claim-check/{SECUREHEALTH_ID}", headers=demo_headers, json={"situation": "hi"}, timeout=15)
        assert r.status_code == 422

    def test_unknown_policy_404(self, demo_headers):
        r = requests.post(f"{API}/ai/claim-check/00000000-0000-0000-0000-000000000000",
                          headers=demo_headers, json={"situation": "I need knee replacement surgery"}, timeout=15)
        assert r.status_code == 404

    def test_other_user_cannot_access(self, other_user_headers):
        headers, _ = other_user_headers
        r = requests.get(f"{API}/ai/claim-checks/{SECUREHEALTH_ID}", headers=headers, timeout=15)
        assert r.status_code == 404


# ---------- Claim check E2E (real AI, slow) ----------
class TestClaimCheckE2E:
    def test_history_starts_empty(self, demo_headers):
        r = requests.get(f"{API}/ai/claim-checks/{SECUREHEALTH_ID}", headers=demo_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_knee_replacement_claim_check(self, demo_headers):
        payload = {"situation": "I need knee replacement surgery next month at a private hospital", "language": "en"}
        r = requests.post(f"{API}/ai/claim-check/{SECUREHEALTH_ID}", headers=demo_headers, json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["verdict"] in {"LIKELY_COVERED", "CONDITIONS_APPLY", "LIKELY_NOT_COVERED"}
        assert data["reason"] and len(data["reason"]) > 5
        assert isinstance(data["clauses"], list) and len(data["clauses"]) >= 1
        assert data["disclaimer"].lower().startswith("ai policy guidance")
        assert data["policy_id"] == SECUREHEALTH_ID

        # persisted -> in history
        h = requests.get(f"{API}/ai/claim-checks/{SECUREHEALTH_ID}", headers=demo_headers, timeout=15)
        assert h.status_code == 200
        assert any(c["id"] == data["id"] for c in h.json())


# ---------- Renewal compare ----------
class TestRenewalOverview:
    def test_overview_lists_originals_only(self, demo_headers):
        r = requests.get(f"{API}/renewals/overview", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "policies" in data
        ids = [p["id"] for p in data["policies"]]
        # Originals should include both demo policies at start (nothing linked)
        assert SECUREHEALTH_ID in ids


class TestRenewalLinking:
    def test_self_link_400(self, demo_headers):
        r = requests.post(f"{API}/renewals/{SECUREHEALTH_ID}/link",
                          headers=demo_headers, json={"quote_id": SECUREHEALTH_ID}, timeout=15)
        assert r.status_code == 400

    def test_link_and_overview_excludes_quote(self, demo_headers):
        # unlink first via direct db not available; assume clean state (main-agent cleanup).
        r = requests.post(f"{API}/renewals/{SECUREHEALTH_ID}/link",
                          headers=demo_headers, json={"quote_id": TEST_UPLOAD_ID}, timeout=15)
        assert r.status_code == 200, r.text
        # overview now shouldn't list the quote as original
        ov = requests.get(f"{API}/renewals/overview", headers=demo_headers, timeout=15).json()
        ids = [p["id"] for p in ov["policies"]]
        assert TEST_UPLOAD_ID not in ids
        assert SECUREHEALTH_ID in ids
        # candidate should list quote
        orig = next(p for p in ov["policies"] if p["id"] == SECUREHEALTH_ID)
        assert any(c["id"] == TEST_UPLOAD_ID for c in orig["candidates"])


class TestRenewalCompareE2E:
    def test_same_id_400(self, demo_headers):
        r = requests.post(f"{API}/renewals/compare", headers=demo_headers,
                          json={"original_id": SECUREHEALTH_ID, "quote_id": SECUREHEALTH_ID}, timeout=15)
        assert r.status_code == 400

    def test_no_comparison_yet_404(self, other_user_headers):
        headers, _ = other_user_headers
        r = requests.get(f"{API}/renewals/comparison/{SECUREHEALTH_ID}", headers=headers, timeout=15)
        assert r.status_code == 404

    def test_compare_full(self, demo_headers):
        r = requests.post(f"{API}/renewals/compare", headers=demo_headers,
                          json={"original_id": SECUREHEALTH_ID, "quote_id": TEST_UPLOAD_ID}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["verdict"] in {"RENEW", "RENEW_WITH_CAUTION", "LOOK_ELSEWHERE"}
        assert data["reason"]
        assert isinstance(data["rows"], list) and len(data["rows"]) >= 5
        assert set(data["changes"].keys()) == {"improved", "worse", "same"}
        assert "disclaimer" in data

        # Reload persisted
        g = requests.get(f"{API}/renewals/comparison/{SECUREHEALTH_ID}", headers=demo_headers, timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == data["id"]


# ---------- Isolation ----------
class TestIsolation:
    def test_other_user_empty_overview(self, other_user_headers):
        headers, _ = other_user_headers
        r = requests.get(f"{API}/renewals/overview", headers=headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["policies"] == []

    def test_other_user_cant_compare_demo(self, other_user_headers):
        headers, _ = other_user_headers
        r = requests.post(f"{API}/renewals/compare", headers=headers,
                          json={"original_id": SECUREHEALTH_ID, "quote_id": TEST_UPLOAD_ID}, timeout=15)
        assert r.status_code == 404
