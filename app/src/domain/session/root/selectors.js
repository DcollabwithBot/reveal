export function buildVotingSummary(selectedVote, votes = []) {
  const allV = selectedVote !== null && selectedVote !== undefined
    ? [{ mid: 1, val: selectedVote }, ...votes]
    : [];

  const averageNumber = allV.length
    ? allV.reduce((sum, vote) => sum + vote.val, 0) / allV.length
    : 0;

  const spread = allV.length
    ? Math.max(...allV.map((vote) => vote.val)) - Math.min(...allV.map((vote) => vote.val))
    : 0;

  return {
    allVotes: allV,
    averageNumber,
    averageDisplay: allV.length ? averageNumber.toFixed(1) : 0,
    spread,
    roundedEstimate: allV.length ? Math.round(averageNumber) : 0,
  };
}

export function buildRootState({
  selectedVote,
  votes = [],
  approvalState = null,
  projectionConfig = null,
  node = null,
  project = null,
}) {
  const voting = buildVotingSummary(selectedVote, votes);

  return {
    mode: node?.tp === 'b' ? 'boss-retro' : node?.tp === 'r' ? 'roulette' : 'poker',
    nodeId: node?.id || null,
    projectId: project?.id || null,
    approvalState,
    projectionConfig,
    voting,
  };
}
