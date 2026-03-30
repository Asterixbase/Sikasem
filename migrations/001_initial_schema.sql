-- Sikasem Production Schema — Supabase / PostgreSQL
-- Run via: supabase db push  OR  psql -f 001_initial_schema.sql
-- All monetary values in INTEGER (minor currency units)

-- ── Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────
CREATE TYPE circle_status      AS ENUM ('FORMING','ACTIVE','PAUSED','COMPLETE','DISSOLVED');
CREATE TYPE payment_status     AS ENUM ('PAID','PENDING','FAILED','NOT_DUE');
CREATE TYPE txn_type           AS ENUM ('COLLECTION','PAYOUT','INSURANCE','GUARANTOR','FEE','REFUND');
CREATE TYPE insurance_status   AS ENUM ('NONE','ACTIVE','CLAIM_ACTIVE','LAPSED','CANCELLED');
CREATE TYPE claim_status       AS ENUM ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID');
CREATE TYPE guarantor_status   AS ENUM ('NONE','PENDING','ACTIVE','TRIGGERED','RELEASED','DECLINED');
CREATE TYPE frequency_type     AS ENUM ('DAILY','WEEKLY','BIWEEKLY','MONTHLY');
CREATE TYPE insurance_provider AS ENUM ('GLICO','ENTLIFE');

-- ── updated_at trigger function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Users ──────────────────────────────────────────────────────────────
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid     TEXT UNIQUE NOT NULL,
  phone            VARCHAR(20) UNIQUE NOT NULL,
  phone_verified   BOOLEAN DEFAULT FALSE,
  full_name        VARCHAR(120) NOT NULL,
  initials         VARCHAR(4) NOT NULL,
  email            VARCHAR(255) UNIQUE,
  avatar_url       TEXT,
  ghana_card_id    VARCHAR(20) UNIQUE,
  momo_wallet      VARCHAR(20),
  momo_verified    BOOLEAN DEFAULT FALSE,
  default_currency VARCHAR(3) DEFAULT 'GHS',
  push_token       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  kyc_level        SMALLINT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX idx_users_phone        ON users(phone);
CREATE INDEX idx_users_supabase_uid ON users(supabase_uid);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own record"
  ON users FOR SELECT USING (auth.uid()::TEXT = supabase_uid);
CREATE POLICY "users can update own record"
  ON users FOR UPDATE USING (auth.uid()::TEXT = supabase_uid);

-- ── Circles ────────────────────────────────────────────────────────────
CREATE TABLE circles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(120) NOT NULL,
  description         TEXT,
  organiser_id        UUID NOT NULL REFERENCES users(id),
  status              circle_status DEFAULT 'FORMING' NOT NULL,
  currency            VARCHAR(3) DEFAULT 'GHS' NOT NULL,
  contribution        BIGINT NOT NULL CHECK (contribution > 0),
  frequency           frequency_type DEFAULT 'MONTHLY',
  max_members         SMALLINT NOT NULL CHECK (max_members >= 2),
  current_cycle       SMALLINT DEFAULT 0,
  total_cycles        SMALLINT NOT NULL,
  next_due_date       TIMESTAMPTZ,
  insurance_enabled   BOOLEAN DEFAULT FALSE,
  guarantors_required BOOLEAN DEFAULT FALSE,
  momo_collection_ref TEXT,
  bog_registered      BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

CREATE INDEX idx_circles_organiser ON circles(organiser_id);
CREATE INDEX idx_circles_status    ON circles(status);

CREATE TRIGGER trg_circles_updated_at
  BEFORE UPDATE ON circles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can read their circles"
  ON circles FOR SELECT USING (
    id IN (
      SELECT circle_id FROM circle_members
      WHERE user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid()::TEXT)
    )
  );

-- ── Circle members ─────────────────────────────────────────────────────
CREATE TABLE circle_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id       UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  payout_position SMALLINT NOT NULL,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE (circle_id, user_id)
);

CREATE INDEX idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX idx_circle_members_user   ON circle_members(user_id);

-- ── Cycle payments ─────────────────────────────────────────────────────
CREATE TABLE cycle_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id    UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES users(id),
  cycle_number SMALLINT NOT NULL,
  status       payment_status DEFAULT 'NOT_DUE' NOT NULL,
  amount       BIGINT NOT NULL,
  due_date     TIMESTAMPTZ,
  paid_at      TIMESTAMPTZ,
  momo_ref     VARCHAR(80),
  momo_status  VARCHAR(40),
  retry_count  SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (circle_id, cycle_number, member_id)
);

CREATE INDEX idx_cycle_payments_circle_cycle ON cycle_payments(circle_id, cycle_number);
CREATE INDEX idx_cycle_payments_momo_ref     ON cycle_payments(momo_ref);
CREATE INDEX idx_cycle_payments_status       ON cycle_payments(status);

-- Trigger: advance cycle counter when all members paid
CREATE OR REPLACE FUNCTION update_circle_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'PAID' AND OLD.status != 'PAID' THEN
    IF (
      SELECT COUNT(*) FROM cycle_payments
      WHERE circle_id = NEW.circle_id
        AND cycle_number = NEW.cycle_number
        AND status != 'PAID'
    ) = 0 THEN
      UPDATE circles SET current_cycle = current_cycle + 1 WHERE id = NEW.circle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cycle_payment_status_change
  AFTER UPDATE ON cycle_payments
  FOR EACH ROW EXECUTE FUNCTION update_circle_on_payment();

-- ── Cycle payouts ──────────────────────────────────────────────────────
CREATE TABLE cycle_payouts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id     UUID NOT NULL REFERENCES circles(id),
  recipient_id  UUID NOT NULL REFERENCES users(id),
  cycle_number  SMALLINT NOT NULL,
  gross_amount  BIGINT NOT NULL,
  momo_fee      BIGINT NOT NULL,
  net_amount    BIGINT NOT NULL,
  momo_ref      VARCHAR(80),
  disbursed_at  TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent double-disbursement: one confirmed payout per cycle per circle
  UNIQUE (circle_id, cycle_number, disbursed_at)
);

CREATE INDEX idx_cycle_payouts_circle ON cycle_payouts(circle_id);

-- ── Transactions (immutable ledger) ───────────────────────────────────
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id    UUID REFERENCES circles(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         txn_type NOT NULL,
  amount       BIGINT NOT NULL,
  currency     VARCHAR(3) DEFAULT 'GHS',
  cycle_number SMALLINT,
  momo_ref     VARCHAR(80),
  momo_status  VARCHAR(40),
  description  TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user     ON transactions(user_id);
CREATE INDEX idx_transactions_circle   ON transactions(circle_id);
CREATE INDEX idx_transactions_momo_ref ON transactions(momo_ref);

-- Transactions are immutable: no UPDATE or DELETE
CREATE RULE no_update_transactions AS ON UPDATE TO transactions DO INSTEAD NOTHING;
CREATE RULE no_delete_transactions AS ON DELETE TO transactions DO INSTEAD NOTHING;

-- ── Insurance policies ─────────────────────────────────────────────────
CREATE TABLE insurance_policies (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id             UUID NOT NULL REFERENCES users(id),
  circle_id             UUID NOT NULL REFERENCES circles(id),
  provider              insurance_provider NOT NULL,
  policy_ref            VARCHAR(80) UNIQUE,
  coverage_types        JSONB NOT NULL,
  premium               BIGINT NOT NULL,
  max_cover             BIGINT NOT NULL,
  status                insurance_status DEFAULT 'ACTIVE',
  beneficiary_name      VARCHAR(120),
  beneficiary_phone     VARCHAR(20),
  beneficiary_relation  VARCHAR(40),
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ
);

CREATE TRIGGER trg_insurance_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Insurance claims ───────────────────────────────────────────────────
CREATE TABLE insurance_claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id       UUID NOT NULL REFERENCES insurance_policies(id),
  claim_ref       VARCHAR(20) UNIQUE NOT NULL,
  claim_type      VARCHAR(40) NOT NULL,
  description     TEXT,
  hospital        VARCHAR(200),
  incident_date   TIMESTAMPTZ,
  amount_claimed  BIGINT,
  amount_approved BIGINT,
  status          claim_status DEFAULT 'SUBMITTED',
  docs_required   SMALLINT DEFAULT 4,
  docs_uploaded   SMALLINT DEFAULT 0,
  document_urls   JSONB,
  provider_ref    VARCHAR(80),
  reviewer_notes  TEXT,
  filed_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ── Guarantor agreements ───────────────────────────────────────────────
CREATE TABLE guarantor_agreements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES users(id),
  guarantor_phone VARCHAR(20) NOT NULL,
  guarantor_name  VARCHAR(120),
  circle_id       UUID NOT NULL REFERENCES circles(id),
  relation        VARCHAR(40),
  status          guarantor_status DEFAULT 'PENDING',
  agreement_ref   VARCHAR(20) UNIQUE NOT NULL,
  sha256_hash     VARCHAR(64),
  ussd_sent_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  triggered_at    TIMESTAMPTZ,
  released_at     TIMESTAMPTZ,
  total_charged   BIGINT DEFAULT 0,
  audit_log       JSONB DEFAULT '[]'::JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guarantor_agreements_status ON guarantor_agreements(status);
CREATE INDEX idx_guarantor_agreements_phone  ON guarantor_agreements(guarantor_phone);

-- Audit log is append-only
CREATE OR REPLACE FUNCTION protect_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(OLD.audit_log) > jsonb_array_length(NEW.audit_log) THEN
    RAISE EXCEPTION 'Audit log is append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guarantor_audit_immutable
  BEFORE UPDATE ON guarantor_agreements
  FOR EACH ROW EXECUTE FUNCTION protect_audit_log();

-- ── Currency rates ─────────────────────────────────────────────────────
CREATE TABLE currency_rates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_ccy   VARCHAR(3) NOT NULL,
  to_ccy     VARCHAR(3) NOT NULL,
  rate       FLOAT NOT NULL,
  source     VARCHAR(40) DEFAULT 'openexchangerates',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_ccy, to_ccy)
);

-- Seed GHS rates (update via scheduled job)
INSERT INTO currency_rates (from_ccy, to_ccy, rate, source) VALUES
  ('GHS','NGN',100.45,'seed'),('GHS','XOF',82.30,'seed'),
  ('GHS','SLL',1820.00,'seed'),('GHS','GMD',5.60,'seed'),
  ('GHS','GNF',780.00,'seed'),('GHS','LRD',14.50,'seed'),
  ('GHS','GBP',0.063,'seed'),('GHS','USD',0.082,'seed')
ON CONFLICT (from_ccy, to_ccy) DO NOTHING;
