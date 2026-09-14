# VeriTrust AI — PRD

## Original Problem Statement
Build VeriTrust AI: a real, premium, full-stack AI-Powered Insurance Intelligence, Policy
Simplification & Blockchain Verification Platform. Users register/login, upload insurance policies
(PDF/image), OCR extracts text, AI analyzes & simplifies policies, generates an explainable risk
score, answers questions, compares policies, supports EN/HI/MR + voice, stores originals on IPFS
with SHA-256 + blockchain verification, persists everything in PostgreSQL, and generates PDF reports.

## Architecture (as built)
- **Frontend**: React (CRA/craco), Tailwind, React Router, Axios (Bearer interceptor), Framer Motion, Recharts.
- **Backend**: FastAPI + SQLAlchemy async + asyncpg, modular `app/` package, routers under `/api`.
- **Database**: PostgreSQL (running locally in-container via supervisor program `postgresql`, `DATABASE_URL`). Tables: users, policies, analysis, risk_analysis, verification, chat_messages.
- **AI**: Claude Sonnet 4.6 via Emergent Universal LLM key (structured JSON analysis, translation, Q&A, comparison). Risk score = deterministic category-weighted combination of LLM per-factor scores.
- **OCR**: Tesseract + pdfplumber (auto-OCR fallback for scanned PDFs via pdf2image).
- **Blockchain/IPFS**: SIMULATED but real SHA-256 hashes, real IPFS CIDv0, real tamper detection, Polygon-style tx hash/block. Solidity `DocumentVerification.sol` + Hardhat deploy script included for going live.
- **Auth**: JWT (Bearer, localStorage `veritrust_token`) + bcrypt.

## User Personas
- Ordinary policyholder who cannot understand complex insurance jargon.
- Cautious buyer comparing policies before purchase.
- Trust-focused user wanting proof their document is unaltered.

## Core Requirements (static)
Registration, login, persistent per-user data, dashboard, 5 insurance categories, upload + OCR,
AI analysis + simple explanation, explainable risk score/breakdown/recommendations, multilingual,
voice, AI Q&A, comparison, analytics, history, IPFS + CID, SHA-256, blockchain verify + tamper
detection, PostgreSQL persistence, PDF report, premium responsive UI.

## Implemented (2026-09-14)
All 27 success criteria delivered and verified by testing agent (20/20 backend tests pass, all
frontend nav/auth flows pass). Pages: Landing, Login, Register, Dashboard, Upload, PolicyAnalysis,
PolicyHistory, PolicyCompare, AskAI, VerificationCenter, Profile. GitHub-ready artifacts: README,
.env.example (backend+frontend), database/schema/schema.sql, Solidity contract + deploy script, .gitignore.

## Backlog / Future (P1/P2)
- P1: Live Polygon Amoy deployment (swap `record_on_chain` for web3 call).
- P1: Real IPFS pinning (Pinata/web3.storage) behind the same `ipfs.py` interface.
- P2: Eager-load (selectinload) policy relations for large lists.
- P2: Tighten CORS_ORIGINS to explicit origin.
- P2: Streaming AI answers (SSE) in Ask VeriTrust AI.

## Next Tasks
See Next Action Items in the finish summary.
