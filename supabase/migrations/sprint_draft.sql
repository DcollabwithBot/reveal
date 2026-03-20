-- Sprint capacity og velocity
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS capacity_points numeric(8,2);
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS velocity_planned numeric(8,2);
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS velocity_actual numeric(8,2);

-- Sprint Draft session config
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS draft_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Session items udvidelse
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS is_stretch boolean NOT NULL DEFAULT false;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS estimate_source text DEFAULT 'planning_poker'
  CHECK (estimate_source IN ('planning_poker', 'quick_estimate', 'imported', 'manual'));

-- Draft picks
CREATE TABLE IF NOT EXISTS sprint_draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  pick_order int NOT NULL,
  priority_score numeric(5,2) DEFAULT 0,
  decision text NOT NULL CHECK (decision IN ('drafted', 'skipped', 'parked', 'stretch')),
  estimate_at_draft numeric(8,2),
  estimate_source text DEFAULT 'existing' CHECK (estimate_source IN ('existing', 'quick_estimate', 'planning_poker')),
  voted_in boolean NOT NULL DEFAULT false,
  pm_override boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, session_item_id)
);
CREATE INDEX IF NOT EXISTS idx_draft_picks_session ON sprint_draft_picks(session_id, pick_order);

-- Priority votes
CREATE TABLE IF NOT EXISTS sprint_draft_priority_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tokens int NOT NULL DEFAULT 0 CHECK (tokens BETWEEN 0 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, session_item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_priority_votes_session ON sprint_draft_priority_votes(session_id, session_item_id);

-- Velocity view
CREATE OR REPLACE VIEW sprint_velocity AS
SELECT 
  s.id AS sprint_id,
  s.project_id,
  s.name AS sprint_name,
  COALESCE(SUM(si.final_estimate::numeric) FILTER (WHERE si.item_status = 'done'), 0) AS velocity_actual,
  COUNT(si.id) FILTER (WHERE si.item_status = 'done') AS items_completed,
  COUNT(si.id) AS items_total
FROM sprints s
LEFT JOIN session_items si ON si.sprint_id = s.id
WHERE s.status IN ('completed', 'closed')
GROUP BY s.id, s.project_id, s.name;
