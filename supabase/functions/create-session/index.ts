import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeSessionType(rawType: string): string {
  const val = String(rawType || '').toLowerCase().trim()
  if (!val) return 'estimation'
  if (['poker', 'planning_poker', 'story_estimation', 'estimation'].includes(val)) return 'estimation'
  if (['roulette', 'scope_roulette'].includes(val)) return 'roulette'
  if (['retro', 'retrospective', 'sprint_retro'].includes(val)) return 'retro'
  if (['draft', 'sprint_draft', 'sprint_planning'].includes(val)) return 'sprint_draft'
  return 'estimation'
}

async function resolveOrProvisionMembership(supabase: ReturnType<typeof createClient>, userId: string) {
  // Try existing membership
  const { data: member } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (member) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, organization_id')
      .eq('id', member.team_id)
      .maybeSingle()
    if (team) return { team_id: team.id, organization_id: team.organization_id, role: member.role }
  }

  // Auto-provision
  const slug = `team-${userId.slice(0, 8)}`
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'My Team', slug, plan: 'free', language: 'da', data_retention_months: 12 })
    .select()
    .single()
  if (!org) return null

  const { data: team } = await supabase
    .from('teams')
    .insert({ organization_id: org.id, name: 'Default Team', created_by: userId })
    .select()
    .single()
  if (!team) return null

  await supabase.from('team_members').insert({ team_id: team.id, user_id: userId, role: 'admin' })
  return { team_id: team.id, organization_id: org.id, role: 'admin' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  const authHeader = req.headers.get('Authorization')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(
    authHeader?.replace('Bearer ', '') ?? ''
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { name, session_type, voting_mode, items, project_id, sprint_id, draft_config } = await req.json()
    if (!name) throw new Error('name required')

    const membership = await resolveOrProvisionMembership(supabase, user.id)
    if (!membership?.team_id) throw new Error('Could not resolve team')

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
        sprint_id: sprint_id || null,
        ...(draft_config ? { draft_config } : {}),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    if (items && items.length > 0) {
      const itemRows = items.map((it: string | { title: string; description?: string; priority?: string }, i: number) => ({
        session_id: session.id,
        sprint_id: sprint_id || null,
        title: typeof it === 'string' ? it : it.title,
        description: typeof it === 'string' ? null : (it.description || null),
        priority: typeof it === 'string' ? 'medium' : (it.priority || 'medium'),
        item_order: i,
        status: 'pending',
      }))
      await supabase.from('session_items').insert(itemRows)
    }

    return new Response(JSON.stringify(session), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
