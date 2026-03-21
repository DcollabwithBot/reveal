import { supabase } from '../supabase';
import { edgeFn, resolveMembership } from './shared';

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
