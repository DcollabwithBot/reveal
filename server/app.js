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

  const { id: _ignored, source_layer, approval_request_id, ...bodyPatch } = req.body || {};
  const allowed = ['assigned_to', 'estimated_hours', 'actual_hours', 'progress', 'item_status', 'title', 'description', 'priority'];
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

app.get('*', (_req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Reveal server running on port ${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
});