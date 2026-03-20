/* eslint-env node */
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { APPROVAL_STATES, transitionApprovalState } = require('./domain/approvalStateMachine');
const { assertPmMutationAllowed } = require('./domain/pmMutationPolicy');
const { SupabaseEventLedger } = require('./domain/eventLedger');
const { applyApprovedRequest } = require('./domain/approvalApplyPipeline');

const app = express();
app.use(express.json());

const devDist = path.join(__dirname, '../app/dist');
const prodDist = __dirname;
const staticRoot = fs.existsSync(path.join(devDist, 'index.html')) ? devDist : prodDist;
app.use(express.static(staticRoot));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const eventLedger = new SupabaseEventLedger({ supabase });

const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_BACKOFF_MS = [1000, 3000];
const GAME_SESSION_TELEMETRY_WINDOW_LIMIT = 200;

const gameSessionTelemetry = {
  counters: {
    readSuccess: 0,
    readFailure: 0,
    writeSuccess: 0,
    writeFailure: 0,
    exportSuccess: 0,
    exportFailure: 0,
  },
  recent: [],
};

function signPayload(secret, body) {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function getWebhookConfigForTeam(teamId) {
  if (!teamId) return null;
  const { data } = await supabase
    .from('webhook_configs')
    .select('id, team_id, url, secret, enabled')
    .eq('team_id', teamId)
    .eq('enabled', true)
    .maybeSingle();
  return data || null;
}

async function markWebhookDelivery(deliveryId, patch) {
  await supabase
    .from('webhook_deliveries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', deliveryId);
}

async function attemptWebhookDelivery({ deliveryId, config, payload, eventType, attempt = 1 }) {
  const body = JSON.stringify(payload);

  try {
    const signature = signPayload(config.secret, body);
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reveal-Event': eventType,
        ...(signature ? { 'X-Reveal-Signature': signature } : {})
      },
      body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await markWebhookDelivery(deliveryId, {
      status: 'delivered',
      attempts: attempt,
      last_error: null,
      delivered_at: new Date().toISOString(),
      next_attempt_at: null
    });
  } catch (err) {
    const lastError = String(err?.message || err);
    const hasRetry = attempt < WEBHOOK_MAX_ATTEMPTS;

    await markWebhookDelivery(deliveryId, {
      status: hasRetry ? 'retrying' : 'failed',
      attempts: attempt,
      last_error: lastError,
      next_attempt_at: hasRetry
        ? new Date(Date.now() + WEBHOOK_BACKOFF_MS[attempt - 1]).toISOString()
        : null
    });

    if (hasRetry) {
      setTimeout(() => {
        attemptWebhookDelivery({ deliveryId, config, payload, eventType, attempt: attempt + 1 })
          .catch((error) => console.error('Webhook retry failed:', error));
      }, WEBHOOK_BACKOFF_MS[attempt - 1]);
    }
  }
}

async function queueWebhookEvent({ teamId, sessionId, eventType, payload, oncePerSessionEvent = false }) {
  const config = await getWebhookConfigForTeam(teamId);
  if (!config?.url) return;

  const emitIdempotencyKey = `emit:${eventType}:${sessionId || 'none'}:${payload?.timestamp || 'na'}`;
  try {
    await appendLedgerEvent({
      eventType: 'approval.request.applied',
      source: 'system',
      idempotencyKey: emitIdempotencyKey,
      payload: {
        kind: 'webhook_emit',
        upstream_event_type: eventType,
        team_id: teamId,
        session_id: sessionId || null
      },
      direction: 'emit'
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_EVENT') return;
    throw err;
  }

  if (oncePerSessionEvent && sessionId) {
    const { data: existing } = await supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('session_id', sessionId)
      .eq('event_type', eventType)
      .limit(1)
      .maybeSingle();
    if (existing) return;
  }

  const { data: delivery, error } = await supabase
    .from('webhook_deliveries')
    .insert({
      team_id: teamId,
      session_id: sessionId || null,
      webhook_config_id: config.id,
      event_type: eventType,
      payload,
      status: 'queued',
      attempts: 0,
      last_error: null
    })
    .select('id')
    .single();

  if (error || !delivery?.id) {
    console.error('Failed to queue webhook:', error?.message || error);
    return;
  }

  attemptWebhookDelivery({
    deliveryId: delivery.id,
    config,
    payload,
    eventType,
    attempt: 1
  }).catch((err) => console.error('Webhook attempt error:', err));
}

async function getUserFromAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (!user || error) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

function normalizeVote(val) {
  if (val == null) return null;
  const n = Number(val);
  if (Number.isNaN(n)) {
    const tshirt = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return tshirt.indexOf(String(val).toUpperCase()) + 1 || null;
  }
  return n;
}

function normalizeSessionType(rawType) {
  const val = String(rawType || '').toLowerCase().trim();
  if (!val) return 'estimation';

  if (['poker', 'planning_poker', 'story_estimation', 'estimation'].includes(val)) {
    return 'estimation';
  }
  if (['roulette', 'scope_roulette'].includes(val)) {
    return 'roulette';
  }
  if (['retro', 'retrospective', 'sprint_retro'].includes(val)) {
    return 'retro';
  }

  return 'estimation';
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

async function resolveMembership(userId) {
  const { data: member } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('id, organization_id, name')
    .eq('id', member.team_id)
    .maybeSingle();

  if (!team) return null;
  return { team_id: team.id, organization_id: team.organization_id, role: member.role };
}

async function resolveOrProvisionMembership(user) {
  let membership = await resolveMembership(user.id);
  if (membership) return membership;

  const slug = `team-${user.id.slice(0, 8)}`;
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'My Team', slug, plan: 'free', language: 'da', data_retention_months: 12 })
    .select()
    .single();

  if (!org) return null;

  const { data: team } = await supabase
    .from('teams')
    .insert({ organization_id: org.id, name: 'Default Team', created_by: user.id })
    .select()
    .single();

  if (!team) return null;

  await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'admin' });
  membership = { team_id: team.id, organization_id: org.id, role: 'admin' };

  return membership;
}

async function appendAuditLog({
  eventType,
  actor,
  sourceLayer,
  organizationId,
  teamId,
  targetType,
  targetId,
  approvalRequestId,
  payload,
  outcome = 'accepted'
}) {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      event_type: eventType,
      actor,
      source_layer: sourceLayer || null,
      organization_id: organizationId || null,
      team_id: teamId || null,
      target_type: targetType || null,
      target_id: targetId || null,
      approval_request_id: approvalRequestId || null,
      outcome,
      payload: payload || {}
    });

  if (error) {
    console.error('audit_log insert failed:', error.message);
  }
}

const GAME_SESSION_TELEMETRY_METRICS = ['readSuccess', 'readFailure', 'writeSuccess', 'writeFailure', 'exportSuccess', 'exportFailure'];

function sanitizeTelemetryContext(context = {}) {
  return {
    organization_id: context.organizationId || null,
    project_id: context.projectId || null,
    node_id: context.nodeId || null,
    source: context.source || null,
    format: context.format || null,
    action: context.action || null,
    error: context.error ? String(context.error).slice(0, 180) : null,
  };
}

async function persistGameSessionTelemetry(metric, context = {}) {
  const safe = sanitizeTelemetryContext(context);
  if (!safe.organization_id) return;

  const { error } = await supabase
    .from('game_session_telemetry_events')
    .insert({
      organization_id: safe.organization_id,
      project_id: safe.project_id,
      node_id: safe.node_id,
      metric,
      source: safe.source,
      format: safe.format,
      action: safe.action,
      error: safe.error,
      occurred_at: new Date().toISOString(),
    });

  if (error) {
    console.error('telemetry persist failed:', error.message || error);
  }
}

async function recordGameSessionTelemetry(metric, context = {}) {
  if (!GAME_SESSION_TELEMETRY_METRICS.includes(metric)) return;

  gameSessionTelemetry.counters[metric] += 1;
  gameSessionTelemetry.recent.push({
    metric,
    at: new Date().toISOString(),
    ...sanitizeTelemetryContext(context),
  });
  if (gameSessionTelemetry.recent.length > GAME_SESSION_TELEMETRY_WINDOW_LIMIT) {
    gameSessionTelemetry.recent.splice(0, gameSessionTelemetry.recent.length - GAME_SESSION_TELEMETRY_WINDOW_LIMIT);
  }

  await persistGameSessionTelemetry(metric, context);
}

async function buildGameSessionTelemetrySnapshot({ organizationId, projectId = null, nodeId = null, limit = 50 }) {
  const fallback = {
    counters: { ...gameSessionTelemetry.counters },
    recent: [...gameSessionTelemetry.recent],
    source: 'memory',
  };

  if (!organizationId) return fallback;

  let countersQuery = supabase
    .from('game_session_telemetry_counters')
    .select('metric,total')
    .eq('organization_id', organizationId);

  let recentQuery = supabase
    .from('game_session_telemetry_events')
    .select('metric,occurred_at,organization_id,project_id,node_id,source,format,action,error')
    .eq('organization_id', organizationId)
    .order('occurred_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), GAME_SESSION_TELEMETRY_WINDOW_LIMIT));

  if (projectId) {
    countersQuery = countersQuery.eq('project_id', projectId);
    recentQuery = recentQuery.eq('project_id', projectId);
  }
  if (nodeId) {
    countersQuery = countersQuery.eq('node_id', nodeId);
    recentQuery = recentQuery.eq('node_id', nodeId);
  }

  const [{ data: counterRows, error: countersError }, { data: recentRows, error: recentError }] = await Promise.all([
    countersQuery,
    recentQuery,
  ]);

  if (countersError || recentError) {
    if (countersError) console.error('telemetry counters read failed:', countersError.message || countersError);
    if (recentError) console.error('telemetry recent read failed:', recentError.message || recentError);
    return fallback;
  }

  const counters = GAME_SESSION_TELEMETRY_METRICS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  for (const row of counterRows || []) {
    if (GAME_SESSION_TELEMETRY_METRICS.includes(row.metric)) {
      counters[row.metric] = Number(row.total) || 0;
    }
  }

  const recent = (recentRows || []).map((row) => ({
    metric: row.metric,
    at: row.occurred_at,
    organization_id: row.organization_id,
    project_id: row.project_id,
    node_id: row.node_id,
    source: row.source,
    format: row.format,
    action: row.action,
    error: row.error,
  }));

  return { counters, recent, source: 'persistent' };
}

async function appendLedgerEvent({ eventType, source, idempotencyKey, payload, direction = 'ingest' }) {
  try {
    await eventLedger.register({
      direction,
      event: {
        eventId: crypto.randomUUID(),
        eventType,
        occurredAt: new Date().toISOString(),
        source,
        idempotencyKey,
        payload
      }
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_EVENT') {
      throw err;
    }
    console.error('event ledger error:', err.message);
    throw err;
  }
}

function resolveActor(req, fallback = 'pm') {
  const actor = String(req.headers['x-reveal-actor'] || fallback).toLowerCase();
  return ['game', 'pm', 'system'].includes(actor) ? actor : fallback;
}

async function resolveApprovalRequestState(approvalRequestId) {
  if (!approvalRequestId) return null;
  const { data } = await supabase
    .from('approval_requests')
    .select('id,state,target_type,target_id')
    .eq('id', approvalRequestId)
    .maybeSingle();
  return data || null;
}

async function enforcePmMutationGuard({ req, membership, targetType, targetId }) {
  const sourceLayer = req.body?.source_layer || 'pm';
  const actor = resolveActor(req, 'pm');
  const approvalRequestId = req.body?.approval_request_id || null;
  const approval = await resolveApprovalRequestState(approvalRequestId);

  try {
    assertPmMutationAllowed({ actor, sourceLayer, approvalState: approval?.state });
  } catch (err) {
    await appendAuditLog({
      eventType: 'pm.mutation.blocked',
      actor,
      sourceLayer,
      organizationId: membership?.organization_id,
      teamId: membership?.team_id,
      targetType,
      targetId,
      approvalRequestId,
      payload: {
        reason: err.message,
        attempted_patch: req.body || {},
        resolution_hint: 'create_advisory_request'
      },
      outcome: 'blocked'
    });
    throw err;
  }

  return { actor, sourceLayer, approvalRequestId, approval };
}

function computeHealth({ status, progress, hasOverdueSprint, nearDeadline }) {
  if (status === 'completed') return 'on_track';
  if (status === 'on_hold') return 'at_risk';
  if (hasOverdueSprint) return 'off_track';
  if (nearDeadline && progress < 35) return 'at_risk';
  return 'on_track';
}

async function buildProjectInsights({ organizationId, projects }) {
  const projectIds = (projects || []).map((p) => p.id);
  if (!projectIds.length) return new Map();

  const [{ data: sprints }, { data: profiles }] = await Promise.all([
    supabase
      .from('sprints')
      .select('id,project_id,name,status,start_date,end_date,created_at,updated_at')
      .eq('organization_id', organizationId),
    supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', [...new Set((projects || []).map((p) => p.created_by).filter(Boolean))])
  ]);

  const sprintIds = (sprints || []).map((s) => s.id);
  const { data: items } = sprintIds.length
    ? await supabase
      .from('session_items')
      .select('id,sprint_id,item_status,progress')
      .in('sprint_id', sprintIds)
    : { data: [] };

  const sprintsByProject = (sprints || []).reduce((acc, sprint) => {
    if (!acc[sprint.project_id]) acc[sprint.project_id] = [];
    acc[sprint.project_id].push(sprint);
    return acc;
  }, {});

  const itemsBySprint = (items || []).reduce((acc, item) => {
    if (!acc[item.sprint_id]) acc[item.sprint_id] = [];
    acc[item.sprint_id].push(item);
    return acc;
  }, {});

  const ownerById = new Map((profiles || []).map((p) => [p.id, p.display_name]));
  const today = new Date();

  const insights = new Map();

  for (const project of projects || []) {
    const projectSprints = sprintsByProject[project.id] || [];
    const projectItems = projectSprints.flatMap((s) => itemsBySprint[s.id] || []);

    const totalItems = projectItems.length;
    const doneItems = projectItems.filter((item) => item.item_status === 'done').length;
    const openItems = Math.max(totalItems - doneItems, 0);
    const progress = totalItems
      ? Math.round(projectItems.reduce((sum, item) => sum + (Number(item.progress) || (item.item_status === 'done' ? 100 : 0)), 0) / totalItems)
      : 0;

    const datedSprints = projectSprints
      .filter((s) => s.end_date)
      .map((s) => ({ ...s, endDate: new Date(s.end_date) }));

    const activeTimed = datedSprints.filter((s) => s.status !== 'completed' && s.status !== 'archived');
    const hasOverdueSprint = activeTimed.some((s) => s.endDate < today);
    const nearDeadline = activeTimed.some((s) => {
      const days = Math.ceil((s.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    });

    const nextMilestone = activeTimed
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())[0];

    const health = computeHealth({
      status: project.status,
      progress,
      hasOverdueSprint,
      nearDeadline
    });

    insights.set(project.id, {
      owner_name: ownerById.get(project.created_by) || (project.created_by ? project.created_by.slice(0, 8) : 'Unassigned'),
      total_items: totalItems,
      done_items: doneItems,
      open_items: openItems,
      progress,
      sprint_count: projectSprints.length,
      health,
      next_milestone: nextMilestone
        ? { name: nextMilestone.name, end_date: nextMilestone.end_date }
        : null
    });
  }

  return insights;
}

app.get('/api/health', async (_req, res) => {
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

function extractNumericVotes(state) {
  if (!state || typeof state !== 'object') return [];
  const fromPov = state?.pv == null ? [] : [Number(state.pv)];
  const fromVotes = Array.isArray(state?.votes)
    ? state.votes.map((vote) => Number(vote?.val))
    : [];
  return [...fromPov, ...fromVotes].filter((value) => Number.isFinite(value));
}

function deriveGameSessionStatus(state) {
  const step = Number(state?.step);
  if (Number.isFinite(step) && step >= 5) return 'completed';
  if (state?.rdy || state?.rev) return 'ready_for_review';
  return 'in_progress';
}

function buildGameSessionPersistencePatch({ membership, projectId, nodeId, state, userId }) {
  const numericVotes = extractNumericVotes(state);
  const voteCount = numericVotes.length;
  const voteAvg = voteCount
    ? Number((numericVotes.reduce((sum, value) => sum + value, 0) / voteCount).toFixed(2))
    : null;

  const finalEstimate = state?.finalEstimate == null
    ? null
    : Number.isFinite(Number(state.finalEstimate))
      ? Number(state.finalEstimate)
      : null;

  return {
    organization_id: membership.organization_id,
    team_id: membership.team_id || null,
    project_id: projectId,
    node_id: nodeId,
    status: deriveGameSessionStatus(state),
    step: Number.isInteger(state?.step) ? state.step : 0,
    final_estimate: finalEstimate,
    vote_count: voteCount,
    vote_min: voteCount ? Math.min(...numericVotes) : null,
    vote_max: voteCount ? Math.max(...numericVotes) : null,
    vote_avg: voteAvg,
    state,
    saved_by: userId,
    saved_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function upsertGameSessionState({ membership, projectId, nodeId, state, userId }) {
  const patch = buildGameSessionPersistencePatch({ membership, projectId, nodeId, state, userId });
  const { data, error } = await supabase
    .from('game_session_states')
    .upsert(patch, { onConflict: 'organization_id,project_id,node_id' })
    .select('state,saved_at')
    .single();

  if (error) {
    throw new Error(error.message || 'Unable to persist game session state');
  }

  return data;
}

async function readLegacyGameSessionState({ organizationId, projectId, nodeId }) {
  const targetId = `${projectId}:${nodeId}`;
  const { data, error } = await supabase
    .from('audit_log')
    .select('payload,created_at')
    .eq('organization_id', organizationId)
    .eq('event_type', 'game.session.state.saved')
    .eq('target_type', 'game_session')
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Unable to read legacy state');

  return {
    state: data?.payload?.state || null,
    saved_at: data?.created_at || null
  };
}

app.get('/api/game-session-state', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const projectId = String(req.query.project_id || '').trim();
  const nodeId = String(req.query.node_id || '').trim();
  if (!projectId || !nodeId) return res.status(400).json({ error: 'project_id and node_id required' });

  const { data, error } = await supabase
    .from('game_session_states')
    .select('state,saved_at')
    .eq('organization_id', membership.organization_id)
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .maybeSingle();

  if (error) {
    await recordGameSessionTelemetry('readFailure', {
      organizationId: membership.organization_id,
      projectId,
      nodeId,
      source: 'game_session_states',
      error: error.message,
    });
    return res.status(500).json({ error: error.message });
  }

  if (data?.state) {
    await recordGameSessionTelemetry('readSuccess', {
      organizationId: membership.organization_id,
      projectId,
      nodeId,
      source: 'game_session_states',
    });
    return res.json({
      state: data.state,
      saved_at: data.saved_at || null,
      source: 'game_session_states'
    });
  }

  try {
    const legacy = await readLegacyGameSessionState({
      organizationId: membership.organization_id,
      projectId,
      nodeId
    });

    if (legacy?.state) {
      await upsertGameSessionState({
        membership,
        projectId,
        nodeId,
        state: legacy.state,
        userId: user.id
      });

      await recordGameSessionTelemetry('readSuccess', {
        organizationId: membership.organization_id,
        projectId,
        nodeId,
        source: 'audit_log_fallback'
      });
      return res.json({
        state: legacy.state,
        saved_at: legacy.saved_at,
        source: 'audit_log_fallback'
      });
    }
  } catch (fallbackErr) {
    await recordGameSessionTelemetry('readFailure', {
      organizationId: membership.organization_id,
      projectId,
      nodeId,
      source: 'audit_log_fallback',
      error: fallbackErr.message,
    });
    console.error('legacy game session state fallback failed:', fallbackErr.message);
  }

  await recordGameSessionTelemetry('readSuccess', {
    organizationId: membership.organization_id,
    projectId,
    nodeId,
    source: 'none'
  });
  return res.json({ state: null, saved_at: null, source: 'none' });
});

app.post('/api/game-session-state', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const projectId = String(req.body?.project_id || '').trim();
  const nodeId = String(req.body?.node_id || '').trim();
  const state = req.body?.state || null;

  if (!projectId || !nodeId || !state) {
    return res.status(400).json({ error: 'project_id, node_id and state required' });
  }

  try {
    const persisted = await upsertGameSessionState({
      membership,
      projectId,
      nodeId,
      state,
      userId: user.id
    });

    const targetId = `${projectId}:${nodeId}`;
    await appendAuditLog({
      eventType: 'game.session.state.saved',
      actor: 'game',
      sourceLayer: 'game',
      organizationId: membership.organization_id,
      teamId: membership.team_id,
      targetType: 'game_session',
      targetId,
      payload: {
        project_id: projectId,
        node_id: nodeId,
        state,
        storage: 'game_session_states',
        saved_by: user.id,
        saved_at: persisted?.saved_at || new Date().toISOString()
      },
      outcome: 'accepted'
    });

    await recordGameSessionTelemetry('writeSuccess', {
      organizationId: membership.organization_id,
      projectId,
      nodeId,
      source: 'game_session_states'
    });
    return res.json({ ok: true, saved_at: persisted?.saved_at || null, source: 'game_session_states' });
  } catch (err) {
    await recordGameSessionTelemetry('writeFailure', {
      organizationId: membership.organization_id,
      projectId,
      nodeId,
      source: 'game_session_states',
      error: err.message,
    });
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/game-session-state/status', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const projectId = String(req.query.project_id || '').trim();
  const nodeId = String(req.query.node_id || '').trim();
  if (!projectId || !nodeId) return res.status(400).json({ error: 'project_id and node_id required' });

  const [{ data: stateRow, error: stateErr }, { data: backfillMeta, error: backfillErr }] = await Promise.all([
    supabase
      .from('game_session_states')
      .select('organization_id,project_id,node_id,status,step,saved_at,updated_at')
      .eq('organization_id', membership.organization_id)
      .eq('project_id', projectId)
      .eq('node_id', nodeId)
      .maybeSingle(),
    supabase
      .from('audit_log')
      .select('created_at,payload')
      .eq('organization_id', membership.organization_id)
      .eq('event_type', 'game.session.state.backfill.completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (stateErr) return res.status(500).json({ error: stateErr.message || 'Unable to read game session state status' });
  if (backfillErr) return res.status(500).json({ error: backfillErr.message || 'Unable to read backfill status' });

  return res.json({
    session_state: {
      present: Boolean(stateRow),
      status: stateRow?.status || null,
      step: stateRow?.step ?? null,
      saved_at: stateRow?.saved_at || null,
      updated_at: stateRow?.updated_at || null,
      stale: Boolean(stateRow?.saved_at) && Date.now() - new Date(stateRow.saved_at).getTime() > 1000 * 60 * 60 * 24,
    },
    backfill: backfillMeta
      ? {
        last_run_at: backfillMeta.created_at,
        scanned: backfillMeta?.payload?.scanned ?? null,
        valid_legacy_records: backfillMeta?.payload?.valid_legacy_records ?? null,
        unique_targets: backfillMeta?.payload?.unique_targets ?? null,
        upserted: backfillMeta?.payload?.upserted ?? null,
      }
      : null,
    telemetry: await buildGameSessionTelemetrySnapshot({ organizationId: membership.organization_id, projectId, nodeId }),
  });
});

app.get('/api/game-session-state/admin-status', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const projectId = String(req.query.project_id || '').trim() || null;
  const nodeId = String(req.query.node_id || '').trim() || null;

  let stateHealthQuery = supabase
    .from('game_session_states')
    .select('saved_at,status,step')
    .eq('organization_id', membership.organization_id)
    .order('saved_at', { ascending: false })
    .limit(500);

  if (projectId) stateHealthQuery = stateHealthQuery.eq('project_id', projectId);
  if (nodeId) stateHealthQuery = stateHealthQuery.eq('node_id', nodeId);

  let backfillQuery = supabase
    .from('audit_log')
    .select('created_at,payload')
    .eq('organization_id', membership.organization_id)
    .eq('event_type', 'game.session.state.backfill.completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (projectId) {
    backfillQuery = backfillQuery.eq('payload->>project_id', projectId);
  }

  const [{ data: healthRows, error: healthErr }, { data: backfillMeta, error: backfillErr }, telemetry] = await Promise.all([
    stateHealthQuery,
    backfillQuery,
    buildGameSessionTelemetrySnapshot({ organizationId: membership.organization_id, projectId, nodeId, limit: 100 }),
  ]);

  if (healthErr) return res.status(500).json({ error: healthErr.message || 'Unable to read session-state health' });
  if (backfillErr) return res.status(500).json({ error: backfillErr.message || 'Unable to read backfill status' });

  const nowMs = Date.now();
  const staleThresholdMs = 1000 * 60 * 60 * 24;
  const recentThresholdMs = 1000 * 60 * 60;

  const rows = healthRows || [];
  const staleCount = rows.filter((row) => row?.saved_at && nowMs - new Date(row.saved_at).getTime() > staleThresholdMs).length;
  const activeFreshCount = rows.filter((row) => {
    if (!row?.saved_at) return false;
    if (row.status === 'completed') return false;
    return nowMs - new Date(row.saved_at).getTime() <= recentThresholdMs;
  }).length;

  const latest = rows[0] || null;

  return res.json({
    scope: {
      organization_id: membership.organization_id,
      project_id: projectId,
      node_id: nodeId,
    },
    session_state_health: {
      tracked_records: rows.length,
      stale_records_24h: staleCount,
      active_recent_1h: activeFreshCount,
      latest_saved_at: latest?.saved_at || null,
      latest_status: latest?.status || null,
      latest_step: latest?.step ?? null,
    },
    backfill: backfillMeta
      ? {
        last_run_at: backfillMeta.created_at,
        scanned: backfillMeta?.payload?.scanned ?? null,
        valid_legacy_records: backfillMeta?.payload?.valid_legacy_records ?? null,
        unique_targets: backfillMeta?.payload?.unique_targets ?? null,
        upserted: backfillMeta?.payload?.upserted ?? null,
      }
      : null,
    telemetry,
  });
});

app.post('/api/telemetry/export-event', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const action = String(req.body?.action || '').trim();
  const format = String(req.body?.format || '').trim().toLowerCase();
  const projectId = String(req.body?.project_id || '').trim() || null;
  const sprintId = String(req.body?.sprint_id || '').trim() || null;
  const ok = Boolean(req.body?.ok);
  const errorMsg = req.body?.error ? String(req.body.error) : null;

  if (action !== 'sprint_report_export') {
    return res.status(400).json({ error: 'unsupported action' });
  }

  const metricKey = ok ? 'exportSuccess' : 'exportFailure';
  await recordGameSessionTelemetry(metricKey, {
    organizationId: membership.organization_id,
    projectId,
    action,
    format,
    error: errorMsg,
  });

  await appendAuditLog({
    eventType: ok ? 'retro.export.completed' : 'retro.export.failed',
    actor: 'pm',
    sourceLayer: 'pm',
    organizationId: membership.organization_id,
    teamId: membership.team_id,
    targetType: 'sprint',
    targetId: sprintId,
    payload: {
      action,
      format,
      project_id: projectId,
      sprint_id: sprintId,
      ok,
      error: errorMsg ? errorMsg.slice(0, 180) : null,
      initiated_by: user.id,
    },
    outcome: ok ? 'accepted' : 'blocked',
  });

  return res.json({ ok: true });
});

app.get('/api/sessions/join/:code', async (req, res) => {
  const { code } = req.params;
  const { data, error } = await supabase
    .from('sessions')
    .select('id, name, session_type, status, join_code, team_id')
    .eq('join_code', code)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Session ikke fundet' });
  if (data.status === 'completed') return res.status(410).json({ error: 'Session er afsluttet' });
  res.json(data);
});

app.get('/auth/callback', (_req, res) => {
  res.redirect('/#/auth/callback');
});

app.post('/api/auth/provision', async (req, res) => {
  const { user_id, display_name } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const existing = await resolveMembership(user_id);
    if (existing) return res.json({ team_id: existing.team_id, organization_id: existing.organization_id });

    const slug = `team-${user_id.slice(0, 8)}`;
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: `${display_name || 'My'} Team`,
        slug,
        plan: 'free',
        language: 'da',
        data_retention_months: 12
      })
      .select()
      .single();
    if (orgErr) throw orgErr;

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({ organization_id: org.id, name: 'Default Team', created_by: user_id })
      .select().single();
    if (teamErr) throw teamErr;

    await supabase.from('team_members').insert({ team_id: team.id, user_id, role: 'admin' });

    res.json({ org_id: org.id, team_id: team.id });
  } catch (err) {
    console.error('Provision error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/webhooks/config', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.team_id) return res.status(400).json({ error: 'No team' });

  const { data } = await supabase
    .from('webhook_configs')
    .select('id, team_id, url, enabled, created_at, updated_at')
    .eq('team_id', membership.team_id)
    .maybeSingle();

  res.json(data || { team_id: membership.team_id, url: null, enabled: false });
});

app.put('/api/webhooks/config', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.team_id) return res.status(400).json({ error: 'No team' });

  const { url, secret, enabled } = req.body;
  const trimmedUrl = typeof url === 'string' ? url.trim() : '';

  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
    return res.status(400).json({ error: 'url must start with http:// or https://' });
  }

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

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/sessions', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { name, session_type, voting_mode, items, project_id, sprint_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  let membership = await resolveMembership(user.id);
  if (!membership) {
    const slug = `team-${user.id.slice(0, 8)}`;
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'My Team', slug, plan: 'free', language: 'da', data_retention_months: 12 })
      .select().single();
    if (org) {
      const { data: team } = await supabase
        .from('teams')
        .insert({ organization_id: org.id, name: 'Default Team', created_by: user.id })
        .select().single();
      if (team) {
        await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'admin' });
        membership = { team_id: team.id, organization_id: org.id, role: 'admin' };
      }
    }
  }

  if (!membership?.team_id) return res.status(500).json({ error: 'Could not resolve team' });

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      name,
      session_type: normalizeSessionType(session_type),
      voting_mode: voting_mode || 'fibonacci',
      team_id: membership.team_id,
      organization_id: membership.organization_id,
      game_master_id: user.id,
      created_by: user.id,
      status: 'draft',
      project_id: project_id || null,
      sprint_id: sprint_id || null
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  if (items && items.length > 0) {
    const itemRows = items.map((it, i) => ({
      session_id: session.id,
      sprint_id: sprint_id || null,
      title: typeof it === 'string' ? it : it.title,
      description: typeof it === 'string' ? null : (it.description || null),
      priority: typeof it === 'string' ? 'medium' : (it.priority || 'medium'),
      item_order: i,
      status: 'pending'
    }));
    const { error: itemErr } = await supabase.from('session_items').insert(itemRows);
    if (itemErr) console.error('Item insert error:', itemErr.message);
  }

  res.json(session);
});

app.patch('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const { status, current_item_index, current_item_id } = req.body;

  const { data: before } = await supabase
    .from('sessions')
    .select('id, status, team_id, name, started_at, ended_at')
    .eq('id', id)
    .maybeSingle();

  const updateObj = {};
  if (status !== undefined) {
    updateObj.status = status;
    if (status === 'active') updateObj.started_at = new Date().toISOString();
    if (status === 'completed') updateObj.ended_at = new Date().toISOString();
  }
  if (current_item_index !== undefined) updateObj.current_item_index = current_item_index;
  if (current_item_id !== undefined) updateObj.current_item_id = current_item_id;

  const { data, error } = await supabase
    .from('sessions')
    .update(updateObj)
    .eq('id', id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  if (before?.team_id && before.status !== data.status) {
    if (data.status === 'active') {
      queueWebhookEvent({
        teamId: before.team_id,
        sessionId: data.id,
        eventType: 'session.started',
        payload: {
          event: 'session.started',
          timestamp: new Date().toISOString(),
          session: {
            id: data.id,
            name: data.name,
            status: data.status,
            started_at: data.started_at
          }
        },
        oncePerSessionEvent: true
      }).catch((err) => console.error('Failed to queue session.started webhook:', err));
    }

    if (data.status === 'completed') {
      queueWebhookEvent({
        teamId: before.team_id,
        sessionId: data.id,
        eventType: 'session.ended',
        payload: {
          event: 'session.ended',
          timestamp: new Date().toISOString(),
          session: {
            id: data.id,
            name: data.name,
            status: data.status,
            ended_at: data.ended_at
          }
        },
        oncePerSessionEvent: true
      }).catch((err) => console.error('Failed to queue session.ended webhook:', err));
    }
  }

  res.json(data);
});

app.get('/api/sessions', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_items(count)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/dashboard', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json({ active: [], upcoming: [], finished: [], projects: [], activity: [] });

  const { data: sessions, error: sessionsErr } = await supabase
    .from('sessions')
    .select('id,name,status,join_code,created_at,started_at,ended_at,current_item_index,session_type,project_id,session_items(count),session_participants(count)')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sessionsErr) return res.status(500).json({ error: sessionsErr.message });

  const { data: projects, error: projectsErr } = await supabase
    .from('projects')
    .select('id,name,description,status,color,icon,created_by,created_at,updated_at')
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false });

  if (projectsErr) return res.status(500).json({ error: projectsErr.message });

  const insights = await buildProjectInsights({ organizationId: membership.organization_id, projects: projects || [] });

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

  const enrichedProjects = (projects || []).map((project) => ({
    ...project,
    ...(insights.get(project.id) || {})
  }));

  const activity = [
    ...(sessions || []).slice(0, 20).map((session) => {
      const itemCount = session.item_count || 0;
      const partCount = session.participant_count || 0;
      let description;
      if (session.status === 'completed') {
        description = `Session afsluttet · ${itemCount} item${itemCount !== 1 ? 's' : ''}${partCount ? ` · ${partCount} deltagere` : ''}`;
      } else if (session.status === 'active') {
        description = `Session i gang · ${itemCount} item${itemCount !== 1 ? 's' : ''}${partCount ? ` · ${partCount} deltagere` : ''}`;
      } else {
        description = `Session klar · ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      }
      return {
        id: `session-${session.id}`,
        type: 'session',
        title: session.name,
        description,
        created_at: session.ended_at || session.started_at || session.created_at,
        href: `/sessions/${session.id}/results`
      };
    }),
    ...(enrichedProjects || []).slice(0, 20).map((project) => {
      const progress = project.progress ?? 0;
      const totalItems = project.total_items || 0;
      const doneItems = project.done_items || 0;
      const nextMilestone = project.next_milestone;
      let description;
      if (nextMilestone) {
        const daysLeft = Math.ceil((new Date(nextMilestone.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          description = `${doneItems}/${totalItems} items · ${nextMilestone.name} overskredet`;
        } else if (daysLeft === 0) {
          description = `${doneItems}/${totalItems} items · ${nextMilestone.name} udløber i dag`;
        } else {
          description = `${doneItems}/${totalItems} items · ${nextMilestone.name} om ${daysLeft} dag${daysLeft !== 1 ? 'e' : ''}`;
        }
      } else if (totalItems > 0) {
        description = `${doneItems}/${totalItems} items · ${progress}% færdig`;
      } else {
        description = `Projekt ${project.status.replace('_', ' ')} · ingen items endnu`;
      }
      return {
        id: `project-${project.id}`,
        type: 'project',
        title: project.name,
        description,
        created_at: project.updated_at || project.created_at,
        href: `/projects/${project.id}`
      };
    })
  ]
    .filter((item) => item.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);

  res.json({ ...byStatus, projects: enrichedProjects, activity });
});

app.get('/api/projects', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json([]);

  const { data, error } = await supabase
    .from('projects')
    .select('id,name,description,status,color,icon,created_by,created_at,updated_at')
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const insights = await buildProjectInsights({ organizationId: membership.organization_id, projects: data || [] });
  const enriched = (data || []).map((project) => ({ ...project, ...(insights.get(project.id) || {}) }));

  res.json(enriched);
});

app.get('/api/team/assignees', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.team_id) return res.json([]);

  const { data: members, error: membersErr } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', membership.team_id);

  if (membersErr) return res.status(500).json({ error: membersErr.message });

  const userIds = [...new Set((members || []).map((m) => m.user_id).filter(Boolean))];
  if (!userIds.length) return res.json([]);

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id,display_name,avatar_class')
    .in('id', userIds);

  if (profilesErr) return res.status(500).json({ error: profilesErr.message });

  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const assignees = userIds.map((id) => {
    const profile = profileById.get(id);
    return {
      id,
      display_name: profile?.display_name || id.slice(0, 8),
      avatar_class: profile?.avatar_class || null
    };
  });

  res.json(assignees);
});

app.post('/api/projects', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveOrProvisionMembership(user);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  try {
    await enforcePmMutationGuard({ req, membership, targetType: 'project', targetId: null });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const { name, description, color, icon, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: membership.organization_id,
      name: name.trim(),
      description: description?.trim() || null,
      color: color || '#4488dd',
      icon: icon || '📋',
      status: status || 'active',
      created_by: user.id
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const insights = await buildProjectInsights({ organizationId: membership.organization_id, projects: [data] });
  res.json({ ...data, ...(insights.get(data.id) || {}) });
});

app.patch('/api/projects/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const { id } = req.params;
  try {
    await enforcePmMutationGuard({ req, membership, targetType: 'project', targetId: id });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const { name, description, status, color, icon } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (name !== undefined) update.name = String(name).trim();
  if (description !== undefined) update.description = description;
  if (status !== undefined) update.status = status;
  if (color !== undefined) update.color = color;
  if (icon !== undefined) update.icon = icon;

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const insights = await buildProjectInsights({ organizationId: membership.organization_id, projects: [data] });
  res.json({ ...data, ...(insights.get(data.id) || {}) });
});

app.get('/api/projects/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const { id } = req.params;
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (error) return res.status(404).json({ error: 'Project not found' });

  const insights = await buildProjectInsights({ organizationId: membership.organization_id, projects: [data] });
  res.json({ ...data, ...(insights.get(data.id) || {}) });
});

app.get('/api/projects/:id/sprints', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const { id } = req.params;
  const { data: sprints, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', id)
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const sprintIds = (sprints || []).map(s => s.id);
  let itemsBySprint = {};
  if (sprintIds.length) {
    const { data: items } = await supabase
      .from('session_items')
      .select('id,sprint_id,title,description,priority,item_status,assigned_to,estimated_hours,actual_hours,progress,final_estimate,created_at')
      .in('sprint_id', sprintIds)
      .order('created_at');
    itemsBySprint = (items || []).reduce((acc, item) => {
      if (!acc[item.sprint_id]) acc[item.sprint_id] = [];
      acc[item.sprint_id].push(item);
      return acc;
    }, {});
  }

  res.json((sprints || []).map(s => ({ ...s, items: itemsBySprint[s.id] || [] })));
});

app.post('/api/projects/:id/sprints', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const membership = await resolveMembership(user.id);
  try {
    await enforcePmMutationGuard({ req, membership, targetType: 'sprint', targetId: id });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const { name, goal, start_date, end_date, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const { data: project } = await supabase.from('projects').select('organization_id').eq('id', id).single();
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { data, error } = await supabase
    .from('sprints')
    .insert({
      project_id: id,
      organization_id: project.organization_id,
      name: name.trim(),
      goal: goal || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: status || 'upcoming',
      created_by: user.id
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/sprints/:id/items', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const { id } = req.params;
  const membership = await resolveMembership(user.id);
  try {
    await enforcePmMutationGuard({ req, membership, targetType: 'session_item', targetId: id });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const { title, description, priority, assigned_to, estimated_hours, actual_hours, progress, item_status, items } = req.body;

  if (Array.isArray(items) && items.length) {
    const rows = items.map((it, idx) => ({
      sprint_id: id,
      title: it.title,
      description: it.description || null,
      priority: it.priority || 'medium',
      item_status: it.item_status || 'backlog',
      progress: typeof it.progress === 'number' ? it.progress : 0,
      item_order: idx
    })).filter(r => r.title?.trim());
    const { data, error } = await supabase.from('session_items').insert(rows).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  const { data, error } = await supabase
    .from('session_items')
    .insert({
      sprint_id: id,
      title: title.trim(),
      description: description || null,
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
      estimated_hours: estimated_hours || null,
      actual_hours: actual_hours || null,
      progress: typeof progress === 'number' ? progress : 0,
      item_status: item_status || 'backlog',
      status: 'pending'
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/items/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const { id } = req.params;
  const membership = await resolveMembership(user.id);
  try {
    await enforcePmMutationGuard({ req, membership, targetType: 'session_item', targetId: id });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  const { id: _ignored, source_layer: _source_layer, approval_request_id: _approval_request_id, ...bodyPatch } = req.body || {};
  const allowed = ['assigned_to', 'estimated_hours', 'actual_hours', 'progress', 'item_status', 'title', 'description', 'priority', 'due_date', 'notes', 'km_driven', 'hours_fak', 'hours_int', 'hours_ub', 'invoiced_dkk'];
  const patch = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(bodyPatch, key)) patch[key] = bodyPatch[key];
  }

  const { data, error } = await supabase
    .from('session_items')
    .update(patch)
    .eq('id', id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/sessions/:id/results', async (req, res) => {
  const { id } = req.params;
  const token = req.query.token;

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('id,name,status,voting_mode,created_at,ended_at,share_token')
    .eq('id', id)
    .maybeSingle();

  if (sessionErr || !session) return res.status(404).json({ error: 'Session not found' });

  if (token) {
    if (String(session.share_token) !== String(token)) return res.status(403).json({ error: 'Invalid token' });
  } else {
    const user = await getUserFromAuth(req, res);
    if (!user) return;
  }

  const { data: items } = await supabase
    .from('session_items')
    .select('id,title,final_estimate')
    .eq('session_id', id)
    .order('item_order');

  const itemIds = (items || []).map(i => i.id);
  const { data: votes } = itemIds.length
    ? await supabase
        .from('votes')
        .select('id,session_item_id,value,confidence,user_id,perspective,profiles(display_name)')
        .in('session_item_id', itemIds)
    : { data: [] };

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
  const avgConfidence = rows.length
    ? rows.reduce((sum, r) => sum + (Number(r.avg_confidence) || 0), 0) / rows.length
    : 0;

  if (session.status === 'completed') {
    const { data: sessionMeta } = await supabase
      .from('sessions')
      .select('id, team_id, name, ended_at')
      .eq('id', id)
      .maybeSingle();

    if (sessionMeta?.team_id) {
      queueWebhookEvent({
        teamId: sessionMeta.team_id,
        sessionId: sessionMeta.id,
        eventType: 'session.results_ready',
        payload: {
          event: 'session.results_ready',
          timestamp: new Date().toISOString(),
          session: {
            id: sessionMeta.id,
            name: sessionMeta.name,
            status: session.status,
            ended_at: sessionMeta.ended_at
          },
          summary: {
            total_items: rows.length,
            estimated_items: estimatedRows.length,
            total_points: Number(points.toFixed(2)),
            avg_confidence: Number(avgConfidence.toFixed(2))
          }
        },
        oncePerSessionEvent: true
      }).catch((err) => console.error('Failed to queue session.results_ready webhook:', err));
    }
  }

  res.json({
    session: {
      ...session,
      share_token: session.share_token
    },
    items: rows,
    summary: {
      total_items: rows.length,
      estimated_items: estimatedRows.length,
      outliers: rows.filter(r => r.outlier).length,
      total_points: Number(points.toFixed(2)),
      avg_confidence: Number(avgConfidence.toFixed(2))
    }
  });
});

app.post('/api/sessions/:id/share-token', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const { id } = req.params;

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('sessions')
    .update({ share_token: token })
    .eq('id', id)
    .select('id, share_token')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/approval-requests', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const actor = resolveActor(req, 'game');
  const { target_type, target_id, requested_patch, idempotency_key } = req.body || {};

  if (!target_type || !target_id || !requested_patch || !idempotency_key) {
    return res.status(400).json({ error: 'target_type,target_id,requested_patch,idempotency_key required' });
  }

  try {
    transitionApprovalState({
      currentState: APPROVAL_STATES.ADVISORY,
      nextState: APPROVAL_STATES.PENDING_APPROVAL,
      actor: 'game'
    });

    await appendLedgerEvent({
      eventType: 'approval.request.created',
      source: actor,
      idempotencyKey: idempotency_key,
      payload: { target_type, target_id, requested_patch }
    });

    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        organization_id: membership.organization_id,
        team_id: membership.team_id,
        target_type,
        target_id,
        requested_patch,
        requested_by: user.id,
        state: APPROVAL_STATES.PENDING_APPROVAL,
        idempotency_key
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await appendAuditLog({
      eventType: 'approval.request.created',
      actor,
      sourceLayer: 'game',
      organizationId: membership.organization_id,
      teamId: membership.team_id,
      targetType: target_type,
      targetId: target_id,
      approvalRequestId: data.id,
      payload: { state: data.state }
    });

    return res.status(201).json(data);
  } catch (err) {
    if (err.code === 'DUPLICATE_EVENT') {
      return res.status(409).json({ error: 'Duplicate idempotency key' });
    }
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/approval-requests/:id/approve', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const actor = resolveActor(req, 'pm');
  if (actor !== 'pm') return res.status(403).json({ error: 'Only PM can approve' });

  const { data: current } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!current) return res.status(404).json({ error: 'Approval request not found' });

  try {
    const nextState = transitionApprovalState({
      currentState: current.state,
      nextState: APPROVAL_STATES.APPROVED,
      actor: 'pm'
    });

    const { data, error } = await supabase
      .from('approval_requests')
      .update({
        state: nextState,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await appendLedgerEvent({
      eventType: 'approval.request.updated',
      source: 'pm',
      idempotencyKey: `approval:${id}:approved`,
      payload: { from: current.state, to: nextState }
    });

    await appendAuditLog({
      eventType: 'approval.request.state_transition',
      actor,
      sourceLayer: 'pm',
      organizationId: data.organization_id,
      teamId: data.team_id,
      targetType: data.target_type,
      targetId: data.target_id,
      approvalRequestId: data.id,
      payload: { from: current.state, to: nextState }
    });

    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/approval-requests/:id/reject', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const actor = resolveActor(req, 'pm');
  if (actor !== 'pm') return res.status(403).json({ error: 'Only PM can reject' });

  const { data: current } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!current) return res.status(404).json({ error: 'Approval request not found' });

  try {
    const nextState = transitionApprovalState({
      currentState: current.state,
      nextState: APPROVAL_STATES.REJECTED,
      actor: 'pm'
    });

    const { data, error } = await supabase
      .from('approval_requests')
      .update({
        state: nextState,
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: req.body?.reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await appendLedgerEvent({
      eventType: 'approval.request.updated',
      source: 'pm',
      idempotencyKey: `approval:${id}:rejected`,
      payload: { from: current.state, to: nextState }
    });

    await appendAuditLog({
      eventType: 'approval.request.state_transition',
      actor,
      sourceLayer: 'pm',
      organizationId: data.organization_id,
      teamId: data.team_id,
      targetType: data.target_type,
      targetId: data.target_id,
      approvalRequestId: data.id,
      payload: { from: current.state, to: nextState, reason: data.rejection_reason }
    });

    return res.json(data);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/approval-requests/:id/apply', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const actor = resolveActor(req, 'system');
  if (actor !== 'system') return res.status(403).json({ error: 'Only system can apply' });

  const { data: current } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!current) return res.status(404).json({ error: 'Approval request not found' });

  try {
    const { updatedApproval, appliedEntity, targetType } = await applyApprovedRequest({
      supabase,
      approvalRequest: current,
      appliedBy: user.id,
      actor: 'system',
      appendLedgerEvent,
      appendAuditLog
    });

    return res.json({
      approval_request: updatedApproval,
      applied_target: {
        type: targetType,
        id: current.target_id,
        entity: appliedEntity
      }
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/approval-requests', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json([]);

  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data || []);
});

app.get('/api/projection/config', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  const organizationId = membership?.organization_id || null;

  let profileQuery = supabase
    .from('game_profiles')
    .select('*')
    .eq('is_default', true)
    .is('organization_id', null)
    .limit(1);

  if (organizationId) {
    profileQuery = supabase
      .from('game_profiles')
      .select('*')
      .or(`organization_id.eq.${organizationId},and(organization_id.is.null,is_default.eq.true)`)
      .order('organization_id', { ascending: false })
      .limit(1);
  }

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError) return res.status(500).json({ error: profileError.message });

  const profile = (profiles || [])[0] || null;
  if (!profile) {
    return res.json({ profile: null, bossProfiles: [], rewardRules: [], achievements: [] });
  }

  const [{ data: bossProfiles, error: bossError }, { data: rewardRules, error: rewardError }, { data: achievements, error: achievementError }] = await Promise.all([
    supabase.from('boss_profiles').select('*').eq('game_profile_id', profile.id).order('key'),
    supabase.from('reward_rules').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key'),
    supabase.from('achievement_definitions').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key')
  ]);

  const err = bossError || rewardError || achievementError;
  if (err) return res.status(500).json({ error: err.message });

  return res.json({
    profile,
    bossProfiles: bossProfiles || [],
    rewardRules: rewardRules || [],
    achievements: achievements || []
  });
});

app.get('/api/sync/health', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json({ queue_depth: 0, blocked_writes: 0, duplicate_events: 0 });

  const [{ count: pendingApprovals }, { count: blockedWrites }, { count: duplicateEvents }] = await Promise.all([
    supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', membership.organization_id)
      .eq('state', APPROVAL_STATES.PENDING_APPROVAL),
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

  return res.json({
    queue_depth: pendingApprovals || 0,
    blocked_writes: blockedWrites || 0,
    duplicate_events: duplicateEvents || 0
  });
});

app.get('/api/sync/conflicts', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json([]);

  const { data, error } = await supabase
    .from('audit_log')
    .select('id,created_at,event_type,source_layer,target_type,target_id,approval_request_id,payload,outcome')
    .eq('organization_id', membership.organization_id)
    .eq('event_type', 'pm.mutation.blocked')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data || []);
});

app.get('/api/templates', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json([]);

  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/templates', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const { name, config } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      organization_id: membership.organization_id,
      created_by: user.id,
      name: name.trim(),
      config: config || {}
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/templates/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { error } = await supabase
    .from('session_templates')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Estimation pipeline endpoints ─────────────────────────────────────────────

// POST /api/items/:id/estimation-session
// Opretter en ny session med item som hoved-backlog-item
app.post('/api/items/:id/estimation-session', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id: sourceItemId } = req.params;
  const { session_name, voting_mode, backlog_items } = req.body || {};

  const membership = await resolveMembership(user.id);
  if (!membership?.team_id) return res.status(400).json({ error: 'No team membership' });

  // Hent source item for at bruge som titel fallback
  const { data: sourceItem, error: itemErr } = await supabase
    .from('session_items')
    .select('id, title, sprint_id, estimated_hours')
    .eq('id', sourceItemId)
    .maybeSingle();

  if (itemErr || !sourceItem) return res.status(404).json({ error: 'Item not found' });

  // Generer join_code
  const join_code = Math.random().toString(36).slice(2, 6).toUpperCase();

  // Opret session
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .insert({
      name: session_name || sourceItem.title,
      session_type: 'estimation',
      voting_mode: voting_mode || 'fibonacci',
      team_id: membership.team_id,
      organization_id: membership.organization_id,
      game_master_id: user.id,
      created_by: user.id,
      status: 'draft',
      join_code,
    })
    .select()
    .single();

  if (sessErr) return res.status(500).json({ error: sessErr.message });

  // Tilføj source item som første backlog-item i sessionen
  const primaryRow = {
    session_id: session.id,
    sprint_id: sourceItem.sprint_id || null,
    title: sourceItem.title,
    item_order: 0,
    status: 'pending',
    source_item_id: sourceItemId,
    estimation_session_id: session.id,
  };

  const extraRows = (backlog_items || []).map((it, i) => ({
    session_id: session.id,
    title: typeof it === 'string' ? it : it.title,
    item_order: i + 1,
    status: 'pending',
  }));

  const { error: insertErr } = await supabase
    .from('session_items')
    .insert([primaryRow, ...extraRows]);

  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // Opdatér source item med estimation_session_id reference
  await supabase
    .from('session_items')
    .update({ estimation_session_id: session.id })
    .eq('id', sourceItemId);

  return res.status(201).json({ session_id: session.id, join_code });
});

// GET /api/items/:id/estimation-sessions
// Returnerer alle sessions linkede til dette item (via source_item_id)
app.get('/api/items/:id/estimation-sessions', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id: sourceItemId } = req.params;

  // Find session_items der peger på dette source_item_id
  const { data: sessionItems, error } = await supabase
    .from('session_items')
    .select('id, title, final_estimate, created_at, session_id, source_item_id')
    .eq('source_item_id', sourceItemId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  if (!sessionItems?.length) return res.json([]);

  // Hent tilhørende sessions
  const sessionIds = [...new Set(sessionItems.map(si => si.session_id).filter(Boolean))];
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, name, status, created_at, join_code')
    .in('id', sessionIds);

  const sessionMap = new Map((sessions || []).map(s => [s.id, s]));

  const result = sessionItems.map(si => ({
    session_item_id: si.id,
    session_id: si.session_id,
    session_name: sessionMap.get(si.session_id)?.name || si.title,
    session_status: sessionMap.get(si.session_id)?.status || 'unknown',
    join_code: sessionMap.get(si.session_id)?.join_code || null,
    final_estimate: si.final_estimate,
    created_at: si.created_at,
  }));

  return res.json(result);
});

// POST /api/estimation-results/:session_item_id/apply
// Opretter en approval_request for at skrive estimat tilbage til PM-opgave
app.post('/api/estimation-results/:session_item_id/apply', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { session_item_id } = req.params;

  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  // Hent session_item + source_item_id + final_estimate
  const { data: sessionItem, error: siErr } = await supabase
    .from('session_items')
    .select('id, source_item_id, final_estimate, title')
    .eq('id', session_item_id)
    .maybeSingle();

  if (siErr || !sessionItem) return res.status(404).json({ error: 'Session item not found' });
  if (!sessionItem.source_item_id) return res.status(400).json({ error: 'No source_item_id — item is not linked to a PM task' });
  if (!sessionItem.final_estimate) return res.status(400).json({ error: 'No final_estimate on this session item' });

  // Tjek for eksisterende pending approval
  const { data: existing } = await supabase
    .from('approval_requests')
    .select('id, state')
    .eq('target_type', 'item_estimate')
    .eq('target_id', sessionItem.source_item_id)
    .in('state', ['pending_approval', 'pending'])
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'En approval request for dette item er allerede pending', approval_request_id: existing.id });
  }

  const idempotency_key = `item_estimate:${sessionItem.source_item_id}:${session_item_id}`;
  const requested_patch = { estimated_hours: sessionItem.final_estimate };

  const { data: approval, error: apErr } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: membership.organization_id,
      team_id: membership.team_id,
      target_type: 'item_estimate',
      target_id: sessionItem.source_item_id,
      requested_patch,
      requested_by: user.id,
      state: APPROVAL_STATES.PENDING_APPROVAL,
      idempotency_key,
    })
    .select('*')
    .single();

  if (apErr) return res.status(500).json({ error: apErr.message });

  await appendAuditLog({
    eventType: 'estimation.apply.requested',
    actor: 'game',
    sourceLayer: 'game',
    organizationId: membership.organization_id,
    teamId: membership.team_id,
    targetType: 'item_estimate',
    targetId: sessionItem.source_item_id,
    approvalRequestId: approval.id,
    payload: { final_estimate: sessionItem.final_estimate, session_item_id },
  }).catch(() => {});

  return res.status(201).json({ approval_request_id: approval.id });
});

// ══════════════════════════════════════════════════════════════════
// Feature: Roles & Permissions
// ══════════════════════════════════════════════════════════════════

const ROLE_PERMISSIONS = {
  owner:     ['create_session','manage_sprints','manage_items','approve_estimates','view_all','change_owner','manage_members'],
  admin:     ['create_session','manage_sprints','manage_items','approve_estimates','view_all','manage_members'],
  pm:        ['create_session','manage_sprints','manage_items','approve_estimates','view_all'],
  tech_lead: ['create_session','manage_items','view_all'],
  developer: ['create_session','vote','view_team'],
  member:    ['create_session','vote','view_team'],
  observer:  ['view_only'],
  guest:     ['view_only'],
};

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['member'];
}

function requirePermission(permission) {
  return async (req, res, next) => {
    const user = await getUserFromAuth(req, res);
    if (!user) return;
    const membership = await resolveMembership(user.id);
    if (!membership) return res.status(403).json({ error: 'No membership' });
    const perms = getPermissionsForRole(membership.role);
    if (!perms.includes(permission)) return res.status(403).json({ error: `Permission denied: ${permission}` });
    req.currentUser = user;
    req.membership = membership;
    next();
  };
}

app.get('/api/org/members', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  // Get organization_members with roles
  const { data: orgMembers, error: omErr } = await supabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('organization_id', membership.organization_id);

  if (omErr) return res.status(500).json({ error: omErr.message });

  const userIds = (orgMembers || []).map(m => m.user_id).filter(Boolean);

  let profileMap = new Map();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_class')
      .in('id', userIds);
    (profiles || []).forEach(p => profileMap.set(p.id, p));
  }

  const result = (orgMembers || []).map(m => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role || 'member',
      joined_at: m.joined_at,
      display_name: profile?.display_name || m.user_id?.slice(0, 8) || 'Unknown',
      avatar_class: profile?.avatar_class || null,
      is_me: m.user_id === user.id,
    };
  });

  res.json(result);
});

app.patch('/api/org/members/:id/role', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const myPerms = getPermissionsForRole(membership.role);
  if (!myPerms.includes('manage_members')) {
    return res.status(403).json({ error: 'Kun owner/admin kan ændre roller' });
  }

  const { role } = req.body;
  const validRoles = ['owner','admin','member','observer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Ugyldig rolle' });

  // Cannot set owner if not owner yourself
  if (role === 'owner' && !myPerms.includes('change_owner')) {
    return res.status(403).json({ error: 'Kun owner kan overføre ownership' });
  }

  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', req.params.id)
    .eq('organization_id', membership.organization_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Member ikke fundet' });

  res.json({ ok: true, member: data });
});

app.get('/api/me/permissions', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership) return res.json({ role: 'guest', permissions: getPermissionsForRole('guest') });

  res.json({
    role: membership.role || 'member',
    permissions: getPermissionsForRole(membership.role || 'member'),
    organization_id: membership.organization_id,
    team_id: membership.team_id,
  });
});

// ══════════════════════════════════════════════════════════════════
// Feature: Comments
// ══════════════════════════════════════════════════════════════════

app.get('/api/items/:id/comments', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(403).json({ error: 'No membership' });

  const { data, error } = await supabase
    .from('comments')
    .select('id, body, parent_id, created_at, updated_at, author_id')
    .eq('item_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const authorIds = [...new Set((data || []).map(c => c.author_id).filter(Boolean))];
  let authorMap = new Map();
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', authorIds);
    (profiles || []).forEach(p => authorMap.set(p.id, p.display_name || p.id.slice(0,8)));
  }

  const enriched = (data || []).map(c => ({
    ...c,
    author_name: authorMap.get(c.author_id) || 'Unknown',
    is_own: c.author_id === user.id,
  }));

  res.json(enriched);
});

app.post('/api/items/:id/comments', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(403).json({ error: 'No membership' });

  const { body, parent_id } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body required' });
  if (body.trim().length > 5000) return res.status(400).json({ error: 'body too long' });

  const { data, error } = await supabase
    .from('comments')
    .insert({
      item_id: req.params.id,
      author_id: user.id,
      body: body.trim(),
      parent_id: parent_id || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Fetch author name
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();

  res.status(201).json({
    ...data,
    author_name: profile?.display_name || user.id.slice(0,8),
    is_own: true,
  });
});

app.patch('/api/comments/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body required' });
  if (body.trim().length > 5000) return res.status(400).json({ error: 'body too long' });

  const { data, error } = await supabase
    .from('comments')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Kommentar ikke fundet eller ikke din' });

  res.json(data);
});

app.delete('/api/comments/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);

  const myPerms = getPermissionsForRole(membership?.role || 'member');
  const isAdmin = myPerms.includes('manage_members');

  // Author can always delete own; admin/owner can delete any
  let query = supabase.from('comments').delete().eq('id', req.params.id);
  if (!isAdmin) {
    query = query.eq('author_id', user.id);
  }

  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════
// Feature: Global Search
// ══════════════════════════════════════════════════════════════════

app.get('/api/search', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json({ items: [], projects: [], sprints: [] });

  const q = (req.query.q || '').trim();
  const types = (req.query.type || 'items,projects,sprints').split(',');
  const orgId = membership.organization_id;

  if (!q || q.length < 2) return res.json({ items: [], projects: [], sprints: [] });

  const results = { items: [], projects: [], sprints: [] };

  const searches = [];

  if (types.includes('items')) {
    searches.push(
      supabase
        .from('session_items')
        .select('id, title, item_code, item_status, sprint_id, sprints!inner(id, name, project_id, projects!inner(id, name, organization_id))')
        .eq('sprints.projects.organization_id', orgId)
        .textSearch('search_vector', q, { type: 'websearch', config: 'danish' })
        .limit(10)
        .then(({ data, error }) => {
          if (error) {
            // Fallback: ILIKE
            return supabase
              .from('session_items')
              .select('id, title, item_code, item_status, sprint_id, sprints!inner(id, name, project_id, projects!inner(id, name, organization_id))')
              .eq('sprints.projects.organization_id', orgId)
              .ilike('title', `%${q}%`)
              .limit(10);
          }
          return { data, error: null };
        })
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
        .textSearch('search_vector', q, { type: 'websearch', config: 'danish' })
        .limit(8)
        .then(({ data, error }) => {
          if (error) {
            return supabase
              .from('projects')
              .select('id, name, description')
              .eq('organization_id', orgId)
              .ilike('name', `%${q}%`)
              .limit(8);
          }
          return { data, error: null };
        })
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
        .ilike('name', `%${q}%`)
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

  res.json(results);
});

// ══════════════════════════════════════════════════════════════════
// Feature: Burndown / Velocity Charts
// ══════════════════════════════════════════════════════════════════

app.get('/api/sprints/:id/burndown', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;

  // Get sprint for ideal line
  const { data: sprint, error: sprintErr } = await supabase
    .from('sprints')
    .select('id, name, start_date, end_date')
    .eq('id', id)
    .maybeSingle();

  if (sprintErr || !sprint) return res.status(404).json({ error: 'Sprint not found' });

  // Get snapshots
  const { data: snapshots, error: snapErr } = await supabase
    .from('sprint_daily_snapshots')
    .select('*')
    .eq('sprint_id', id)
    .order('snapshot_date', { ascending: true });

  if (snapErr) return res.status(500).json({ error: snapErr.message });

  // Build ideal burndown line
  let ideal = [];
  if (sprint.start_date && sprint.end_date && snapshots?.length) {
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

  res.json({ sprint, snapshots: snapshots || [], ideal });
});

app.get('/api/projects/:id/velocity', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;

  const { data, error } = await supabase
    .from('sprint_velocity')
    .select('*')
    .eq('project_id', id)
    .order('end_date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/sprints/:id/snapshot', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;

  // Get current items for this sprint
  const { data: items, error: itemsErr } = await supabase
    .from('session_items')
    .select('id, item_status, estimated_hours, actual_hours')
    .eq('sprint_id', id);

  if (itemsErr) return res.status(500).json({ error: itemsErr.message });

  const allItems = items || [];
  const itemsTotal = allItems.length;
  const itemsDone = allItems.filter(i => i.item_status === 'completed' || i.item_status === 'done').length;
  const hoursEstimated = allItems.reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);
  const hoursActual = allItems.filter(i => i.item_status === 'completed' || i.item_status === 'done')
    .reduce((sum, i) => sum + (Number(i.actual_hours) || 0), 0);
  const hoursRemaining = allItems.filter(i => i.item_status !== 'completed' && i.item_status !== 'done')
    .reduce((sum, i) => sum + (Number(i.estimated_hours) || 0), 0);

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sprint_daily_snapshots')
    .upsert({
      sprint_id: id,
      snapshot_date: today,
      items_total: itemsTotal,
      items_done: itemsDone,
      hours_estimated: hoursEstimated,
      hours_actual: hoursActual,
      hours_remaining: hoursRemaining,
    }, { onConflict: 'sprint_id,snapshot_date' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ══════════════════════════════════════════════════════════════════
// Feature: Dependencies & Blockers
// ══════════════════════════════════════════════════════════════════

async function hasCircularDependency(itemId, dependsOnId) {
  const visited = new Set();
  const queue = [dependsOnId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === itemId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const { data } = await supabase
      .from('item_dependencies')
      .select('depends_on_id')
      .eq('item_id', current);
    for (const dep of data || []) queue.push(dep.depends_on_id);
  }
  return false;
}

app.get('/api/items/:id/dependencies', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;

  // Items this item blocks (this item depends on them)
  const { data: blocks, error: blocksErr } = await supabase
    .from('item_dependencies')
    .select('id, depends_on_id, dependency_type, created_at')
    .eq('item_id', id);

  // Items that depend on this item (blocked by this item)
  const { data: blockedBy, error: blockedByErr } = await supabase
    .from('item_dependencies')
    .select('id, item_id, dependency_type, created_at')
    .eq('depends_on_id', id);

  if (blocksErr || blockedByErr) {
    return res.status(500).json({ error: (blocksErr || blockedByErr).message });
  }

  // Enrich with item titles
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

  res.json({
    blocks: (blocks || []).map(b => ({
      ...b,
      item: itemMap.get(b.depends_on_id) || null,
    })),
    blocked_by: (blockedBy || []).map(b => ({
      ...b,
      item: itemMap.get(b.item_id) || null,
    })),
  });
});

app.post('/api/items/:id/dependencies', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { depends_on_id, dependency_type } = req.body;

  if (!depends_on_id) return res.status(400).json({ error: 'depends_on_id required' });
  if (id === depends_on_id) return res.status(400).json({ error: 'Cannot depend on itself' });

  // Circular check
  const circular = await hasCircularDependency(id, depends_on_id);
  if (circular) return res.status(409).json({ error: 'Circular dependency detected' });

  const { data, error } = await supabase
    .from('item_dependencies')
    .insert({
      item_id: id,
      depends_on_id,
      dependency_type: dependency_type || 'blocks',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/dependencies/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { error } = await supabase
    .from('item_dependencies')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════
// Feature: In-app Notifications
// ══════════════════════════════════════════════════════════════════

async function createNotification(userId, orgId, eventType, title, body, link) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      organization_id: orgId,
      event_type: eventType,
      title,
      body: body || null,
      link: link || null,
    });
  if (error) console.error('createNotification failed:', error.message);
}

app.get('/api/notifications', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('read_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/notifications/read-all', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/api/notifications/unread-count', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Reveal server running on port ${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
});