import { useState } from 'react';
import RetroEventCard from '../RetroEventCard.jsx';
import RootCauseSelector from '../RootCauseSelector.jsx';
import { handleError } from "../../lib/errorHandler";

function RetroActionEditor({ C, PF, onSaveActions }) {
  const [actions, setActions] = useState([{ title: '', description: '', assignee: '' }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addRow() { setActions(prev => [...prev, { title: '', description: '', assignee: '' }]); }
  function updateRow(idx, key, val) { setActions(prev => prev.map((a, i) => i === idx ? { ...a, [key]: val } : a)); }
  function removeRow(idx) { setActions(prev => prev.filter((_, i) => i !== idx)); }

  async function handleSave() {
    const valid = actions.filter(a => a.title.trim());
    if (!valid.length) return;
    setSaving(true);
    try {
      await onSaveActions(valid.map(a => ({ title: a.title, description: a.description, suggested_assignee: a.assignee || null })));
      setSaved(true);
    } catch (e) { handleError(e, "save-retro-actions"); }
    setSaving(false);
  }

  if (saved) {
    return (
      <div style={{ margin: '20px 0', padding: 16, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8, textAlign: 'center' }}>
        <span style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: C.grn }}>✓ {actions.filter(a => a.title.trim()).length} action items gemt</span>
      </div>
    );
  }

  return (
    <div style={{ margin: '20px 0', textAlign: 'left', maxWidth: 400, width: '100%' }}>
      <div style={{ fontFamily: PF, fontSize: 8, color: C.dim, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2 }}>
        📋 ACTION ITEMS
      </div>
      {actions.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={a.title} onChange={e => updateRow(i, 'title', e.target.value)} placeholder="Action item..." style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.brd}`, borderRadius: 4, color: C.txt, fontSize: 12, padding: '6px 8px' }} />
          <input value={a.assignee} onChange={e => updateRow(i, 'assignee', e.target.value)} placeholder="Hvem?" style={{ width: 80, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.brd}`, borderRadius: 4, color: C.txt, fontSize: 11, padding: '6px 8px' }} />
          {actions.length > 1 && (
            <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14 }}>×</button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={addRow} style={{ fontFamily: PF, fontSize: 7, color: C.dim, background: 'none', border: `1px dashed ${C.brd}`, padding: '4px 10px', cursor: 'pointer', borderRadius: 4 }}>+ Tilføj</button>
        <button onClick={handleSave} disabled={saving || !actions.some(a => a.title.trim())} style={{ fontFamily: PF, fontSize: 7, color: C.bg, background: saving ? C.dim : C.grn, border: 'none', padding: '4px 12px', cursor: saving ? 'wait' : 'pointer', borderRadius: 4 }}>
          {saving ? 'Gemmer...' : 'Gem action items'}
        </button>
      </div>
    </div>
  );
}

export default function BossRetroStage({
  C,
  PF,
  bossVm,
  oracleUsed,
  onStart,
  onVote,
  onOracle,
  onContinue,
  onRootCause,
  onConfidence,
  onFinish,
  onSaveRetroActions,
}) {
  return (
    <>
      {bossVm.bossStep === 0 && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: 'bossIdle 2s ease-in-out infinite' }}>👾</div>
          <div style={{ fontFamily: PF, fontSize: 11, color: C.red, marginBottom: 12, letterSpacing: 2 }}>
            SPRINT DEMON VÅGNER
          </div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 20, color: C.txt, marginBottom: 8, maxWidth: 320, lineHeight: 1.4 }}>
            Hvad skjuler sprinten? Hvert problem I erkender, giver dæmonen styrke.
          </div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: C.dim, marginBottom: 24, maxWidth: 300, lineHeight: 1.4 }}>
            Men erkendelse er første skridt mod sejr.
          </div>
          <button onClick={onStart} style={{ fontFamily: PF, fontSize: 9, color: C.wht, background: C.red, border: `3px solid ${C.red}`, borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`, padding: '12px 24px', cursor: 'pointer' }}>
            ⚔️ START RETROSPEKTIV
          </button>
        </div>
      )}

      {bossVm.bossStep === 1 && bossVm.currentRetroEvent && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: C.dim }}>
            EVENT {bossVm.currentEvtIdx + 1} / {bossVm.totalEvents}
          </div>
          <div style={{ width: 'min(320px, 85vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: PF, fontSize: 6, color: C.red }}>👾 SPRINT DEMON</span>
              <span style={{ fontFamily: PF, fontSize: 6, color: C.red }}>{bossVm.bossBattleHp} / {bossVm.maxHp} HP</span>
            </div>
            <div style={{ height: 8, background: C.bgL, border: `2px solid ${C.brd}` }}>
              <div style={{ height: '100%', width: `${Math.min((bossVm.bossBattleHp / bossVm.maxHp) * 100, 100)}%`, background: C.red, transition: 'width 0.5s ease' }} />
            </div>
          </div>
          <RetroEventCard event={bossVm.currentRetroEvent} oracleUsed={oracleUsed} onVote={onVote} onOracle={onOracle} />
        </div>
      )}

      {bossVm.bossStep === 2 && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 80, marginBottom: 16, animation: bossVm.bossBattleHp > 60 ? 'bossRage 1s ease-in-out infinite' : 'bossIdle 2s ease-in-out infinite' }}>
            {bossVm.bossMood}
          </div>
          <div style={{ fontFamily: PF, fontSize: 10, color: C.red, marginBottom: 8 }}>
            SPRINT DEMON HAR {bossVm.bossBattleHp} HP
          </div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: C.txt, marginBottom: 8 }}>
            {bossVm.problemEventsCount} problemer identificeret.
          </div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: C.dim, marginBottom: 24 }}>
            {bossVm.bossBattleHp === 0 ? 'Ingen problemer — en perfekt sprint! 🎉' : 'Kan I forklare hvad der skete?'}
          </div>
          <button onClick={onContinue} style={{ fontFamily: PF, fontSize: 9, color: C.bg, background: bossVm.bossBattleHp === 0 ? C.grn : C.yel, border: `3px solid ${bossVm.bossBattleHp === 0 ? C.grn : C.yel}`, borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`, padding: '12px 24px', cursor: 'pointer' }}>
            {bossVm.bossContinueLabel}
          </button>
        </div>
      )}

      {bossVm.bossStep === 3 && bossVm.currentProblemEvent && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: C.dim }}>
            PROBLEM {bossVm.rootCauseIdx + 1} / {bossVm.problemEventsCount}
          </div>
          <RootCauseSelector event={bossVm.currentProblemEvent} onSelect={onRootCause} />
        </div>
      )}

      {bossVm.bossStep === 4 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: PF, fontSize: 9, color: C.yel, marginBottom: 12 }}>FINAL SPØRGSMÅL</div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 22, color: C.wht, marginBottom: 8 }}>Vil vi gentage disse fejl næste sprint?</div>
          <div style={{ fontFamily: 'VT323, monospace', fontSize: 16, color: C.dim, marginBottom: 24 }}>1 = Sikkert · 5 = Aldrig igen</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onConfidence(n)} style={{ fontFamily: PF, fontSize: 9, color: C.bg, background: n <= 2 ? C.red : n === 3 ? C.yel : C.grn, border: `3px solid ${n <= 2 ? C.red : n === 3 ? C.yel : C.grn}`, borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`, padding: '12px 16px', cursor: 'pointer', minWidth: 40 }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {bossVm.bossStep === 5 && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          {bossVm.escaped ? (
            <>
              <div style={{ fontSize: 64, marginBottom: 16 }}>😤</div>
              <div style={{ fontFamily: PF, fontSize: 10, color: C.red, marginBottom: 8 }}>SPRINT DEMON SLIPPER VÆK!</div>
              <div style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: C.dim, marginBottom: 24 }}>{bossVm.maxHp > 0 ? 'HP carry-over til næste sprint...' : ''}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 64, marginBottom: 16, animation: 'victoryPulse 1s ease-in-out infinite' }}>🏆</div>
              <div style={{ fontFamily: PF, fontSize: 12, color: C.grn, marginBottom: 8, animation: 'victoryPulse 1s ease-in-out infinite' }}>SPRINT DEMON BESEJRET!</div>
              <div style={{ fontFamily: 'VT323, monospace', fontSize: 20, color: C.txt, marginBottom: 8 }}>{bossVm.oracleCount > 0 && `🔮 ${bossVm.oracleCount} Oracle-forudsigelse(r)`}</div>
              <div style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: C.dim, marginBottom: 24 }}>{bossVm.summaryText}</div>
            </>
          )}
          {onSaveRetroActions && (
            <RetroActionEditor C={C} PF={PF} onSaveActions={onSaveRetroActions} />
          )}
          <button onClick={onFinish} style={{ fontFamily: PF, fontSize: 9, color: C.bg, background: C.grn, border: `3px solid ${C.grn}`, borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`, padding: '12px 24px', cursor: 'pointer' }}>
            📋 AFSLUT RETROSPEKTIV
          </button>
        </div>
      )}
    </>
  );
}
