import { useGameMode } from './GameModeContext';

// Returnerer true/false for individuelle features baseret på game_mode
export function useGameFeature(feature) {
  const { gameMode } = useGameMode();

  const features = {
    focus: {
      xpBadges: false,
      rarityStrips: false,
      gameWidget: false,
      bossHp: false,
      particles: false,
      sideQuests: false,
      streakBadge: false,
      levelBadge: false,
    },
    engaged: {
      xpBadges: true,
      rarityStrips: true,
      gameWidget: true,
      bossHp: false,
      particles: false,
      sideQuests: true,
      streakBadge: true,
      levelBadge: true,
    },
    full: {
      xpBadges: true,
      rarityStrips: true,
      gameWidget: true,
      bossHp: true,
      particles: true,
      sideQuests: true,
      streakBadge: true,
      levelBadge: true,
    },
  };

  return features[gameMode]?.[feature] ?? false;
}
