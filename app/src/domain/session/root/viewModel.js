export function buildSessionViewModel({ root, world, bossName, bossHp, maxHp, bossHit, bossDead, advisoryBusy, advisoryError, showRoulette, showAchieve, spellName, shake, dmgNums }) {
  return {
    chrome: {
      modeLabel: root.mode === 'roulette' ? '🎰 ROULETTE' : root.mode === 'boss-retro' ? '👾 RETRO' : '🃏 POKER',
      modeColor: root.mode === 'roulette' ? '#facc15' : root.mode === 'boss-retro' ? '#f87171' : '#60a5fa',
      title: bossName,
      approvalLabel: world.governance.approvalLabel,
      approvalColor: world.governance.approvalColor,
      canSubmitAdvisory: world.governance.canSubmitAdvisory,
      advisoryBusy,
      advisoryError,
      combo: root.combo,
      step: root.step,
    },
    overlays: {
      showRoulette,
      showAchieve,
      spellName,
      shake,
    },
    combat: {
      boss: {
        hp: bossHp,
        maxHp,
        name: bossName,
        hit: bossHit,
        defeated: bossDead,
      },
      dmgNums,
    },
  };
}
