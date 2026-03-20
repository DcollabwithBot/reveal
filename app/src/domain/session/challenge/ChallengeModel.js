/**
 * ChallengeModel.js — Build challenge model from RootState + WorldProjection.
 *
 * Determines the current challenge objective, rules, rewards,
 * and action labels based on mode and active challenge state.
 * Pure function — no side effects, no API calls.
 */

import { getChallengeBonusHp } from '../boss/bossProjection.js';

/**
 * Build a ChallengeModel from root state and world projection.
 *
 * Returns null if mode is not roulette (challenges only apply in roulette mode).
 *
 * @param {object} root - RootState
 * @param {object} world - WorldProjection
 * @returns {ChallengeModel|null}
 */
export function buildChallengeModel(root, world) {
  if (root.mode !== 'roulette') return null;

  // No active challenge — show "draw challenge" prompt
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
        primaryLabel: '🎰 TRÆK CHALLENGE!',
      },
    };
  }

  // Active challenge — build full model
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

/**
 * Determine if a challenge has high stakes (modifier > 1.5).
 */
export function isHighStakes(challenge) {
  return challenge && challenge.rules?.modifier > 1.5;
}

/**
 * Get challenge difficulty label.
 */
export function getChallengeDifficultyLabel(challenge) {
  if (!challenge) return 'none';
  const mod = challenge.rules?.modifier || 1;
  if (mod >= 2) return 'extreme';
  if (mod >= 1.5) return 'hard';
  if (mod >= 1.2) return 'moderate';
  return 'easy';
}
