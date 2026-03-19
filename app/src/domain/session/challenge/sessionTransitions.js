export function createChallengeCompletionResult({ maxHp, challenge }) {
  const modifier = Number(challenge?.modifier || 1);
  const bonusHp = Math.round(maxHp * (modifier - 1.0) * 0.4);
  return {
    activeChallenge: challenge,
    showRoulette: false,
    revoting: true,
    bonusHp,
    achievementId: 'roulette',
  };
}

export function createVoteResult({ vote, bossDamageMultiplier }) {
  return {
    selectedVote: vote,
    attackDamage: vote * bossDamageMultiplier,
    critical: vote >= 8,
    comboDelta: 1,
    achievementIds: ['first'],
    sound: vote >= 8 ? 'combo' : 'attack',
  };
}

export function createConfidenceResult({ value }) {
  return {
    confidence: value,
    achievementId: value === 5 ? 'brave' : null,
  };
}

export function createLifelineResult({ id, pv, votes = [] }) {
  if (id === 'expert') {
    return {
      lifelineId: id,
      response: '💬 "Denne type tog 8 pts sidst."',
      achievementId: 'power',
    };
  }

  if (id === 'audience') {
    const allVotes = [pv, ...votes.map((vote) => vote.val)].filter((v) => v !== null && v !== undefined);
    const distribution = {};
    allVotes.forEach((vote) => { distribution[vote] = (distribution[vote] || 0) + 1; });

    return {
      lifelineId: id,
      response: `📊 ${Object.entries(distribution).map(([k, v]) => `${k}:${Math.round((v / allVotes.length) * 100)}%`).join(' ')}`,
      achievementId: 'power',
    };
  }

  if (id === '5050') {
    return {
      lifelineId: id,
      response: '✂️ To dårlige antagelser fjernet!',
      achievementId: 'power',
    };
  }

  return {
    lifelineId: id,
    response: '🔮 Afhængighed til team på ferie!',
    achievementId: 'power',
  };
}

export function createVictoryResult({ rewardRule, combo = 0, rootCauseCount = 0, lifelineUsed = false, colors = {}, buildRewardLoot }) {
  const loot = buildRewardLoot({
    rewardRule,
    combo,
    rootCauseCount,
    lifelineUsed,
    colors,
  });

  return {
    step: 4,
    loot,
    showLootDelayMs: 500,
    completeDelayMs: 5000,
    sound: 'victory',
    flashColor: colors.gld,
  };
}
