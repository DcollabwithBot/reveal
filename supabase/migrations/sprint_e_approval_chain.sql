-- Sprint E8: Governance — Approval Chain
-- Extends approval_requests with chain/delegation/timeout support

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS chain_step     int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chain_total    int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delegated_to   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timeout_hours  int DEFAULT 72,
  ADD COLUMN IF NOT EXISTS timeout_action text DEFAULT 'escalate'
    CHECK (timeout_action IN ('auto_approve', 'auto_reject', 'escalate')),
  ADD COLUMN IF NOT EXISTS chain_type     text DEFAULT 'single'
    CHECK (chain_type IN ('single', 'chain', 'delegated'));

-- Project-level approval settings
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS approval_chain_type text DEFAULT 'single'
    CHECK (approval_chain_type IN ('single', 'chain', 'delegated')),
  ADD COLUMN IF NOT EXISTS approval_timeout_hours int DEFAULT 72,
  ADD COLUMN IF NOT EXISTS approval_timeout_action text DEFAULT 'escalate'
    CHECK (approval_timeout_action IN ('auto_approve', 'auto_reject', 'escalate'));

-- Chain approvers (for chain mode: PM → PO → Stakeholder)
CREATE TABLE IF NOT EXISTS approval_chain_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chain_position      int NOT NULL DEFAULT 0,  -- 0 = first, 1 = second, etc.
  role_label          text,                     -- 'GM', 'Product Owner', 'Stakeholder'
  created_at          timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Index for looking up chain members
CREATE INDEX IF NOT EXISTS idx_approval_chain_project ON approval_chain_members(project_id, chain_position);

-- Audit: log approval chain events
COMMENT ON COLUMN approval_requests.chain_step IS 'Current step in approval chain (0-indexed)';
COMMENT ON COLUMN approval_requests.chain_total IS 'Total steps in approval chain';
COMMENT ON COLUMN approval_requests.delegated_to IS 'User this approval is delegated to (NULL = not delegated)';
COMMENT ON COLUMN approval_requests.timeout_hours IS 'Hours before timeout action triggers (default 72)';
COMMENT ON COLUMN approval_requests.timeout_action IS 'What happens on timeout: auto_approve, auto_reject, escalate';
