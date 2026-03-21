import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function edgeFn(fnName, body = {}, method = 'POST') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Edge function error');
  }
  return res.json();
}

async function resolveMembership() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgMember?.organization_id) {
    return { organization_id: orgMember.organization_id, role: orgMember.role };
  }

  const { data: member } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member?.team_id) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('id, organization_id')
    .eq('id', member.team_id)
    .maybeSingle();

  return team ? { team_id: team.id, organization_id: team.organization_id, role: member.role } : null;
}

// ── Auth / Provision ──────────────────────────────────────────────────────────
export async function provisionUser(_userId, _displayName) {
  return edgeFn('provision');
}

// ── Membership ────────────────────────────────────────────────────────────────
export async function getMembership() {
  return resolveMembership();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) {
    return { active: [], upcoming: [], finished: [], projects: [], activity: [] };
  }

  const [{ data: sessions }, { data: projects }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id,name,status,join_code,created_at,started_at,ended_at,session_type,project_id,session_items(count),session_participants(count)')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('projects')
      .select('id,name,description,status,color,icon,created_by,created_at,updated_at,sprints(id,session_items(id,item_status))')
      .eq('organization_id', membership.organization_id)
      .order('updated_at', { ascending: false })
  ]);

  const byStatus = { active: [], upcoming: [], finished: [] };
  for (const s of sessions || []) {
    const shaped = {
      ...s,
      item_count: s.session_items?.[0]?.count || 0,
      participant_count: s.session_participants?.[0]?.count || 0
    };
    if (s.status === 'active') byStatus.active.push(shaped);
    else if (s.status === 'completed') byStatus.finished.push(shaped);
    else byStatus.upcoming.push(shaped);
  }

  const activity = [
    ...(sessions || []).slice(0, 20).map(s => {
      const itemCount = s.session_items?.[0]?.count || 0;
      const partCount = s.session_participants?.[0]?.count || 0;
      let description;
      if (s.status === 'completed') {
        description = `Session afsluttet · ${itemCount} item${itemCount !== 1 ? 's' : ''}${partCount ? ` · ${partCount} deltagere` : ''}`;
      } else if (s.status === 'active') {
        description = `Session i gang · ${itemCount} item${itemCount !== 1 ? 's' : ''}${partCount ? ` · ${partCount} deltagere` : ''}`;
      } else {
        description = `Session klar · ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      }
      return {
        id: `session-${s.id}`,
        type: 'session',
        title: s.name,
        description,
        created_at: s.ended_at || s.started_at || s.created_at,
        href: `/sessions/${s.id}/results`
      };
    }),
    ...(projects || []).slice(0, 20).map(p => {
      const allItems = (p.sprints || []).flatMap(s => s.session_items || []);
      const doneItems = allItems.filter(i => i.item_status === 'done').length;
      const total = allItems.length;
      const progress = total > 0 ? Math.round((doneItems / total) * 100) : 0;
      let description;
      if (total > 0) {
        description = `${doneItems}/${total} items · ${progress}% færdig`;
      } else {
        description = `Projekt ${p.status.replace('_', ' ')} · ingen items endnu`;
      }
      return {
        id: `project-${p.id}`,
        type: 'project',
        title: p.name,
        description,
        created_at: p.updated_at || p.created_at,
        href: `/projects/${p.id}`
      };
    })
  ]
    .filter(i => i.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);

  const projectsWithProgress = (projects || []).map(p => {
    const allItems = (p.sprints || []).flatMap(s => s.session_items || []);
    const doneItems = allItems.filter(i => i.item_status === 'done');
    const progress = allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0;
    return { ...p, total_items: allItems.length, done_items: doneItems.length, progress };
  });

  return { ...byStatus, projects: projectsWithProgress, activity };
}

// ── Governance / Dashboard combo ──────────────────────────────────────────────
export async function getDashboardGovernance() {
  const [dashboard, approvalRequests, health, conflicts] = await Promise.all([
    getDashboard(),
    getApprovalRequests(),
    getSyncHealth(),
    getSyncConflicts()
  ]);
  return { dashboard, approvalRequests, health, conflicts };
}

// ── Approval Requests ────────────────────────────────────────────────────────
export async function getApprovalRequests() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(200);
  return data || [];
}

export async function getLatestApprovalState(targetId) {
  const rows = await getApprovalRequests();
  const match = (rows || []).find(r => String(r.target_id) === String(targetId));
  return match?.state || null;
}

export async function approveRequest(requestId) {
  return edgeFn('approve-mutation', { approvalId: requestId, action: 'approve' });
}

export async function rejectRequest(requestId, reason) {
  return edgeFn('approve-mutation', { approvalId: requestId, action: 'reject', reason });
}

export async function applyRequest(requestId) {
  return edgeFn('approve-mutation', { approvalId: requestId, action: 'apply' });
}

export async function submitAdvisoryRequest(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const membership = await resolveMembership();

  const { data } = await supabase
    .from('approval_requests')
    .insert({
      ...payload,
      state: 'pending_approval',
      organization_id: membership?.organization_id || null,
      team_id: membership?.team_id || null,
      requested_by: user?.id || null
    })
    .select('*')
    .single();
  return data;
}

export function createConflictResolutionRequest(conflict) {
  const attemptedPatch = conflict?.payload?.attempted_patch || {};
  const { source_layer, approval_request_id, id, ...requestedPatch } = attemptedPatch;
  return submitAdvisoryRequest({
    target_type: conflict?.target_type,
    target_id: conflict?.target_id,
    requested_patch: requestedPatch,
    idempotency_key: `conflict:${conflict?.id}:${Date.now()}`
  });
}

// ── Sync Health + Conflicts ───────────────────────────────────────────────────
export async function getSyncHealth() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return { queue_depth: 0, blocked_writes: 0, duplicate_events: 0 };

  const [
    { count: pendingApprovals },
    { count: blockedWrites },
    { count: duplicateEvents }
  ] = await Promise.all([
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('state', 'pending_approval'),
    supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('event_type', 'pm.mutation.blocked'),
    supabase
      .from('event_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'ingest')
  ]);

  return {
    queue_depth: pendingApprovals || 0,
    blocked_writes: blockedWrites || 0,
    duplicate_events: duplicateEvents || 0
  };
}

export async function getSyncConflicts() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('audit_log')
    .select('id,created_at,event_type,source_layer,target_type,target_id,approval_request_id,payload,outcome')
    .eq('organization_id', membership.organization_id)
    .eq('event_type', 'pm.mutation.blocked')
    .order('created_at', { ascending: false })
    .limit(100);
  return data || [];
}

// ── Projection Config ─────────────────────────────────────────────────────────
export async function getProjectionConfig() {
  const membership = await resolveMembership();
  const organizationId = membership?.organization_id || null;

  let query = supabase.from('game_profiles').select('*');
  if (organizationId) {
    query = query
      .or(`organization_id.eq.${organizationId},and(organization_id.is.null,is_default.eq.true)`)
      .order('organization_id', { ascending: false })
      .limit(1);
  } else {
    query = query.eq('is_default', true).is('organization_id', null).limit(1);
  }

  const { data: profiles } = await query;
  const profile = (profiles || [])[0] || null;
  if (!profile) return { profile: null, bossProfiles: [], rewardRules: [], achievements: [] };

  const [{ data: bossProfiles }, { data: rewardRules }, { data: achievements }] = await Promise.all([
    supabase.from('boss_profiles').select('*').eq('game_profile_id', profile.id).order('key'),
    supabase.from('reward_rules').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key'),
    supabase.from('achievement_definitions').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key')
  ]);

  return {
    profile,
    bossProfiles: bossProfiles || [],
    rewardRules: rewardRules || [],
    achievements: achievements || []
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function joinSessionByCode(code) {
  const { data } = await supabase
    .from('sessions')
    .select('id, name, session_type, status, join_code, team_id')
    .eq('join_code', code.toUpperCase())
    .neq('status', 'completed')
    .maybeSingle();
  return data;
}

export async function createSession(payload) {
  return edgeFn('create-session', payload);
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function getProject(projectId) {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  return data;
}

export async function getProjects() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('projects')
    .select('id,name,description,status,color,icon,created_by,created_at,updated_at,sprints(id,session_items(id,item_status,estimated_hours,actual_hours,progress))')
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false });

  return (data || []).map(p => {
    const allItems = (p.sprints || []).flatMap(s => s.session_items || []);
    const doneItems = allItems.filter(i => i.item_status === 'done');
    const progress = allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0;
    return { ...p, total_items: allItems.length, done_items: doneItems.length, progress };
  });
}

export async function getProjectSprints(projectId) {
  const { data } = await supabase
    .from('sprints')
    .select('id, name, sprint_code, status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function getSprintItems(sprintId) {
  const { data } = await supabase
    .from('session_items')
    .select('id, item_code, parent_code, title, status, item_status, estimated_hours, hours_fak, hours_int, invoiced_dkk, to_invoice_dkk, assigned_to, priority, due_date, notes')
    .eq('sprint_id', sprintId)
    .order('item_code', { ascending: true });
  return data || [];
}

export async function updateItemStatus(itemId, status) {
  const { data } = await supabase
    .from('session_items')
    .update({ status })
    .eq('id', itemId)
    .select()
    .single();
  return data;
}

export async function updateItem(itemId, updates) {
  const { data } = await supabase
    .from('session_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();
  return data;
}

export async function updateProjectStatus(projectId, status) {
  const { data } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId)
    .select('id, status')
    .single();
  return data;
}

export async function createProject(payload) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: membership.organization_id,
      name: (payload.name || '').trim(),
      description: payload.description?.trim() || null,
      color: payload.color || '#4488dd',
      icon: payload.icon || '📋',
      status: payload.status || 'active',
      created_by: user?.id
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createSprint(projectId, payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: project } = await supabase.from('projects').select('organization_id').eq('id', projectId).single();
  if (!project) throw new Error('Project not found');

  const { data, error } = await supabase
    .from('sprints')
    .insert({
      project_id: projectId,
      organization_id: project.organization_id,
      name: (payload.name || '').trim(),
      goal: payload.goal || null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      status: payload.status || 'upcoming',
      created_by: user?.id
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createSprintItem(sprintId, payload) {
  if (Array.isArray(payload.items) && payload.items.length) {
    const rows = payload.items.map((it, idx) => ({
      sprint_id: sprintId,
      title: it.title,
      description: it.description || null,
      priority: it.priority || 'medium',
      item_status: it.item_status || 'backlog',
      progress: typeof it.progress === 'number' ? it.progress : 0,
      item_order: idx
    })).filter(r => r.title?.trim());
    const { data, error } = await supabase.from('session_items').insert(rows).select();
    if (error) throw new Error(error.message);
    return data || [];
  }

  const { data, error } = await supabase
    .from('session_items')
    .insert({
      sprint_id: sprintId,
      title: (payload.title || '').trim(),
      description: payload.description || null,
      priority: payload.priority || 'medium',
      assigned_to: payload.assigned_to || null,
      estimated_hours: payload.estimated_hours || null,
      actual_hours: payload.actual_hours || null,
      progress: typeof payload.progress === 'number' ? payload.progress : 0,
      item_status: payload.item_status || 'backlog',
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function closeItem(itemId) {
  const { data } = await supabase
    .from('session_items')
    .update({ item_status: 'done', status: 'completed' })
    .eq('id', itemId)
    .select()
    .single();
  return data;
}

// ── Item Comments ─────────────────────────────────────────────────────────────
export async function getItemComments(itemId) {
  const { data } = await supabase
    .from('item_comments')
    .select('id, body, author_name, user_id, created_at')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function addItemComment(itemId, body, authorName) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('item_comments')
    .insert({ item_id: itemId, body, author_name: authorName || 'Unknown', user_id: user?.id || null })
    .select()
    .single();
  return data;
}

// ── Risk Items ────────────────────────────────────────────────────────────────
export async function getRiskItems(organizationId) {
  const { data } = await supabase
    .from('risk_items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createRiskItem(organizationId, payload) {
  const { data } = await supabase
    .from('risk_items')
    .insert({ organization_id: organizationId, ...payload })
    .select()
    .single();
  return data;
}

export async function updateRiskItem(id, updates) {
  const { data } = await supabase
    .from('risk_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return data;
}

export async function resolveRiskItem(id) {
  const { data } = await supabase
    .from('risk_items')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return data;
}

// ── Org Metrics ───────────────────────────────────────────────────────────────
export async function getOrgMetrics(organizationId) {
  const { data } = await supabase
    .from('org_metrics')
    .select('key, value_num, value_text, prev_value_num')
    .eq('organization_id', organizationId);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r; });
  return map;
}

export async function upsertOrgMetric(organizationId, key, valueNum, prevValueNum, valueText) {
  const { data } = await supabase
    .from('org_metrics')
    .upsert({
      organization_id: organizationId,
      key,
      value_num: valueNum ?? null,
      prev_value_num: prevValueNum ?? null,
      value_text: valueText ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,key' })
    .select()
    .single();
  return data;
}

// ── Team Assignees ────────────────────────────────────────────────────────────
export async function getTeamAssignees() {
  const membership = await resolveMembership();
  if (!membership?.team_id) return [];

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', membership.team_id);

  const userIds = [...new Set((members || []).map(m => m.user_id).filter(Boolean))];
  if (!userIds.length) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_class')
    .in('id', userIds);

  const profileById = new Map((profiles || []).map(p => [p.id, p]));
  return userIds.map(id => {
    const profile = profileById.get(id);
    return {
      id,
      display_name: profile?.display_name || id.slice(0, 8),
      avatar_class: profile?.avatar_class || null
    };
  });
}

// ── Approval Request Create + Apply ───────────────────────────────────────────
export async function createApprovalRequest(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: membership.organization_id,
      team_id: membership.team_id || null,
      target_type: payload.target_type,
      target_id: payload.target_id,
      requested_patch: payload.requested_patch,
      requested_by: user?.id,
      state: 'pending_approval',
      idempotency_key: payload.idempotency_key
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function applyApprovedRequest(requestId) {
  return edgeFn('approve-mutation', { approvalId: requestId, action: 'apply' });
}

// ── Game Session State ────────────────────────────────────────────────────────
export async function loadGameSessionState({ projectId, nodeId }) {
  if (!projectId || !nodeId) return null;
  const membership = await resolveMembership();
  if (!membership?.organization_id) return null;

  const { data } = await supabase
    .from('game_session_states')
    .select('state, saved_at')
    .eq('organization_id', membership.organization_id)
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .maybeSingle();

  return data ? { state: data.state, saved_at: data.saved_at, source: 'game_session_states' } : { state: null, saved_at: null, source: 'none' };
}

export async function persistGameSessionState({ projectId, nodeId, state }) {
  if (!projectId || !nodeId || !state) return null;
  const membership = await resolveMembership();
  if (!membership?.organization_id) return null;
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('game_session_states')
    .upsert({
      organization_id: membership.organization_id,
      team_id: membership.team_id || null,
      project_id: projectId,
      node_id: nodeId,
      state,
      saved_by: user?.id,
      saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'organization_id,project_id,node_id' })
    .select('state, saved_at')
    .single();

  if (error) throw new Error(error.message);
  return { ok: true, saved_at: data?.saved_at, source: 'game_session_states' };
}

export async function getGameSessionStateStatus({ projectId, nodeId }) {
  if (!projectId || !nodeId) return null;
  const membership = await resolveMembership();
  if (!membership?.organization_id) return null;

  const { data: stateRow } = await supabase
    .from('game_session_states')
    .select('organization_id,project_id,node_id,status,step,saved_at,updated_at')
    .eq('organization_id', membership.organization_id)
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .maybeSingle();

  return {
    session_state: {
      present: Boolean(stateRow),
      status: stateRow?.status || null,
      step: stateRow?.step ?? null,
      saved_at: stateRow?.saved_at || null,
      updated_at: stateRow?.updated_at || null,
      stale: Boolean(stateRow?.saved_at) && Date.now() - new Date(stateRow.saved_at).getTime() > 1000 * 60 * 60 * 24,
    },
  };
}

// ── Game-PM Bridge (Fase 3) ───────────────────────────────────────────────────
export async function startSprintEstimation(sprintId, { session_name, voting_mode } = {}) {
  return edgeFn('start-estimation', { type: 'sprint', id: sprintId, session_name, voting_mode });
}

export async function startProjectEstimation(projectId, { session_name, voting_mode } = {}) {
  return edgeFn('start-estimation', { type: 'project', id: projectId, session_name, voting_mode });
}

export async function startBulkEstimation({ item_ids, session_name, voting_mode }) {
  return edgeFn('start-estimation', { type: 'bulk', item_ids, session_name, voting_mode });
}

// ── Org Settings ──────────────────────────────────────────────────────────────
export async function getOrgSettings() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data } = await supabase
    .from('organizations')
    .select('id, auto_approve_estimates')
    .eq('id', membership.organization_id)
    .maybeSingle();

  return { auto_approve_estimates: data?.auto_approve_estimates || false };
}

export async function updateOrgSettings(patch) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const update = {};
  if (typeof patch.auto_approve_estimates === 'boolean') update.auto_approve_estimates = patch.auto_approve_estimates;

  const { data, error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', membership.organization_id)
    .select('id, auto_approve_estimates')
    .single();

  if (error) throw new Error(error.message);
  return { auto_approve_estimates: data?.auto_approve_estimates || false };
}

// ── Retro Actions ─────────────────────────────────────────────────────────────
export async function saveRetroActions(sessionId, actions) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = (actions || []).map(a => ({
    session_id: sessionId,
    title: a.title,
    description: a.description || null,
    suggested_assignee: a.suggested_assignee || null,
    suggested_sprint_id: a.suggested_sprint_id || null,
    created_by: user?.id,
  })).filter(r => r.title?.trim());

  if (!rows.length) throw new Error('At least one action with title required');

  const { data, error } = await supabase.from('retro_actions').insert(rows).select();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRetroActions() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name')
    .eq('organization_id', membership.organization_id);

  const sessionIds = (sessions || []).map(s => s.id);
  if (!sessionIds.length) return [];

  const sessionMap = new Map((sessions || []).map(s => [s.id, s.name]));

  const { data } = await supabase
    .from('retro_actions')
    .select('*')
    .in('session_id', sessionIds)
    .is('promoted_at', null)
    .order('created_at', { ascending: false });

  return (data || []).map(a => ({
    ...a,
    session_name: sessionMap.get(a.session_id) || 'Unknown session',
  }));
}

export async function promoteRetroAction(actionId, { sprint_id } = {}) {
  return edgeFn('promote-retro-action', { actionId, sprint_id });
}

// ── Game Stats ────────────────────────────────────────────────────────────────
export async function getGameStats() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const orgId = membership.organization_id;

  const { data: sprints } = await supabase
    .from('sprints')
    .select('id, name, status, end_date, project_id')
    .eq('organization_id', orgId)
    .order('end_date', { ascending: false })
    .limit(20);

  const completedSprints = (sprints || []).filter(s => s.status === 'completed');
  const activeSprint = (sprints || []).find(s => s.status === 'active');

  let sprint_streak = 0;
  for (const _s of completedSprints) {
    sprint_streak++;
    if (sprint_streak >= 10) break;
  }

  let estimation_accuracy = null;
  const recentCompletedIds = completedSprints.slice(0, 5).map(s => s.id);
  if (recentCompletedIds.length) {
    const { data: estItems } = await supabase
      .from('session_items')
      .select('estimated_hours, actual_hours')
      .in('sprint_id', recentCompletedIds)
      .not('estimated_hours', 'is', null)
      .not('actual_hours', 'is', null);

    const pairs = (estItems || []).filter(i => i.estimated_hours > 0 && i.actual_hours > 0);
    if (pairs.length) {
      const accuracies = pairs.map(i => {
        const ratio = i.actual_hours / i.estimated_hours;
        return ratio > 1 ? 1 / ratio : ratio;
      });
      estimation_accuracy = Number((accuracies.reduce((s, v) => s + v, 0) / accuracies.length).toFixed(2));
    }
  }

  let team_velocity_trend = 'stable';
  if (completedSprints.length >= 3) {
    const lastThreeIds = completedSprints.slice(0, 3).map(s => s.id);
    const { data: velItems } = await supabase
      .from('session_items')
      .select('sprint_id, estimated_hours')
      .in('sprint_id', lastThreeIds)
      .eq('item_status', 'done');

    const pointsBySprint = {};
    for (const item of velItems || []) {
      pointsBySprint[item.sprint_id] = (pointsBySprint[item.sprint_id] || 0) + (item.estimated_hours || 1);
    }

    const velocities = lastThreeIds.map(id => pointsBySprint[id] || 0);
    if (velocities[0] > velocities[1]) team_velocity_trend = 'up';
    else if (velocities[0] < velocities[1]) team_velocity_trend = 'down';
  }

  let sessions_this_sprint = 0;
  if (activeSprint) {
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('sprint_id', activeSprint.id)
      .eq('session_type', 'estimation');
    sessions_this_sprint = count || 0;
  }

  let items_estimated_pct = 0;
  if (activeSprint) {
    const { data: allItems } = await supabase
      .from('session_items')
      .select('id, estimated_hours')
      .eq('sprint_id', activeSprint.id);

    const total = (allItems || []).length;
    const estimated = (allItems || []).filter(i => i.estimated_hours != null).length;
    items_estimated_pct = total > 0 ? Number((estimated / total).toFixed(2)) : 0;
  }

  return { sprint_streak, estimation_accuracy, team_velocity_trend, sessions_this_sprint, items_estimated_pct };
}

// ── Telemetry ─────────────────────────────────────────────────────────────────
export async function reportExportEvent({ projectId, sprintId, format, ok, error }) {
  // Best-effort telemetry — fire and forget via audit_log
  const membership = await resolveMembership();
  if (!membership?.organization_id) return { ok: true };
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('audit_log').insert({
    event_type: ok ? 'retro.export.completed' : 'retro.export.failed',
    actor: 'pm',
    source_layer: 'pm',
    organization_id: membership.organization_id,
    team_id: membership.team_id || null,
    target_type: 'sprint',
    target_id: sprintId || null,
    payload: { action: 'sprint_report_export', format, project_id: projectId, ok, error: error ? String(error).slice(0, 180) : null, initiated_by: user?.id },
    outcome: ok ? 'accepted' : 'blocked',
  });

  return { ok: true };
}

// ── Sprint Draft ──────────────────────────────────────────────────────────────

export async function getVelocitySuggestion(projectId) {
  const { data: sprints } = await supabase
    .from('sprint_velocity')
    .select('sprint_name, velocity_actual')
    .eq('project_id', projectId)
    .order('sprint_id', { ascending: false })
    .limit(3);

  const velocities = (sprints || []).map(s => Number(s.velocity_actual) || 0);
  const suggested_capacity = velocities.length
    ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
    : 0;

  return {
    suggested_capacity,
    sprints: (sprints || []).map(s => ({ name: s.sprint_name, velocity_actual: Number(s.velocity_actual) || 0 }))
  };
}

export async function getDraftState(sessionId) {
  const [sessionRes, itemsRes, picksRes, votesRes] = await Promise.all([
    supabase.from('sessions').select('id,name,status,draft_config,sprint_id,project_id,game_master_id').eq('id', sessionId).maybeSingle(),
    supabase.from('session_items').select('*').eq('session_id', sessionId).order('item_order'),
    supabase.from('sprint_draft_picks').select('*').eq('session_id', sessionId).order('pick_order'),
    supabase.from('sprint_draft_priority_votes').select('session_item_id, tokens').eq('session_id', sessionId),
  ]);

  const session = sessionRes.data;
  const items = itemsRes.data || [];
  const picks = picksRes.data || [];
  const votes = votesRes.data || [];

  const priorityScores = {};
  for (const v of votes) {
    priorityScores[v.session_item_id] = (priorityScores[v.session_item_id] || 0) + v.tokens;
  }

  const capacityUsed = picks
    .filter(p => p.decision === 'drafted' || p.decision === 'stretch')
    .reduce((sum, p) => sum + (Number(p.estimate_at_draft) || 0), 0);
  const capacity = session?.draft_config?.capacity_points || 0;

  return { session, items, picks, priorityScores, capacityUsed, capacity };
}

export async function submitDraftPicks(sessionId, picks) {
  const rows = picks.map(p => ({
    session_id: sessionId,
    session_item_id: p.session_item_id,
    pick_order: p.pick_order,
    decision: p.decision,
    estimate_at_draft: p.estimate_at_draft ?? null,
    estimate_source: p.estimate_source || 'existing',
    voted_in: p.voted_in ?? false,
    pm_override: p.pm_override ?? false,
    priority_score: p.priority_score ?? 0,
  }));

  const { data, error } = await supabase
    .from('sprint_draft_picks')
    .upsert(rows, { onConflict: 'session_id,session_item_id' })
    .select('*');

  if (error) throw new Error(error.message);
  return data;
}

export async function submitPriorityVotes(sessionId, votes) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = votes.map(v => ({
    session_id: sessionId,
    session_item_id: v.session_item_id,
    user_id: user.id,
    tokens: v.tokens,
  }));

  const { error } = await supabase
    .from('sprint_draft_priority_votes')
    .upsert(rows, { onConflict: 'session_id,session_item_id,user_id' });

  if (error) throw new Error(error.message);

  const { data: agg } = await supabase
    .from('sprint_draft_priority_votes')
    .select('session_item_id, tokens')
    .eq('session_id', sessionId);

  const scores = {};
  for (const row of agg || []) {
    scores[row.session_item_id] = (scores[row.session_item_id] || 0) + row.tokens;
  }
  return { scores };
}

export async function finalizeDraft(sessionId) {
  return edgeFn('finalize-draft', { sessionId });
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function markNotificationRead(notificationId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .select()
    .single();
  return data;
}

export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  return { ok: true };
}

export async function getUnreadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);
  return { count: count || 0 };
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function searchAll(query, types = ['items', 'projects', 'sprints']) {
  const membership = await resolveMembership();
  if (!membership?.organization_id || !query || query.length < 2) return { items: [], projects: [], sprints: [] };
  const orgId = membership.organization_id;
  const results = { items: [], projects: [], sprints: [] };

  const searches = [];

  if (types.includes('items')) {
    searches.push(
      supabase
        .from('session_items')
        .select('id, title, item_code, item_status, sprint_id, sprints!inner(id, name, project_id, projects!inner(id, name, organization_id))')
        .eq('sprints.projects.organization_id', orgId)
        .ilike('title', `%${query}%`)
        .limit(10)
        .then(({ data }) => {
          results.items = (data || []).map(item => ({
            id: item.id,
            title: item.title,
            item_code: item.item_code,
            item_status: item.item_status,
            sprint_name: item.sprints?.name || null,
            project_name: item.sprints?.projects?.name || null,
            project_id: item.sprints?.projects?.id || null,
          }));
        })
        .catch(() => {})
    );
  }

  if (types.includes('projects')) {
    searches.push(
      supabase
        .from('projects')
        .select('id, name, description')
        .eq('organization_id', orgId)
        .ilike('name', `%${query}%`)
        .limit(8)
        .then(({ data }) => {
          results.projects = (data || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
          }));
        })
        .catch(() => {})
    );
  }

  if (types.includes('sprints')) {
    searches.push(
      supabase
        .from('sprints')
        .select('id, name, project_id, projects!inner(id, name, organization_id)')
        .eq('projects.organization_id', orgId)
        .ilike('name', `%${query}%`)
        .limit(8)
        .then(({ data }) => {
          results.sprints = (data || []).map(s => ({
            id: s.id,
            name: s.name,
            project_name: s.projects?.name || null,
            project_id: s.projects?.id || null,
          }));
        })
        .catch(() => {})
    );
  }

  await Promise.all(searches);
  return results;
}

// ── Burndown / Velocity ───────────────────────────────────────────────────────
export async function getSprintBurndown(sprintId) {
  const { data: sprint } = await supabase
    .from('sprints')
    .select('id, name, start_date, end_date')
    .eq('id', sprintId)
    .maybeSingle();

  const { data: snapshots } = await supabase
    .from('sprint_daily_snapshots')
    .select('*')
    .eq('sprint_id', sprintId)
    .order('snapshot_date', { ascending: true });

  let ideal = [];
  if (sprint?.start_date && sprint?.end_date && snapshots?.length) {
    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const totalHours = snapshots[0]?.hours_estimated || 0;

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      ideal.push({
        date: d.toISOString().split('T')[0],
        hours_remaining: Number((totalHours * (1 - i / totalDays)).toFixed(1))
      });
    }
  }

  return { sprint, snapshots: snapshots || [], ideal };
}

export async function getProjectVelocity(projectId) {
  const { data } = await supabase
    .from('sprint_velocity')
    .select('*')
    .eq('project_id', projectId)
    .order('end_date', { ascending: true });
  return data || [];
}

// ── Dependencies ──────────────────────────────────────────────────────────────
export async function getItemDependencies(itemId) {
  const [{ data: blocks }, { data: blockedBy }] = await Promise.all([
    supabase.from('item_dependencies').select('id, depends_on_id, dependency_type, created_at').eq('item_id', itemId),
    supabase.from('item_dependencies').select('id, item_id, dependency_type, created_at').eq('depends_on_id', itemId),
  ]);

  const relatedIds = [
    ...(blocks || []).map(b => b.depends_on_id),
    ...(blockedBy || []).map(b => b.item_id),
  ].filter(Boolean);

  let itemMap = new Map();
  if (relatedIds.length) {
    const { data: items } = await supabase
      .from('session_items')
      .select('id, title, item_code, item_status')
      .in('id', relatedIds);
    (items || []).forEach(i => itemMap.set(i.id, i));
  }

  return {
    blocks: (blocks || []).map(b => ({ ...b, item: itemMap.get(b.depends_on_id) || null })),
    blocked_by: (blockedBy || []).map(b => ({ ...b, item: itemMap.get(b.item_id) || null })),
  };
}

export async function addItemDependency(itemId, dependsOnId, dependencyType) {
  if (itemId === dependsOnId) throw new Error('Cannot depend on itself');

  const { data, error } = await supabase
    .from('item_dependencies')
    .insert({
      item_id: itemId,
      depends_on_id: dependsOnId,
      dependency_type: dependencyType || 'blocks',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeItemDependency(dependencyId) {
  const { error } = await supabase
    .from('item_dependencies')
    .delete()
    .eq('id', dependencyId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Templates ─────────────────────────────────────────────────────────────────
export async function getTemplates() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('session_templates')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createTemplate(name, config) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      organization_id: membership.organization_id,
      created_by: user?.id,
      name: (name || '').trim(),
      config: config || {}
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTemplate(templateId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('session_templates')
    .delete()
    .eq('id', templateId)
    .eq('created_by', user?.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Org Members ───────────────────────────────────────────────────────────────
export async function getOrgMembers() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('organization_id', membership.organization_id);

  const userIds = (orgMembers || []).map(m => m.user_id).filter(Boolean);
  let profileMap = new Map();
  if (userIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_class').in('id', userIds);
    (profiles || []).forEach(p => profileMap.set(p.id, p));
  }

  return (orgMembers || []).map(m => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role || 'member',
      joined_at: m.joined_at,
      display_name: profile?.display_name || m.user_id?.slice(0, 8) || 'Unknown',
      avatar_class: profile?.avatar_class || null,
      is_me: m.user_id === user?.id,
    };
  });
}

export async function updateMemberRole(memberId, role) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { ok: true, member: data };
}

export async function getMyPermissions() {
  const membership = await resolveMembership();
  const ROLE_PERMISSIONS = {
    owner: ['create_session', 'manage_sprints', 'manage_items', 'approve_estimates', 'view_all', 'change_owner', 'manage_members'],
    admin: ['create_session', 'manage_sprints', 'manage_items', 'approve_estimates', 'view_all', 'manage_members'],
    pm: ['create_session', 'manage_sprints', 'manage_items', 'approve_estimates', 'view_all'],
    tech_lead: ['create_session', 'manage_items', 'view_all'],
    developer: ['create_session', 'vote', 'view_team'],
    member: ['create_session', 'vote', 'view_team'],
    observer: ['view_only'],
    guest: ['view_only'],
  };

  const role = membership?.role || 'guest';
  return {
    role,
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['guest'],
    organization_id: membership?.organization_id,
    team_id: membership?.team_id,
  };
}

// ── Session Results ───────────────────────────────────────────────────────────
export async function getSessionResults(sessionId, token) {
  const { data: session } = await supabase
    .from('sessions')
    .select('id,name,status,voting_mode,created_at,ended_at,share_token')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) throw new Error('Session not found');

  if (token && String(session.share_token) !== String(token)) {
    throw new Error('Invalid token');
  }

  const { data: items } = await supabase
    .from('session_items')
    .select('id,title,final_estimate')
    .eq('session_id', sessionId)
    .order('item_order');

  const itemIds = (items || []).map(i => i.id);
  const { data: votes } = itemIds.length
    ? await supabase
      .from('votes')
      .select('id,session_item_id,value,confidence,user_id,perspective,profiles(display_name)')
      .in('session_item_id', itemIds)
    : { data: [] };

  function normalizeVote(val) {
    if (val == null) return null;
    const n = Number(val);
    if (Number.isNaN(n)) {
      const tshirt = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      return tshirt.indexOf(String(val).toUpperCase()) + 1 || null;
    }
    return n;
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function avg(values) {
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  function percentile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = (sorted.length - 1) * p;
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
  }

  const rows = (items || []).map(item => {
    const itemVotes = (votes || []).filter(v => v.session_item_id === item.id);
    const numbers = itemVotes.map(v => normalizeVote(v.value)).filter(v => typeof v === 'number' && !Number.isNaN(v));
    const med = median(numbers);
    const q1 = percentile(numbers, 0.25);
    const q3 = percentile(numbers, 0.75);
    const iqr = (q1 != null && q3 != null) ? (q3 - q1) : null;
    const outlierThreshold = iqr != null ? (q3 + iqr * 1.5) : null;
    const outlier = outlierThreshold != null && numbers.some(v => v > outlierThreshold);
    const avgConfidence = itemVotes.length
      ? (itemVotes.reduce((sum, v) => sum + (Number(v.confidence) || 0), 0) / itemVotes.length)
      : 0;

    const byPerspective = itemVotes.reduce((acc, v) => {
      if (!v.perspective) return acc;
      if (!acc[v.perspective]) acc[v.perspective] = [];
      const n = Number(v.value);
      if (!Number.isNaN(n)) acc[v.perspective].push(n);
      return acc;
    }, {});

    const perspective_consensus = Object.entries(byPerspective)
      .map(([perspective, vals]) => ({
        perspective,
        count: vals.length,
        consensus: vals.length ? Math.round(avg(vals)) : null
      }))
      .filter(row => row.count > 0);

    const recommended_estimate = perspective_consensus.length
      ? Math.round(avg(perspective_consensus.map(p => p.consensus).filter(v => typeof v === 'number')))
      : null;

    const consensus = session.voting_mode === 'perspective_poker'
      ? (recommended_estimate ?? item.final_estimate ?? null)
      : (med > 0 ? med : (item.final_estimate || null));

    return {
      id: item.id,
      title: item.title,
      final_estimate: item.final_estimate,
      median: med,
      consensus,
      recommended_estimate,
      perspective_consensus,
      outlier_threshold: outlierThreshold != null ? Number(outlierThreshold.toFixed(2)) : null,
      avg_confidence: Number(avgConfidence.toFixed(2)),
      outlier,
      votes: itemVotes.map(v => ({
        user_id: v.user_id,
        name: v.profiles?.display_name || v.user_id?.slice(0, 6) || 'unknown',
        value: v.value,
        perspective: v.perspective || null,
        confidence: v.confidence || null,
        outlier: outlierThreshold != null ? Number(v.value) > outlierThreshold : false
      }))
    };
  });

  const estimatedRows = rows.filter(r => r.consensus !== null && r.consensus !== undefined);
  const points = estimatedRows.reduce((sum, r) => sum + (Number(r.consensus) || 0), 0);
  const avgConf = rows.length
    ? rows.reduce((sum, r) => sum + (Number(r.avg_confidence) || 0), 0) / rows.length
    : 0;

  return {
    session: { ...session, share_token: session.share_token },
    items: rows,
    summary: {
      total_items: rows.length,
      estimated_items: estimatedRows.length,
      outliers: rows.filter(r => r.outlier).length,
      total_points: Number(points.toFixed(2)),
      avg_confidence: Number(avgConf.toFixed(2))
    }
  };
}

export async function createShareToken(sessionId) {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('sessions')
    .update({ share_token: token })
    .eq('id', sessionId)
    .select('id, share_token')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Estimation Pipeline ───────────────────────────────────────────────────────
export async function createEstimationSession(itemId, { session_name, voting_mode, backlog_items } = {}) {
  return edgeFn('start-estimation', {
    type: 'item',
    id: itemId,
    session_name,
    voting_mode,
    backlog_items
  });
}

export async function getEstimationSessions(itemId) {
  const { data: sessionItems } = await supabase
    .from('session_items')
    .select('id, title, final_estimate, created_at, session_id, source_item_id')
    .eq('source_item_id', itemId)
    .order('created_at', { ascending: false });

  if (!sessionItems?.length) return [];

  const sessionIds = [...new Set(sessionItems.map(si => si.session_id).filter(Boolean))];
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name, status, created_at, join_code')
    .in('id', sessionIds);

  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));

  return sessionItems.map(si => ({
    session_item_id: si.id,
    session_id: si.session_id,
    session_name: sessionMap.get(si.session_id)?.name || si.title,
    session_status: sessionMap.get(si.session_id)?.status || 'unknown',
    join_code: sessionMap.get(si.session_id)?.join_code || null,
    final_estimate: si.final_estimate,
    created_at: si.created_at,
  }));
}

export async function applyEstimationResult(sessionItemId) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sessionItem } = await supabase
    .from('session_items')
    .select('id, source_item_id, final_estimate, title')
    .eq('id', sessionItemId)
    .maybeSingle();

  if (!sessionItem) throw new Error('Session item not found');
  if (!sessionItem.source_item_id) throw new Error('No source_item_id — item is not linked to a PM task');
  if (!sessionItem.final_estimate) throw new Error('No final_estimate on this session item');

  const { data: existing } = await supabase
    .from('approval_requests')
    .select('id, state')
    .eq('target_type', 'item_estimate')
    .eq('target_id', sessionItem.source_item_id)
    .in('state', ['pending_approval', 'pending'])
    .maybeSingle();

  if (existing) throw new Error('En approval request for dette item er allerede pending');

  const { data: approval, error } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: membership.organization_id,
      team_id: membership.team_id || null,
      target_type: 'item_estimate',
      target_id: sessionItem.source_item_id,
      requested_patch: { estimated_hours: sessionItem.final_estimate },
      requested_by: user?.id,
      state: 'pending_approval',
      idempotency_key: `item_estimate:${sessionItem.source_item_id}:${sessionItemId}`,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { approval_request_id: approval.id };
}

// ── v3.1 Risk Cards ───────────────────────────────────────────────────────────
export async function getSessionRiskCards(sessionId) {
  const { data } = await supabase.from('session_risk_cards')
    .select('id, card_type, note, played_by, acknowledged, created_at, profiles(display_name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function playRiskCard(sessionId, sessionItemId, cardType, note) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('session_risk_cards').insert({
    session_id: sessionId,
    session_item_id: sessionItemId || null,
    played_by: user?.id,
    card_type: cardType,
    note: note || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ── v3.1 Truth Serum ──────────────────────────────────────────────────────────
export async function submitTruthSerum(sessionId, sessionItemId, response) {
  const { data, error } = await supabase.from('truth_serum_responses').insert({
    session_id: sessionId,
    session_item_id: sessionItemId || null,
    response,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTruthSerumResponses(sessionId) {
  const { data } = await supabase.from('truth_serum_responses')
    .select('id, response, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  return data || [];
}

// ── v3.1 Lifelines ────────────────────────────────────────────────────────────
export async function useLifeline(sessionId, lifelineType, resultData = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('session_lifelines').insert({
    session_id: sessionId,
    lifeline_type: lifelineType,
    used_by: user?.id,
    result_data: resultData,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSessionLifelines(sessionId) {
  const { data } = await supabase.from('session_lifelines')
    .select('id, lifeline_type, used_by, result_data, used_at')
    .eq('session_id', sessionId);
  return data || [];
}

// ── v3.1 Sprint Close ─────────────────────────────────────────────────────────
export async function closeSprint(sprintId) {
  const { data, error } = await supabase.from('sprints').update({
    status: 'closed',
    closed_at: new Date().toISOString(),
  }).eq('id', sprintId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getTeamAccuracyScores(organizationId) {
  const { data } = await supabase.from('team_accuracy_scores')
    .select('*')
    .eq('organization_id', organizationId)
    .order('calculated_at', { ascending: false })
    .limit(20);
  return data || [];
}

// ── v3.1 XP / Badges ─────────────────────────────────────────────────────────
export async function getUserBadges(userId) {
  const { data } = await supabase.from('user_badges')
    .select('badge_type, earned_at, session_id')
    .eq('user_id', userId);
  return data || [];
}

export async function getUserProfile(userId) {
  const { data } = await supabase.from('profiles')
    .select('id, display_name, avatar_class, xp, level, accuracy_score')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function awardXpBadges(event, sessionId, sprintId) {
  return edgeFn('award-xp-badges', { event, session_id: sessionId, sprint_id: sprintId });
}

// ── Snapshots ─────────────────────────────────────────────────────────────────
export async function createSprintSnapshot(sprintId) {
  const { data: items } = await supabase
    .from('session_items')
    .select('id, item_status, estimated_hours, actual_hours')
    .eq('sprint_id', sprintId);

  const allItems = items || [];
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sprint_daily_snapshots')
    .upsert({
      sprint_id: sprintId,
      snapshot_date: today,
      items_total: allItems.length,
      items_done: allItems.filter(i => i.item_status === 'completed' || i.item_status === 'done').length,
      hours_estimated: allItems.reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0),
      hours_actual: allItems.filter(i => i.item_status === 'completed' || i.item_status === 'done')
        .reduce((sum, i) => sum + (Number(i.actual_hours) || 0), 0),
      hours_remaining: allItems.filter(i => i.item_status !== 'completed' && i.item_status !== 'done')
        .reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0),
    }, { onConflict: 'sprint_id,snapshot_date' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Session Update ────────────────────────────────────────────────────────────
export async function updateSession(sessionId, updates) {
  const updateObj = {};
  if (updates.status !== undefined) {
    updateObj.status = updates.status;
    if (updates.status === 'active') updateObj.started_at = new Date().toISOString();
    if (updates.status === 'completed') updateObj.ended_at = new Date().toISOString();
  }
  if (updates.current_item_index !== undefined) updateObj.current_item_index = updates.current_item_index;
  if (updates.current_item_id !== undefined) updateObj.current_item_id = updates.current_item_id;

  const { data, error } = await supabase
    .from('sessions')
    .update(updateObj)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
export async function getWebhookConfig() {
  const membership = await resolveMembership();
  if (!membership?.team_id) return { team_id: null, url: null, enabled: false };

  const { data } = await supabase
    .from('webhook_configs')
    .select('id, team_id, url, enabled, created_at, updated_at')
    .eq('team_id', membership.team_id)
    .maybeSingle();

  return data || { team_id: membership.team_id, url: null, enabled: false };
}

export async function updateWebhookConfig({ url, secret, enabled }) {
  const membership = await resolveMembership();
  if (!membership?.team_id) throw new Error('No team');

  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
  const payload = {
    team_id: membership.team_id,
    url: trimmedUrl || null,
    enabled: Boolean(enabled) && Boolean(trimmedUrl),
    updated_at: new Date().toISOString()
  };
  if (typeof secret === 'string') payload.secret = secret;

  const { data, error } = await supabase
    .from('webhook_configs')
    .upsert(payload, { onConflict: 'team_id' })
    .select('id, team_id, url, enabled, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Comments (DB: comments table) ─────────────────────────────────────────────
export async function getComments(itemId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('comments')
    .select('id, body, parent_id, created_at, updated_at, author_id')
    .eq('item_id', itemId)
    .order('created_at', { ascending: true });

  const authorIds = [...new Set((data || []).map(c => c.author_id).filter(Boolean))];
  let authorMap = new Map();
  if (authorIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', authorIds);
    (profiles || []).forEach(p => authorMap.set(p.id, p.display_name || p.id.slice(0, 8)));
  }

  return (data || []).map(c => ({
    ...c,
    author_name: authorMap.get(c.author_id) || 'Unknown',
    is_own: c.author_id === user?.id,
  }));
}

export async function addComment(itemId, body, parentId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('comments')
    .insert({
      item_id: itemId,
      author_id: user?.id,
      body: (body || '').trim(),
      parent_id: parentId || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  return { ...data, author_name: profile?.display_name || user.id.slice(0, 8), is_own: true };
}

export async function updateComment(commentId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('comments')
    .update({ body: (body || '').trim(), updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('author_id', user?.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteComment(commentId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', user?.id);

  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Integration Connections ───────────────────────────────────────────────────
export async function getIntegrationConnections() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });
  return data || [];
}

// ── Import Batches ────────────────────────────────────────────────────────────
export async function getImportBatches(projectId) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  let query = supabase
    .from('import_batches')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .is('undone_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (projectId) query = query.eq('project_id', projectId);

  const { data } = await query;
  return data || [];
}

export async function undoImportBatch(batchId) {
  const { error: deleteErr } = await supabase
    .from('session_items')
    .delete()
    .eq('import_batch_id', batchId);
  if (deleteErr) throw new Error(deleteErr.message);

  const { error: updateErr } = await supabase
    .from('import_batches')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', batchId);
  if (updateErr) throw new Error(updateErr.message);

  return { ok: true };
}

// ── Bulk Import (Excel/CSV with batch tracking) ──────────────────────────────
export async function bulkImportItems(sprintId, items, sourceType = 'excel') {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sprint } = await supabase
    .from('sprints')
    .select('project_id')
    .eq('id', sprintId)
    .maybeSingle();

  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      organization_id: membership.organization_id,
      project_id: sprint?.project_id || null,
      sprint_id: sprintId,
      source_type: sourceType,
      items_count: items.length,
      created_by: user?.id,
    })
    .select('id')
    .single();
  if (batchErr) throw new Error(batchErr.message);

  const rows = items.map((it, idx) => ({
    sprint_id: sprintId,
    title: it.title || 'Untitled',
    description: it.description || null,
    estimated_hours: it.estimated_hours || null,
    priority: it.priority || 'medium',
    item_status: it.item_status || 'backlog',
    assigned_to: it.assigned_to || null,
    import_batch_id: batch.id,
    item_order: idx,
    status: 'pending',
    progress: 0,
  })).filter(r => r.title?.trim());

  const { data: inserted, error: insertErr } = await supabase
    .from('session_items')
    .insert(rows)
    .select();
  if (insertErr) throw new Error(insertErr.message);

  return { imported: inserted?.length || 0, batch_id: batch.id };
}

// ── Unplanned Work ────────────────────────────────────────────────────────────
export async function createUnplannedItem(sprintId, payload) {
  const { data, error } = await supabase
    .from('session_items')
    .insert({
      sprint_id: sprintId,
      title: (payload.title || '').trim(),
      description: payload.description || null,
      priority: payload.priority || 'medium',
      item_status: payload.item_status || 'backlog',
      is_unplanned: true,
      status: 'pending',
      progress: 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSprintUnplannedStats(sprintId) {
  const { data: items } = await supabase
    .from('session_items')
    .select('id, is_unplanned, estimated_hours')
    .eq('sprint_id', sprintId);

  const all = items || [];
  const total = all.length;
  const unplanned = all.filter(i => i.is_unplanned);
  const unplannedCount = unplanned.length;
  const rate = total > 0 ? unplannedCount / total : 0;
  const hoursPlanned = all.filter(i => !i.is_unplanned).reduce((s, i) => s + (Number(i.estimated_hours) || 0), 0);
  const hoursUnplanned = unplanned.reduce((s, i) => s + (Number(i.estimated_hours) || 0), 0);

  return { total, unplannedCount, rate, hoursPlanned, hoursUnplanned };
}

// ── Daily Missions ────────────────────────────────────────────────────────────
export async function generateMissions(orgId) {
  return edgeFn('generate-missions', { org_id: orgId });
}

// ── SMTP Config ───────────────────────────────────────────────────────────────
export async function getSmtpConfig() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return null;

  const { data } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .maybeSingle();
  return data;
}

export async function upsertSmtpConfig(config) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('smtp_configs')
    .upsert({
      organization_id: membership.organization_id,
      ...config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Integration Connections (write) ───────────────────────────────────────────
export async function upsertIntegrationConnection(provider, config) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('integration_connections')
    .upsert({
      organization_id: membership.organization_id,
      provider,
      config,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function disconnectIntegration(connectionId) {
  const { data, error } = await supabase
    .from('integration_connections')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Jira Sync ─────────────────────────────────────────────────────────────────
export async function triggerJiraSync() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  return edgeFn('jira-sync', { org_id: membership.organization_id });
}

// ── Send Webhook (manual test) ────────────────────────────────────────────────
export async function testWebhook(eventType, data) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  return edgeFn('send-webhook', { org_id: membership.organization_id, event_type: eventType, data });
}

// ── Send Email ────────────────────────────────────────────────────────────────
export async function sendEmailViaEdge(to, subject, html) {
  const membership = await resolveMembership();
  return edgeFn('send-email', { to, subject, html, org_id: membership?.organization_id });
}

// ── Sprint E: Leaderboard (E14) ───────────────────────────────────────────────
export async function getLeaderboard({ organizationId, category = 'xp', limit = 10 } = {}) {
  try {
    let orgId = organizationId;
    if (!orgId) {
      const m = await resolveMembership();
      orgId = m?.organization_id;
    }
    if (!orgId) return [];

    // Base: profiles in org
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId);

    const userIds = (members || []).map(m => m.user_id).filter(Boolean);
    if (!userIds.length) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_class, xp, level')
      .in('id', userIds)
      .order('xp', { ascending: false })
      .limit(limit);

    if (category === 'xp' || !profiles?.length) {
      return (profiles || []).map((p, i) => ({
        rank: i + 1,
        user_id: p.id,
        display_name: p.display_name || p.id?.slice(0, 8) || 'Anonym',
        avatar_class: p.avatar_class || null,
        xp: p.xp || 0,
        level: p.level || 1,
        score: p.xp || 0,
        scoreLabel: `${p.xp || 0} XP`,
      }));
    }

    // For other categories, compute from session data
    const baseEntries = (profiles || []).map(p => ({
      user_id: p.id,
      display_name: p.display_name || p.id?.slice(0, 8) || 'Anonym',
      avatar_class: p.avatar_class || null,
      xp: p.xp || 0,
      level: p.level || 1,
      score: 0,
      scoreLabel: '0',
    }));

    if (category === 'accuracy') {
      // Estimation accuracy: compare final_estimate vs actual_hours
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, value, session_items(final_estimate, actual_hours)')
        .in('user_id', userIds)
        .not('session_items.actual_hours', 'is', null)
        .limit(500);

      const accuracyByUser = {};
      for (const v of votes || []) {
        const actual = v.session_items?.actual_hours;
        const estimate = Number(v.value);
        if (!actual || !estimate || isNaN(estimate)) continue;
        const ratio = actual / estimate;
        const acc = ratio > 1 ? 1 / ratio : ratio;
        if (!accuracyByUser[v.user_id]) accuracyByUser[v.user_id] = { total: 0, count: 0 };
        accuracyByUser[v.user_id].total += acc;
        accuracyByUser[v.user_id].count += 1;
      }

      return baseEntries
        .map(e => {
          const a = accuracyByUser[e.user_id];
          const pct = a ? Math.round((a.total / a.count) * 100) : 0;
          return { ...e, score: pct, scoreLabel: `${pct}% acc` };
        })
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }

    // Default fallback: XP
    return baseEntries
      .sort((a, b) => b.xp - a.xp)
      .map((e, i) => ({ ...e, rank: i + 1, score: e.xp, scoreLabel: `${e.xp} XP` }));
  } catch (err) {
    console.warn('[getLeaderboard]', err.message);
    return [];
  }
}

export async function getCurrentUserProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_class, xp, level')
      .eq('id', user.id)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function getUserMissions() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('user_missions')
    .select('*, missions(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false });
  return data || [];
}

// ── XP & Achievement Persistence ──────────────────────────────────────────────

export async function awardXP(userId, amount, reason, organizationId) {
  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, level, total_sessions, display_name, avatar_class')
      .eq('id', userId)
      .single();

    const currentXP = profile?.xp || 0;
    const newXP = currentXP + amount;
    const newLevel = Math.floor(newXP / 1000) + 1;
    const newTotalSessions = (profile?.total_sessions || 0) + (reason === 'session_complete' ? 1 : 0);

    // Update profiles
    await supabase.from('profiles')
      .update({ xp: newXP, level: newLevel, total_sessions: newTotalSessions })
      .eq('id', userId);

    // Update leaderboard_org
    if (organizationId) {
      const { data: existing } = await supabase
        .from('leaderboard_org')
        .select('id')
        .eq('id', userId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        await supabase.from('leaderboard_org')
          .update({ xp: newXP, level: newLevel })
          .eq('id', userId)
          .eq('organization_id', organizationId);
      } else {
        await supabase.from('leaderboard_org')
          .insert({
            id: userId,
            display_name: profile?.display_name || userId.slice(0, 8),
            avatar_class: profile?.avatar_class || null,
            xp: newXP,
            level: newLevel,
            organization_id: organizationId
          });
      }
    }

    return { newXP, newLevel, totalSessions: newTotalSessions };
  } catch (err) {
    console.warn('[awardXP]', err.message);
    return { newXP: 0, newLevel: 1, error: err.message };
  }
}

export async function unlockAchievement(userId, achievementKey, sessionId, organizationId) {
  try {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_key', achievementKey)
      .maybeSingle();

    if (existing) return { alreadyUnlocked: true };

    const { data, error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_key: achievementKey,
        session_id: sessionId || null,
        organization_id: organizationId || null
      })
      .select()
      .single();

    if (error) throw error;
    return { unlocked: true, achievement: data };
  } catch (err) {
    console.warn('[unlockAchievement]', err.message);
    return { error: err.message };
  }
}

export async function getUserAchievements(userId) {
  try {
    const { data } = await supabase
      .from('user_achievements')
      .select('id, achievement_key, session_id, organization_id, unlocked_at')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });
    return data || [];
  } catch (err) {
    console.warn('[getUserAchievements]', err.message);
    return [];
  }
}

// ── Sprint E: Game Availability ───────────────────────────────────────────────
export async function getGameAvailability(sprintId) {
  if (!sprintId) return null;
  try {
    // Items without estimate
    const { data: items } = await supabase
      .from('session_items')
      .select('id, final_estimate, estimated_hours, acceptance_criteria, item_status')
      .eq('sprint_id', sprintId);

    const allItems = items || [];
    const withoutEstimate = allItems.filter(i => !i.final_estimate && !i.estimated_hours);
    const withoutAC = allItems.filter(i => !i.acceptance_criteria);

    // Recent sessions for this sprint
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('id, session_type, status, ended_at, created_at')
      .eq('sprint_id', sprintId)
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(20);

    const sessions = recentSessions || [];

    // Get sprint info
    const { data: sprint } = await supabase
      .from('sprints')
      .select('id, status, end_date, name')
      .eq('id', sprintId)
      .maybeSingle();

    const isActive = sprint?.status === 'active';
    const isClosed = sprint?.status === 'completed' || sprint?.status === 'closed';
    const daysLeft = sprint?.end_date
      ? Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    const sprintEndingSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

    function lastPlayed(type) {
      const s = sessions.find(s => s.session_type === type || s.session_type?.includes(type));
      return s?.ended_at || null;
    }

    function dayLabel(dt) {
      if (!dt) return null;
      const d = new Date(dt);
      const now = new Date();
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'i dag';
      if (diff === 1) return 'i går';
      return `${diff} dage siden`;
    }

    // planning_poker
    const ppLast = lastPlayed('estimation');
    let ppState = 'locked';
    let ppReason = 'Ingen aktiv sprint';
    if (isActive || isClosed) {
      if (withoutEstimate.length > 0) {
        ppState = sprintEndingSoon ? 'recommended' : 'available';
        ppReason = `${withoutEstimate.length} items uden estimate`;
      } else if (ppLast) {
        ppState = 'completed';
        ppReason = `Alle items estimeret`;
      } else {
        ppState = 'available';
        ppReason = 'Klar til estimering';
      }
    }

    // spec_wars
    const swLast = lastPlayed('spec_wars');
    let swState = 'locked';
    let swReason = 'Ingen aktiv sprint';
    if (isActive) {
      if (withoutAC.length > 0) {
        swState = sprintEndingSoon ? 'recommended' : 'available';
        swReason = `${withoutAC.length} items mangler acceptance criteria`;
      } else if (swLast) {
        swState = 'completed';
        swReason = 'Spec Wars gennemført';
      } else {
        swState = 'available';
        swReason = 'Klar';
      }
    }

    // perspective_poker
    const pLast = lastPlayed('perspective_poker');
    let pState = 'locked';
    let pReason = 'Ingen aktiv sprint';
    if (isActive) {
      pState = 'available';
      pReason = 'Klar til perspektiv-estimering';
      if (pLast) { pState = 'completed'; pReason = 'Perspektiv-Poker gennemført'; }
      if (withoutEstimate.length > 3) { pState = 'recommended'; pReason = `${withoutEstimate.length} items med store estimat-gaps`; }
    }

    // retro / boss battle
    const rLast = lastPlayed('retro');
    let rState = 'locked';
    let rReason = 'Sprint skal lukkes for retro';
    if (isClosed) {
      rState = rLast ? 'completed' : 'recommended';
      rReason = rLast ? 'Retro gennemført' : 'Sprint er lukket — tid til retro!';
    } else if (sprintEndingSoon) {
      rState = 'recommended';
      rReason = `Sprint slutter om ${daysLeft} dag${daysLeft !== 1 ? 'e' : ''}`;
    }

    return {
      planning_poker: { state: ppState, reason: ppReason, lastPlayedAt: ppLast, lastPlayedLabel: dayLabel(ppLast) },
      spec_wars: { state: swState, reason: swReason, lastPlayedAt: swLast, lastPlayedLabel: dayLabel(swLast) },
      perspective_poker: { state: pState, reason: pReason, lastPlayedAt: pLast, lastPlayedLabel: dayLabel(pLast) },
      retro: { state: rState, reason: rReason, lastPlayedAt: rLast, lastPlayedLabel: dayLabel(rLast) },
      meta: { withoutEstimate: withoutEstimate.length, withoutAC: withoutAC.length, daysLeft, sprintEndingSoon },
    };
  } catch (e) {
    console.warn('[getGameAvailability]', e.message);
    return null;
  }
}

// ── Sprint E: Game Session Starters ──────────────────────────────────────────
export async function startSpecWarsSession(sprintId, options = {}) {
  const membership = await resolveMembership();
  return createSession({
    session_type: 'spec_wars',
    sprint_id: sprintId,
    organization_id: membership?.organization_id,
    name: options.name || 'Spec Wars',
    ...options,
  });
}

export async function startPerspectivePokerSession(sprintId, options = {}) {
  const membership = await resolveMembership();
  return createSession({
    session_type: 'perspective_poker',
    sprint_id: sprintId,
    organization_id: membership?.organization_id,
    name: options.name || 'Perspektiv-Poker',
    ...options,
  });
}

// ── Sprint E: Project Visibility ─────────────────────────────────────────────
export async function updateProjectVisibility(projectId, visibility) {
  const { data, error } = await supabase
    .from('projects')
    .update({ visibility })
    .eq('id', projectId)
    .select('id, visibility')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSprintVisibility(sprintId, visibility) {
  const { data, error } = await supabase
    .from('sprints')
    .update({ visibility: visibility || null }) // null = inherit from project
    .eq('id', sprintId)
    .select('id, visibility')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Sprint E: Audit Log ────────────────────────────────────────────────────────
export async function writeAuditLog({ actor_id, organization_id, session_id, entity_type, entity_id, action, metadata } = {}) {
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_id: actor_id || null,
      actor: actor_id || 'system',
      event_type: action || 'unknown',
      action: action || 'unknown',
      organization_id: organization_id || null,
      session_id: session_id || null,
      target_type: entity_type || null,
      target_id: entity_id || null,
      metadata: metadata || {},
      payload: metadata || {},
    });
    if (error) console.warn('[audit_log write]', error.message);
  } catch (e) {
    console.warn('[audit_log]', e.message);
  }
}

export async function getAuditLog({ organization_id, actor_id, session_id, limit = 100, offset = 0 } = {}) {
  try {
    let q = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (organization_id) q = q.eq('organization_id', organization_id);
    if (actor_id) q = q.eq('actor_id', actor_id);
    if (session_id) q = q.eq('session_id', session_id);

    const { data } = await q;
    return data || [];
  } catch (e) {
    console.warn('[getAuditLog]', e.message);
    return [];
  }
}
