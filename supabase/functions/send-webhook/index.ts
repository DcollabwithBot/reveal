import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://reveal.blichert.net'

// ── Payload Builders ──────────────────────────────────────────────────────────

function buildSlackPayload(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  const title = getEventTitle(eventType, data)
  const description = getEventDescription(eventType, data)
  const actionUrl = getEventUrl(eventType, data)

  const blocks: unknown[] = [
    { type: 'section', text: { type: 'mrkdwn', text: `*${title}*\n${description}` } },
  ]

  if (actionUrl) {
    blocks.push({
      type: 'actions',
      elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open Reveal' }, url: actionUrl }],
    })
  }

  return { text: title, blocks }
}

function buildTeamsPayload(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  const title = getEventTitle(eventType, data)
  const description = getEventDescription(eventType, data)
  const actionUrl = getEventUrl(eventType, data)

  const card: Record<string, unknown> = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    summary: title,
    sections: [{ activityTitle: title, activityText: description }],
  }

  if (actionUrl) {
    card.potentialAction = [{
      '@type': 'OpenUri',
      name: 'Open Reveal',
      targets: [{ os: 'default', uri: actionUrl }],
    }]
  }

  return card
}

function getEventTitle(eventType: string, data: Record<string, unknown>): string {
  switch (eventType) {
    case 'session.started': return `⚔️ Estimation session started: ${data.session_name || 'Unnamed'}`
    case 'sprint.completed': return `🏁 Sprint closed: ${data.sprint_name || 'Unnamed'}`
    case 'approval.pending': return `🔔 PM approval required: ${data.item_name || 'Item'}`
    case 'risk_card.played': return `⚠️ Risk card played: ${data.card_type || 'Unknown'}`
    case 'mission.completed': return `🎯 Mission completed: ${data.mission_name || 'Unknown'}`
    default: return `📢 Reveal notification`
  }
}

function getEventDescription(eventType: string, data: Record<string, unknown>): string {
  switch (eventType) {
    case 'session.started': return `Session "${data.session_name}" is now active. Join and start estimating!`
    case 'sprint.completed': return `Sprint "${data.sprint_name}" has been completed.${data.accuracy ? ` Accuracy: ${data.accuracy}%` : ''}`
    case 'approval.pending': return `"${data.item_name}" needs PM approval before changes are applied.`
    case 'risk_card.played': return `${data.player_name || 'Someone'} played a ${data.card_type} risk card${data.note ? `: "${data.note}"` : '.'}`
    case 'mission.completed': return `${data.user_name || 'A team member'} completed the mission "${data.mission_name}".`
    default: return String(data.message || '')
  }
}

function getEventUrl(eventType: string, data: Record<string, unknown>): string | null {
  if (data.session_id) return `${APP_URL}/sessions/${data.session_id}/results`
  if (data.project_id) return `${APP_URL}/projects/${data.project_id}`
  return `${APP_URL}/dashboard`
}

// ── Notify Webhooks Helper ────────────────────────────────────────────────────

export async function notifyWebhooks(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<{ sent: number; errors: string[] }> {
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('provider, config, status')
    .eq('organization_id', orgId)
    .in('provider', ['slack', 'teams'])
    .eq('status', 'active')

  if (!connections?.length) return { sent: 0, errors: [] }

  const errors: string[] = []
  let sent = 0

  for (const conn of connections) {
    const webhookUrl = conn.config?.webhook_url
    if (!webhookUrl) continue

    try {
      const payload = conn.provider === 'teams'
        ? buildTeamsPayload(eventType, data)
        : buildSlackPayload(eventType, data)

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        sent++
      } else {
        errors.push(`${conn.provider}: ${res.status} ${res.statusText}`)
      }
    } catch (e) {
      errors.push(`${conn.provider}: ${(e as Error).message}`)
    }
  }

  return { sent, errors }
}

// ── HTTP Handler (manual trigger) ─────────────────────────────────────────────

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
    const { org_id, event_type, data } = await req.json()
    if (!org_id || !event_type) throw new Error('org_id and event_type required')

    const result = await notifyWebhooks(supabase, org_id, event_type, data || {})

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
