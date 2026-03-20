const { assertWriteBackAllowed } = require('./writeBackGuard');
const { APPROVAL_STATES } = require('./approvalStateMachine');

function assertPmMutationAllowed({ actor, sourceLayer, approvalState }) {
  if (sourceLayer !== 'game') return true;

  const hasApprovedRequest = approvalState === APPROVAL_STATES.APPROVED || approvalState === APPROVAL_STATES.APPLIED;
  return assertWriteBackAllowed({ actor, sourceLayer, hasApprovedRequest });
}

module.exports = {
  assertPmMutationAllowed
};
