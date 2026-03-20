const test = require('node:test');
const assert = require('node:assert/strict');

const { APPROVAL_STATES, transitionApprovalState } = require('../domain/approvalStateMachine');

test('approval state machine: supports advisory -> pending_approval -> approved -> applied', () => {
  let state = APPROVAL_STATES.ADVISORY;
  state = transitionApprovalState({ currentState: state, nextState: APPROVAL_STATES.PENDING_APPROVAL, actor: 'game' });
  assert.equal(state, APPROVAL_STATES.PENDING_APPROVAL);

  state = transitionApprovalState({ currentState: state, nextState: APPROVAL_STATES.APPROVED, actor: 'pm' });
  assert.equal(state, APPROVAL_STATES.APPROVED);

  state = transitionApprovalState({ currentState: state, nextState: APPROVAL_STATES.APPLIED, actor: 'system' });
  assert.equal(state, APPROVAL_STATES.APPLIED);
});

test('approval state machine: supports rejection path', () => {
  const rejected = transitionApprovalState({
    currentState: APPROVAL_STATES.PENDING_APPROVAL,
    nextState: APPROVAL_STATES.REJECTED,
    actor: 'pm'
  });
  assert.equal(rejected, APPROVAL_STATES.REJECTED);
});

test('approval state machine: blocks unauthorized/non-linear transitions', () => {
  assert.throws(
    () => transitionApprovalState({ currentState: APPROVAL_STATES.PENDING_APPROVAL, nextState: APPROVAL_STATES.APPROVED, actor: 'game' }),
    /Only PM/
  );

  assert.throws(
    () => transitionApprovalState({ currentState: APPROVAL_STATES.ADVISORY, nextState: APPROVAL_STATES.APPLIED, actor: 'game' }),
    /Invalid transition/
  );
});
