const { APPROVAL_STATES, transitionApprovalState } = require('./approvalStateMachine');

const TARGET_TABLE_BY_TYPE = {
  project: 'projects',
  sprint: 'sprints',
  item: 'session_items',
  session_item: 'session_items'
};

function sanitizePatch(targetType, patch = {}) {
  const allowedByType = {
    project: ['name', 'description', 'status', 'color', 'icon'],
    sprint: ['name', 'goal', 'status', 'start_date', 'end_date'],
    item: ['title', 'description', 'priority', 'item_status', 'progress', 'assigned_to', 'estimated_hours', 'actual_hours'],
    session_item: ['title', 'description', 'priority', 'item_status', 'progress', 'assigned_to', 'estimated_hours', 'actual_hours']
  };

  const allowed = allowedByType[targetType] || [];
  const output = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      output[key] = patch[key];
    }
  }

  if (Object.keys(output).length === 1) {
    throw new Error(`Requested patch has no allowed fields for target type: ${targetType}`);
  }

  return output;
}

function createTargetAppliers({ supabase }) {
  async function applyToTable({ table, targetId, organizationId, patch }) {
    const query = supabase
      .from(table)
      .update(patch)
      .eq('id', targetId);

    const scopedQuery = organizationId ? query.eq('organization_id', organizationId) : query;

    const { data, error } = await scopedQuery.select('*').single();
    if (error) throw new Error(error.message || `Failed to apply patch to ${table}`);
    return data;
  }

  return {
    async project(ctx) {
      return applyToTable({ table: 'projects', ...ctx });
    },
    async sprint(ctx) {
      return applyToTable({ table: 'sprints', ...ctx });
    },
    async item(ctx) {
      return applyToTable({ table: 'session_items', ...ctx });
    },
    async session_item(ctx) {
      return applyToTable({ table: 'session_items', ...ctx });
    }
  };
}

function resolveTargetType(targetType) {
  const normalized = String(targetType || '').trim().toLowerCase();
  if (!TARGET_TABLE_BY_TYPE[normalized]) {
    throw new Error(`Unsupported approval target type: ${targetType}`);
  }
  return normalized;
}

async function applyApprovedRequest({
  supabase,
  approvalRequest,
  appliedBy,
  actor = 'system',
  appendLedgerEvent,
  appendAuditLog
}) {
  const targetType = resolveTargetType(approvalRequest.target_type);

  const nextState = transitionApprovalState({
    currentState: approvalRequest.state,
    nextState: APPROVAL_STATES.APPLIED,
    actor
  });

  const patch = sanitizePatch(targetType, approvalRequest.requested_patch || {});
  const targetAppliers = createTargetAppliers({ supabase });

  const applyStartedKey = `approval:${approvalRequest.id}:apply:start`;
  await appendLedgerEvent({
    eventType: 'approval.request.apply.started',
    source: 'system',
    idempotencyKey: applyStartedKey,
    payload: {
      approval_request_id: approvalRequest.id,
      target_type: targetType,
      target_id: approvalRequest.target_id
    }
  });

  const appliedEntity = await targetAppliers[targetType]({
    targetId: approvalRequest.target_id,
    organizationId: approvalRequest.organization_id,
    patch
  });

  const { data: updatedApproval, error: approvalError } = await supabase
    .from('approval_requests')
    .update({
      state: nextState,
      applied_at: new Date().toISOString(),
      applied_by: appliedBy,
      updated_at: new Date().toISOString()
    })
    .eq('id', approvalRequest.id)
    .eq('state', approvalRequest.state)
    .select('*')
    .single();

  if (approvalError) {
    throw new Error(approvalError.message || 'Failed to update approval request state to applied');
  }

  await appendLedgerEvent({
    eventType: 'approval.request.applied',
    source: 'system',
    idempotencyKey: `approval:${approvalRequest.id}:applied`,
    payload: {
      from: approvalRequest.state,
      to: nextState,
      target_type: targetType,
      target_id: approvalRequest.target_id,
      target_snapshot: appliedEntity
    }
  });

  await appendAuditLog({
    eventType: 'approval.request.state_transition',
    actor,
    sourceLayer: 'system',
    organizationId: updatedApproval.organization_id,
    teamId: updatedApproval.team_id,
    targetType: updatedApproval.target_type,
    targetId: updatedApproval.target_id,
    approvalRequestId: updatedApproval.id,
    payload: {
      from: approvalRequest.state,
      to: nextState,
      applied_patch: patch,
      target_type: targetType
    }
  });

  return { updatedApproval, appliedEntity, targetType };
}

module.exports = {
  TARGET_TABLE_BY_TYPE,
  sanitizePatch,
  resolveTargetType,
  createTargetAppliers,
  applyApprovedRequest
};
