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

export function projectBossEncounter({ projectionConfig, node, project, bossKey = 'delivery-pressure-default' }) {
  const bossProfile = resolveBossProfile(projectionConfig, bossKey);
  const bossName = node?.l || bossProfile?.name || project?.name || 'PROJ-142: OAuth2 Login Flow';
  const maxHp = getBossHpBase(bossProfile, 100);
  const bossDamageMultiplier = getBossDamageMultiplier(bossProfile, 2);

  return {
    bossProfile,
    bossName,
    maxHp,
    bossDamageMultiplier,
  };
}
