-- VeriTrust AI — PostgreSQL schema (reference DDL)
-- The FastAPI backend auto-creates these tables via SQLAlchemy (app/models.py).
-- This file documents the relational architecture: USER -> POLICIES -> (ANALYSIS, RISK, VERIFICATION).

CREATE TABLE IF NOT EXISTS users (
    id                 VARCHAR PRIMARY KEY,
    full_name          VARCHAR(120) NOT NULL,
    email              VARCHAR(255) UNIQUE NOT NULL,
    password_hash      VARCHAR(255) NOT NULL,       -- bcrypt hash, never plain text
    preferred_language VARCHAR(10)  DEFAULT 'en',
    created_at         TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
    id             VARCHAR PRIMARY KEY,
    user_id        VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_name    VARCHAR(255) NOT NULL,
    category       VARCHAR(50)  NOT NULL,           -- health | vehicle | home | travel | life
    upload_date    TIMESTAMPTZ  DEFAULT now(),
    file_name      VARCHAR(255),
    file_type      VARCHAR(50),
    file_size      INTEGER      DEFAULT 0,
    extracted_text TEXT         DEFAULT '',
    ipfs_cid       VARCHAR(120) DEFAULT '',
    document_hash  VARCHAR(80)  DEFAULT '',         -- SHA-256 hex
    policy_start_date DATE,
    policy_end_date   DATE                          -- drives renewal reminders
);
CREATE INDEX IF NOT EXISTS idx_policies_user ON policies(user_id);

CREATE TABLE IF NOT EXISTS alerts (
    id         VARCHAR PRIMARY KEY,
    user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id  VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    type       VARCHAR(20)  NOT NULL,               -- FRAUD | RENEWAL
    severity   VARCHAR(20)  NOT NULL,               -- low | medium | high | critical
    title      VARCHAR(255) NOT NULL,
    message    TEXT         NOT NULL,
    dedupe_key VARCHAR(160) NOT NULL,
    meta       JSONB,
    status     VARCHAR(20)  DEFAULT 'ACTIVE',       -- ACTIVE | RESOLVED | DISMISSED
    created_at TIMESTAMPTZ  DEFAULT now(),
    read_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dedupe ON alerts(dedupe_key);

CREATE TABLE IF NOT EXISTS verification_logs (
    id           VARCHAR PRIMARY KEY,
    user_id      VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id    VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    policy_name  VARCHAR(255),
    source       VARCHAR(20) NOT NULL,              -- MANUAL | REUPLOAD | AUTO_SWEEP
    query        TEXT,
    stored_hash  VARCHAR(80),
    current_hash VARCHAR(80),
    result       VARCHAR(30) NOT NULL,              -- VERIFIED | DOCUMENT_MODIFIED
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis (
    id                    VARCHAR PRIMARY KEY,
    policy_id             VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    summary               TEXT,
    insurance_type        VARCHAR(80),
    benefits              JSONB,
    coverage              JSONB,
    exclusions            JSONB,
    waiting_period        TEXT,
    claim_conditions      JSONB,
    limitations           JSONB,
    important_terms       JSONB,
    premium_info          TEXT,
    recommendations       JSONB,
    simple_explanation_en TEXT,
    simple_explanation_hi TEXT,
    simple_explanation_mr TEXT
);

CREATE TABLE IF NOT EXISTS risk_analysis (
    id            VARCHAR PRIMARY KEY,
    policy_id     VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    overall_score INTEGER DEFAULT 0,               -- 0..100
    risk_level    VARCHAR(20) DEFAULT 'Low',        -- Low | Medium | High
    breakdown     JSONB,                            -- [{factor, score, weight, reason}]
    reasons       JSONB,
    concerns      JSONB
);

CREATE TABLE IF NOT EXISTS verification (
    id               VARCHAR PRIMARY KEY,
    policy_id        VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    document_hash    VARCHAR(80),
    ipfs_cid         VARCHAR(120),
    tx_hash          VARCHAR(80),
    block_number     INTEGER,
    contract_address VARCHAR(80),
    network          VARCHAR(80),
    status           VARCHAR(30) DEFAULT 'VERIFIED',
    verified_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         VARCHAR PRIMARY KEY,
    policy_id  VARCHAR NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20),
    content    TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
