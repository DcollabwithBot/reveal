export default function PokerRouletteSteps({
  step,
  rdy,
  isR,
  activeChallenge,
  currentChallenge,
  rev,
  revoting,
  pv,
  avg,
  spread,
  initialVote,
  rc,
  ll,
  llr,
  cv,
  ac,
  TEAM,
  combo,
  loot,
  showLoot,
  achieves,
  resolveProjectionAchievement,
  allV,
  clamp,
  doVote,
  doReveal,
  doDisc,
  doCv,
  doFin,
  doLL,
  safeComplete,
  setShowRoulette,
  Btn,
  Box,
  Sprite,
  LootDrops,
  C,
  PF,
  showXpBadges = true,
}) {
  return (
    <>
      {step === 0 && <div style={{ animation: 'slideUp 0.3s', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontSize: '6px', color: C.dim, letterSpacing: '2px', marginBottom: '8px' }}>
          {pv === null ? '◈ VÆLG DIT KORT FOR AT ANGRIBE ◈' : rdy ? '◈ ALLE HAR ANGREBET! ◈' : '◈ PARTY ANGRIBER... ◈'}
        </div>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[1, 2, 3, 5, 8, 13, 21].map((v, vi) => (
            <div key={v} onClick={() => { if (pv === null) doVote(v); }} style={{ width: '56px', height: '78px', background: `linear-gradient(145deg,${C.bgL},${C.bgC})`, border: `3px solid ${pv === v ? C.acc : C.brd}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: pv === null ? 'pointer' : 'default', opacity: pv !== null && pv !== v ? 0.1 : 1, transform: pv === v ? 'scale(1.15) translateY(-10px)' : 'scale(1)', transition: 'all 0.15s', boxShadow: pv === v ? `0 4px 16px ${C.acc}66` : `3px 3px 0 ${C.bg}`, animation: pv === null ? `cardFloat 2.5s ease-in-out ${vi * 0.12}s infinite` : 'none', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '2px', left: '4px', fontFamily: PF, fontSize: '5px', color: pv === v ? C.acc : C.dim }}>{v}</div>
              <div style={{ fontFamily: PF, fontSize: '18px', color: pv === v ? C.acc : C.txt, textShadow: pv === v ? `0 0 8px ${C.acc}` : 'none' }}>{v}</div>
              <div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>DMG</div>
            </div>
          ))}
        </div>
        {rdy && isR && !activeChallenge && (
          <button onClick={() => setShowRoulette(true)} style={{ fontFamily: PF, fontSize: 9, color: C.bg, background: C.yel, border: `3px solid ${C.yel}`, borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`, padding: '12px 24px', cursor: 'pointer', letterSpacing: 1, animation: 'pulse 1.5s ease-in-out infinite' }}>
            {currentChallenge?.actions?.primaryLabel || '🎰 TRÆK CHALLENGE!'}
          </button>
        )}
        {rdy && isR && activeChallenge && !rev && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: C.yel, marginBottom: 8 }}>
              AKTIV CHALLENGE: {currentChallenge?.objective?.title || activeChallenge.title}
            </div>
            <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 12 }}>
              {currentChallenge?.actions?.primaryLabel || 'RE-ESTIMER OG ANGRIB!'}
            </div>
            {revoting && pv !== null && (
              <Btn large color={C.acc} onClick={doReveal} style={{ fontSize: '11px', animation: 'pulse 0.8s infinite' }}>{currentChallenge?.actions?.completeLabel || '⚔️ REVEAL ATTACK!'}</Btn>
            )}
          </div>
        )}
        {rdy && !isR && <Btn large color={C.acc} onClick={doReveal} style={{ fontSize: '11px', animation: 'pulse 0.8s infinite' }}>⚔️ REVEAL ATTACK!</Btn>}
      </div>}

      {step === 1 && <div style={{ animation: 'slideUp 0.3s', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontSize: '7px', color: C.grn, marginBottom: '10px', textShadow: `0 0 6px ${C.grn}44` }}>👾 BOSS DEFEATED!</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
          <Box glow={C.blu + '33'} style={{ padding: '10px', minWidth: '70px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>SNIT</div><div style={{ fontFamily: PF, fontSize: '18px', color: C.blu, textShadow: `0 0 6px ${C.blu}44` }}>{avg}</div></Box>
          <Box glow={(spread > 5 ? C.acc : C.grn) + '33'} style={{ padding: '10px', minWidth: '70px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>SPREAD</div><div style={{ fontFamily: PF, fontSize: '18px', color: spread > 5 ? C.acc : C.grn }}>{spread}</div></Box>
          <Box style={{ padding: '10px', minWidth: '70px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>STATUS</div><div style={{ fontFamily: PF, fontSize: '9px', color: spread > 5 ? C.acc : spread > 2 ? C.yel : C.grn }}>{spread > 5 ? '⚠️ HØJ' : spread > 2 ? 'MEDIUM' : '✓ ALIGN'}</div></Box>
        </div>
        {isR && activeChallenge && initialVote !== null && (
          <div style={{ fontFamily: PF, fontSize: 7, color: C.yel, marginTop: 8, marginBottom: 8 }}>
            FØRSTE ESTIMAT: {initialVote} SP → NU: {pv} SP
            {pv > initialVote && <span style={{ color: C.red }}> (+{pv - initialVote} pga. {activeChallenge.title})</span>}
            {pv === initialVote && <span style={{ color: C.grn }}> (INGEN ÆNDRING)</span>}
          </div>
        )}
        <Btn large color={C.blu} onClick={doDisc}>💬 DISKUSSION & POWER-UPS</Btn>
      </div>}

      {step === 2 && <div style={{ animation: 'slideUp 0.3s', textAlign: 'center' }}>
        {spread > 3 && <Box color={C.yel} glow={C.yel + '33'} style={{ padding: '7px', marginBottom: '8px' }}><div style={{ fontFamily: PF, fontSize: '6px', color: C.yel }}>⚠️ UENIGHED — {spread} PTS!</div></Box>}
        <div style={{ fontFamily: PF, fontSize: '5px', color: C.dim, marginBottom: '5px' }}>RISK CARDS</div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          {['🔥 Dependency', '🧱 Legacy', '🕳️ Unknown', '🧑💻 Single PoK'].map((c) => (
            <div key={c} onClick={() => { if (!rc.includes(c)) doDisc(c); }} style={{ fontFamily: PF, fontSize: '5px', padding: '5px 8px', cursor: 'pointer', background: rc.includes(c) ? C.acc : C.bgL + 'dd', color: rc.includes(c) ? C.wht : C.txt, border: `2px solid ${rc.includes(c) ? C.acc : C.brd}`, animation: rc.includes(c) ? 'pop 0.3s' : 'none' }}>{c}</div>
          ))}
        </div>
        <div style={{ fontFamily: PF, fontSize: '5px', color: C.dim, marginBottom: '6px' }}>POWER-UPS</div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px' }}>
          {[{ id: 'expert', i: '📞', n: 'Expert' }, { id: 'audience', i: '📊', n: 'Audience' }, { id: '5050', i: '✂️', n: 'Cut' }, { id: 'oracle', i: '🔮', n: 'Oracle' }].map((l) => (
            <div key={l.id} onClick={() => { if (!ll) doLL(l.id); }} style={{ textAlign: 'center', cursor: ll ? 'default' : 'pointer', opacity: ll && ll !== l.id ? 0.15 : 1, transform: ll === l.id ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.2s' }}>
              <div style={{ width: '38px', height: '38px', margin: '0 auto', borderRadius: '50%', background: ll === l.id ? C.pur : C.bgL + 'dd', border: `3px solid ${ll === l.id ? C.pur : C.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: ll === l.id ? `0 0 12px ${C.pur}66` : 'none', animation: !ll ? 'float 2s ease-in-out infinite' : 'none' }}>{l.i}</div>
              <div style={{ fontFamily: PF, fontSize: '4px', color: ll === l.id ? C.pur : C.dim, marginTop: '2px' }}>{l.n}</div>
            </div>
          ))}
        </div>
        {llr && <Box color={C.pur} glow={C.pur + '22'} style={{ padding: '8px', marginBottom: '8px' }}><div style={{ fontFamily: 'Bitcount Grid Single, monospace', fontSize: '14px', color: C.txt }}>{llr}</div></Box>}
        <Btn large color={C.grn} onClick={() => doCv(null)}>😎 VIDERE TIL CONFIDENCE</Btn>
      </div>}

      {step === 3 && <div style={{ animation: 'slideUp 0.3s', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontSize: '6px', color: C.dim, marginBottom: '8px' }}>◈ HVOR SIKKER ER DU? ◈</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '14px' }}>
          {[1, 2, 3, 4, 5].map((v) => {
            const cols = [C.red, C.org, C.yel, C.grnL, C.grn], em = ['😰', '😐', '🤔', '😊', '💪'];
            return (
              <div key={v} onClick={() => { if (cv === null) doCv(v); }} style={{ textAlign: 'center', cursor: cv === null ? 'pointer' : 'default', opacity: cv !== null && cv !== v ? 0.1 : 1, transform: cv === v ? 'scale(1.25)' : 'scale(1)', transition: 'all 0.2s' }}>
                <div style={{ width: '42px', height: '42px', margin: '0 auto', borderRadius: '50%', background: cv === v ? cols[v - 1] : C.bgL + 'dd', border: `3px solid ${cv === v ? cols[v - 1] : C.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: cv === v ? `0 0 14px ${cols[v - 1]}66` : 'none', animation: cv === null ? `float 2s ease-in-out ${v * 0.15}s infinite` : 'none' }}>{em[v - 1]}</div>
                <div style={{ fontFamily: PF, fontSize: '4px', color: cv === v ? cols[v - 1] : C.dim, marginTop: '2px' }}>{['USIKKER', 'LIDT', 'OK', 'SIKKER', '100%'][v - 1]}</div>
              </div>
            );
          })}
        </div>
        {ac.length > 0 && <>
          <Box style={{ padding: '10px', maxWidth: '320px', margin: '0 auto 10px' }}>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {[{ mid: 1, val: cv }, ...ac].map((c, i) => {
                const m = TEAM.find((x) => x.id === c.mid);
                const cols = [C.red, C.org, C.yel, C.grnL, C.grn];
                return <div key={i} style={{ textAlign: 'center' }}><Sprite m={m} size={0.8} idle={false} /><div style={{ fontFamily: PF, fontSize: '7px', color: cols[c.val - 1] }}>{c.val}</div></div>;
              })}
            </div>
          </Box>
          <Btn large color={C.acc} onClick={doFin}>🏆 VICTORY!</Btn>
        </>}
      </div>}

      {step === 4 && <div style={{ animation: 'slideUp 0.3s', textAlign: 'center' }}>
        <div style={{ fontFamily: PF, fontSize: '16px', color: C.gld, marginBottom: '10px', textShadow: `0 0 25px ${C.gld}66`, letterSpacing: '4px', animation: 'victoryPulse 1s ease-in-out infinite' }}>★ VICTORY ★</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
          <Box color={C.grn} glow={C.grn + '33'} style={{ padding: '10px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>ESTIMAT</div><div style={{ fontFamily: PF, fontSize: '22px', color: C.grn }}>{clamp(Math.round(allV.reduce((s, v) => s + v.val, 0) / allV.length))}</div></Box>
          <Box style={{ padding: '10px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>CONFIDENCE</div><div style={{ fontSize: '22px' }}>{['😰', '😐', '🤔', '😊', '💪'][(cv || 1) - 1]}</div></Box>
          <Box style={{ padding: '10px' }}><div style={{ fontFamily: PF, fontSize: '4px', color: C.dim }}>COMBO</div><div style={{ fontFamily: PF, fontSize: '22px', color: C.org }}>{combo}x</div></Box>
        </div>
        <div style={{ fontFamily: PF, fontSize: '6px', color: C.gld, marginBottom: '6px', animation: 'pop 0.5s 0.3s both' }}>◈ LOOT DROPS ◈</div>
        <LootDrops items={loot} active={showLoot} />
        {showXpBadges && (
          <Box color={C.xp} glow={C.xp + '33'} style={{ padding: '10px', maxWidth: '300px', margin: '10px auto' }}>
            <div style={{ fontFamily: PF, fontSize: '7px', color: C.xp }}>⭐ +{45 + combo * 5} XP</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
              <span style={{ fontFamily: PF, fontSize: '5px', color: C.gld }}>LV3</span>
              <div style={{ flex: 1, height: '7px', background: C.bg, border: `2px solid ${C.brd}` }}>
                <div style={{ height: '100%', width: '72%', background: `linear-gradient(90deg,${C.xp},${C.bluL})`, transition: 'width 2s', boxShadow: `0 0 6px ${C.xp}44` }} />
              </div>
            </div>
          </Box>
        )}
        {achieves.length > 0 && <div style={{ marginTop: '8px' }}>
          <div style={{ fontFamily: PF, fontSize: '5px', color: C.gld, marginBottom: '4px' }}>ACHIEVEMENTS</div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {achieves.map((id) => { const a = resolveProjectionAchievement(id); return a ? <div key={id} style={{ padding: '4px 8px', background: C.bgL, border: `2px solid ${C.gld}`, display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ fontSize: '12px' }}>{a.icon}</span><span style={{ fontFamily: PF, fontSize: '4px', color: C.gld }}>{a.name}</span></div> : null; })}
          </div>
        </div>}
        <div style={{ marginTop: '12px' }}>
          <Btn color={C.grn} onClick={safeComplete}>← TILBAGE TIL KORTET</Btn>
        </div>
      </div>}
    </>
  );
}
