-- Phase 6: Persistent telemetry for game-session state + export outcomes

CREATE TABLE IF NOT EXISTS game_session_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  node_id text,
  metric text NOT NULL CHECK (metric IN (
    'readSuccess',
    'readFailure',
    'writeSuccess',
    'writeFailure',
    'exportSuccess',
    'exportFailure'
  )),
  source text,
  format text,
  action text,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_session_telemetry_org_occurred
  ON game_session_telemetry_events (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_session_telemetry_org_scope
  ON game_session_telemetry_events (organization_id, project_id, node_id, occurred_at DESC);

ALTER TABLE game_session_telemetry_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_session_telemetry_events'
      AND policyname = 'org members can read telemetry events'
  ) THEN
    CREATE POLICY "org members can read telemetry events"
      ON game_session_telemetry_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.organization_id = game_session_telemetry_events.organization_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE VIEW game_session_telemetry_counters AS
SELECT
  organization_id,
  project_id,
  node_id,
  metric,
  COUNT(*)::bigint AS total,
  MAX(occurred_at) AS last_seen_at
FROM game_session_telemetry_events
GROUP BY organization_id, project_id, node_id, metric;
