-- Sprint Methodology Modes: Flow Poker, Risk Poker, Assumption Slayer
-- Run after: sprint_c_game_modes.sql

-- ────────────────────────────────────────────────────────────────────────────
-- Flow Poker (Kanban)
-- ────────────────────────────────────────────────────────────────────────────

-- Per-item cycle time estimates
CREATE TABLE IF NOT EXISTS flow_poker_estimates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  days       INTEGER NOT NULL, -- 1,2,3,5,8,13,21
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, item_id, user_id)
);

-- Write-back: consensus cycle time estimate on item
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS cycle_time_estimate INTEGER;

-- ────────────────────────────────────────────────────────────────────────────
-- Risk Poker (Generic)
-- ────────────────────────────────────────────────────────────────────────────

-- Risk registry per session
CREATE TABLE IF NOT EXISTS risks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  probability     INTEGER,     -- 1-5 consensus
  impact          INTEGER,     -- 1-5 consensus
  priority_rank   INTEGER,
  status          TEXT NOT NULL DEFAULT 'open', -- open | mitigated | accepted | closed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual probability+impact votes per risk
CREATE TABLE IF NOT EXISTS risk_estimates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  risk_id     UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  probability INTEGER NOT NULL, -- 1-5
  impact      INTEGER NOT NULL, -- 1-5
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, risk_id, user_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- Assumption Slayer (Generic)
-- ────────────────────────────────────────────────────────────────────────────

-- Anonymous assumptions submitted during write phase
CREATE TABLE IF NOT EXISTS assumptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  danger_score NUMERIC(3,1), -- consensus avg 1-5
  gm_verdict   TEXT,         -- valid | addressed | investigate | null
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual danger votes per assumption
CREATE TABLE IF NOT EXISTS assumption_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id UUID NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  danger        INTEGER NOT NULL, -- 1-5
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assumption_id, user_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE flow_poker_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_estimates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE assumptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assumption_votes     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_poker_estimates_read"  ON flow_poker_estimates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "flow_poker_estimates_write" ON flow_poker_estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flow_poker_estimates_upd"   ON flow_poker_estimates FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "risks_read"   ON risks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "risks_write"  ON risks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "risks_update" ON risks FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "risk_estimates_read"  ON risk_estimates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "risk_estimates_write" ON risk_estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "risk_estimates_upd"   ON risk_estimates FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "assumptions_read"  ON assumptions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assumptions_write" ON assumptions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "assumptions_update"ON assumptions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "assumption_votes_read"  ON assumption_votes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "assumption_votes_write" ON assumption_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "assumption_votes_upd"   ON assumption_votes FOR UPDATE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Achievement definitions
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO achievement_definitions (id, key, name, description, icon, rule)
VALUES
  -- Flow Poker
  (gen_random_uuid(), 'flow_master',       'Flow Master',       'Median estimates matched actual cycle time within 1 day (3 times)', '🌊', '{"xp": 60, "mode": "flow_poker"}'),
  (gen_random_uuid(), 'pipeline_cleaner',  'Pipeline Cleaner',  'Identified 5+ flow blockers in one session',                        '🚿', '{"xp": 50, "mode": "flow_poker"}'),
  (gen_random_uuid(), 'consensus_flow',    'Consensus Flow',    'Team achieved ≤1 day spread on all items',                          '🎯', '{"xp": 40, "mode": "flow_poker"}'),
  -- Risk Poker
  (gen_random_uuid(), 'risk_realist',      'Risk Realist',      'Identified top-3 risks that team overlooked',                       '🔍', '{"xp": 55, "mode": "risk_poker"}'),
  (gen_random_uuid(), 'the_risk_manager',  'The Risk Manager',  'Completed 5 risk poker sessions',                                   '📊', '{"xp": 70, "mode": "risk_poker"}'),
  (gen_random_uuid(), 'hot_spotter',       'Hot Spotter',       'Correctly predicted 3 risks that materialized',                     '🎯', '{"xp": 65, "mode": "risk_poker"}'),
  -- Assumption Slayer
  (gen_random_uuid(), 'assumption_buster', 'Assumption Buster', 'Your assumption voted most dangerous 3 times',                      '💥', '{"xp": 50, "mode": "assumption_slayer"}'),
  (gen_random_uuid(), 'the_skeptic',       'The Skeptic',       'Rated 10+ assumptions as danger 4-5 across sessions',               '🤔', '{"xp": 45, "mode": "assumption_slayer"}'),
  (gen_random_uuid(), 'slayer',            'Slayer',            'Team slayed all top-3 assumptions in one session',                  '⚔️', '{"xp": 80, "mode": "assumption_slayer"}'),
  (gen_random_uuid(), 'devils_advocate',   "Devil's Advocate",  'Wrote unique assumption nobody else thought of (5 times)',          '😈', '{"xp": 60, "mode": "assumption_slayer"}')
ON CONFLICT (key) DO NOTHING;
