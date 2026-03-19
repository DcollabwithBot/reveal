export function applyRetroEventVote({ vote, event, currentEvtIdx, totalEvents, maxHp }) {
  const hpGain = vote === 'wrong' || (vote === 'improve' && event?.hp)
    ? Number(event?.hp || 10)
    : 0;

  const bossDamage = vote === 'well' && event?.dmg
    ? Number(event.dmg)
    : 0;

  return {
    hpGain,
    bossDamage,
    nextEventIndex: currentEvtIdx + 1 < totalEvents ? currentEvtIdx + 1 : currentEvtIdx,
    nextBossStep: currentEvtIdx + 1 < totalEvents ? 1 : 2,
    bossHpDelta: hpGain > 0 ? Math.round(hpGain * 0.5) : -bossDamage,
    bossHpCap: maxHp * 2,
    resetOracle: currentEvtIdx + 1 < totalEvents,
    addProblemEvent: hpGain > 0,
  };
}

export function applyOracleDecision({ currentOracleEvents = [] }) {
  const nextOracleCount = currentOracleEvents.length + 1;
  return {
    nextOracleCount,
    bossDamage: 15,
    unlocks: [
      ...(nextOracleCount >= 1 ? ['oracle'] : []),
      ...(nextOracleCount >= 3 ? ['prophet'] : []),
    ],
  };
}

export function applyRootCauseDecision({ rootCauseIdx, totalProblemEvents }) {
  return {
    bossDamage: 20,
    nextRootCauseIdx: rootCauseIdx + 1 < totalProblemEvents ? rootCauseIdx + 1 : rootCauseIdx,
    nextBossStep: rootCauseIdx + 1 < totalProblemEvents ? 3 : 4,
  };
}

export function buildBossRetroViewModel({ bossStep, currentEvtIdx, retroEvents = [], bossBattleHp, maxHp, problemEvents = [], rootCauseIdx, oracleEvents = [], bossHp }) {
  const currentRetroEvent = retroEvents[currentEvtIdx] || null;
  const currentProblemEvent = problemEvents[rootCauseIdx] || null;
  const bossMood = bossBattleHp > 80 ? '😤' : bossBattleHp > 40 ? '😠' : '😐';
  const bossContinueLabel = bossBattleHp === 0 ? '🏆 PERFEKT SPRINT!' : '⚔️ ANALYSER PROBLEMER';
  const summaryText = problemEvents.length === 0
    ? 'Perfekt sprint! Ingen problemer fundet.'
    : `${problemEvents.length} problemer forstået og lært af.`;

  return {
    bossStep,
    currentRetroEvent,
    currentProblemEvent,
    currentEvtIdx,
    totalEvents: retroEvents.length,
    bossBattleHp,
    maxHp,
    bossMood,
    problemEventsCount: problemEvents.length,
    rootCauseIdx,
    oracleCount: oracleEvents.length,
    bossContinueLabel,
    summaryText,
    escaped: bossHp > 0,
  };
}
