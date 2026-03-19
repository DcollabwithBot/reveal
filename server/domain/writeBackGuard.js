/**
 * Guardrail: game layer cannot directly mutate PM source-of-truth.
 * Allowed writes require approved request + PM/SYSTEM actor.
 */
function assertWriteBackAllowed({ actor, sourceLayer, hasApprovedRequest }) {
  if (sourceLayer === 'game' && actor !== 'pm' && actor !== 'system') {
    throw new Error('Unauthorized direct game->PM mutation blocked');
  }

  if (!hasApprovedRequest) {
    throw new Error('Write-back requires PM approval first');
  }

  return true;
}

module.exports = {
  assertWriteBackAllowed
};
