import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateJoinCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
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
    const body = await req.json()
    const { type, id, session_name, voting_mode, item_ids, backlog_items } = body

    const membership = await resolveMembership(supabase, user.id)
    if (!membership?.team_id) {
      return new Response(JSON.stringify({ error: 'No team membership' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const join_code = generateJoinCode()

    // ── Sprint estimation ──
    if (type === 'sprint') {
      const { data: sprint } = await supabase
        .from('sprints')
        .select('id, name, project_id, organization_id')
        .eq('id', id)
        .maybeSingle()
      if (!sprint) throw new Error('Sprint not found')

      const { data: items } = await supabase
        .from('session_items')
        .select('id, title, sprint_id')
        .eq('sprint_id', id)
        .is('estimated_hours', null)
        .order('item_order', { ascending: true })
      if (!items?.length) throw new Error('Alle items i dette sprint er allerede estimeret')

      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .insert({
          name: session_name || `Estimer: ${sprint.name}`,
          session_type: 'estimation',
          voting_mode: voting_mode || 'fibonacci',
          team_id: membership.team_id,
          organization_id: membership.organization_id,
          game_master_id: user.id,
          created_by: user.id,
          status: 'draft',
          join_code,
          project_id: sprint.project_id || null,
          sprint_id: id,
        })
        .select()
        .single()
      if (sessErr) throw new Error(sessErr.message)

      const itemRows = items.map((it: { id: string; title: string }, i: number) => ({
        session_id: session.id,
        sprint_id: id,
        title: it.title,
        item_order: i,
        status: 'pending',
        source_item_id: it.id,
      }))
      await supabase.from('session_items').insert(itemRows)

      return new Response(JSON.stringify({ session_id: session.id, join_code }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Project estimation ──
    if (type === 'project') {
      const { data: project } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', id)
        .maybeSingle()
      if (!project) throw new Error('Project not found')

      const { data: sprints } = await supabase
        .from('sprints')
        .select('id')
        .eq('project_id', id)
      const sprintIds = (sprints || []).map((s: { id: string }) => s.id)
      if (!sprintIds.length) throw new Error('Ingen sprints i projektet')

      const { data: items } = await supabase
        .from('session_items')
        .select('id, title, sprint_id')
        .in('sprint_id', sprintIds)
        .is('estimated_hours', null)
        .order('item_order', { ascending: true })
      if (!items?.length) throw new Error('Alle items i projektet er allerede estimeret')

      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .insert({
          name: session_name || `Bulk estimer: ${project.name}`,
          session_type: 'estimation',
          voting_mode: voting_mode || 'fibonacci',
          team_id: membership.team_id,
          organization_id: membership.organization_id,
          game_master_id: user.id,
          created_by: user.id,
          status: 'draft',
          join_code,
          project_id: id,
        })
        .select()
        .single()
      if (sessErr) throw new Error(sessErr.message)

      const itemRows = items.map((it: { id: string; title: string; sprint_id: string }, i: number) => ({
        session_id: session.id,
        sprint_id: it.sprint_id,
        title: it.title,
        item_order: i,
        status: 'pending',
        source_item_id: it.id,
      }))
      await supabase.from('session_items').insert(itemRows)

      return new Response(JSON.stringify({ session_id: session.id, join_code }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Bulk estimation (selected items) ──
    if (type === 'bulk') {
      if (!Array.isArray(item_ids) || !item_ids.length) throw new Error('item_ids required')

      const { data: items } = await supabase
        .from('session_items')
        .select('id, title, sprint_id')
        .in('id', item_ids)
      if (!items?.length) throw new Error('No items found')

      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .insert({
          name: session_name || `Estimering: ${items.length} items`,
          session_type: 'estimation',
          voting_mode: voting_mode || 'fibonacci',
          team_id: membership.team_id,
          organization_id: membership.organization_id,
          game_master_id: user.id,
          created_by: user.id,
          status: 'draft',
          join_code,
        })
        .select()
        .single()
      if (sessErr) throw new Error(sessErr.message)

      const itemRows = items.map((it: { id: string; title: string; sprint_id: string | null }, i: number) => ({
        session_id: session.id,
        sprint_id: it.sprint_id || null,
        title: it.title,
        item_order: i,
        status: 'pending',
        source_item_id: it.id,
      }))
      await supabase.from('session_items').insert(itemRows)

      return new Response(JSON.stringify({ session_id: session.id, join_code }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Item estimation (single item) ──
    if (type === 'item') {
      const { data: sourceItem } = await supabase
        .from('session_items')
        .select('id, title, sprint_id')
        .eq('id', id)
        .maybeSingle()
      if (!sourceItem) throw new Error('Item not found')

      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .insert({
          name: session_name || sourceItem.title,
          session_type: 'estimation',
          voting_mode: voting_mode || 'fibonacci',
          team_id: membership.team_id,
          organization_id: membership.organization_id,
          game_master_id: user.id,
          created_by: user.id,
          status: 'draft',
          join_code,
        })
        .select()
        .single()
      if (sessErr) throw new Error(sessErr.message)

      const primaryRow = {
        session_id: session.id,
        sprint_id: sourceItem.sprint_id || null,
        title: sourceItem.title,
        item_order: 0,
        status: 'pending',
        source_item_id: id,
        estimation_session_id: session.id,
      }

      const extraRows = (backlog_items || []).map((it: string | { title: string }, i: number) => ({
        session_id: session.id,
        title: typeof it === 'string' ? it : it.title,
        item_order: i + 1,
        status: 'pending',
      }))

      await supabase.from('session_items').insert([primaryRow, ...extraRows])
      await supabase.from('session_items').update({ estimation_session_id: session.id }).eq('id', id)

      return new Response(JSON.stringify({ session_id: session.id, join_code }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error(`Unknown estimation type: ${type}`)
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
