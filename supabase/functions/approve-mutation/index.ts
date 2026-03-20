import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Approval State Machine ────────────────────────────────────────────────────
const APPROVAL_STATES = {
  ADVISORY: 'advisory',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  [APPROVAL_STATES.ADVISORY]: [APPROVAL_STATES.PENDING_APPROVAL],
  [APPROVAL_STATES.PENDING_APPROVAL]: [APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED],
  [APPROVAL_STATES.APPROVED]: [APPROVAL_STATES.APPLIED],
  [APPROVAL_STATES.REJECTED]: [],
  [APPROVAL_STATES.APPLIED]: [],
}

function transitionState(current: string, next: string, actor: string): string {
  if (!VALID_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`Invalid transition: ${current} -> ${next}`)
  }
  if (current === APPROVAL_STATES.PENDING_APPROVAL && [APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED].includes(next) && actor !== 'pm') {
    throw new Error('Only PM can approve or reject')
  }
  if (current === APPROVAL_STATES.APPROVED && next === APPROVAL_STATES.APPLIED && actor !== 'system') {
    throw new Error('Only system can apply')
  }
  return next
}

// ── Apply Pipeline ────────────────────────────────────────────────────────────
const TARGET_TABLE: Record<string, string> = {
  project: 'projects',
  sprint: 'sprints',
  item: 'session_items',
  session_item: 'session_items',
  item_estimate: 'session_items',
}

const ALLOWED_FIELDS: Record<string, string[]> = {
  project: ['name', 'description', 'status', 'color', 'icon'],
  sprint: ['name', 'goal', 'status', 'start_date', 'end_date'],
  item: ['title', 'description', 'priority', 'item_status', 'progress', 'assigned_to', 'estimated_hours', 'actual_hours'],
  session_item: ['title', 'description', 'priority', 'item_status', 'progress', 'assigned_to', 'estimated_hours', 'actual_hours'],
  item_estimate: ['estimated_hours'],
}

function sanitizePatch(targetType: string, patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[targetType] || []
  const output: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      output[key] = patch[key]
    }
  }
  if (Object.keys(output).length === 1) {
    throw new Error(`No allowed fields for target type: ${targetType}`)
  }
  return output
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
    const { approvalId, action, reason } = body

    if (!approvalId || !action) {
      return new Response(JSON.stringify({ error: 'approvalId and action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: current, error: fetchErr } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', approvalId)
      .maybeSingle()

    if (fetchErr || !current) {
      return new Response(JSON.stringify({ error: 'Approval request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'approve') {
      const nextState = transitionState(current.state, APPROVAL_STATES.APPROVED, 'pm')
      const { data, error } = await supabase
        .from('approval_requests')
        .update({
          state: nextState,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      // Audit log
      await supabase.from('audit_log').insert({
        event_type: 'approval.request.state_transition',
        actor: 'pm',
        source_layer: 'pm',
        organization_id: data.organization_id,
        team_id: data.team_id,
        target_type: data.target_type,
        target_id: data.target_id,
        approval_request_id: data.id,
        payload: { from: current.state, to: nextState },
        outcome: 'accepted',
      })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'reject') {
      const nextState = transitionState(current.state, APPROVAL_STATES.REJECTED, 'pm')
      const { data, error } = await supabase
        .from('approval_requests')
        .update({
          state: nextState,
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      await supabase.from('audit_log').insert({
        event_type: 'approval.request.state_transition',
        actor: 'pm',
        source_layer: 'pm',
        organization_id: data.organization_id,
        team_id: data.team_id,
        target_type: data.target_type,
        target_id: data.target_id,
        approval_request_id: data.id,
        payload: { from: current.state, to: nextState, reason: data.rejection_reason },
        outcome: 'accepted',
      })

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'apply') {
      const targetType = String(current.target_type || '').toLowerCase()
      const table = TARGET_TABLE[targetType]
      if (!table) throw new Error(`Unsupported target type: ${targetType}`)

      const nextState = transitionState(current.state, APPROVAL_STATES.APPLIED, 'system')
      const patch = sanitizePatch(targetType, current.requested_patch || {})

      // Apply patch to target
      const { data: appliedEntity, error: applyErr } = await supabase
        .from(table)
        .update(patch)
        .eq('id', current.target_id)
        .select('*')
        .single()

      if (applyErr) throw new Error(applyErr.message)

      // Update approval state
      const { data: updatedApproval, error: approvalErr } = await supabase
        .from('approval_requests')
        .update({
          state: nextState,
          applied_at: new Date().toISOString(),
          applied_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('*')
        .single()

      if (approvalErr) throw new Error(approvalErr.message)

      await supabase.from('audit_log').insert({
        event_type: 'approval.request.state_transition',
        actor: 'system',
        source_layer: 'system',
        organization_id: updatedApproval.organization_id,
        team_id: updatedApproval.team_id,
        target_type: updatedApproval.target_type,
        target_id: updatedApproval.target_id,
        approval_request_id: updatedApproval.id,
        payload: { from: current.state, to: nextState, applied_patch: patch },
        outcome: 'accepted',
      })

      return new Response(JSON.stringify({
        approval_request: updatedApproval,
        applied_target: { type: targetType, id: current.target_id, entity: appliedEntity }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
