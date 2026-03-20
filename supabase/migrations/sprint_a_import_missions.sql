-- Sprint A: Data ind + Daily Missions foundation
-- Migration: sprint_a_import_missions.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- Del 1: Integration connections (Jira, TopDesk, ADO)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jira','topdesk','azure_devops')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error','disconnected')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_enc text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage integrations" ON integration_connections
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- Sync log
CREATE TABLE IF NOT EXISTS sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES integration_connections(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  entity_type text NOT NULL,
  external_id text,
  canonical_id uuid,
  action text NOT NULL CHECK (action IN ('created','updated','skipped','conflict','error')),
  error_msg text,
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Del 2: Import batches (til undo)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'excel' CHECK (source_type IN ('excel','csv','jira')),
  items_count int DEFAULT 0,
  undone_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_items ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Del 3: Unplanned Work Tracking
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE session_items ADD COLUMN IF NOT EXISTS is_unplanned boolean NOT NULL DEFAULT false;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS scope_changed_at timestamptz;
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS original_estimate numeric(8,2);

CREATE TABLE IF NOT EXISTS sprint_scope_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  measured_at timestamptz DEFAULT now(),
  items_planned int DEFAULT 0,
  items_unplanned int DEFAULT 0,
  unplanned_rate numeric(4,3),
  scope_change_count int DEFAULT 0,
  hours_planned numeric(8,2),
  hours_unplanned numeric(8,2),
  UNIQUE(sprint_id, (measured_at::date))
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Del 4: Daily Missions — foundation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  mission_type text NOT NULL,
  title text NOT NULL,
  description text,
  icon text DEFAULT '🎯',
  xp_reward int NOT NULL DEFAULT 10,
  bonus_xp int DEFAULT 0,
  badge_key text,
  trigger_event text NOT NULL,
  trigger_threshold int DEFAULT 1,
  scope text NOT NULL DEFAULT 'individual'
    CHECK (scope IN ('individual','team','org')),
  refresh_cadence text NOT NULL DEFAULT 'daily'
    CHECK (refresh_cadence IN ('daily','sprint','event')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','expired')),
  progress int DEFAULT 0,
  assigned_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  completed_at timestamptz,
  xp_earned int DEFAULT 0,
  context_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_missions_active ON user_missions(user_id, status, expires_at);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_read" ON missions FOR SELECT
  USING (organization_id IS NULL OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "user_missions_own" ON user_missions FOR ALL
  USING (user_id = auth.uid());

-- Seed: 10 globale missions
INSERT INTO missions (mission_type, title, description, icon, xp_reward, trigger_event, trigger_threshold, scope, refresh_cadence) VALUES
('join_session', 'Show Up', 'Deltag i en estimation session i dag', '⚔️', 10, 'session_join', 1, 'individual', 'daily'),
('quick_estimate', 'Quick Draw', 'Estimer 3 backlog-items', '🎯', 15, 'vote_insert', 3, 'individual', 'daily'),
('update_actuals', 'Reality Check', 'Opdatér actual hours på 3 items', '✓', 20, 'actual_hours_update', 3, 'individual', 'daily'),
('confidence_vote', 'Gut Check', 'Afgiv confidence vote på 5 items', '💭', 15, 'confidence_vote', 5, 'individual', 'daily'),
('play_risk_card', 'Risk Spotter', 'Spil et Risk Card i en session', '🃏', 20, 'risk_card_played', 1, 'individual', 'event'),
('comment_item', 'Context King', 'Tilføj kommentar til 3 items', '💬', 10, 'comment_insert', 3, 'individual', 'daily'),
('spec_detective', 'Spec Detective', 'Projekt ikke nedbrudt? Tilføj 5 items fra spec', '🔍', 25, 'item_create', 5, 'individual', 'event'),
('orphan_hunter', 'Orphan Hunter', 'X items mangler sprint-tilknytning — triage dem', '👻', 20, 'sprint_assigned', 3, 'individual', 'event'),
('team_full_estimate', 'All Hands', 'Alle sprint-items har estimater inden fredag', '🤝', 25, 'sprint_fully_estimated', 1, 'team', 'sprint'),
('team_retro_complete', 'Retrospective Done', 'Gennemfør sprint retro med hele teamet', '🏆', 30, 'retro_session_complete', 1, 'team', 'sprint')
ON CONFLICT DO NOTHING;
