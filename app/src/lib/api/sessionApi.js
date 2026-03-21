import { supabase } from '../supabase';
import { edgeFn, resolveMembership } from './shared';

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

// ── Game-PM Bridge ────────────────────────────────────────────────────────────
export async function startSprintEstimation(sprintId, { session_name, voting_mode } = {}) {
  return edgeFn('start-estimation', { type: 'sprint', id: sprintId, session_name, voting_mode });
}

export async function startProjectEstimation(projectId, { session_name, voting_mode } = {}) {
  return edgeFn('start-estimation', { type: 'project', id: projectId, session_name, voting_mode });
}

export async function startBulkEstimation({ item_ids, session_name, voting_mode }) {
  return edgeFn('start-estimation', { type: 'bulk', item_ids, session_name, voting_mode });
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

// ── Sprint Draft ──────────────────────────────────────────────────────────────
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
