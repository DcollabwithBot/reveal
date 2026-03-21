import { supabase } from '../supabase';
import { edgeFn, resolveMembership } from './shared';

// ── Webhooks ──────────────────────────────────────────────────────────────────
export async function getWebhookConfig() {
  const membership = await resolveMembership();
  if (!membership?.team_id) return { team_id: null, url: null, enabled: false };

  const { data } = await supabase
    .from('webhook_configs')
    .select('id, team_id, url, enabled, created_at, updated_at')
    .eq('team_id', membership.team_id)
    .maybeSingle();

  return data || { team_id: membership.team_id, url: null, enabled: false };
}

export async function updateWebhookConfig({ url, secret, enabled }) {
  const membership = await resolveMembership();
  if (!membership?.team_id) throw new Error('No team');

  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
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

  if (error) throw new Error(error.message);
  return data;
}

// ── Integration Connections ───────────────────────────────────────────────────
export async function getIntegrationConnections() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return [];

  const { data } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function upsertIntegrationConnection(provider, config) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('integration_connections')
    .upsert({
      organization_id: membership.organization_id,
      provider,
      config,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,provider' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function disconnectIntegration(connectionId) {
  const { data, error } = await supabase
    .from('integration_connections')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Jira Sync ─────────────────────────────────────────────────────────────────
export async function triggerJiraSync() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  return edgeFn('jira-sync', { org_id: membership.organization_id });
}

// ── Send Webhook (manual test) ────────────────────────────────────────────────
export async function testWebhook(eventType, data) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  return edgeFn('send-webhook', { org_id: membership.organization_id, event_type: eventType, data });
}

// ── Send Email ────────────────────────────────────────────────────────────────
export async function sendEmailViaEdge(to, subject, html) {
  const membership = await resolveMembership();
  return edgeFn('send-email', { to, subject, html, org_id: membership?.organization_id });
}

// ── SMTP Config ───────────────────────────────────────────────────────────────
export async function getSmtpConfig() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) return null;

  const { data } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .maybeSingle();
  return data;
}

export async function upsertSmtpConfig(config) {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');

  const { data, error } = await supabase
    .from('smtp_configs')
    .upsert({
      organization_id: membership.organization_id,
      ...config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
