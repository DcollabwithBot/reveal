#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../../.secrets/supabase.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=');
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function deriveStatus(state) {
  const status = String(state?.status || '').trim();
  if (['in_progress', 'ready_for_review', 'completed'].includes(status)) return status;
  if (state?.completed) return 'completed';
  if (state?.readyForReview) return 'ready_for_review';
  return 'in_progress';
}

function parseTargetId(targetId) {
  if (!targetId || typeof targetId !== 'string') return { projectId: null, nodeId: null };
  const idx = targetId.indexOf(':');
  if (idx < 0) return { projectId: null, nodeId: null };
  return {
    projectId: targetId.slice(0, idx),
    nodeId: targetId.slice(idx + 1),
  };
}

function buildPatch(entry) {
  const payload = entry.payload || {};
  const state = payload.state || null;
  const legacyTarget = parseTargetId(payload.target_id || entry.target_id);
  const projectId = payload.project_id || legacyTarget.projectId;
  const nodeId = payload.node_id || legacyTarget.nodeId;

  if (!entry.organization_id || !projectId || !nodeId || !state || typeof state !== 'object') {
    return null;
  }

  const votes = Array.isArray(state.votes) ? state.votes.map(normalizeNumber).filter((v) => v != null) : [];
  const voteCount = votes.length;
  const voteAvg = voteCount ? Number((votes.reduce((s, v) => s + v, 0) / voteCount).toFixed(2)) : null;

  return {
    organization_id: entry.organization_id,
    team_id: entry.team_id || null,
    project_id: projectId,
    node_id: nodeId,
    status: deriveStatus(state),
    step: Number.isInteger(state.step) ? state.step : 0,
    final_estimate: normalizeNumber(state.finalEstimate),
    vote_count: voteCount,
    vote_min: voteCount ? Math.min(...votes) : null,
    vote_max: voteCount ? Math.max(...votes) : null,
    vote_avg: voteAvg,
    saved_by: payload.saved_by || null,
    saved_at: payload.saved_at || entry.created_at,
    state,
    updated_at: payload.saved_at || entry.created_at,
  };
}

async function run() {
  let offset = 0;
  const pageSize = 500;
  const patches = [];

  while (true) {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id,organization_id,team_id,target_id,payload,created_at')
      .eq('event_type', 'game.session.state.saved')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      const patch = buildPatch(entry);
      if (patch) patches.push(patch);
    }

    offset += data.length;
    if (data.length < pageSize) break;
  }

  let upserted = 0;
  for (const patch of patches) {
    const { error } = await supabase
      .from('game_session_states')
      .upsert(patch, { onConflict: 'organization_id,project_id,node_id' });
    if (error) throw error;
    upserted += 1;
  }

  const uniqueKeys = new Set(patches.map((p) => `${p.organization_id}:${p.project_id}:${p.node_id}`));
  const skipped = Math.max(0, offset - patches.length);

  const summary = {
    scanned: offset,
    valid_legacy_records: patches.length,
    unique_targets: uniqueKeys.size,
    upserted,
    skipped,
    idempotent: true,
    completed_at: new Date().toISOString(),
  };

  if (patches.length) {
    const orgIds = [...new Set(patches.map((p) => p.organization_id).filter(Boolean))];
    for (const organizationId of orgIds) {
      await supabase.from('audit_log').insert({
        event_type: 'game.session.state.backfill.completed',
        actor: 'system',
        source_layer: 'system',
        organization_id: organizationId,
        team_id: null,
        target_type: 'game_session_state_backfill',
        target_id: 'backfill',
        outcome: 'accepted',
        payload: summary,
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((err) => {
  console.error('backfill failed:', err.message || err);
  process.exit(1);
});
