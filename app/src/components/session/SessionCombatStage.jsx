export default function SessionCombatStage({
  C,
  PF,
  boss,
  dmgNums,
  Boss,
  DmgNum,
  TEAM,
  pv,
  votes,
  npcAtk,
  npcHits,
  atk,
  rev,
  step,
  Sprite,
  FlipCard,
  mc,
}) {
  return (
    <>
      <div data-tour="session-boss-hp" style={{ position: 'relative', marginBottom: '8px' }}>
        <Boss hp={boss.hp} maxHp={boss.maxHp} name={boss.name} hit={boss.hit} defeated={boss.defeated} />
        {dmgNums.map((d) => <DmgNum key={d.id} value={d.val} x={d.x} critical={d.critical} color={d.critical ? C.gld : C.acc} />)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '14px', marginBottom: '10px', minHeight: '130px' }}>
        {TEAM.map((m, i) => {
          const hasV = m.isP ? pv !== null : votes.some((v) => v.mid === m.id);
          const vv = m.isP ? pv : votes.find((v) => v.mid === m.id)?.val;
          const isAtk = m.isP ? atk : npcAtk.includes(m.id);
          const isHit = npcHits.includes(m.id);
          const isVic = step === 4;
          const anim = isVic ? 'celebrate 0.4s ease-in-out infinite' : isAtk ? 'atkLunge 0.4s ease-out' : hasV && !rev ? 'charBounce 0.8s ease-in-out infinite' : 'none';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {hasV && <div style={{ marginBottom: '4px', animation: 'cardDrop 0.4s ease-out' }}><FlipCard value={vv} member={m} revealed={rev} delay={i * 0.12} mc={mc} /></div>}
              {!hasV && <div style={{ height: '66px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{!m.isP && <div style={{ fontFamily: PF, fontSize: '6px', color: m.hat || C.dim, animation: 'pulse 1s infinite' }}>💭</div>}</div>}
              <Sprite m={m} size={1.7} anim={anim} attacking={isAtk} hit={isHit} />
            </div>
          );
        })}
      </div>
    </>
  );
}
