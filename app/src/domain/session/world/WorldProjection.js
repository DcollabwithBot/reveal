/**
 * WorldProjection.js — Pure world projection from RootState + config.
 *
 * Builds the complete world view: theme, player, encounter, progress,
 * rewards, governance, and UI flags. No side effects, no API calls.
 */

import { projectBossEncounter } from '../boss/bossProjection.js';
import { projectApprovalOverlay } from '../governance/approvalProjection.js';
import { buildRewardLoot } from '../rewards/buildRewardLoot.js';

/**
 * Derive difficulty from mode + voting spread.
 */
function deriveDifficulty(mode, spread) {
  if (mode === 'boss-retro') return 'boss';
  if (spread > 5) return 'hard';
  if (spread > 2) return 'normal';
  return 'trivial';
}

/**
 * Derive player energy level from combo count.
 */
function deriveEnergy(combo) {
  if (combo >= 3) return 'high';
  if (combo >= 1) return 'medium';
  return 'low';
}

/**
 * Derive tone from difficulty.
 */
function deriveTone(difficulty) {
  if (difficulty === 'boss') return 'epic';
  if (difficulty === 'hard') return 'tense';
  return 'calm';
}

/**
 * Project complete world state from root + config.
 *
 * @param {object} root - RootState (from builder.js or selectors.js)
 * @param {object|null} config - ProjectionConfig from DB
 * @param {object} colors - Color map for approval/reward rendering
 * @returns {WorldProjection}
 */
export function projectWorldFull(root, config, colors = {}) {
  const boss = projectBossEncounter({
    projectionConfig: config,
    node: root.node,
    project: root.project,
    bossKey: 'delivery-pressure-default',
  });

  const approval = projectApprovalOverlay(root.approvalState, colors);

  const rewardRule = (config?.rewardRules || []).find(
    (rule) => rule.key === 'session-complete-default'
  ) || null;

  const rewardPreview = buildRewardLoot({
    rewardRule,
    combo: root.combo || 0,
    rootCauseCount: root.rootCauseCount || 0,
    lifelineUsed: Boolean(root.lifelineUsed),
    colors,
  });

  const difficulty = deriveDifficulty(root.mode, root.voting?.spread ?? 0);
  const progressCurrent = root.step || 0;
  const progressTotal = root.mode === 'boss-retro' ? 5 : 4;

  return {
    theme: {
      worldId: root.mode,
      worldLabel: root.mode === 'boss-retro'
        ? 'Retro Dungeon'
        : root.mode === 'roulette'
          ? 'Roulette Arena'
          : 'Planning Arena',
      zoneLabel: boss.bossName,
      tone: deriveTone(difficulty),
    },

    player: {
      level: 3,
      xp: 45 + (root.combo || 0) * 5,
      streak: root.combo || 0,
      energy: deriveEnergy(root.combo || 0),
    },

    encounter: {
      bossId: boss.bossProfile?.key || null,
      bossLabel: boss.bossName,
      challengeId: root.activeChallenge?.id || null,
      challengeLabel: root.activeChallenge?.title || null,
      difficulty,
      maxHp: boss.maxHp,
      bossDamageMultiplier: boss.bossDamageMultiplier,
    },

    progress: {
      current: progressCurrent,
      total: progressTotal,
      percent: progressTotal ? Math.round((progressCurrent / progressTotal) * 100) : 0,
      statusLabel: difficulty === 'boss'
        ? 'Boss fight'
        : difficulty === 'hard'
          ? 'High variance'
          : 'Stable run',
    },

    rewards: {
      previewXp: 45 + (root.combo || 0) * 5,
      previewLoot: rewardPreview,
      unlocks: [],
    },

    governance: {
      approvalLabel: approval.label,
      approvalColor: approval.color,
      warning: approval.state === 'pending_approval' ? 'Approval pending' : null,
      canSubmitAdvisory: approval.canSubmitAdvisory,
    },

    ui: {
      showBossPanel: true,
      showRewardPreview: (root.step || 0) === 4,
      showApprovalGate: root.approvalState === 'pending_approval',
      showChallengePrompt: root.mode === 'roulette' && root.ready && !root.activeChallenge,
    },
  };
}

/**
 * Get a combined session view model from root + config.
 * Import buildChallengeModel from ChallengeModel.js at call-site
 * to avoid circular dependencies.
 */
export function getSessionViewModelFromWorld(root, config, colors, buildChallengeFn) {
  const world = projectWorldFull(root, config, colors);
  const challenge = buildChallengeFn ? buildChallengeFn(root, world) : null;
  return { world, challenge };
}
