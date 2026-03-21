import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Scene, DmgNum } from '../components/session/SessionPrimitives.jsx';
import { C, PF } from '../shared/constants.js';

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

export default function TruthSerumScreen({ sessionId, userId, isGm, organizationId, onBack }) {
  const [phase, setPhase] = useState('setup'); // setup | voting | reveal | report
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [myVotes, setMyVotes] = useState({}); // itemId → estimate
  const [allResponses, setAllResponses] = useState([]); // [{user_id, item_id, estimate}]
  const [biasReport, setBiasReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [achievement, setAchievement] = useState(null);
  const [dmgNums, setDmgNums] = useState([]);

  useEffect(() => {
    if (!sessionId) return;
    loadSessionItems();
    checkAchievement();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSessionItems() {
    setLoading(true);
    const { data } = await supabase
      .from('session_items')
      .select('id, title, estimated_hours, final_estimate, item_status')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  async function checkAchievement() {
    if (!userId) return;
    const { data } = await supabase
      .from('truth_serum_responses')
      .select('session_id')
      .eq('user_id', userId);
    const uniqueSessions = new Set((data || []).map(r => r.session_id));
    if (uniqueSessions.size >= 2) {
      setAchievement({ key: 'truth_seeker', label: 'Truth Seeker 🧪', desc: 'Deltaget i 3 Truth Serum sessions' });
    }
  }

  function toggleItem(itemId) {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) return prev.filter(id => id !== itemId);
      if (prev.length >= 5) return prev;
      return [...prev, itemId];
    });
  }

  function startVoting() {
    if (selectedItems.length < 3) return;
    setPhase('voting');
    setMyVotes({});
  }

  function castVote(itemId, estimate) {
    setMyVotes(prev => ({ ...prev, [itemId]: estimate }));
    // Show dmg number
    const id = Date.now();
    setDmgNums(prev => [...prev, { id, val: estimate, x: 50, y: 40 }]);
    setTimeout(() => setDmgNums(prev => prev.filter(d => d.id !== id)), 1000);
  }

  async function submitVotes() {
    if (Object.keys(myVotes).length < selectedItems.length) return;
    setSubmitting(true);
    try {
      const rows = Object.entries(myVotes).map(([item_id, estimate]) => ({
        session_id: sessionId,
        item_id,
        user_id: userId,
        estimate,
      }));
      await supabase.from('truth_serum_responses').upsert(rows, {
        onConflict: 'session_id,item_id,user_id',
      });

      if (isGm) {
        // GM can trigger reveal
        await loadAllResponses();
        setPhase('reveal');
      } else {
        setPhase('waiting');
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
    setSubmitting(false);
  }

  async function loadAllResponses() {
    const { data } = await supabase
      .from('truth_serum_responses')
      .select('user_id, item_id, estimate')
      .eq('session_id', sessionId)
      .in('item_id', selectedItems);
    setAllResponses(data || []);
    computeBiasReport(data || []);
  }

  function computeBiasReport(responses) {
    // For each user, calculate bias vs median
    const byItem = {};
    responses.forEach(r => {
      if (!byItem[r.item_id]) byItem[r.item_id] = [];
      byItem[r.item_id].push(r.estimate);
    });

    // Compute consensus (median) per item
    const consensus = {};
    Object.entries(byItem).forEach(([itemId, estimates]) => {
      const sorted = [...estimates].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      consensus[itemId] = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    });

    // Compute user bias
    const byUser = {};
    responses.forEach(r => {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      const bias = r.estimate - (consensus[r.item_id] || r.estimate);
      byUser[r.user_id].push(bias);
    });

    const userBias = Object.entries(byUser).map(([userId, biases]) => {
      const avg = biases.reduce((a, b) => a + b, 0) / biases.length;
      return { userId, avgBias: Math.round(avg * 10) / 10 };
    }).sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias));

    setBiasReport({ consensus, userBias, responses, byItem });
  }

  const votedCount = Object.keys(myVotes).length;
  const totalItems = selectedItems.length;
  const progressPct = totalItems > 0 ? Math.round((votedCount / totalItems) * 100) : 0;

  if (loading) {
    return (
      <Scene mc={C.pur}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ fontFamily: PF, fontSize: 10, color: C.pur, animation: 'pulse 1.5s infinite' }}>
            INDLÆSER TRUTH SERUM...
          </div>
        </div>
      </Scene>
    );
  }

  return (
    <Scene mc={C.pur}>
      {/* Floating damage numbers */}
      {dmgNums.map(d => (
        <DmgNum key={d.id} val={d.val} x={d.x} y={d.y} />
      ))}

      <div style={{ minHeight: '100vh', padding: '20px 16px', maxWidth: 660, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: PF, fontSize: 7, padding: '5px 10px',
              background: 'transparent', border: `1px solid ${C.brd}`,
              color: C.dim, cursor: 'pointer',
            }}
          >
            ← BACK
          </button>
          <div style={{ fontFamily: PF, fontSize: 10, color: C.pur, textShadow: `0 0 10px ${C.pur}66`, letterSpacing: '2px' }}>
            🧪 TRUTH SERUM
          </div>
        </div>

        {/* Achievement banner */}
        {achievement && (
          <div style={{
            background: `${C.gld}22`, border: `1px solid ${C.gld}44`,
            borderLeft: `3px solid ${C.gld}`,
            padding: '8px 12px', marginBottom: 16,
            fontFamily: PF, fontSize: 7, color: C.gld, lineHeight: 2,
          }}>
            🏆 {achievement.label}<br />
            <span style={{ fontSize: 6, color: C.dim }}>{achievement.desc}</span>
          </div>
        )}

        {/* Phase: Setup */}
        {phase === 'setup' && (
          <SetupPhase
            items={items}
            selectedItems={selectedItems}
            onToggle={toggleItem}
            onStart={startVoting}
            isGm={isGm}
            C={C}
            PF={PF}
          />
        )}

        {/* Phase: Voting */}
        {phase === 'voting' && (
          <VotingPhase
            items={items.filter(i => selectedItems.includes(i.id))}
            myVotes={myVotes}
            onVote={castVote}
            onSubmit={submitVotes}
            submitting={submitting}
            votedCount={votedCount}
            progressPct={progressPct}
            C={C}
            PF={PF}
          />
        )}

        {/* Phase: Waiting (non-GM) */}
        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontFamily: PF, fontSize: 10, color: C.jade || '#00c896', marginBottom: 12 }}>
              ✅ STEMMER INDSENDT!
            </div>
            <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, lineHeight: 2 }}>
              VENTER PÅ AT GM ÅBNER REVEAL...
            </div>
          </div>
        )}

        {/* Phase: Reveal */}
        {phase === 'reveal' && biasReport && (
          <RevealPhase
            items={items.filter(i => selectedItems.includes(i.id))}
            biasReport={biasReport}
            onReport={() => setPhase('report')}
            C={C}
            PF={PF}
          />
        )}

        {/* Phase: Truth Report */}
        {phase === 'report' && biasReport && (
          <TruthReport
            biasReport={biasReport}
            userId={userId}
            onBack={() => setPhase('reveal')}
            onDone={onBack}
            C={C}
            PF={PF}
          />
        )}

        {/* GM: Load reveal button during voting */}
        {isGm && phase === 'voting' && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={async () => { await loadAllResponses(); setPhase('reveal'); }}
              style={{
                fontFamily: PF, fontSize: 7, padding: '8px 16px',
                background: `${C.pur}33`, border: `1px solid ${C.pur}`,
                color: C.pur, cursor: 'pointer', width: '100%',
              }}
            >
              🔮 GM: ÅBEN REVEAL (ALLE SVAR)
            </button>
          </div>
        )}
      </div>
    </Scene>
  );
}

function SetupPhase({ items, selectedItems, onToggle, onStart, isGm, C, PF }) {
  return (
    <div>
      <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, lineHeight: 2, marginBottom: 16 }}>
        {isGm
          ? `VÆLG 3-5 ITEMS TIL TRUTH SERUM · ALLE ESTIMERER HEMMELIGT`
          : 'GM VÆLGER ITEMS · ALLE ESTIMERER HEMMELIGT — INGEN SER DE ANDRES SVAR'}
      </div>

      {isGm && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {items.map(item => {
              const selected = selectedItems.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', cursor: 'pointer',
                    background: selected ? `${C.pur}22` : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${selected ? C.pur : C.brd}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 0,
                    background: selected ? C.pur : 'transparent',
                    border: `2px solid ${selected ? C.pur : C.brd}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff', flexShrink: 0,
                  }}>
                    {selected && '✓'}
                  </div>
                  <div style={{ fontFamily: PF, fontSize: 6, color: selected ? C.txt || '#ddd' : C.dim, lineHeight: 1.8 }}>
                    {item.title}
                    {item.final_estimate && (
                      <span style={{ color: C.pur, marginLeft: 8 }}>· {item.final_estimate}p</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onStart}
              disabled={selectedItems.length < 3}
              style={{
                fontFamily: PF, fontSize: 8, padding: '10px 20px',
                background: selectedItems.length >= 3 ? C.pur : C.bgL || '#1a1c2e',
                border: `2px solid ${selectedItems.length >= 3 ? C.pur : C.brd}`,
                color: selectedItems.length >= 3 ? '#fff' : C.dim,
                cursor: selectedItems.length >= 3 ? 'pointer' : 'default',
              }}
            >
              🧪 START TRUTH SERUM
            </button>
            <div style={{ fontFamily: PF, fontSize: 6, color: C.dim }}>
              {selectedItems.length}/5 VALGT
            </div>
          </div>
        </>
      )}

      {!isGm && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontFamily: PF, fontSize: 8, color: C.dim, lineHeight: 2 }}>
            VENTER PÅ AT GM<br />STARTER SESSIONEN...
          </div>
        </div>
      )}
    </div>
  );
}

function VotingPhase({ items, myVotes, onVote, onSubmit, submitting, votedCount, progressPct, C, PF }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginBottom: 6 }}>
          DINE HEMLIGE ESTIMATER · {votedCount}/{items.length} BEDØMT
        </div>
        <div style={{ height: 8, background: C.bg || '#0e1019', border: `1px solid ${C.brd}` }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: C.pur, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ fontFamily: PF, fontSize: 6, color: C.pur, marginBottom: 12 }}>
        ⚠️ ALLE SVAR ER SKJULTE — INGEN SER DINE ESTIMATER FØR REVEAL
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map(item => {
          const voted = myVotes[item.id];
          return (
            <div key={item.id} style={{
              padding: '12px 16px',
              background: voted ? `${C.pur}11` : 'rgba(255,255,255,0.02)',
              border: `2px solid ${voted ? C.pur : C.brd}`,
            }}>
              <div style={{ fontFamily: PF, fontSize: 6, color: voted ? C.txt || '#ddd' : C.dim, marginBottom: 10, lineHeight: 1.8 }}>
                {item.title}
                {voted && <span style={{ color: C.pur, marginLeft: 8 }}>→ DIT SVAR: {voted}</span>}
              </div>
              {!voted && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 5, 8, 13, 21].map(v => (
                    <button
                      key={v}
                      onClick={() => onVote(item.id, v)}
                      style={{
                        fontFamily: PF, fontSize: 8, width: 36, height: 36,
                        background: 'transparent', border: `2px solid ${C.pur}`,
                        color: C.pur, cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { e.target.style.background = `${C.pur}33`; }}
                      onMouseLeave={e => { e.target.style.background = 'transparent'; }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {votedCount === items.length && (
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            marginTop: 20, fontFamily: PF, fontSize: 8, padding: '12px 24px',
            background: C.pur, border: 'none', color: '#fff', cursor: 'pointer',
            width: '100%', opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'SENDER...' : '🧪 INDSEND HEMLIGE SVAR'}
        </button>
      )}
    </div>
  );
}

function RevealPhase({ items, biasReport, onReport, C, PF }) {
  const { byItem, consensus, responses } = biasReport;
  const itemMap = new Map(items.map(i => [i.id, i]));

  return (
    <div>
      <div style={{ fontFamily: PF, fontSize: 9, color: C.pur, marginBottom: 16, letterSpacing: '2px' }}>
        🔮 REVEAL — HVEM ESTIMEREDE HVAD?
      </div>

      {items.map(item => {
        const itemResponses = (responses || []).filter(r => r.item_id === item.id);
        const med = consensus[item.id];
        const estimates = itemResponses.map(r => r.estimate).sort((a, b) => a - b);

        return (
          <div key={item.id} style={{
            marginBottom: 16, padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.pur}44`,
          }}>
            <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginBottom: 8, lineHeight: 1.8 }}>
              {item.title}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 6 }}>
              {estimates.map((est, idx) => {
                const diff = est - med;
                const color = diff > 2 ? C.red : diff < -2 ? C.yel : C.grn;
                return (
                  <div key={idx} style={{ textAlign: 'center' }}>
                    <div style={{
                      height: Math.max(16, (est / 21) * 60),
                      width: 24,
                      background: color,
                      marginBottom: 2,
                      transition: 'height 0.5s',
                    }} />
                    <div style={{ fontFamily: PF, fontSize: 6, color: C.dim }}>{est}</div>
                  </div>
                );
              })}
              <div style={{ marginLeft: 8, textAlign: 'center' }}>
                <div style={{ fontFamily: PF, fontSize: 5, color: C.dim }}>MEDIAN</div>
                <div style={{ fontFamily: PF, fontSize: 10, color: C.grn }}>{med}</div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={onReport}
        style={{
          marginTop: 8, fontFamily: PF, fontSize: 8, padding: '10px 20px',
          background: `${C.pur}33`, border: `2px solid ${C.pur}`,
          color: C.pur, cursor: 'pointer', width: '100%',
        }}
      >
        📊 SE TRUTH REPORT →
      </button>
    </div>
  );
}

function TruthReport({ biasReport, userId, onBack, onDone, C, PF }) {
  const { userBias } = biasReport;
  const myBias = userBias.find(u => u.userId === userId);

  return (
    <div>
      <div style={{ fontFamily: PF, fontSize: 9, color: C.pur, marginBottom: 16, letterSpacing: '2px' }}>
        📋 TRUTH REPORT
      </div>

      {myBias && (
        <div style={{
          padding: '16px', marginBottom: 16,
          background: Math.abs(myBias.avgBias) > 2 ? `${C.red}22` : `${C.grn}22`,
          border: `2px solid ${Math.abs(myBias.avgBias) > 2 ? C.red : C.grn}`,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 8 }}>
            DIN BIAS
          </div>
          <div style={{ fontFamily: PF, fontSize: 20, color: Math.abs(myBias.avgBias) > 2 ? C.red : C.grn }}>
            {myBias.avgBias > 0 ? '+' : ''}{myBias.avgBias}
          </div>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginTop: 8, lineHeight: 2 }}>
            {myBias.avgBias > 2
              ? 'DU OVERESTIMERER TYPISK — OVERVEJ LAVERE INITIAL ESTIMATER'
              : myBias.avgBias < -2
              ? 'DU UNDERESTIMERER TYPISK — HUSK EDGE CASES OG TESTS'
              : '🎯 DU ESTIMERER TÆT PÅ KONSENSUS — GOD KALIBRERING!'
            }
          </div>
        </div>
      )}

      <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 12 }}>
        TEAM OVERSIGT — BIAS PER DELTAGER:
      </div>
      {userBias.map((u, idx) => (
        <div key={u.userId} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px', marginBottom: 6,
          background: u.userId === userId ? `${C.pur}22` : 'rgba(255,255,255,0.02)',
          border: `1px solid ${u.userId === userId ? C.pur : C.brd}`,
        }}>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, width: 20 }}>#{idx + 1}</div>
          <div style={{ flex: 1, fontFamily: PF, fontSize: 6, color: u.userId === userId ? C.pur : C.dim }}>
            {u.userId === userId ? '▶ DIG' : `DELTAGER ${idx + 1}`}
          </div>
          <div style={{
            fontFamily: PF, fontSize: 8,
            color: Math.abs(u.avgBias) > 2 ? C.red : Math.abs(u.avgBias) > 1 ? C.yel : C.grn,
          }}>
            {u.avgBias > 0 ? '+' : ''}{u.avgBias}p
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onBack} style={{ fontFamily: PF, fontSize: 6, padding: '8px 14px', background: 'transparent', border: `1px solid ${C.brd}`, color: C.dim, cursor: 'pointer' }}>
          ← TILBAGE
        </button>
        <button onClick={onDone} style={{ fontFamily: PF, fontSize: 6, padding: '8px 14px', flex: 1, background: C.pur, border: 'none', color: '#fff', cursor: 'pointer' }}>
          ✅ FÆRDIG
        </button>
      </div>
    </div>
  );
}
