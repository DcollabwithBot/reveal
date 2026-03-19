require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
      session_type: session_type || 'estimation',
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
  if (!membership?.organization_id) return res.json({ active: [], upcoming: [], finished: [], projects: [] });

  const { data: sessions, error: sessionsErr } = await supabase
    .from('sessions')
    .select('id,name,status,join_code,created_at,started_at,ended_at,current_item_index,session_type,project_id,session_items(count),session_participants(count)')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sessionsErr) return res.status(500).json({ error: sessionsErr.message });

  const { data: projects, error: projectsErr } = await supabase
    .from('projects')
    .select('id,name,status,color,icon,updated_at')
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false });

  if (projectsErr) return res.status(500).json({ error: projectsErr.message });

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

  res.json({ ...byStatus, projects: projects || [] });
});

app.get('/api/projects', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.json([]);

  const { data, error } = await supabase
    .from('projects')
    .select('id,name,description,status,color,icon,created_at,updated_at')
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/projects', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;
  const membership = await resolveMembership(user.id);
  if (!membership?.organization_id) return res.status(400).json({ error: 'No org' });

  const { name, description, color, icon, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: membership.organization_id,
      name: name.trim(),
      description: description || null,
      color: color || '#4488dd',
      icon: icon || '📋',
      status: status || 'active',
      created_by: user.id
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/projects/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { name, description, status, color, icon } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (status !== undefined) update.status = status;
  if (color !== undefined) update.color = color;
  if (icon !== undefined) update.icon = icon;

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/projects/:id', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Project not found' });
  res.json(data);
});

app.get('/api/projects/:id/sprints', async (req, res) => {
  const user = await getUserFromAuth(req, res);
  if (!user) return;

  const { id } = req.params;
  const { data: sprints, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', id)
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
  const allowed = ['assigned_to', 'estimated_hours', 'actual_hours', 'progress', 'item_status', 'title', 'description', 'priority'];
  const patch = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key];
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
    .select('id,name,status,created_at,ended_at,share_token')
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
        .select('id,session_item_id,value,confidence,user_id,profiles(display_name)')
        .in('session_item_id', itemIds)
    : { data: [] };

  const rows = (items || []).map(item => {
    const itemVotes = (votes || []).filter(v => v.session_item_id === item.id);
    const numbers = itemVotes.map(v => normalizeVote(v.value)).filter(v => typeof v === 'number' && !Number.isNaN(v));
    const med = median(numbers);
    const outlier = med > 0 && numbers.some(v => v > med * 2);
    const avgConfidence = itemVotes.length
      ? (itemVotes.reduce((sum, v) => sum + (Number(v.confidence) || 0), 0) / itemVotes.length)
      : 0;
    const consensus = med > 0 ? med : (item.final_estimate || null);

    return {
      id: item.id,
      title: item.title,
      final_estimate: item.final_estimate,
      median: med,
      consensus,
      avg_confidence: Number(avgConfidence.toFixed(2)),
      outlier,
      votes: itemVotes.map(v => ({
        user_id: v.user_id,
        name: v.profiles?.display_name || v.user_id?.slice(0, 6) || 'unknown',
        value: v.value,
        confidence: v.confidence || null
      }))
    };
  });

  const estimatedRows = rows.filter(r => r.consensus !== null && r.consensus !== undefined);
  const points = estimatedRows.reduce((sum, r) => sum + (Number(r.consensus) || 0), 0);
  const avgConfidence = rows.length
    ? rows.reduce((sum, r) => sum + (Number(r.avg_confidence) || 0), 0) / rows.length
    : 0;

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