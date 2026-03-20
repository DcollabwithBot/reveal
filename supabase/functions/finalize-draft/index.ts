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
    const { sessionId } = await req.json()
    if (!sessionId) throw new Error('sessionId required')

    const membership = await resolveMembership(supabase, user.id)
    if (!membership?.organization_id) throw new Error('No org')

    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
    if (!session) throw new Error('Session not found')

    const { data: picks } = await supabase
      .from('sprint_draft_picks')
      .select('*')
      .eq('session_id', sessionId)

    const drafted = (picks || []).filter((p: { decision: string }) => p.decision === 'drafted' || p.decision === 'stretch')
    const capacityUsed = drafted.reduce((sum: number, p: { estimate_at_draft: number | null }) => sum + (Number(p.estimate_at_draft) || 0), 0)

    const idempotencyKey = `sprint_draft_finalize_${sessionId}_${Date.now()}`

    const { data: approval, error } = await supabase
      .from('approval_requests')
      .insert({
        organization_id: membership.organization_id,
        team_id: membership.team_id,
        target_type: 'sprint_draft_finalization',
        target_id: sessionId,
        requested_patch: {
          session_id: sessionId,
          sprint_id: session.sprint_id,
          drafted_items: drafted.map((p: { session_item_id: string; decision: string; estimate_at_draft: number | null }) => ({
            session_item_id: p.session_item_id,
            decision: p.decision,
            estimate: p.estimate_at_draft,
          })),
          capacity_used: capacityUsed,
          capacity_target: session.draft_config?.capacity_points || 0,
        },
        requested_by: user.id,
        state: 'pending_approval',
        idempotency_key: idempotencyKey,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    // Mark session completed
    await supabase
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    return new Response(JSON.stringify({ approval_request_id: approval.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
