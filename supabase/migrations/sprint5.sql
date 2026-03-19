-- ============================================================
-- SPRINT 5 MIGRATION — Reveal
-- Run manually in Supabase SQL editor
-- Project ID: swyfcathwcdpgkirwihh
-- ============================================================

-- 1. voting_mode on sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS voting_mode text NOT NULL DEFAULT 'fibonacci' CHECK (voting_mode IN ('fibonacci', 'tshirt'));

-- 2. retro_events table (replaces SPRINT_EVENTS constant)
CREATE TABLE IF NOT EXISTS retro_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL = global default
  cat             text NOT NULL CHECK (cat IN ('well', 'wrong', 'improve', 'surprise')),
  icon            text NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  dmg             int,
  hp              int,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE retro_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retro_events_read" ON retro_events
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- 3. challenges table (replaces ROULETTE_CHALLENGES constant)
CREATE TABLE IF NOT EXISTS challenges (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL = global default
  cat             text NOT NULL CHECK (cat IN ('human', 'tech', 'extern', 'custom')),
  icon            text NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  modifier        numeric(3,1) NOT NULL DEFAULT 1.0,
  color           text DEFAULT '#feae34',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenges_read" ON challenges
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
