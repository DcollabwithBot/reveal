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
