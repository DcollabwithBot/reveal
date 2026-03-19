import { projectBossEncounter } from '../boss/bossProjection.js';
import { projectApprovalOverlay } from '../governance/approvalProjection.js';
import { buildRewardLoot } from '../rewards/buildRewardLoot.js';

export function projectWorld(root, config, colors = {}) {
  const boss = projectBossEncounter({
    projectionConfig: config,
    node: root.node,
    project: root.project,
    bossKey: 'delivery-pressure-default',
  });

  const approval = projectApprovalOverlay(root.approvalState, colors);
  const rewardRule = (config?.rewardRules || []).find((rule) => rule.key === 'session-complete-default') || null;
  const rewardPreview = buildRewardLoot({
    rewardRule,
    combo: root.combo || 0,
    rootCauseCount: root.rootCauseCount || 0,
    lifelineUsed: Boolean(root.lifelineUsed),
    colors,
  });

  const difficulty = root.mode === 'boss-retro'
    ? 'boss'
    : root.voting.spread > 5
      ? 'hard'
      : root.voting.spread > 2
        ? 'normal'
        : 'trivial';

  const progressCurrent = root.step || 0;
  const progressTotal = root.mode === 'boss-retro' ? 5 : 4;

  return {
    theme: {
      worldId: root.mode,
      worldLabel: root.mode === 'boss-retro' ? 'Retro Dungeon' : root.mode === 'roulette' ? 'Roulette Arena' : 'Planning Arena',
      zoneLabel: boss.bossName,
      tone: difficulty === 'boss' ? 'epic' : difficulty === 'hard' ? 'tense' : 'calm',
    },
    player: {
      level: 3,
      xp: 45 + (root.combo || 0) * 5,
      streak: root.combo || 0,
      energy: root.combo >= 3 ? 'high' : root.combo >= 1 ? 'medium' : 'low',
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
      statusLabel: difficulty === 'boss' ? 'Boss fight' : difficulty === 'hard' ? 'High variance' : 'Stable run',
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
      showRewardPreview: root.step === 4,
      showApprovalGate: root.approvalState === 'pending_approval',
      showChallengePrompt: root.mode === 'roulette' && root.ready && !root.activeChallenge,
    },
  };
}
