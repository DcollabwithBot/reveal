const test = require('node:test');
const assert = require('node:assert/strict');

const { assertPmMutationAllowed } = require('../domain/pmMutationPolicy');
const { APPROVAL_STATES } = require('../domain/approvalStateMachine');

test('pm mutation policy: blocks game-origin writes without approved request', () => {
  assert.throws(
    () => assertPmMutationAllowed({ actor: 'game', sourceLayer: 'game', approvalState: APPROVAL_STATES.PENDING_APPROVAL }),
    /Unauthorized direct game->PM mutation blocked/
  );
});

test('pm mutation policy: allows PM when approval state is approved/applied', () => {
  assert.equal(
    assertPmMutationAllowed({ actor: 'pm', sourceLayer: 'game', approvalState: APPROVAL_STATES.APPROVED }),
    true
  );
  assert.equal(
    assertPmMutationAllowed({ actor: 'system', sourceLayer: 'game', approvalState: APPROVAL_STATES.APPLIED }),
    true
  );
});

test('pm mutation policy: non-game source bypasses approval gate', () => {
  assert.equal(assertPmMutationAllowed({ actor: 'pm', sourceLayer: 'pm', approvalState: null }), true);
});
