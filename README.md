# VeriTrust AI

**AI-Powered Insurance Intelligence, Policy Simplification & Blockchain Verification Platform**

> Understand Your Insurance. Trust Your Documents.

VeriTrust AI uses Artificial Intelligence to analyze and simplify complex insurance policies into
easy-to-understand insights, while using blockchain technology (SHA-256 + IPFS + a Polygon-style
smart contract) to guarantee document integrity and trustworthy verification.

Three pillars: **AI Intelligence · Simple Policy Understanding · Blockchain Trust & Verification**

---

## Features

- 🔐 **Auth** — JWT + bcrypt, protected routes, per-user data isolation
- 📤 **Upload** — PDF / JPG / JPEG / PNG across 5 categories (Health, Vehicle, Home, Travel, Life)
- 🔎 **OCR** — Tesseract + pdfplumber (auto-OCR for scanned PDFs)
- 🧠 **AI Analysis** — Claude Sonnet 4.6 produces structured JSON: summary, coverage, exclusions,
  waiting period, claim conditions, limitations, benefits, premium, recommendations
- ✨ **Policy Simplifier** — complex legal wording → very simple explanations
- 📊 **Explainable Risk Score (0–100)** — category-weighted, never random, with breakdown + reasons
- 🌐 **Multilingual** — English, Hindi, Marathi
- 🔊 **Voice** — Web Speech API (play / pause / stop)
- 💬 **Ask VeriTrust AI** — policy-grounded Q&A
- ⚖️ **Policy Comparison** — A vs B with AI recommendation
- 🧾 **PDF Report** — professional downloadable analysis report
- 🔗 **Blockchain Verification** — SHA-256 hash + IPFS CID + on-chain tx, real tamper detection
- 🚨 **Fraud Alerts** — automatic integrity sweep + "re-verify a copy"; an alert fires the moment a
  document's SHA-256 hash stops matching its on-chain record (never simulated)
- ⏰ **Renewal Reminders** — AI-extracted (editable) expiry dates, reminders at 30 / 15 / 7 days
- 📚 **Persistent History** — PostgreSQL; data survives logout/login; no seeded/demo data

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React, Tailwind CSS, React Router, Axios, Framer Motion, Recharts |
| Backend    | Python, FastAPI, Uvicorn, SQLAlchemy (async) |
| AI         | Claude Sonnet 4.6 (Emergent Universal LLM key), Tesseract OCR, pdfplumber |
| Blockchain | SHA-256, Solidity (`DocumentVerification.sol`), Polygon Amoy, IPFS CID |
| Database   | **PostgreSQL** |

## Project Structure

```
VeriTrust-AI/
├── backend/
│   ├── server.py                # FastAPI entrypoint (mounts /api routers)
│   ├── app/
│   │   ├── database.py          # async engine/session (PostgreSQL)
│   │   ├── models.py            # SQLAlchemy models (User, Policy, Analysis, Risk, Verification)
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── auth.py              # JWT + bcrypt + get_current_user
│   │   ├── ocr.py               # PDF/image text extraction + OCR
│   │   ├── ai.py                # Claude analysis, translation, Q&A, comparison, risk scoring
│   │   ├── ipfs.py              # IPFS CID generation + object store
│   │   ├── blockchain.py        # SHA-256 + on-chain record + tamper detection
│   │   ├── report.py            # ReportLab PDF report
│   │   └── routes/              # auth / policy / ai / verify routers
│   └── requirements.txt
├── frontend/
│   └── src/{pages,components,context,lib}
├── blockchain/
│   ├── contracts/DocumentVerification.sol
│   └── scripts/deploy.js
├── database/schema/schema.sql
└── README.md
```

## Local Setup

### 1. PostgreSQL
```bash
createdb veritrust_db
# create role: CREATE ROLE veritrust LOGIN PASSWORD 'veritrust_pass';
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, EMERGENT_LLM_KEY
pip install -r requirements.txt
# system deps: tesseract-ocr, poppler-utils
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Tables are auto-created on startup (see `database/schema/schema.sql` for the DDL).

### 3. Frontend
```bash
cd frontend
cp .env.example .env          # set REACT_APP_BACKEND_URL
yarn install
yarn start
```

### 4. (Optional) Deploy the smart contract to Polygon Amoy
```bash
cd blockchain
npm i --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat run scripts/deploy.js --network amoy
```
Then set `CONTRACT_ADDRESS` in `backend/.env` and switch `app/blockchain.py::record_on_chain`
to a web3 contract call (the interface matches the Solidity contract exactly).

## API Overview

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/me` |
| Policies | `POST /api/policies/upload`, `GET /api/policies`, `GET /api/policies/dashboard`, `GET /api/policies/{id}`, `DELETE /api/policies/{id}`, `GET /api/policies/{id}/document`, `POST /api/policies/compare` |
| AI | `POST /api/ai/ask/{policy_id}`, `GET /api/ai/history/{policy_id}` |
| Verification | `POST /api/verify`, `POST /api/verify/reupload`, `GET /api/verify/history`, `GET /api/verify/{policy_id}` |
| Alerts | `GET /api/alerts`, `POST /api/alerts/{id}/read`, `POST /api/alerts/{id}/dismiss`, `POST /api/alerts/read-all`, `GET /api/renewals`, `PATCH /api/policies/{id}/dates` |
| Reports | `GET /api/report/{policy_id}` (PDF) |

## Security

bcrypt password hashing · JWT-protected routes · users access only their own policies ·
file-type & size validation · secrets via environment variables · no private keys in code.

## Note on Blockchain / IPFS

For zero-friction demos, blockchain and IPFS run in **simulated** mode: SHA-256 hashes and IPFS
CIDv0 identifiers are **real and cryptographically valid**, tamper detection genuinely recomputes
the hash from the stored document, and a Polygon-style transaction hash + block number are produced.
Deploy `DocumentVerification.sol` and provide RPC + key to go fully on-chain — no code redesign needed.
The UI always states which mode is active: records show a **"Simulated ledger · dev mode"** badge until
both `CONTRACT_ADDRESS` and `AMOY_RPC_URL` are configured, after which they are labelled **"Live on-chain"**.
Simulated records are never presented as real Polygon transactions.

© 2026 VeriTrust AI
