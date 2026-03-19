import { useState, useEffect, useRef, useReducer } from "react";
import { C, NPC_TEAM } from "../shared/constants.js";
import { buildRewardLoot } from "../domain/session/rewards/buildRewardLoot.js";
import { FALLBACK_ACHIEVEMENTS, createAchievementResolver } from "../domain/session/rewards/achievements.js";
import { projectBossEncounter } from "../domain/session/boss/bossProjection.js";
import { buildRootState } from "../domain/session/root/selectors.js";
import { buildSessionViewModel } from "../domain/session/root/viewModel.js";
import { createInitialSessionFlowState, sessionFlowReducer } from "../domain/session/root/sessionFlowReducer.js";
import { createInitialSessionRetroState, sessionRetroReducer } from "../domain/session/root/sessionRetroReducer.js";
import { initialSessionUiState, sessionUiReducer } from "../domain/session/root/sessionUiReducer.js";
import { projectWorld } from "../domain/session/world/projectWorld.js";
import { buildChallenge } from "../domain/session/challenge/buildChallenge.js";
import RouletteOverlay from "../components/RouletteOverlay.jsx";
import BossRetroStage from "../components/session/BossRetroStage.jsx";
import PokerRouletteSteps from "../components/session/PokerRouletteSteps.jsx";
import SessionChrome from "../components/session/SessionChrome.jsx";
import SessionCombatStage from "../components/session/SessionCombatStage.jsx";
import { AchievePopup, Boss, Box, Btn, ComboDisplay, DmgNum, FlipCard, LootDrops, Scene, Sprite } from "../components/session/SessionPrimitives.jsx";
import { applyOracleDecision, applyRetroEventVote, applyRootCauseDecision, buildBossRetroViewModel } from "../domain/session/challenge/retroDecisions.js";
import { createChallengeCompletionResult, createConfidenceResult, createLifelineResult, createVictoryResult, createVoteResult } from "../domain/session/challenge/sessionTransitions.js";
import { useSessionData } from "../hooks/useSessionData.js";
import { useSessionOrchestration } from "../hooks/useSessionOrchestration.js";
const PV = [1, 2, 3, 5, 8, 13, 21];
function clamp(v) { let b = PV[0]; for (const p of PV) if (Math.abs(p - v) < Math.abs(b - v)) b = p; return b; }
function gv(pv, sp = 2) { return NPC_TEAM.map(m => ({ mid: m.id, val: clamp(Math.max(1, pv + Math.round((Math.random() - 0.5) * sp * 2))) })); }


export default function Session({ avatar, node, project, onBack, onComplete, sound }) {
  // Determine mode from node type
  const isR = node?.tp === "r";
  const isB = node?.tp === "b";
  const mc = isR ? C.yel : isB ? C.red : C.blu;

  // Build team from avatar + NPCs
  const TEAM = [
    {
      id: 1, name: "Du", isP: true, lv: 3,
      cls: avatar?.cls || CLASSES[0],
      hat: avatar?.helmet?.pv || avatar?.cls?.color || "#f04f78",
      body: avatar?.armor?.pv || avatar?.cls?.color || "#f04f78",
      btc: avatar?.boots?.pv || dk(avatar?.cls?.color || "#f04f78", 60),
      skin: avatar?.skin || "#fdd",
    },
    ...NPC_TEAM,
  ];

  const [flow, dispatchFlow] = useReducer(sessionFlowReducer, maxHp, createInitialSessionFlowState);
  const { step, pv, votes, rdy, rev, cd, cv, ac, bossHp, combo, achieves, loot, rc, ll, llr, activeChallenge, initialVote, revoting } = flow;
  const [sessionUi, dispatchUi] = useReducer(sessionUiReducer, initialSessionUiState);
  const { bossHit, bossDead, atk, npcAtk, npcHits, dmgNums, flash, shake, showAchieve, spellName, showRoulette, showLoot } = sessionUi;

  const { bossName, maxHp, bossDamageMultiplier } = projectBossEncounter({
    projectionConfig,
    node,
    project,
    bossKey: 'delivery-pressure-default',
  });
  const { projectionConfig, approvalState, advisoryBusy, advisoryError, setApprovalState, sendToApprovalQueue } = useSessionData({
    nodeId: node?.id,
    projectId: project?.id,
    pv,
    spread: 0,
    cv,
    rootEstimate: pv ?? 0,
  });
  const finCalled = useRef(false);

  const [retro, dispatchRetro] = useReducer(sessionRetroReducer, undefined, createInitialSessionRetroState);
  const { bossStep, retroEvents, currentEvtIdx, eventVotes, oracleEvents, oracleUsed, rootCauses, bossBattleHp, problemEvents, rootCauseIdx } = retro;

  function safeComplete() {
    if (finCalled.current) return;
    finCalled.current = true;
    if (onComplete) onComplete(node?.id);
  }

  const resolveProjectionAchievement = createAchievementResolver(projectionConfig?.achievements || [], FALLBACK_ACHIEVEMENTS);
  const sessionRewardRule = (projectionConfig?.rewardRules || []).find((rule) => rule.key === 'session-complete-default') || null;
  const rootState = buildRootState({
    selectedVote: pv,
    votes,
    approvalState,
    projectionConfig,
    node,
    project,
    step,
    combo,
    ready: rdy,
    activeChallenge,
    rootCauseCount: rc.length,
    lifelineUsed: Boolean(ll),
  });
  const approvalOverlay = projectApprovalOverlay(approvalState, { yel: C.yel, blu: C.blu, red: C.red, grn: C.grn, dim: C.dim });
  const world = projectWorld(rootState, projectionConfig, { xp: C.xp, acc: C.acc, org: C.org, pur: C.pur, gld: C.gld, yel: C.yel, blu: C.blu, red: C.red, grn: C.grn, dim: C.dim });
  const currentChallenge = buildChallenge(rootState, world);

  function addDmg(val, x, critical = false) { dispatchUi({ type: 'dmgNums:add', value: { id: Date.now() + Math.random(), val, x, critical } }); setTimeout(() => dispatchUi({ type: 'dmgNums:trimFront', count: 1 }), 1200); }
  function addAchieve(a) {
    const resolved = typeof a === 'string' ? resolveProjectionAchievement(a) : a;
    if (!resolved || achieves.includes(resolved.id)) return;
    dispatchFlow({ type: 'addAchieveId', value: resolved.id });
    dispatchUi({ type: 'showAchieve', value: resolved });
    sound("achieve");
  }
  function doFlash(col) { orchestration.flash(col); }
  function doShake() { orchestration.shake(); }
  function doBossHit(dmg) { dispatchUi({ type: 'bossHit', value: true }); setBossHp(h => Math.max(0, h - dmg)); setTimeout(() => dispatchUi({ type: 'bossHit', value: false }), 200); sound("hit"); }

  useEffect(() => {
    if (pv === null || rdy) return;
    const timer = setTimeout(() => {
      const v = gv(pv, 2); dispatchFlow({ type: 'setVotesReady', votes: v });
      orchestration.runNpcAttackSequence(v);
    }, 1200);
    return () => clearTimeout(timer);
  }, [pv, rdy]);

  function handleChallengeComplete(challenge) {
    const result = createChallengeCompletionResult({ maxHp, challenge });
    dispatchFlow({ type: 'merge', patch: { activeChallenge: result.activeChallenge } });
    dispatchUi({ type: 'showRoulette', value: result.showRoulette });
    dispatchFlow({ type: 'merge', patch: { revoting: result.revoting } });
    setBossHp(prev => Math.min(prev + result.bonusHp, Math.round(maxHp * 1.5)));
    addAchieve(result.achievementId);
  }

  function doVote(v) {
    const result = createVoteResult({ vote: v, bossDamageMultiplier });
    if (isR && !revoting && initialVote === null) {
      dispatchFlow({ type: 'merge', patch: { initialVote: v } });
    }
    dispatchFlow({ type: 'merge', patch: { pv: result.selectedVote } });
    sound('attack');
    dispatchUi({ type: 'atk', value: true });
    dispatchUi({ type: 'spellName', value: TEAM[0].cls.spellName });
    setTimeout(() => { dispatchUi({ type: 'spellName', value: null }); }, 600);
    doBossHit(result.attackDamage);
    addDmg(v, 50, result.critical);
    doFlash(TEAM[0].cls.trail);
    doShake();
    setTimeout(() => dispatchUi({ type: 'atk', value: false }), 500);
    dispatchFlow({ type: 'merge', patch: { combo: combo + result.comboDelta } });
    result.achievementIds.forEach((id) => addAchieve(id));
    if (result.sound === 'combo') sound('combo');
  }

  function doReveal() {
    orchestration.runRevealCountdown({ mc, pv, votes, addAchieve });
  }


  function doDisc(riskCard) {
    if (riskCard) {
      if (!rc.includes(riskCard)) {
        dispatchFlow({ type: 'addRiskCard', value: riskCard });
        sound('click');
        addAchieve('detective');
      }
      return;
    }
    dispatchFlow({ type: 'merge', patch: { step: 2 } });
    sound('click');
  }
  function doCv(v) {
    if (v === null) {
      dispatchFlow({ type: 'merge', patch: { step: 3 } });
      sound('click');
      return;
    }
    const result = createConfidenceResult({ value: v });
    dispatchFlow({ type: 'merge', patch: { cv: result.confidence } });
    sound('select');
    if (result.achievementId) addAchieve(result.achievementId);
    setTimeout(() => { dispatchFlow({ type: 'merge', patch: { ac: NPC_TEAM.map(m => ({ mid: m.id, val: Math.max(1, Math.min(5, v + Math.floor(Math.random() * 3) - 1)) })) } }); }, 500);
  }
  function doFin() {
    const result = createVictoryResult({
      rewardRule: sessionRewardRule,
      combo,
      rootCauseCount: rc.length,
      lifelineUsed: Boolean(ll),
      colors: { xp: C.xp, acc: C.acc, org: C.org, pur: C.pur, gld: C.gld },
      buildRewardLoot,
    });
    dispatchFlow({ type: 'merge', patch: { step: result.step } });
    sound(result.sound);
    doFlash(result.flashColor);
    dispatchFlow({ type: 'merge', patch: { loot: result.loot } });
    setTimeout(() => dispatchUi({ type: 'showLoot', value: true }), result.showLootDelayMs);
    setTimeout(() => safeComplete(), result.completeDelayMs);
  }
  function doLL(id) {
    const result = createLifelineResult({ id, pv, votes });
    dispatchFlow({ type: 'merge', patch: { ll: result.lifelineId } });
    sound('powerup');
    doFlash(C.pur);
    if (result.achievementId) addAchieve(result.achievementId);
    dispatchFlow({ type: 'merge', patch: { llr: result.response } });
  }



  function handleEventVote(vote) {
    const ev = retroEvents[currentEvtIdx];
    const decision = applyRetroEventVote({
      vote,
      event: ev,
      currentEvtIdx,
      totalEvents: retroEvents.length,
      maxHp,
    });

    dispatchRetro({ type: 'eventVote', eventId: ev.id, vote });
    if (decision.addProblemEvent) {
      dispatchRetro({ type: 'problemEvent:add', event: ev, hpGain: decision.hpGain });
    }
    setBossHp(p => {
      const next = p + decision.bossHpDelta;
      return decision.bossHpDelta >= 0
        ? Math.min(next, decision.bossHpCap)
        : Math.max(0, next);
    });

    setTimeout(() => {
      if (decision.resetOracle) dispatchRetro({ type: 'oracle:reset' });
      if (decision.nextBossStep === 1) {
        dispatchRetro({ type: 'merge', patch: { currentEvtIdx: decision.nextEventIndex } });
      } else {
        dispatchRetro({ type: 'merge', patch: { bossStep: decision.nextBossStep } });
      }
    }, 600);
  }

  function handleOracle() {
    const ev = retroEvents[currentEvtIdx];
    const decision = applyOracleDecision({ currentOracleEvents: oracleEvents });
    dispatchRetro({ type: 'oracle:add', eventId: ev.id });
    decision.unlocks.forEach((achievementId) => addAchieve(achievementId));
    setBossHp(p => Math.max(0, p - 15));
    sound("achieve");
  }

  function handleRootCause(cause) {
    const ev = problemEvents[rootCauseIdx];
    const decision = applyRootCauseDecision({
      rootCauseIdx,
      totalProblemEvents: problemEvents.length,
    });

    dispatchRetro({ type: 'rootCause:set', eventId: ev.id, cause });
    setBossHp(p => Math.max(0, p - decision.bossDamage));
    setBossBattleHp(p => Math.max(0, p - decision.bossDamage));
    setTimeout(() => {
      if (decision.nextBossStep === 3) {
        dispatchRetro({ type: 'merge', patch: { rootCauseIdx: decision.nextRootCauseIdx } });
      } else {
        dispatchRetro({ type: 'merge', patch: { bossStep: decision.nextBossStep } });
      }
    }, 500);
  }

  const allV = rootState.voting.allVotes;
  const avg = rootState.voting.averageDisplay;
  const spread = rootState.voting.spread;
  const bossRetroVm = buildBossRetroViewModel({
    bossStep,
    currentEvtIdx,
    retroEvents,
    bossBattleHp,
    maxHp,
    problemEvents,
    rootCauseIdx,
    oracleEvents,
    bossHp,
  });
  const sessionVm = buildSessionViewModel({
    root: rootState,
    world,
    bossName,
    bossHp,
    maxHp,
    bossHit,
    bossDead,
    advisoryBusy,
    advisoryError,
    showRoulette,
    showAchieve,
    spellName,
    shake,
    dmgNums,
  });

  return (
    <>
    {/* ═══ SPRINT BOSS BATTLE MODE ═══ */}
    {isB && (
      <Scene mc={C.red}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 20 }}>
          <BossRetroStage
            C={C}
            PF={PF}
            bossVm={bossRetroVm}
            oracleUsed={oracleUsed}
            onStart={() => dispatchRetro({ type: 'merge', patch: { bossStep: 1 } })}
            onVote={handleEventVote}
            onOracle={handleOracle}
            onContinue={() => dispatchRetro({ type: 'merge', patch: { bossStep: bossBattleHp === 0 ? 5 : 3 } })}
            onRootCause={handleRootCause}
            onConfidence={(n) => {
              if (n >= 4) setBossHp(p => Math.max(0, p - 15));
              if (problemEvents.length >= 5) addAchieve('honest');
              dispatchRetro({ type: 'merge', patch: { bossStep: 5 } });
              sound("reveal");
            }}
            onFinish={() => safeComplete(node?.id)}
          />
        </div>
      </Scene>
    )}

    {/* Eksisterende Poker + Roulette mode — uændret */}
    {!isB && (
    <Scene mc={mc}>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.5, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.3s ease-out forwards" }} />}
      {cd >= 0 && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `rgba(0,0,0,${cd > 0 ? 0.7 : 0.9})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        <div style={{ fontFamily: PF, fontSize: cd > 0 ? "80px" : "60px", color: cd > 0 ? C.acc : C.grn, textShadow: `0 0 50px ${cd > 0 ? C.acc : C.grn}`, animation: "pop 0.4s" }}>{cd > 0 ? cd : "⚔️ REVEAL!"}</div>
        {cd > 0 && <div style={{ fontFamily: PF, fontSize: "8px", color: C.dim, marginTop: "16px", animation: "pulse 0.75s infinite" }}>ALLE KORT VENDES...</div>}
      </div>}
      {sessionVm.overlays.showRoulette && <RouletteOverlay onComplete={handleChallengeComplete} />}
      {sessionVm.overlays.showAchieve && <AchievePopup achieve={showAchieve} onDone={() => dispatchUi({ type: 'showAchieve', value: null })} />}
      <ComboDisplay count={combo} />
      {sessionVm.overlays.spellName && <div style={{ position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 100, pointerEvents: "none", animation: "spellFlash 0.6s ease-out forwards" }}><div style={{ fontFamily: PF, fontSize: "14px", color: C.wht, textShadow: `0 0 20px ${C.wht}, 0 0 40px ${mc}`, letterSpacing: "3px" }}>{sessionVm.overlays.spellName}!</div></div>}

      <div style={{ animation: sessionVm.overlays.shake ? "screenShake 0.4s" : "none" }}>
        <div style={{ padding: "10px 14px" }}>
          <SessionChrome
            C={C}
            PF={PF}
            combo={sessionVm.chrome.combo}
            step={sessionVm.chrome.step}
            modeLabel={sessionVm.chrome.modeLabel}
            modeColor={sessionVm.chrome.modeColor}
            title={sessionVm.chrome.title}
            approvalLabel={sessionVm.chrome.approvalLabel}
            approvalColor={sessionVm.chrome.approvalColor}
            advisoryBusy={sessionVm.chrome.advisoryBusy}
            canSubmitAdvisory={sessionVm.chrome.canSubmitAdvisory}
            advisoryError={sessionVm.chrome.advisoryError}
            onBack={() => { sound("click"); if (onBack) onBack(); }}
            onSendToApprovalQueue={sendToApprovalQueue}
          />

          <SessionCombatStage
            C={C}
            PF={PF}
            boss={sessionVm.combat.boss}
            dmgNums={sessionVm.combat.dmgNums}
            Boss={Boss}
            DmgNum={DmgNum}
            TEAM={TEAM}
            pv={pv}
            votes={votes}
            npcAtk={npcAtk}
            npcHits={npcHits}
            atk={atk}
            rev={rev}
            step={step}
            Sprite={Sprite}
            FlipCard={FlipCard}
            mc={mc}
          />

          {/* Game UI */}
          <div style={{ maxWidth: "660px", margin: "0 auto" }}>
            <PokerRouletteSteps
              step={step}
              rdy={rdy}
              isR={isR}
              activeChallenge={activeChallenge}
              currentChallenge={currentChallenge}
              rev={rev}
              revoting={revoting}
              pv={pv}
              avg={avg}
              spread={spread}
              initialVote={initialVote}
              rc={rc}
              ll={ll}
              llr={llr}
              cv={cv}
              ac={ac}
              TEAM={TEAM}
              combo={combo}
              loot={loot}
              showLoot={showLoot}
              achieves={achieves}
              resolveProjectionAchievement={resolveProjectionAchievement}
              allV={allV}
              clamp={clamp}
              doVote={doVote}
              doReveal={doReveal}
              doDisc={doDisc}
              doCv={doCv}
              doFin={doFin}
              doLL={doLL}
              safeComplete={safeComplete}
              setShowRoulette={(value) => dispatchUi({ type: 'showRoulette', value })}
              Btn={Btn}
              Box={Box}
              Sprite={Sprite}
              LootDrops={LootDrops}
              C={C}
              PF={PF}
            />
          </div>
        </div>
      </div>
    </Scene>
    )}
    </>
  );
}


