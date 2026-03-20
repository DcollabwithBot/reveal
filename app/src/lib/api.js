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
async function getMembership() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const membership = await getMembership();
  if (!membership?.organization_id) {
    return { active: [], upcoming: [], finished: [], projects: [], activity: [] };
  }

  const [{ data: sessions }, { data: projects }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id,name,status,join_code,created_at,started_at,ended_at,current_item_index,session_type,project_id,session_items(count),session_participants(count)')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('projects')
      .select('id,name,description,status,color,icon,created_by,created_at,updated_at')
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
    ...(sessions || []).slice(0, 20).map(s => ({
      id: `session-${s.id}`,
      type: 'session',
      title: s.name,
      description: s.status === 'completed' ? 'Session completed' : s.status === 'active' ? 'Session active' : 'Session updated',
      created_at: s.ended_at || s.started_at || s.created_at,
      href: `/sessions/${s.id}/results`
    })),
    ...(projects || []).slice(0, 20).map(p => ({
      id: `project-${p.id}`,
      type: 'project',
      title: p.name,
      description: `Project ${p.status.replace('_', ' ')}`,
      created_at: p.updated_at || p.created_at,
      href: `/projects/${p.id}`
    }))
  ]
    .filter(i => i.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);

  return { ...byStatus, projects: projects || [], activity };
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
