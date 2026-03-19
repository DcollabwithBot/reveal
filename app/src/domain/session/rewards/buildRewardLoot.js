export function buildRewardLoot({ rewardRule, combo = 0, rootCauseCount = 0, lifelineUsed = false, colors = {} }) {
  const xpBase = Number(rewardRule?.rule?.xpBase ?? 45);
  const comboMultiplier = Number(rewardRule?.rule?.comboMultiplier ?? 5);
  const rewardBadges = rewardRule?.rule?.rewardBadges || [];

  const loot = [
    { icon: '💎', label: `+${xpBase + combo * comboMultiplier} XP`, color: colors.xp || '#57d6ff' }
  ];

  const hasBadge = (badge) => rewardBadges.some((b) => b?.badge === badge);

  if (rootCauseCount > 0 && hasBadge('risk-badge')) {
    loot.push({ icon: '🔍', label: 'Risk Badge', color: colors.acc || '#5eead4' });
  }
  if (combo >= 3 && hasBadge('streak-bonus')) {
    loot.push({ icon: '🔥', label: 'Streak Bonus', color: colors.org || '#f59e0b' });
  }
  if (lifelineUsed && hasBadge('power-badge')) {
    loot.push({ icon: '⚡', label: 'Power Badge', color: colors.pur || '#a78bfa' });
  }
  if (hasBadge('session-star')) {
    loot.push({ icon: '⭐', label: 'Session Star', color: colors.gld || '#facc15' });
  }

  return loot;
}
