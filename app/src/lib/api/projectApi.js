import { supabase } from '../supabase';
import { resolveMembership } from './shared';

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

// ── Bulk Import ───────────────────────────────────────────────────────────────
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

// ── Velocity Suggestion ───────────────────────────────────────────────────────
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
