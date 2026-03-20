import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Jira Shadow Sync ──────────────────────────────────────────────────────────
// Conflict rules:
//   Reveal owns: estimated_hours, actual_hours, confidence, risk_cards, game state
//   Jira owns: title, description, status, assignee, priority
//   Reveal fields are NEVER overwritten by Jira

function mapJiraStatus(jiraStatus: string): string {
  const s = (jiraStatus || '').toLowerCase()
  if (['done', 'closed', 'resolved'].includes(s)) return 'done'
  if (['in progress', 'in review', 'in development'].includes(s)) return 'in_progress'
  if (['to do', 'open', 'new', 'backlog'].includes(s)) return 'backlog'
  return 'backlog'
}

function mapJiraPriority(jiraPriority: string): string {
  const p = (jiraPriority || '').toLowerCase()
  if (['highest', 'blocker', 'critical'].includes(p)) return 'critical'
  if (['high', 'major'].includes(p)) return 'high'
  if (['medium', 'normal'].includes(p)) return 'medium'
  return 'low'
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

  // Auth
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
    const { org_id } = body

    // Get all active Jira connections for this org (or all orgs if triggered by cron)
    let query = supabase
      .from('integration_connections')
      .select('*')
      .eq('provider', 'jira')
      .eq('status', 'active')

    if (org_id) {
      query = query.eq('organization_id', org_id)
    }

    const { data: connections } = await query
    if (!connections?.length) {
      return new Response(JSON.stringify({ synced: 0, message: 'No active Jira connections' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = []

    for (const conn of connections) {
      const config = conn.config || {}
      const baseUrl = config.base_url
      const apiToken = config.api_token
      const email = config.email
      const projectKey = config.project_key

      if (!baseUrl || !apiToken || !projectKey) {
        results.push({ connection_id: conn.id, error: 'Missing config (base_url, api_token, or project_key)' })
        continue
      }

      // Build JQL — only issues updated since last sync
      const lastSync = conn.last_sync_at || '2020-01-01T00:00:00Z'
      const lastSyncFormatted = new Date(lastSync).toISOString().split('T')[0] + ' ' +
        new Date(lastSync).toISOString().split('T')[1].split('.')[0]

      const jql = `project = ${projectKey} AND updated >= "${lastSyncFormatted}" ORDER BY updated DESC`
      const jiraUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,description,status,priority,assignee,updated,timetracking`

      // Fetch from Jira
      const authString = email ? btoa(`${email}:${apiToken}`) : btoa(`:${apiToken}`)
      const jiraRes = await fetch(jiraUrl, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      })

      if (!jiraRes.ok) {
        const errText = await jiraRes.text().catch(() => jiraRes.statusText)
        results.push({ connection_id: conn.id, error: `Jira API error: ${jiraRes.status} ${errText.slice(0, 200)}` })
        continue
      }

      const jiraData = await jiraRes.json()
      const issues = jiraData.issues || []
      let synced = 0
      const errors: string[] = []

      for (const issue of issues) {
        const externalId = issue.key
        const fields = issue.fields || {}

        // Only update Jira-owned fields (title, description, status, assignee, priority)
        // NEVER touch: estimated_hours, actual_hours, confidence, risk_cards, game state
        const upsertData: Record<string, unknown> = {
          external_id: externalId,
          external_source: 'jira',
          title: fields.summary || externalId,
          description: typeof fields.description === 'string'
            ? fields.description
            : (fields.description?.content?.[0]?.content?.[0]?.text || null),
          item_status: mapJiraStatus(fields.status?.name || ''),
          priority: mapJiraPriority(fields.priority?.name || ''),
          assigned_to: fields.assignee?.displayName || fields.assignee?.emailAddress || null,
          updated_at: new Date().toISOString(),
        }

        // Check if item already exists
        const { data: existing } = await supabase
          .from('session_items')
          .select('id')
          .eq('external_id', externalId)
          .eq('external_source', 'jira')
          .maybeSingle()

        if (existing) {
          // Update only Jira-owned fields
          const { error: updateErr } = await supabase
            .from('session_items')
            .update({
              title: upsertData.title,
              description: upsertData.description,
              item_status: upsertData.item_status,
              priority: upsertData.priority,
              assigned_to: upsertData.assigned_to,
              updated_at: upsertData.updated_at,
            })
            .eq('id', existing.id)

          if (updateErr) {
            errors.push(`Update ${externalId}: ${updateErr.message}`)
          } else {
            synced++
          }
        }
        // Note: We don't INSERT new items during sync — only update existing ones
        // New items come through the jira-import flow
      }

      // Update last_sync_at
      await supabase
        .from('integration_connections')
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', conn.id)

      // Log sync
      await supabase.from('jira_sync_log').insert({
        organization_id: conn.organization_id,
        provider: 'jira',
        action: 'shadow_sync',
        items_synced: synced,
        errors: errors.length ? errors : [],
      })

      results.push({ connection_id: conn.id, synced, total_issues: issues.length, errors })
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ── Supabase Cron Setup (documentation) ───────────────────────────────────────
// To set up periodic sync, run this in Supabase Dashboard → Database → Cron:
//
// SELECT cron.schedule('jira-sync', '*/15 * * * *', $$
//   SELECT net.http_post(
//     url := '<SUPABASE_URL>/functions/v1/jira-sync',
//     headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
//     body := '{}'::jsonb
//   );
// $$);
