-- Sprint B1: Mission Tracking Engine
-- Migration: sprint_b1_mission_engine.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- Ensure pg_net extension is available for HTTP calls from triggers
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Ensure acceptance_criteria + risk_notes columns on session_items
-- (used by B4 Spec Wars and B5 Perspektiv-Poker)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS acceptance_criteria text;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS risk_notes text;

-- ═══════════════════════════════════════════════════════════════════════════════
-- B4: Spec Wars tables
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS spec_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES profiles(id),
  content         text NOT NULL,
  score           numeric(3,1) DEFAULT 0,
  vote_count      int DEFAULT 0,
  is_winner       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, author_id)
);

CREATE TABLE IF NOT EXISTS spec_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES spec_submissions(id) ON DELETE CASCADE,
  voter_id        uuid NOT NULL REFERENCES profiles(id),
  rating          int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(submission_id, voter_id)
);

ALTER TABLE spec_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spec_submissions_session_member" ON spec_submissions
  FOR ALL USING (
    session_id IN (
      SELECT id FROM sessions WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "spec_votes_session_member" ON spec_votes
  FOR ALL USING (
    submission_id IN (
      SELECT ss.id FROM spec_submissions ss
      JOIN sessions s ON s.id = ss.session_id
      WHERE s.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- B5: Perspektiv-Poker tables
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS perspective_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id),
  perspective     text NOT NULL CHECK (perspective IN
    ('customer','support','ops','developer','security','business')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, session_item_id, user_id)
);

ALTER TABLE perspective_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perspective_assignments_member" ON perspective_assignments
  FOR ALL USING (
    session_id IN (
      SELECT id FROM sessions WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- B1: Mission progress trigger function
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_mission_progress()
RETURNS trigger AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Only fire when relevant fields change or on insert
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.sprint_id IS NOT DISTINCT FROM NEW.sprint_id) AND
       (OLD.final_estimate IS NOT DISTINCT FROM NEW.final_estimate) AND
       (OLD.acceptance_criteria IS NOT DISTINCT FROM NEW.acceptance_criteria) THEN
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    v_url := current_setting('app.supabase_url', true);
    v_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Settings not configured — skip HTTP call gracefully
    RETURN NEW;
  END;

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    PERFORM net.http_post(
      url    := v_url || '/functions/v1/evaluate-mission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body   := jsonb_build_object(
        'item_id',         NEW.id,
        'user_id',         NEW.assigned_to,
        'organization_id', NEW.organization_id,
        'sprint_id',       NEW.sprint_id,
        'final_estimate',  NEW.final_estimate,
        'acceptance_criteria', NEW.acceptance_criteria,
        'op',              TG_OP
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and re-create trigger
DROP TRIGGER IF EXISTS trg_mission_progress ON session_items;
CREATE TRIGGER trg_mission_progress
  AFTER INSERT OR UPDATE ON session_items
  FOR EACH ROW EXECUTE FUNCTION notify_mission_progress();

-- ═══════════════════════════════════════════════════════════════════════════════
-- B1: Mission expiry via pg_cron (daily at 03:00 UTC)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'expire-user-missions',
  '0 3 * * *',
  $$
    UPDATE user_missions
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
  $$
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- B3: New achievement_definitions for bonus mechanics
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO achievement_definitions (game_profile_id, key, name, description, icon, rule, is_active)
SELECT
  gp.id,
  a.key,
  a.name,
  a.description,
  a.icon,
  a.rule::jsonb,
  true
FROM game_profiles gp
CROSS JOIN (VALUES
  ('sniper_shot',    'Sniper Shot',     'Estimation within 15% of actual hours', '🎯',
   '{"event":"estimation_accurate","xp":15}'),
  ('oracle',         'Oracle',          'Confidence vote matched final outcome',  '🔮',
   '{"event":"confidence_hit","xp":20}'),
  ('risk_prophet',   'Risk Prophet',    'Risk card prediction confirmed correct', '⚡',
   '{"event":"risk_card_confirmed","xp":25}'),
  ('spec_machine',   'Spec Machine',    'Wrote winning acceptance criteria in Spec Wars', '📝',
   '{"event":"spec_wars_winner","xp":20}'),
  ('perspective_master', 'Perspective Master', 'Closed a gap ≥3 in Perspektiv-Poker', '🌐',
   '{"event":"perspective_gap_closed","xp":25}')
) AS a(key, name, description, icon, rule)
WHERE gp.is_default = true
ON CONFLICT DO NOTHING;
