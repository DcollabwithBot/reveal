import { supabase } from './supabase';

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWZjYXRod2NkcGdraXJ3aWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA1MTAsImV4cCI6MjA4OTQyNjUxMH0.9plelXfU7k9Y3sJaLFpwWeDtPTfZQHadxpxBEHrPqog';
const SUPABASE_URL = 'https://swyfcathwcdpgkirwihh.supabase.co';

// ── Auth / Provision ──────────────────────────────────────────────────────────
export async function provisionUser(_userId, _displayName) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export async function getMembership() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Prøv direkte organization_members først
  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgError) {
    console.error('[getMembership] organization_members query failed:', orgError.message);
  }

  if (orgMember?.organization_id) {
    return { organization_id: orgMember.organization_id, role: orgMember.role };
  }

  // Fallback: via team_members
  const { data: member, error: teamError } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (teamError) {
    console.error('[getMembership] team_members query failed:', teamError.message);
  }

  if (!member?.team_id) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('id, organization_id')
    .eq('id', member.team_id)
    .maybeSingle();

  return team ? { team_id: team.id, organization_id: team.organization_id, role: member.role } : null;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const membership = await getMembership();
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
  const membership = await getMembership();
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
  const { data: current } = await supabase
    .from('approval_requests')
    .select('state')
    .eq('id', requestId)
    .maybeSingle();

  const { data } = await supabase
    .from('approval_requests')
    .update({
      state: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('*')
    .single();
  return data;
}

export async function rejectRequest(requestId, reason) {
  const { data } = await supabase
    .from('approval_requests')
    .update({
      state: 'rejected',
      rejection_reason: reason || null,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('*')
    .single();
  return data;
}

export async function applyRequest(requestId) {
  const { data } = await supabase
    .from('approval_requests')
    .update({
      state: 'applied',
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select('*')
    .single();
  return data;
}

export async function submitAdvisoryRequest(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const membership = await getMembership();

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
  const membership = await getMembership();
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
  const membership = await getMembership();
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
  const membership = await getMembership();
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

// ── Projects ──────────────────────────────────────────────────────────────────
export async function getProject(projectId) {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  return data;
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
    .select('id, item_code, parent_code, title, status, estimated_hours, hours_fak, hours_int, invoiced_dkk, to_invoice_dkk, assigned_to, priority, due_date, notes')
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

export async function updateProjectStatus(projectId, status) {
  const { data } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId)
    .select('id, status')
    .single();
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
