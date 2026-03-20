import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Hent bruger fra JWT i Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await createClient(supabaseUrl, supabaseAnonKey).auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id
    const displayName = user.user_metadata?.full_name || user.email || 'Player'

    // Check for existing team membership
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('id, organization_id')
        .eq('id', existingMember.team_id)
        .maybeSingle()

      return new Response(JSON.stringify({
        team_id: existingMember.team_id,
        organization_id: team?.organization_id || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // No membership — provision new org + team
    const slug = `team-${userId.slice(0, 8)}`

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: `${displayName} Team`,
        slug,
        plan: 'free',
        language: 'da',
        data_retention_months: 12
      })
      .select('id')
      .single()

    if (orgErr || !org) {
      return new Response(JSON.stringify({ error: orgErr?.message || 'Failed to create org' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({
        organization_id: org.id,
        name: 'Default Team',
        created_by: userId
      })
      .select('id')
      .single()

    if (teamErr || !team) {
      return new Response(JSON.stringify({ error: teamErr?.message || 'Failed to create team' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: userId,
      role: 'admin'
    })

    return new Response(JSON.stringify({
      team_id: team.id,
      organization_id: org.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
