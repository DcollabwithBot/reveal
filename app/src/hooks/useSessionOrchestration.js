export function useSessionOrchestration({ dispatchUi, dispatchFlow, TEAM, sound, doBossHit, addDmg }) {
  function flash(color, durationMs = 300) {
    dispatchUi({ type: 'flash', value: color });
    setTimeout(() => dispatchUi({ type: 'flash', value: null }), durationMs);
  }

  function shake(durationMs = 400) {
    dispatchUi({ type: 'shake', value: true });
    setTimeout(() => dispatchUi({ type: 'shake', value: false }), durationMs);
  }

  function showSpell(name, durationMs = 600) {
    dispatchUi({ type: 'spellName', value: name });
    setTimeout(() => dispatchUi({ type: 'spellName', value: null }), durationMs);
  }

  function runNpcAttackSequence(votes) {
    votes.forEach((vote, i) => {
      setTimeout(() => {
        dispatchUi({ type: 'npcAtk:add', value: vote.mid });
        sound('spell');
        showSpell(TEAM.find((m) => m.id === vote.mid)?.cls?.spellName || 'ATTACK');
        doBossHit(vote.val * 1.5);
        addDmg(vote.val, 35 + i * 10);
        setTimeout(() => dispatchUi({ type: 'npcAtk:remove', value: vote.mid }), 500);
      }, 400 + i * 500);
    });
  }

  function runRevealCountdown({ mc, pv, votes, addAchieve }) {
    sound('countdown');
    dispatchFlow({ type: 'merge', patch: { cd: 3 } });
    const intervalId = setInterval(() => {
      dispatchFlow({ type: 'merge', patch: { cd: 0 } });
      dispatchFlow({ type: 'merge', patch: { cd: -1 } });
      sound('countgo');
      flash(mc);
      shake();
      dispatchUi({ type: 'bossDead', value: true });
      setTimeout(() => {
        sound('boom');
        flash('#ffffff');
        shake();
        dispatchFlow({ type: 'merge', patch: { rev: true, step: 1, bossHp: 0 } });
        const allV = [pv, ...votes.map((v) => v.val)];
        const avg = allV.reduce((a, b) => a + b, 0) / allV.length;
        if (Math.abs(pv - avg) < 2) addAchieve('sniper');
        const spread = Math.max(...allV) - Math.min(...allV);
        if (spread <= 3) addAchieve('team');
      }, 800);
      clearInterval(intervalId);
    }, 750);
  }

  return {
    flash,
    shake,
    showSpell,
    runNpcAttackSequence,
    runRevealCountdown,
  };
}
