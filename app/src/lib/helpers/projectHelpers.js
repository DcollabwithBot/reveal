/**
 * Shared project/sprint/item queries for PM screens.
 * Replaces inline supabase.from('projects') / supabase.from('sprints') /
 * supabase.from('organization_members') calls scattered across Dashboard,
 * ProjectWorkspace, KpiDashboard, TeamKanban, TimelogScreen, RetroScreen, AppShell.
 */

import { supabase } from '../supabase.js';

// ── Projects ──────────────────────────────────────────────────────────────────

/** Fetch lightweight project list (id, name, icon, status) for org. */
export async function fetchProjectsForOrg(orgId, { statusFilter } = {}) {
  let query = supabase
    .from('projects')
    .select('id,name,icon,status')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Sprints ───────────────────────────────────────────────────────────────────

/** Fetch sprints for a single project. */
export async function fetchSprintsForProject(projectId, { fields = 'id,name,project_id,status,sprint_code,start_date,created_at,updated_at' } = {}) {
  const { data, error } = await supabase
    .from('sprints')
    .select(fields)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Fetch sprints for multiple projects (by org id). */
export async function fetchSprintsForOrg(orgId, { fields = 'id,name,project_id,status', statusFilter } = {}) {
  let query = supabase
    .from('sprints')
    .select(fields)
    .eq('organization_id', orgId)
    .limit(20);

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Fetch sprints for an array of project ids. */
export async function fetchSprintsForProjects(projectIds, { fields = 'id,name,project_id,status', statusFilter } = {}) {
  if (!projectIds?.length) return [];
  let query = supabase
    .from('sprints')
    .select(fields)
    .in('project_id', projectIds);

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Items ─────────────────────────────────────────────────────────────────────

/** Fetch session_items for a single sprint. */
export async function fetchItemsForSprint(sprintId, { fields = 'id,item_code,parent_code,title,status,item_status,estimated_hours,actual_hours,hours_fak,hours_int,invoiced_dkk,to_invoice_dkk,assigned_to,priority,due_date,notes' } = {}) {
  const { data, error } = await supabase
    .from('session_items')
    .select(fields)
    .eq('sprint_id', sprintId)
    .order('item_code', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Fetch session_items for an array of sprint ids. */
export async function fetchItemsForSprints(sprintIds, { fields = 'id,item_status,sprint_id' } = {}) {
  if (!sprintIds?.length) return [];
  const { data, error } = await supabase
    .from('session_items')
    .select(fields)
    .in('sprint_id', sprintIds);
  if (error) throw error;
  return data || [];
}

// ── Members ───────────────────────────────────────────────────────────────────

/** Fetch organization_members with their profile. */
export async function fetchOrgMembers(orgId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, role, profiles(display_name, avatar_url, sprite_class)')
    .eq('organization_id', orgId);
  if (error) throw error;
  return data || [];
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Get the current session's access token (for Authorization headers). */
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/** Build Authorization + Content-Type headers from current session. */
export async function buildAuthHeaders() {
  const token = await getAccessToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}
