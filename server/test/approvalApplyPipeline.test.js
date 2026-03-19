const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizePatch,
  normalizePatch,
  sanitizeAndNormalizePatch,
  resolveTargetType,
  applyApprovedRequest
} = require('../domain/approvalApplyPipeline');

test('resolveTargetType supports project/sprint/item aliases', () => {
  assert.equal(resolveTargetType('project'), 'project');
  assert.equal(resolveTargetType('sprint'), 'sprint');
  assert.equal(resolveTargetType('item'), 'item');
  assert.equal(resolveTargetType('session_item'), 'session_item');
  assert.throws(() => resolveTargetType('epic'), /Unsupported approval target type/);
});

test('sanitizePatch keeps only allowed fields per target', () => {
  const patch = sanitizePatch('project', { name: 'Nyt navn', status: 'active', sneaky: 'x' });
  assert.equal(patch.name, 'Nyt navn');
  assert.equal(patch.status, 'active');
  assert.equal(patch.sneaky, undefined);
  assert.ok(patch.updated_at);
});

test('normalizePatch enforces allowed values and derives item state/progress', () => {
  const itemPatch = normalizePatch('session_item', { progress: 100 });
  assert.equal(itemPatch.progress, 100);
  assert.equal(itemPatch.item_status, 'done');

  const itemStatusPatch = normalizePatch('session_item', { item_status: 'backlog' });
  assert.equal(itemStatusPatch.progress, 0);

  assert.throws(() => normalizePatch('project', { status: 'at_risk' }), /Invalid project.status/);
  assert.throws(() => normalizePatch('session_item', { priority: 'urgent' }), /Invalid item.priority/);
});

test('sanitizeAndNormalizePatch applies whitelist before normalization', () => {
  const patch = sanitizeAndNormalizePatch('session_item', {
    progress: 42,
    priority: 'high',
    sneaky: 'ignored'
  });

  assert.equal(patch.progress, 42);
  assert.equal(patch.priority, 'high');
  assert.equal(patch.item_status, 'in_progress');
  assert.equal(patch.sneaky, undefined);
});

function createSupabaseStub() {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const state = { table, filters: [] };
      return {
        update(payload) {
          state.payload = payload;
          return this;
        },
        eq(key, value) {
          state.filters.push([key, value]);
          return this;
        },
        select() {
          return this;
        },
        async single() {
          calls.push({ ...state });
          if (table === 'approval_requests') {
            return { data: { id: 'ar_1', state: 'applied', organization_id: 'org_1', team_id: 'team_1', target_type: 'project', target_id: 'p_1' }, error: null };
          }
          return { data: { id: 'p_1', status: state.payload.status, name: 'Patched project' }, error: null };
        }
      };
    }
  };
  return client;
}

test('applyApprovedRequest applies target patch + marks approval applied', async () => {
  const supabase = createSupabaseStub();
  const ledgerEvents = [];
  const audits = [];

  const result = await applyApprovedRequest({
    supabase,
    approvalRequest: {
      id: 'ar_1',
      state: 'approved',
      organization_id: 'org_1',
      team_id: 'team_1',
      target_type: 'project',
      target_id: 'p_1',
      requested_patch: { status: 'on_hold' }
    },
    appliedBy: 'user_1',
    actor: 'system',
    appendLedgerEvent: async (event) => ledgerEvents.push(event),
    appendAuditLog: async (audit) => audits.push(audit)
  });

  assert.equal(result.targetType, 'project');
  assert.equal(result.updatedApproval.state, 'applied');
  assert.equal(result.appliedEntity.status, 'on_hold');
  assert.equal(ledgerEvents.length, 2);
  assert.equal(ledgerEvents[0].eventType, 'approval.request.apply.started');
  assert.equal(ledgerEvents[1].eventType, 'approval.request.applied');
  assert.equal(audits.length, 1);
});
