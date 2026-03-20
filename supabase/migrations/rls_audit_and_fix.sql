-- RLS Audit & Fix — enable RLS on all public tables missing it
-- Tables already enabled: challenges, comments, excel_imports, game_session_states,
--   item_comments, item_dependencies, notifications, org_metrics, organization_members,
--   organizations, profiles, retro_events, retro_notes, risk_items, session_items,
--   session_participants, sessions, team_members, teams, time_entries, votes

-- ── Enable RLS on tables missing it ──

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE retro_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_draft_priority_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ── Policies: approval_requests ──
CREATE POLICY "approval_requests_select" ON approval_requests
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "approval_requests_insert" ON approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "approval_requests_update" ON approval_requests
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ── Policies: audit_log ──
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── Policies: event_ledger ──
CREATE POLICY "event_ledger_select" ON event_ledger
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "event_ledger_insert" ON event_ledger
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── Policies: node_completions ──
CREATE POLICY "node_completions_all" ON node_completions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: notification_rules ──
CREATE POLICY "notification_rules_all" ON notification_rules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: projects ──
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── Policies: retro_actions ──
CREATE POLICY "retro_actions_select" ON retro_actions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "retro_actions_insert" ON retro_actions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "retro_actions_update" ON retro_actions
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- ── Policies: session_templates ──
CREATE POLICY "session_templates_select" ON session_templates
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "session_templates_insert" ON session_templates
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "session_templates_delete" ON session_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── Policies: sprint_daily_snapshots ──
CREATE POLICY "sprint_daily_snapshots_all" ON sprint_daily_snapshots
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: sprint_draft_picks ──
CREATE POLICY "sprint_draft_picks_all" ON sprint_draft_picks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: sprint_draft_priority_votes ──
CREATE POLICY "sprint_draft_priority_votes_all" ON sprint_draft_priority_votes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: sprints ──
CREATE POLICY "sprints_select" ON sprints
  FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "sprints_insert" ON sprints
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "sprints_update" ON sprints
  FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ── Policies: webhook_configs ──
CREATE POLICY "webhook_configs_all" ON webhook_configs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Policies: webhook_deliveries ──
CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "webhook_deliveries_insert" ON webhook_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (true);
