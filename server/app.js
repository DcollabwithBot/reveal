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
    // Check if user already has an org
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', user_id)
      .maybeSingle();

    if (existing) return res.json({ org_id: existing.id });

    // Create org
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: `${display_name || 'My'} Team`, owner_id: user_id })
      .select().single();
    if (orgErr) throw orgErr;

    // Create default team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({ org_id: org.id, name: 'Default Team' })
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

// ─── SPA fallback ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Reveal server running on port ${PORT}`);
  console.log(`   Supabase URL: ${process.env.SUPABASE_URL}`);
});
