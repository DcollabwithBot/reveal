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

export function mapAchievementsByKey(achievements = []) {
  const map = {};
  for (const achievement of achievements || []) {
    map[achievement.key] = {
      id: achievement.key,
      name: achievement.name,
      icon: achievement.icon,
      desc: achievement.description
    };
  }
  return map;
}

export function createAchievementResolver(configAchievements = [], fallbackAchievements = []) {
  const configMap = mapAchievementsByKey(configAchievements);
  const fallbackMap = {};
  for (const achievement of fallbackAchievements || []) {
    fallbackMap[achievement.id] = achievement;
  }

  return function resolve(keyOrAchievement) {
    if (!keyOrAchievement) return null;
    if (typeof keyOrAchievement === 'string') {
      return configMap[keyOrAchievement] || fallbackMap[keyOrAchievement] || null;
    }
    if (keyOrAchievement.id) {
      return configMap[keyOrAchievement.id] || keyOrAchievement;
    }
    return null;
  };
}

export function resolveAchievement(map, fallback) {
  if (!fallback?.id) return fallback;
  return map[fallback.id] || fallback;
}

export function resolveBossProfile(config, key = 'delivery-pressure-default') {
  const profiles = config?.bossProfiles || [];
  return profiles.find((profile) => profile.key === key) || profiles[0] || null;
}

export function getBossHpBase(bossProfile, fallback = 100) {
  return Number(bossProfile?.rules?.hpBase ?? fallback);
}

export function getBossDamageMultiplier(bossProfile, fallback = 2) {
  const hpScale = bossProfile?.rules?.hpScale || {};
  const values = Object.values(hpScale).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!values.length) return fallback;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.max(1, Math.round(avg / 6));
}

export function getChallengeBonusHp(maxHp, modifier = 1) {
  return Math.round(maxHp * (modifier - 1.0) * 0.4);
}
