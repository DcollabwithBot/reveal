-- Sprint 7 - Task A (Perspective Poker)

-- 1) Extend voting mode constraint to include perspective_poker
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_voting_mode_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_voting_mode_check
  CHECK (voting_mode IN ('fibonacci', 'tshirt', 'perspective_poker'));

-- 2) Store perspective card directly on votes (DB-safe, backwards compatible)
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS perspective text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Optional guard for perspective value size
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'votes_perspective_length_check'
  ) THEN
    ALTER TABLE votes
      ADD CONSTRAINT votes_perspective_length_check
      CHECK (perspective IS NULL OR length(trim(perspective)) BETWEEN 2 AND 32);
  END IF;
END $$;

-- Query helpers for results aggregation
CREATE INDEX IF NOT EXISTS idx_votes_session_item_perspective
  ON votes(session_item_id, perspective);

CREATE INDEX IF NOT EXISTS idx_votes_session_perspective
  ON votes(session_id, perspective);

-- Sprint 7 - Task B (Webhook MVP)
CREATE TABLE IF NOT EXISTS webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  url text,
  secret text,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'retrying', 'delivered', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_team_created
  ON webhook_deliveries(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_next_attempt
  ON webhook_deliveries(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_session_event
  ON webhook_deliveries(session_id, event_type);
