/**
 * B4: Spec Wars Game Mode
 * session_type: 'spec_wars'
 *
 * 5-step flow:
 *  1. Item vises — alle skriver acceptance criteria (timer: 3 min)
 *  2. Submissions anonymiseres
 *  3. Alle voter (star-rating 1-5)
 *  4. Top-rated spec vises som "winning spec"
 *  5. GM godkender → næste item
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import PostSessionSummary from '../components/session/PostSessionSummary.jsx';
import { supabase } from '../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../shared/constants.js';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

// ── CSS injection ─────────────────────────────────────────────────────────────
let swStylesInjected = false;
function injectStyles() {
  if (swStylesInjected) return;
  swStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes sw-scanline {
      0%   { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    @keyframes sw-reveal {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes sw-winner-glow {
      0%, 100% { box-shadow: 0 0 10px var(--gold); }
      50%       { box-shadow: 0 0 30px var(--gold), 0 0 60px var(--gold); }
    }
    @keyframes sw-timer-pulse {
      0%, 100% { color: var(--jade); }
      50%       { color: var(--danger); opacity: 0.7; }
    }
    @keyframes sw-star-pop {
      0%  { transform: scale(0); }
      70% { transform: scale(1.3); }
      100%{ transform: scale(1); }
    }
    @keyframes sw-screenShake {
      0%, 100% { transform: translate(0, 0); }
      20%       { transform: translate(-5px, 0); }
      40%       { transform: translate(5px, 0); }
      60%       { transform: translate(-3px, 0); }
      80%       { transform: translate(3px, 0); }
    }
    .sw-shake { animation: sw-screenShake 0.5s ease-in-out; }
    @keyframes sw-avatar-float {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-6px); }
    }
    .sw-revealed { animation: sw-reveal 0.4s ease forwards; }
    .sw-winner-card { animation: sw-winner-glow 2s ease-in-out infinite; }
    .sw-timer-urgent { animation: sw-timer-pulse 0.8s ease-in-out infinite; }
    .sw-star-animated { animation: sw-star-pop 0.2s ease forwards; }
    .sw-avatar { animation: sw-avatar-float 3s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ── Web Audio ─────────────────────────────────────────────────────────────────
function playTick() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function playWinner() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [392, 523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'square'; osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function edgeFn(fnName, body, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Build a deterministic pixel-art member object from an index (for anonymous users) */
function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return {
    id: index,
    name: name || `ANON ${index + 1}`,
    lv: 1 + (index % 5),
    cls: cl,
    hat: cl.color,
    body: cl.color,
    btc: dk(cl.color, 60),
    skin: ['#fdd', '#fed', '#edc', '#ffe', '#fec'][index % 5],
    isP: false,
  };
}

/** Build a member object from the user's saved avatar */
function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return {
    id: 0,
    name: 'YOU',
    lv: 3,
    cls: cl,
    hat: avatar?.helmet?.pv || cl.color,
    body: avatar?.armor?.pv || cl.color,
    btc: avatar?.boots?.pv || dk(cl.color, 60),
    skin: avatar?.skin || '#fdd',
    isP: true,
  };
}

function anonymize(submissions, myId, myAvatar) {
  let anonIdx = 0;
  return submissions.map((s) => {
    const isMe = s.author_id === myId;
    const member = isMe ? makeMyMember(myAvatar) : makeAnonMember(anonIdx++);
    return { ...s, member, isMe };
  });
}

// ── Pixel art: Star rating ────────────────────────────────────────────────────
function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => !readOnly && onChange(n)}
          disabled={readOnly}
          className={value >= n ? 'sw-star-animated' : ''}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: readOnly ? 'default' : 'pointer',
            color: value >= n ? 'var(--gold)' : 'var(--text3)',
            filter: value >= n ? 'drop-shadow(0 0 4px var(--gold))' : 'none',
            padding: 2,
            transition: 'color 0.15s',
          }}
        >
          {value >= n ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function Timer({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => {
      setLeft(l => l - 1);
      if (left <= 10) playTick();
    }, 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = Math.floor(left / 60);
  const s = left % 60;
  const urgent = left <= 30;

  return (
    <span
      className={urgent ? 'sw-timer-urgent' : ''}
      style={{ fontFamily: PF, fontSize: 12, color: urgent ? 'var(--danger)' : 'var(--jade)' }}
    >
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ── STEP COMPONENTS ───────────────────────────────────────────────────────────

function Step1Write({ item, onSubmit, userId }) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('spec_submissions').upsert({
      session_id: item.session_id,
      session_item_id: item.id,
      author_id: userId,
      content: text.trim(),
    }, { onConflict: 'session_id,session_item_id,author_id' });
    if (!error) { setSubmitted(true); onSubmit(); }
    setSaving(false);
  }

  return (
    <div style={styles.step}>
      {/* Purpose banner — kerneværdi: formål klar */}
      <div style={{
        background: 'rgba(232,84,84,0.07)', border: '1px solid rgba(232,84,84,0.25)',
        borderLeft: '3px solid var(--danger)',
        padding: '9px 13px', marginBottom: '16px',
        fontFamily: VT, fontSize: '17px', color: 'var(--text2)', lineHeight: 1.6,
      }}>
        <span style={{ fontFamily: PF, fontSize: '6px', color: 'var(--danger)', display: 'block', marginBottom: '3px', letterSpacing: 1 }}>
          HVAD LØSER DETTE?
        </span>
        Spec Wars afslører hvem der forstår kravet forskelligt. Skriv acceptance criteria — den bedste spec vinder og gemmes til projektet.
      </div>

      <div style={styles.itemCard}>
        <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', marginBottom: 8, letterSpacing: 2 }}>
          ITEM TO SPEC
        </div>
        <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text)' }}>{item.title}</div>
        {item.description && (
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)', marginTop: 6 }}>
            {item.description}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
        <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2 }}>
          WRITE ACCEPTANCE CRITERIA
        </div>
        <Timer seconds={180} onExpire={handleSubmit} />
      </div>

      {submitted ? (
        <div style={styles.submitted}>
          <span style={{ fontSize: 28 }}>✅</span>
          <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--jade)' }}>Submitted! Waiting for others...</span>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'Given...\nWhen...\nThen...\n\n• Acceptance Criteria 1\n• Acceptance Criteria 2'}
            style={styles.textarea}
            rows={8}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || saving}
            style={styles.primaryBtn}
          >
            {saving ? 'SUBMITTING...' : 'SUBMIT SPEC ⚔️'}
          </button>
        </>
      )}
    </div>
  );
}

function Step2Vote({ submissions, userId, avatar, sessionId, itemId, onDone, isGM }) {
  const [ratings, setRatings] = useState({});
  const [voted, setVoted] = useState(false);
  const [saving, setSaving] = useState(false);

  const anon = anonymize(submissions, userId, avatar);

  async function handleVote() {
    if (saving) return;
    setSaving(true);
    // Cast votes for each rated submission
    for (const [subId, rating] of Object.entries(ratings)) {
      await supabase.from('spec_votes').upsert({
        submission_id: subId,
        voter_id: userId,
        rating,
      }, { onConflict: 'submission_id,voter_id' });
    }
    setVoted(true);
    setSaving(false);
  }

  return (
    <div style={styles.step}>
      <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--epic)', marginBottom: 16, textAlign: 'center' }}>
        ⚔️ VOTE — BEST SPEC WINS
      </div>

      {anon.map((s, i) => (
        <div
          key={s.id}
          className="sw-revealed"
          style={{ ...styles.submissionCard, animationDelay: `${i * 0.1}s`, opacity: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }} className="sw-avatar">
              <Sprite m={s.member} size={0.85} idle />
            </div>
            {!s.isMe && (
              <StarRating
                value={ratings[s.id] || 0}
                onChange={v => setRatings(r => ({ ...r, [s.id]: v }))}
                readOnly={voted}
              />
            )}
            {s.isMe && (
              <span style={{ fontFamily: VT, fontSize: 14, color: 'var(--text3)' }}>
                (your submission)
              </span>
            )}
          </div>
          <pre style={styles.specText}>{s.content}</pre>
        </div>
      ))}

      {!voted ? (
        <button
          onClick={handleVote}
          disabled={saving || Object.keys(ratings).length === 0}
          style={styles.primaryBtn}
        >
          {saving ? 'VOTING...' : 'CAST VOTES 🗳️'}
        </button>
      ) : (
        <div style={styles.submitted}>
          <span style={{ fontSize: 22 }}>✅</span>
          <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--jade)' }}>
            Votes cast! {isGM ? '' : 'Waiting for GM...'}
          </span>
          {isGM && (
            <button onClick={onDone} style={{ ...styles.primaryBtn, marginTop: 8 }}>
              REVEAL WINNER ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Step3Winner({ winner, submissions, userId, avatar, onNext, isGM }) {
  useEffect(() => { playWinner(); }, []);

  const winnerIdx = submissions.findIndex(s => s.id === winner.id);
  const isMyWin = winner.author_id === userId;
  const winnerMember = isMyWin
    ? makeMyMember(avatar)
    : makeAnonMember(winnerIdx >= 0 ? winnerIdx : 0);

  return (
    <div style={styles.step}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', textShadow: '0 0 12px var(--gold)' }}>
          WINNING SPEC
        </div>
      </div>

      <div className="sw-winner-card" style={styles.winnerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <Sprite m={winnerMember} size={1.0} idle />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StarRating value={Math.round(winner.score || 0)} readOnly />
            <span style={{ fontFamily: PF, fontSize: 7, color: 'var(--text2)', marginLeft: 4 }}>
              {(winner.score || 0).toFixed(1)}
            </span>
          </div>
        </div>
        <pre style={{ ...styles.specText, borderColor: 'var(--gold)', color: 'var(--text)' }}>
          {winner.content}
        </pre>
      </div>

      {isGM && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => onNext('approve')} style={styles.primaryBtn}>
            ✅ APPROVE → NEXT ITEM
          </button>
          <button onClick={() => onNext('skip')} style={styles.secondaryBtn}>
            SKIP
          </button>
        </div>
      )}
      {/* PM-kobling: vis at spec gemmes ved godkendelse */}
      {isGM && (
        <div style={{
          marginTop: 10, fontFamily: VT, fontSize: 16, color: 'var(--jade)',
          textAlign: 'center', opacity: 0.8,
        }}>
          ✅ Godkendelse gemmer spec til projektets historik
        </div>
      )}
      {!isGM && (
        <div style={styles.submitted}>
          <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>
            Waiting for GM to approve...
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SpecWarsScreen({ sessionId, user, avatar, onBack }) {
  useEffect(() => { injectStyles(); }, []);
  const { soundEnabled, toggleSound } = useGameSound();

  const [phase, setPhase] = useState('loading'); // loading | write | vote | winner | done
  const [items, setItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [winner, setWinner] = useState(null);
  const [isGM, setIsGM] = useState(false);
  const [session, setSession] = useState(null);
  const channelRef = useRef(null);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);
  const [shaking, setShaking] = useState(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1200);
  }
  function triggerShake() { setShaking(true); setTimeout(() => setShaking(false), 500); }
  function triggerLoot() { setLootActive(true); setTimeout(() => setLootActive(false), 2000); }

  useEffect(() => {
    loadSession();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSession() {
    // Load session
    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sess) return;
    setSession(sess);
    setIsGM(sess.created_by === user.id);

    // Load items
    const { data: its } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setItems(its || []);

    subscribeRealtime(sess);
    setPhase('write');
  }

  function subscribeRealtime(sess) {
    channelRef.current = supabase
      .channel(`spec-wars-${sessionId}`)
      .on('broadcast', { event: 'phase' }, ({ payload }) => {
        setPhase(payload.phase);
        if (payload.phase === 'vote') loadSubmissions(payload.itemId);
        if (payload.phase === 'winner') setWinner(payload.winner);
        if (payload.phase === 'next') { setCurrentIdx(i => i + 1); setPhase('write'); setSubmissions([]); setWinner(null); }
        if (payload.phase === 'done') setPhase('done');
      })
      .subscribe();
  }

  async function loadSubmissions(itemId) {
    const { data } = await supabase
      .from('spec_submissions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('session_item_id', itemId || currentItem?.id);
    setSubmissions(data || []);
  }

  async function broadcastPhase(payload) {
    await channelRef.current?.send({ type: 'broadcast', event: 'phase', payload });
  }

  const currentItem = items[currentIdx];

  async function onWriteSubmit() {
    if (!isGM) return;
    // GM can trigger vote phase when ready
  }

  async function gmTriggerVote() {
    if (!isGM || !currentItem) return;
    await loadSubmissions(currentItem.id);
    setPhase('vote');
    broadcastPhase({ phase: 'vote', itemId: currentItem.id });
  }

  async function onVoteDone() {
    if (!isGM || !currentItem) return;
    // Calculate winner
    const { data: token } = await supabase.auth.getSession();
    const result = await edgeFn('finalize-spec-wars', {
      sessionId,
      itemId: currentItem.id,
    }, token?.session?.access_token);

    // Fetch winning submission
    const { data: winSub } = await supabase
      .from('spec_submissions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('session_item_id', currentItem.id)
      .eq('is_winner', true)
      .maybeSingle();

    const w = winSub || submissions[0];
    setWinner(w);
    setPhase('winner');
    broadcastPhase({ phase: 'winner', winner: w });
    // Game soul: winner reveal effects
    addDmg('🏆 +20 XP', C.gld);
    triggerShake();
    triggerLoot();
    playWinner();
  }

  async function onGMDecision(decision) {
    if (decision === 'approve' && winner && currentItem) {
      // Accept the approval (or just move to next)
      await supabase.from('approval_requests')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('target_id', currentItem.id)
        .eq('target_type', 'spec_wars_acceptance_criteria');
    }

    if (currentIdx + 1 >= items.length) {
      setPhase('done');
      broadcastPhase({ phase: 'done' });
    } else {
      broadcastPhase({ phase: 'next' });
      setCurrentIdx(i => i + 1);
      setPhase('write');
      setSubmissions([]);
      setWinner(null);
    }
  }

  if (phase === 'loading') {
    return (
      <div style={styles.container}>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--epic)', textAlign: 'center' }}>
          Loading Spec Wars...
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 60 }}>⚔️</div>
          <div style={{ fontFamily: PF, fontSize: 12, color: 'var(--jade)', marginTop: 16 }}>
            SPEC WARS COMPLETE
          </div>
          <PostSessionSummary
            sessionType="spec_wars"
            results={{
              winning_spec: winner?.text,
              acceptance_criteria: winner?.text,
            }}
            approvalPending={true}
            approvalItems={['Spec godkendelse afventer GM']}
            projectName={session?.title}
            onViewApproval={onBack}
            onBack={onBack}
            sessionId={sessionId}
            teamId={session?.world_id}
          />
        </div>
      </div>
    );
  }

  return (
    <Scene mc={C.acc}>
      <div className={shaking ? 'sw-shake' : ''} style={styles.container}>
        {/* Damage numbers */}
        {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
        {/* Loot drops */}
        <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <LootDrops active={lootActive} items={[{ icon: '📜', label: '+XP', color: C.gld }, { icon: '⭐', label: 'SPEC', color: C.yel }]} />
        </div>
        {/* NPC Spectators */}
        <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
          {NPC_TEAM.map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
        </div>
        {/* XP Bar */}
        {user?.id && <XPBadgeNotifier userId={user.id} />}
        {user?.id && (
          <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
            <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
            <GameXPBar userId={user.id} />
          </div>
        )}
        {/* Header */}
        <div style={styles.header}>
          <button onClick={onBack} style={styles.backBtn}>← BACK</button>
          <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--epic)', textShadow: '0 0 8px var(--epic)' }}>
            ⚔️ SPEC WARS
          </div>
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>
            {currentIdx + 1}/{items.length}
          </div>
        </div>

        {/* Scanlines */}
        <div style={styles.scanlines} />

        {/* Phase content */}
        <div style={styles.content}>
          {phase === 'write' && currentItem && (
            <Step1Write
              item={currentItem}
              userId={user.id}
              onSubmit={onWriteSubmit}
            />
          )}
          {phase === 'write' && isGM && currentItem && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={gmTriggerVote} style={styles.gmBtn}>
                GM: START VOTING ▶
              </button>
            </div>
          )}

          {phase === 'vote' && currentItem && (
            <Step2Vote
              submissions={submissions}
              userId={user.id}
              avatar={avatar}
              sessionId={sessionId}
              itemId={currentItem.id}
              onDone={onVoteDone}
              isGM={isGM}
            />
          )}

          {phase === 'winner' && winner && (
            <Step3Winner
              winner={winner}
              submissions={submissions}
              userId={user.id}
              avatar={avatar}
              onNext={onGMDecision}
              isGM={isGM}
            />
          )}
        </div>
      </div>
    </Scene>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg2)',
    position: 'relative',
    zIndex: 2,
  },
  content: {
    flex: 1,
    padding: '24px 20px',
    position: 'relative',
    zIndex: 1,
    maxWidth: 600,
    margin: '0 auto',
    width: '100%',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  itemCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--epic)',
    borderRadius: 8,
    padding: '14px 16px',
    boxShadow: '0 0 16px var(--epic-dim)',
  },
  submissionCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 8,
  },
  winnerCard: {
    background: 'var(--bg2)',
    border: '2px solid var(--gold)',
    borderRadius: 10,
    padding: '16px 18px',
  },
  specText: {
    fontFamily: VT,
    fontSize: 18,
    color: 'var(--text2)',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 12px',
    whiteSpace: 'pre-wrap',
    margin: 0,
    lineHeight: 1.4,
  },
  textarea: {
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    color: 'var(--text)',
    fontFamily: VT,
    fontSize: 18,
    padding: '12px 14px',
    resize: 'vertical',
    lineHeight: 1.5,
    outline: 'none',
  },
  submitted: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    background: 'rgba(0,200,150,0.08)',
    border: '1px solid rgba(0,200,150,0.2)',
    borderRadius: 8,
    flexDirection: 'column',
  },
  primaryBtn: {
    fontFamily: PF,
    fontSize: 8,
    color: 'var(--bg)',
    background: 'var(--jade)',
    border: 'none',
    borderRadius: 6,
    padding: '12px 20px',
    cursor: 'pointer',
    letterSpacing: 1,
    width: '100%',
  },
  secondaryBtn: {
    fontFamily: PF,
    fontSize: 8,
    color: 'var(--text2)',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '12px 20px',
    cursor: 'pointer',
    letterSpacing: 1,
  },
  gmBtn: {
    fontFamily: PF,
    fontSize: 7,
    color: 'var(--bg)',
    background: 'var(--epic)',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    cursor: 'pointer',
    letterSpacing: 1,
    boxShadow: '0 0 12px var(--epic)',
  },
  backBtn: {
    fontFamily: PF,
    fontSize: 7,
    color: 'var(--text3)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 10px',
    cursor: 'pointer',
  },
};
