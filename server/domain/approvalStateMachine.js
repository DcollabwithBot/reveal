const APPROVAL_STATES = {
  ADVISORY: 'advisory',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied'
};

const VALID_TRANSITIONS = {
  [APPROVAL_STATES.ADVISORY]: [APPROVAL_STATES.PENDING_APPROVAL],
  [APPROVAL_STATES.PENDING_APPROVAL]: [APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED],
  [APPROVAL_STATES.APPROVED]: [APPROVAL_STATES.APPLIED],
  [APPROVAL_STATES.REJECTED]: [],
  [APPROVAL_STATES.APPLIED]: []
};

/**
 * Transition state for Sprint 1 approval flow skeleton.
 * No direct PM write path from game layer.
 */
function transitionApprovalState({ currentState, nextState, actor }) {
  if (!VALID_TRANSITIONS[currentState]) {
    throw new Error(`Unknown current state: ${currentState}`);
  }

  if (!VALID_TRANSITIONS[currentState].includes(nextState)) {
    throw new Error(`Invalid transition: ${currentState} -> ${nextState}`);
  }

  if (currentState === APPROVAL_STATES.ADVISORY && actor !== 'game') {
    throw new Error('Only game can create advisory recommendations');
  }

  if (
    currentState === APPROVAL_STATES.PENDING_APPROVAL &&
    [APPROVAL_STATES.APPROVED, APPROVAL_STATES.REJECTED].includes(nextState) &&
    actor !== 'pm'
  ) {
    throw new Error('Only PM can approve or reject write-back requests');
  }

  if (currentState === APPROVAL_STATES.APPROVED && nextState === APPROVAL_STATES.APPLIED && actor !== 'system') {
    throw new Error('Only system apply pipeline can mark approved requests as applied');
  }

  return nextState;
}

module.exports = {
  APPROVAL_STATES,
  VALID_TRANSITIONS,
  transitionApprovalState
};
