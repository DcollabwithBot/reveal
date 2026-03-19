require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Serve Vite frontend — support both local dev and production paths
const devDist = path.join(__dirname, '../app/dist');
const prodDist = __dirname; // On Nordicway, static files are in same dir as app.js
const staticRoot = fs.existsSync(path.join(devDist, 'index.html')) ? devDist : prodDist;
app.use(express.static(staticRoot));

// Supabase client (service role — server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('organizations').select('count').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Session join by code ──────────────────────────────────
// Used before auth — returns public session info
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

// ─── Auth callback ────────────────────────────────────────
// Supabase handles token exchange client-side via URL hash
app.get('/auth/callback', (req, res) => {
  res.redirect('/#/auth/callback');
});

// ─── Provision org + team on signup ──────────────────────
app.post('/api/auth/provision', async (req, res) => {
  const { user_id, display_name } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    // Check if user already has a team membership
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingMember) return res.json({ team_id: existingMember.team_id });

    // Create org
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
      .select().single();
    if (orgErr) throw orgErr;

    // Create default team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({
        organization_id: org.id,
        name: 'Default Team',
        created_by: user_id
      })
      .select().single();
    if (teamErr) throw teamErr;

    // Add user as admin
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id,
      role: 'admin'
    });

    res.json({ org_id: org.id, team_id: team.id });
  } catch (err) {
    console.error('Provision error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/sessions ───────────────────────────────────
app.post('/api/sessions', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (!user || authErr) return res.status(401).json({ error: 'Unauthorized' });

  const { name, session_type, voting_mode, items } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Get or create user's team
  let teamId;
  const { data: member } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (member) {
    teamId = member.team_id;
  } else {
    // Auto-provision
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
        teamId = team.id;
        await supabase.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'admin' });
      }
    }
  }

  if (!teamId) return res.status(500).json({ error: 'Could not resolve team' });

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      name,
      session_type: session_type || 'estimation',
      voting_mode: voting_mode || 'fibonacci',
      team_id: teamId,
      game_master_id: user.id,
      created_by: user.id,
      status: 'draft'
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  if (items && items.length > 0) {
    const itemRows = items.map((title, i) => ({
      session_id: session.id,
      title,
      item_order: i,
      status: 'pending'
    }));
    const { error: itemErr } = await supabase.from('session_items').insert(itemRows);
    if (itemErr) console.error('Item insert error:', itemErr.message);
  }

  res.json(session);
});

// ─── PATCH /api/sessions/:id ──────────────────────────────
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

// ─── GET /api/sessions ────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (!user || authErr) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('sessions')
    .select('*, session_items(count)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── SPA fallback ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Reveal server running on port ${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
});
