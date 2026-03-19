-- Sprint 8 - Governance + Sync persistence baseline (Sprint 1 runtime)

CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  requested_patch jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL CHECK (state IN ('advisory', 'pending_approval', 'approved', 'rejected', 'applied')),
  requested_by uuid,
  approved_by uuid,
  rejected_by uuid,
  applied_by uuid,
  rejection_reason text,
  idempotency_key text NOT NULL UNIQUE,
  approved_at timestamptz,
  rejected_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_state
  ON approval_requests(organization_id, state, created_at DESC);

CREATE TABLE IF NOT EXISTS event_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  source text NOT NULL CHECK (source IN ('game', 'pm', 'system')),
  direction text NOT NULL DEFAULT 'ingest' CHECK (direction IN ('ingest', 'emit')),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ledger_direction_created
  ON event_ledger(direction, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor text NOT NULL,
  source_layer text,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  target_type text,
  target_id uuid,
  approval_request_id uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'accepted' CHECK (outcome IN ('accepted', 'blocked', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_event_created
  ON audit_log(organization_id, event_type, created_at DESC);
