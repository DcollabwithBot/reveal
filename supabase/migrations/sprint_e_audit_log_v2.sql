-- Sprint E: Audit Log v2 — Extend existing audit_log with Sprint E fields
-- Existing table from sprint8_governance_sync.sql is extended here

-- Add missing columns
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action     text,
  ADD COLUMN IF NOT EXISTS metadata   jsonb DEFAULT '{}'::jsonb;

-- Additional indexes for Sprint E queries
CREATE INDEX IF NOT EXISTS idx_audit_log_session
  ON audit_log(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON audit_log(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Read policy: org members can read their org's audit log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_log_org_read'
  ) THEN
    CREATE POLICY audit_log_org_read ON audit_log
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Insert policy: authenticated users can insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_log_insert'
  ) THEN
    CREATE POLICY audit_log_insert ON audit_log
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
