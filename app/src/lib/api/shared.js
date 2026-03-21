import { supabase } from '../supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── Helpers (shared across domain modules) ────────────────────────────────────

export async function edgeFn(fnName, body = {}, method = 'POST') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Edge function error');
  }
  return res.json();
}

export async function resolveMembership() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgMember?.organization_id) {
    return { organization_id: orgMember.organization_id, role: orgMember.role };
  }

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
