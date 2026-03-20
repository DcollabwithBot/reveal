import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function resolveMembership(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: member } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!member) return null
  const { data: team } = await supabase
    .from('teams')
    .select('id, organization_id')
    .eq('id', member.team_id)
    .maybeSingle()
  if (!team) return null
  return { team_id: team.id, organization_id: team.organization_id, role: member.role }
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
    const { actionId, sprint_id } = await req.json()
    if (!actionId) throw new Error('actionId required')

    const membership = await resolveMembership(supabase, user.id)
    if (!membership?.organization_id) throw new Error('No org')

    const { data: action } = await supabase
      .from('retro_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle()

    if (!action) throw new Error('Retro action not found')
    if (action.promoted_at) throw new Error('Already promoted')

    const idempotency_key = `retro_promote:${actionId}:${Date.now()}`

    const { data: approval, error: apErr } = await supabase
      .from('approval_requests')
      .insert({
        organization_id: membership.organization_id,
        team_id: membership.team_id,
        target_type: 'retro_promotion',
        target_id: actionId,
        requested_patch: {
          title: action.title,
          description: action.description,
          sprint_id: sprint_id || action.suggested_sprint_id || null,
          source_type: 'retro',
          source_session_id: action.session_id,
        },
        requested_by: user.id,
        state: 'pending_approval',
        idempotency_key,
      })
      .select('*')
      .single()

    if (apErr) throw new Error(apErr.message)

    return new Response(JSON.stringify({ approval_request_id: approval.id }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
