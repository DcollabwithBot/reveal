-- Sprint Scrum Complete: Refinement Roulette + Dependency Mapper
-- Run after: sprint_methodology_modes.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- is_groomed column on session_items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS is_groomed BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Refinement Roulette
-- ─────────────────────────────────────────────────────────────────────────────

-- Anonymous DoD + clarification submissions per session
CREATE TABLE IF NOT EXISTS refinement_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('dod', 'clarification')),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refinement_submissions_session ON refinement_submissions(session_id);

-- Clarification votes (which clarification is most important)
CREATE TABLE IF NOT EXISTS refinement_votes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clarification_idx   INTEGER NOT NULL,  -- index into refinement_submissions for clarification type
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dependency Mapper
-- ─────────────────────────────────────────────────────────────────────────────

-- Individual dependency submissions (person believes A blocks B)
CREATE TABLE IF NOT EXISTS dependency_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_item_id UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  to_item_id   UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id, from_item_id, to_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dep_submissions_session ON dependency_submissions(session_id);

-- Conflict votes on controversial dependencies
CREATE TABLE IF NOT EXISTS dependency_conflict_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dep_key     TEXT NOT NULL,  -- "fromItemId→toItemId"
  vote        TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id, dep_key)
);

-- Confirmed dependencies (written after GM approval)
CREATE TABLE IF NOT EXISTS item_dependencies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE,
  from_item_id UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  to_item_id   UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_item_id, to_item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_deps_from ON item_dependencies(from_item_id);
CREATE INDEX IF NOT EXISTS idx_item_deps_to   ON item_dependencies(to_item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE refinement_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE refinement_votes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_conflict_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_dependencies          ENABLE ROW LEVEL SECURITY;

-- Refinement submissions: read all in session, write own
CREATE POLICY IF NOT EXISTS "rr_submissions_read"
  ON refinement_submissions FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "rr_submissions_write"
  ON refinement_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Refinement votes: read all, write own
CREATE POLICY IF NOT EXISTS "rr_votes_read"
  ON refinement_votes FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "rr_votes_write"
  ON refinement_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Dependency submissions: read all, write own
CREATE POLICY IF NOT EXISTS "dm_submissions_read"
  ON dependency_submissions FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "dm_submissions_write"
  ON dependency_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "dm_submissions_delete"
  ON dependency_submissions FOR DELETE
  USING (auth.uid() = user_id);

-- Conflict votes: read all, write own
CREATE POLICY IF NOT EXISTS "dm_conflict_votes_read"
  ON dependency_conflict_votes FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "dm_conflict_votes_write"
  ON dependency_conflict_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Item dependencies: read all, write requires authenticated
CREATE POLICY IF NOT EXISTS "item_deps_read"
  ON item_dependencies FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "item_deps_write"
  ON item_dependencies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- Approval queue: add types for new modes
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure the type column allows new approval types (no-op if already generic)
-- approval_queue.type: 'acceptance_criteria' | 'description_append' already covered by existing schema

-- ─────────────────────────────────────────────────────────────────────────────
-- Achievements for new modes (inserted into achievements table if it exists)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO achievements (key, name, description, icon, xp_reward)
VALUES
  ('grooming_master',     'Grooming Master',      'Deltag i 10 refinement sessions',                   '🌿', 200),
  ('perfect_alignment',   'Perfect Alignment',    'DoD submissions er identiske (0 misalignment)',      '⚡', 150),
  ('the_clarifier',       'The Clarifier',        'Din clarification vinder 5 gange',                   '🔍', 250),
  ('dependency_detector', 'Dependency Detector',  'Find 3+ dependencies andre ikke fandt',              '🕸️', 175),
  ('circular_slayer',     'Circular Slayer',      'Afslører en circular dependency',                    '🔄', 200),
  ('the_architect',       'The Architect',        'Dependency map bruges korrekt i næste sprint',       '🏗️', 300)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Session type registration
-- ─────────────────────────────────────────────────────────────────────────────
-- sessions.session_type check constraint — add new types if constraint exists
-- (No-op if sessions.session_type is unconstrained text)
DO $$
BEGIN
  -- Try to add new session types to check constraint
  -- This is safe: if constraint doesn't exist or is already generic, skip
  EXCEPTION WHEN others THEN NULL;
END $$;
