import { getChallengeBonusHp } from '../boss/bossProjection.js';

export function buildChallenge(root, world) {
  if (root.mode !== 'roulette') return null;

  if (!root.activeChallenge) {
    return {
      id: 'roulette-draw',
      kind: 'side-quest',
      objective: {
        title: 'Træk challenge',
        description: 'Spin roulette og få et curveball til re-estimering.',
        winCondition: 'En challenge er trukket',
      },
      rules: {
        canStart: Boolean(root.ready),
        blockedReason: root.ready ? null : 'Vent på team votes',
        requiresApproval: false,
        writebackOnComplete: false,
        modifier: 1,
      },
      rewards: {
        xp: 0,
        loot: [],
      },
      actions: {
        primaryLabel: '🎰 TRÆK CHALLENGE!'
      },
    };
  }

  const modifier = Number(root.activeChallenge?.modifier || 1);
  const bossBonusHp = getChallengeBonusHp(world.encounter.maxHp, modifier);

  return {
    id: root.activeChallenge?.id || root.activeChallenge?.title || 'active-challenge',
    kind: 'side-quest',
    objective: {
      title: root.activeChallenge?.title || 'Aktiv challenge',
      description: root.activeChallenge?.description || 'Re-estimér efter curveball.',
      winCondition: 'Nyt estimat er valgt og reveal kan gennemføres',
      failureState: 'Challenge ignoreres og estimat bliver misvisende',
    },
    rules: {
      canStart: true,
      blockedReason: null,
      requiresApproval: false,
      writebackOnComplete: false,
      modifier,
    },
    rewards: {
      xp: 0,
      loot: [],
      bossDamage: bossBonusHp,
    },
    actions: {
      primaryLabel: 'RE-ESTIMER OG ANGRIB!',
      completeLabel: '⚔️ REVEAL ATTACK!',
    },
  };
}
