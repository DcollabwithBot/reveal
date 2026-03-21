-- Sprint C: Bluff Poker + Russian Nesting Scope + Speed Scope tables
-- Run after: sprint_b1_mission_engine.sql

-- ────────────────────────────────────────────────────────────────────────────
-- C1: Bluff Poker
-- ────────────────────────────────────────────────────────────────────────────

-- Tracks which participant is the bluffer per session item
CREATE TABLE IF NOT EXISTS bluff_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  bluffer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id)
);

-- Estimates submitted during Bluff Poker (rounds 1 = bluff round, 2 = clean)
CREATE TABLE IF NOT EXISTS bluff_estimates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  estimate   INTEGER NOT NULL,
  round      INTEGER NOT NULL DEFAULT 1, -- 1 = bluff round, 2 = clean re-vote
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id, user_id, round)
);

-- Who each participant thinks is bluffing
CREATE TABLE IF NOT EXISTS bluff_guesses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  guesser_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suspected_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  correct           BOOLEAN,  -- set after reveal
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id, guesser_id)
);

-- Discussion notes per item (optional, stored on session_items)
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS discussion_notes TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- C2: Russian Nesting Scope
-- ────────────────────────────────────────────────────────────────────────────

-- Sub-item submissions during breakdown phase
CREATE TABLE IF NOT EXISTS scope_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | duplicate
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- T-shirt estimates for sub-items
CREATE TABLE IF NOT EXISTS scope_estimates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tshirt_size TEXT NOT NULL, -- XS, S, M, L, XL, XXL
  story_points INTEGER,       -- XS=1, S=2, M=3, L=5, XL=8, XXL=13
  round       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id, user_id, round)
);

-- Parent-child relationship on session_items (for nested scope)
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS parent_item_id UUID REFERENCES session_items(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- C3: Speed Scope
-- ────────────────────────────────────────────────────────────────────────────

-- Speed estimates: round 1 = speed (10s), round 2 = discussed (2min)
CREATE TABLE IF NOT EXISTS speed_estimates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  estimate         INTEGER NOT NULL,
  round            INTEGER NOT NULL DEFAULT 1,
  response_time_ms INTEGER, -- milliseconds from item shown to card selected
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id, user_id, round)
);

-- ────────────────────────────────────────────────────────────────────────────
-- Add new session_type values (Postgres allows any text, just document)
-- session_type: 'bluff_poker' | 'nesting_scope' | 'speed_scope'
-- ────────────────────────────────────────────────────────────────────────────

-- RLS policies (mirrors existing patterns)
ALTER TABLE bluff_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_estimates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bluff_guesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_estimates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_estimates    ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write rows for sessions they're in
CREATE POLICY "bluff_assignments_read"  ON bluff_assignments  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bluff_assignments_write" ON bluff_assignments  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "bluff_estimates_read"    ON bluff_estimates    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bluff_estimates_write"   ON bluff_estimates    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bluff_estimates_update"  ON bluff_estimates    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "bluff_guesses_read"      ON bluff_guesses      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bluff_guesses_write"     ON bluff_guesses      FOR INSERT WITH CHECK (auth.uid() = guesser_id);
CREATE POLICY "bluff_guesses_update"    ON bluff_guesses      FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "scope_submissions_read"  ON scope_submissions  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "scope_submissions_write" ON scope_submissions  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "scope_submissions_update"ON scope_submissions  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "scope_estimates_read"    ON scope_estimates    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "scope_estimates_write"   ON scope_estimates    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scope_estimates_update"  ON scope_estimates    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "speed_estimates_read"    ON speed_estimates    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "speed_estimates_write"   ON speed_estimates    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "speed_estimates_update"  ON speed_estimates    FOR UPDATE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Achievement definitions for Sprint C modes
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO achievement_definitions (id, key, name, description, icon, rule)
VALUES
  (gen_random_uuid(), 'master_bluffer',        'Master Bluffer',        'Survived as bluffer 3 times without being caught',    '🃏', '{"xp": 50, "mode": "bluff_poker"}'),
  (gen_random_uuid(), 'detective',             'Detective',             'Correctly guessed the bluffer 5 times',               '🔍', '{"xp": 40, "mode": "bluff_poker"}'),
  (gen_random_uuid(), 'poker_face',            'Poker Face',            'Estimated within ±1 of consensus while bluffing',     '😐', '{"xp": 30, "mode": "bluff_poker"}'),
  (gen_random_uuid(), 'archaeologist',         'Archaeologist',         'Found 3+ sub-items nobody else found',                '⛏️', '{"xp": 45, "mode": "nesting_scope"}'),
  (gen_random_uuid(), 'scope_slayer',          'Scope Slayer',          'Breakdown reduced total estimate by 20%+',            '🗡️', '{"xp": 40, "mode": "nesting_scope"}'),
  (gen_random_uuid(), 'the_decomposer',        'The Decomposer',        'Participated in 5 nesting scope sessions',            '🧬', '{"xp": 60, "mode": "nesting_scope"}'),
  (gen_random_uuid(), 'speed_demon',           'Speed Demon',           'Estimated all items before timeout in speed round',   '⚡', '{"xp": 35, "mode": "speed_scope"}'),
  (gen_random_uuid(), 'hidden_complexity_hunter', 'Hidden Complexity Hunter', 'Flagged 3+ items with large speed vs discussed delta', '🕵️', '{"xp": 40, "mode": "speed_scope"}'),
  (gen_random_uuid(), 'calibrated',            'Calibrated',            'Speed estimates matched discussed within ±1 for all', '🎯', '{"xp": 50, "mode": "speed_scope"}')
ON CONFLICT (key) DO NOTHING;
