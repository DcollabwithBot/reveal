/**
 * builder.js — RootState factory
 *
 * Creates and patches the canonical RootState object used by
 * WorldProjection and ChallengeModel. All session facts flow through here.
 */

import { buildVotingSummary } from './selectors.js';

/**
 * Create a full RootState from raw inputs.
 * This is the single entry point for assembling session facts.
 */
export function createRootState({
  sessionId = null,
  avatar = null,
  node = null,
  project = null,
  approvalState = null,
  projectionConfig = null,
  selectedVote = null,
  votes = [],
  step = 0,
  combo = 0,
  ready = false,
  activeChallenge = null,
  rootCauseCount = 0,
  lifelineUsed = false,
  confidence = null,
  revealed = false,
  initialVote = null,
  revoting = false,
  bossHp = 0,
  maxHp = 100,
  achievements = [],
  loot = [],
} = {}) {
  const voting = buildVotingSummary(selectedVote, votes);
  const mode = node?.tp === 'b' ? 'boss-retro' : node?.tp === 'r' ? 'roulette' : 'poker';

  return {
    sessionId,
    mode,
    nodeId: node?.id || null,
    projectId: project?.id || null,

    // Raw references (read-only downstream)
    avatar,
    node,
    project,
    approvalState,
    projectionConfig,

    // Voting
    voting,
    selectedVote,
    initialVote,
    revoting,
    revealed,
    confidence,

    // Progression
    step,
    combo,
    ready,
    activeChallenge,
    rootCauseCount,
    lifelineUsed,
    achievements,
    loot,

    // Battle
    battle: {
      bossHp,
      maxHp,
      bossDead: bossHp <= 0 && maxHp > 0,
    },

    // Flags
    flags: {
      isBossFight: mode === 'boss-retro',
      isRoulette: mode === 'roulette',
      isPoker: mode === 'poker',
      hasBlockingIssue: approvalState === 'pending_approval',
      lootVisible: step >= 4,
    },

    // Telemetry
    telemetry: {
      completedSteps: step,
      totalSteps: mode === 'boss-retro' ? 5 : 4,
    },
  };
}

/**
 * Immutably patch a RootState with partial updates.
 * Recalculates derived fields (voting, flags, battle.bossDead).
 */
export function patchRootState(root, patch = {}) {
  const merged = { ...root, ...patch };

  // Recalculate voting if vote-related fields changed
  if ('selectedVote' in patch || 'votes' in patch) {
    merged.voting = buildVotingSummary(
      merged.selectedVote,
      merged.votes || root.voting?.allVotes?.slice(1)?.map(v => ({ mid: v.mid, val: v.val })) || []
    );
  }

  // Recalculate battle derived
  if ('bossHp' in patch || 'maxHp' in patch) {
    const bossHp = patch.bossHp ?? merged.battle?.bossHp ?? root.battle?.bossHp ?? 0;
    const maxHp = patch.maxHp ?? merged.battle?.maxHp ?? root.battle?.maxHp ?? 100;
    merged.battle = { bossHp, maxHp, bossDead: bossHp <= 0 && maxHp > 0 };
  }

  // Recalculate flags
  merged.flags = {
    ...root.flags,
    hasBlockingIssue: (merged.approvalState || root.approvalState) === 'pending_approval',
    lootVisible: (merged.step ?? root.step) >= 4,
  };

  return merged;
}
