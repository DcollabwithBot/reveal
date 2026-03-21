-- Sprint Discovery Engine
-- Mission & Quest Engine with Randomness, Side Quests, Random Events
-- Migration: sprint_discovery_engine.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- random_events table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS random_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type       text NOT NULL, -- 'cursed_sprint', 'golden_hour', 'mystery_mode', 'boss_rush'
  title            text,
  description      text,
  mode_id          text,          -- optional: ties to a specific game mode
  xp_multiplier    numeric(3,1) DEFAULT 1.0,
  active_until     timestamptz NOT NULL,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE random_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "random_events_org_member" ON random_events
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_random_events_org_active
  ON random_events(organization_id, active_until);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Extend missions table with discovery fields (if not already present)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE missions ADD COLUMN IF NOT EXISTS mission_type text DEFAULT 'daily';
  -- 'daily', 'side_quest', 'bonus', 'slip_the_beast'
ALTER TABLE missions ADD COLUMN IF NOT EXISTS required_mode text;
  -- links to ALL_MODES id (e.g. 'planning_poker', 'speed_scope')
ALTER TABLE missions ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'normal';
  -- 'easy', 'normal', 'hard', 'expert'
ALTER TABLE missions ADD COLUMN IF NOT EXISTS min_team_xp integer DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS max_team_xp integer DEFAULT 999999;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS week_number integer;
  -- for side quests: ISO week number
ALTER TABLE missions ADD COLUMN IF NOT EXISTS expires_in_days integer DEFAULT 1;
  -- 1 = daily, 7 = side quest

-- ═══════════════════════════════════════════════════════════════════════════════
-- user_missions: extend with discovery fields
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS mission_type text DEFAULT 'daily';
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0;
ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS random_event_id uuid REFERENCES random_events(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- quest_log view: missions + user_missions + random_events joined
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW quest_log AS
  SELECT
    um.id                AS user_mission_id,
    um.user_id,
    um.organization_id,
    um.status,
    um.progress,
    um.expires_at,
    um.completed_at,
    um.xp_earned,
    um.mission_type,
    um.random_event_id,
    m.id                 AS mission_id,
    m.title,
    m.description,
    m.icon,
    m.xp_reward,
    m.scope,
    m.required_mode,
    m.difficulty,
    m.mission_type       AS mission_category,
    re.id                AS event_id,
    re.event_type,
    re.title             AS event_title,
    re.description       AS event_description,
    re.xp_multiplier,
    re.active_until      AS event_active_until
  FROM user_missions um
  LEFT JOIN missions m  ON um.mission_id = m.id
  LEFT JOIN random_events re ON um.random_event_id = re.id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: side quest templates (20+)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO missions (
  title, description, icon, xp_reward, scope,
  mission_type, required_mode, difficulty, expires_in_days, is_active
) VALUES
  ('The Accuracy Challenge',    'Opnå >80% estimation accuracy i 3 sessioner denne uge',  '🎯', 150, 'team',       'side_quest', 'planning_poker',      'hard',   7, true),
  ('The Grooming Marathon',     'Groom 10 backlog items i én uge',                         '🔍', 120, 'team',       'side_quest', 'refinement_roulette', 'normal', 7, true),
  ('The Risk Hunter',           'Find og dokumentér 5 risici via Risk Poker',              '⚠️', 130, 'team',       'side_quest', 'risk_poker',          'normal', 7, true),
  ('Speed Demon Week',          'Deltag i 3 Speed Scope sessioner denne uge',              '⚡', 100, 'individual', 'side_quest', 'speed_scope',         'normal', 7, true),
  ('The Assumption Slayer',     'Dræb 5 farlige antagelser på én uge',                    '🐉', 140, 'team',       'side_quest', 'assumption_slayer',   'hard',   7, true),
  ('Boss Battle Champion',      'Gennemfør en Boss Battle Retro og vind',                  '👾', 160, 'team',       'side_quest', 'boss_battle_retro',   'hard',   7, true),
  ('The Spec Writer',           'Skriv acceptance criteria til 5 items via Spec Wars',    '📜', 110, 'individual', 'side_quest', 'spec_wars',           'normal', 7, true),
  ('Dependency Detective',      'Kortlæg 8+ afhængigheder via Dependency Mapper',         '🕸️', 120, 'team',       'side_quest', 'dependency_mapper',   'normal', 7, true),
  ('The Bluff Master',          'Afsløre blufferen 3 gange i én uge via Bluff Poker',     '🃏', 130, 'individual', 'side_quest', 'bluff_poker',         'hard',   7, true),
  ('Nesting Ninja',             'Opdel 5 epics i sub-tasks via Nesting Scope',            '🪆', 115, 'team',       'side_quest', 'nesting_scope',       'normal', 7, true),
  ('Perspective Champion',      'Estimér fra 4 roller i Perspektiv-Poker',                '🎭', 125, 'individual', 'side_quest', 'perspective_poker',   'normal', 7, true),
  ('Flow Master',               'Mål cycle time på 5 items via Flow Poker',               '🌊', 120, 'team',       'side_quest', 'flow_poker',          'normal', 7, true),
  ('Truth Revealer',            'Afslør bias i 3 sessioner via Truth Serum',              '🧪', 135, 'team',       'side_quest', 'truth_serum',         'hard',   7, true),
  ('Sprint Architect',          'Planlæg en hel sprint via Sprint Draft',                 '📋', 140, 'team',       'side_quest', 'sprint_draft',        'hard',   7, true),
  ('The Completionist',         'Afslut alle 3 daily missions 5 dage i træk',             '🏆', 200, 'individual', 'side_quest', null,                  'expert', 7, true),
  ('Team Player',               'Deltag i 5 team-missions denne uge',                    '🤝', 110, 'team',       'side_quest', null,                  'normal', 7, true),
  ('The Speed Run',             'Gennemfør 5 sessioner på under 20 min total',            '🚀', 150, 'individual', 'side_quest', 'speed_scope',         'expert', 7, true),
  ('Backlog Buster',            'Reducer backlog med 15+ items på én uge',                '💥', 130, 'team',       'side_quest', null,                  'hard',   7, true),
  ('The Estimator',             'Deltag i 5 Planning Poker sessioner denne uge',          '⚔️', 100, 'individual', 'side_quest', 'planning_poker',      'normal', 7, true),
  ('Risk Zero',                 'Løs alle aktive risici inden sprint slutter',            '🛡️', 180, 'team',       'side_quest', 'risk_poker',          'expert', 7, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: daily mission templates (alle modes repræsenteret)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO missions (
  title, description, icon, xp_reward, scope,
  mission_type, required_mode, difficulty, expires_in_days, is_active
) VALUES
  ('Estimer sprint',       'Afhold en Planning Poker session',                    '⚔️', 40, 'team',       'daily', 'planning_poker',      'normal', 1, true),
  ('Groom 3 items',        'Kør Refinement Roulette og groom mindst 3 items',    '🎡', 35, 'team',       'daily', 'refinement_roulette', 'normal', 1, true),
  ('Find en blocker',      'Kortlæg afhæng. og find en blocker i dag',           '🕸️', 30, 'team',       'daily', 'dependency_mapper',   'easy',   1, true),
  ('Skriv 1 spec',         'Skriv acceptance criteria til ét item via Spec Wars','📜', 30, 'individual', 'daily', 'spec_wars',           'easy',   1, true),
  ('Hurtig estimat',       'Tag en Speed Scope session (10 items, 10 sek each)', '⚡', 25, 'individual', 'daily', 'speed_scope',         'easy',   1, true),
  ('Afsløre blufferen',    'Spil en runde Bluff Poker',                          '🃏', 30, 'individual', 'daily', 'bluff_poker',         'easy',   1, true),
  ('Risikoanalyse',        'Afhold Risk Poker og dokumentér 1+ risiko',          '⚠️', 35, 'team',       'daily', 'risk_poker',          'normal', 1, true),
  ('Nedbryd en opgave',    'Brug Nesting Scope til at opdele ét item',           '🪆', 25, 'individual', 'daily', 'nesting_scope',       'easy',   1, true),
  ('Retro-session',        'Afslut sprinten med Boss Battle Retro',              '👾', 50, 'team',       'daily', 'boss_battle_retro',   'normal', 1, true),
  ('Rollebaseret estimat', 'Kør Perspektiv-Poker fra 2+ roller',                 '🎭', 35, 'team',       'daily', 'perspective_poker',   'normal', 1, true),
  ('Cycle time check',     'Mål cycle time på aktuelle items via Flow Poker',   '🌊', 30, 'team',       'daily', 'flow_poker',          'easy',   1, true),
  ('Kill en antagelse',    'Brug Assumption Slayer og identificér 1 antagelse', '🐉', 35, 'team',       'daily', 'assumption_slayer',   'easy',   1, true),
  ('Sanity check',         'Kør Truth Serum og find skjult bias',               '🧪', 30, 'team',       'daily', 'truth_serum',         'easy',   1, true),
  ('Sprint planlæg',       'Brug Sprint Draft til at kickstarte ny sprint',     '📋', 45, 'team',       'daily', 'sprint_draft',        'normal', 1, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: "Slip The Beast" bonus missions (10% chance)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO missions (
  title, description, icon, xp_reward, scope,
  mission_type, required_mode, difficulty, expires_in_days, is_active
) VALUES
  ('SLIP THE BEAST — Bluff Poker',      'En mystisk kraft kalder jer til Bluff Poker i dag!',  '🐲', 80, 'team', 'slip_the_beast', 'bluff_poker',      'hard', 1, true),
  ('SLIP THE BEAST — Nesting Scope',    'Nedbryd det største epic i backlog. Nu.',              '🐲', 80, 'team', 'slip_the_beast', 'nesting_scope',    'hard', 1, true),
  ('SLIP THE BEAST — Assumption Slayer','Det er tid til at slå de farlige antagelser ihjel.',  '🐲', 80, 'team', 'slip_the_beast', 'assumption_slayer','hard', 1, true),
  ('SLIP THE BEAST — Truth Serum',      'Sandheden kan ikke vente. Kør Truth Serum nu.',       '🐲', 80, 'team', 'slip_the_beast', 'truth_serum',      'hard', 1, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DEL 5B: game_mode_config on projects
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE projects ADD COLUMN IF NOT EXISTS game_mode_config jsonb DEFAULT '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DEL 6: project_templates
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS project_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  game_mode_config jsonb DEFAULT '{}'::jsonb,
  is_system        boolean DEFAULT false,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_templates_org_member" ON project_templates
  FOR ALL USING (
    is_system = true OR
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_templates_org ON project_templates(organization_id);
