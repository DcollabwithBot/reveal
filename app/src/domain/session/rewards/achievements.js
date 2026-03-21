export const FALLBACK_ACHIEVEMENTS = [
  { id: 'first', name: 'FIRST BLOOD', icon: '🩸', desc: 'Første vote i sessionen' },
  { id: 'risk', name: 'RISK HUNTER', icon: '🔍', desc: 'Spillede et risk card' },
  { id: 'power', name: 'POWER PLAYER', icon: '⚡', desc: 'Brugte en power-up' },
  { id: 'sniper', name: 'ESTIMATION SNIPER', icon: '🎯', desc: 'Ramte tæt på gennemsnittet' },
  { id: 'team', name: 'TEAM PLAYER', icon: '🤝', desc: 'Alle havde lav spredning' },
  { id: 'brave', name: 'BRAVE SOUL', icon: '💪', desc: 'Confidence 5/5' },
  { id: 'roulette', name: 'SCOPE SURVIVOR', icon: '🎰', desc: 'Overlevede en Roulette-udfordring' },
  { id: 'oracle', name: 'ORACLE', icon: '🔮', desc: 'Forudså et problem før sprinten' },
  { id: 'honest', name: 'RADICAL HONESTY', icon: '🪞', desc: 'Anerkendte 5+ problemer' },
  { id: 'aligned', name: 'HIVE MIND', icon: '🧠', desc: '100% team enighed om root cause' },
  { id: 'learner', name: 'NEVER AGAIN', icon: '🎓', desc: 'Confidence 5/5 på alle problems' },
  { id: 'prophet', name: 'PROPHET', icon: '⭐', desc: 'Forudså 3+ problemer' },
  { id: 'detective', name: 'DETECTIVE', icon: '🕵️', desc: 'Markerede et risk card' },
];

export function mapAchievementsByKey(achievements = []) {
  const map = {};
  for (const achievement of achievements || []) {
    map[achievement.key] = {
      id: achievement.key,
      name: achievement.name,
      icon: achievement.icon,
      desc: achievement.description,
    };
  }
  return map;
}

export function createAchievementResolver(configAchievements = [], fallbackAchievements = FALLBACK_ACHIEVEMENTS) {
  const configMap = mapAchievementsByKey(configAchievements);
  const fallbackMap = {};
  for (const achievement of fallbackAchievements || []) {
    fallbackMap[achievement.id] = achievement;
  }

  return function resolve(keyOrAchievement) {
    if (!keyOrAchievement) return { id: 'unknown', name: 'UNLOCKED', icon: '🏆', desc: '' };
    if (typeof keyOrAchievement === 'string') {
      return configMap[keyOrAchievement] || fallbackMap[keyOrAchievement] || { id: keyOrAchievement, name: keyOrAchievement.toUpperCase(), icon: '🏆', desc: '' };
    }
    if (keyOrAchievement.id) {
      return configMap[keyOrAchievement.id] || { ...keyOrAchievement, icon: keyOrAchievement.icon || '🏆' };
    }
    return { id: 'unknown', name: 'UNLOCKED', icon: '🏆', desc: '' };
  };
}
