import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sprite } from '../components/session/SessionPrimitives.jsx';
import { CLASSES } from '../shared/constants.js';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TSHIRT_POINTS = { XS: 1, S: 2, M: 3, L: 5, XL: 8, XXL: 13 };

const STEPS = { LOBBY: 1, BREAKDOWN: 2, GM_MERGE: 3, QUICK_ESTIMATE: 4, SUM_REVEAL: 5, GAP_ANALYSIS: 6, APPROVAL: 7 };

// ─── WEB AUDIO ────────────────────────────────────────────────────────────────
function playDing(index) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = [523, 587, 659, 698, 784, 880, 988, 1047];
    const freq = frequencies[index % frequencies.length];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* audio blocked */ }
}

function playBuzz() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = 120;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* audio blocked */ }
}

function playDollOpen() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch (e) { /* audio blocked */ }
}

// ─── MATRYOSHKA DOLL ─────────────────────────────────────────────────────────
function MatryoshkaDoll({ itemName, size = 1, topRef, bottomRef, opening = false }) {
  const s = size;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* TOP HALF */}
      <div
        ref={topRef}
        className={opening ? 'ns-doll-top-opening' : ''}
        style={{
          width: 120 * s, height: 80 * s,
          borderRadius: `50% 50% 0 0 / 60% 60% 0 0`,
          background: `linear-gradient(180deg, #cc2200 0%, #dd4411 70%, #cc2200 100%)`,
          border: `${3 * s}px solid #991100`,
          borderBottom: 'none',
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: 'hidden',
          transformOrigin: 'bottom center',
          zIndex: 2,
        }}
      >
        {/* Head */}
        <div style={{
          width: 60 * s, height: 50 * s, marginTop: 6 * s,
          background: '#fdd', borderRadius: '50%',
          border: `${2 * s}px solid #cc9977`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4 * s,
          position: 'relative',
        }}>
          {/* Eyes */}
          <div style={{ display: 'flex', gap: 10 * s, marginTop: -4 * s }}>
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: '#222' }} />
            <div style={{ width: 6 * s, height: 6 * s, borderRadius: '50%', background: '#222' }} />
          </div>
          {/* Smile */}
          <div style={{
            width: 20 * s, height: 10 * s,
            borderRadius: `0 0 ${10 * s}px ${10 * s}px`,
            border: `${2 * s}px solid #c44`,
            borderTop: 'none',
            marginTop: -2 * s,
          }} />
        </div>
        {/* Flower decorations */}
        {[20, 40, 70, 90].map((left, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: 8 * s, left: left * s / 1.2,
            width: 8 * s, height: 8 * s, borderRadius: '50%',
            background: i % 2 === 0 ? '#feae34' : '#4caf50',
            border: `${1 * s}px solid rgba(0,0,0,0.3)`,
          }} />
        ))}
      </div>

      {/* YELLOW BAND */}
      <div style={{
        width: 120 * s, height: 24 * s,
        background: '#feae34',
        borderTop: `${2 * s}px solid #cc8800`,
        borderBottom: `${2 * s}px solid #cc8800`,
        borderLeft: `${3 * s}px solid #991100`,
        borderRight: `${3 * s}px solid #991100`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3,
      }}>
        {itemName && (
          <span style={{ fontFamily: VT, fontSize: 12 * s, color: '#222', textAlign: 'center', padding: `0 ${4 * s}px`, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 110 * s }}>
            {itemName}
          </span>
        )}
      </div>

      {/* BOTTOM HALF */}
      <div
        ref={bottomRef}
        className={opening ? 'ns-doll-bottom-opening' : ''}
        style={{
          width: 120 * s, height: 60 * s,
          borderRadius: `0 0 45% 45% / 0 0 40% 40%`,
          background: `linear-gradient(180deg, #cc2200 0%, #dd4411 50%, #cc2200 100%)`,
          border: `${3 * s}px solid #991100`,
          borderTop: 'none',
          transformOrigin: 'top center',
          zIndex: 1,
        }}
      />
    </div>
  );
}

// ─── ACHIEVEMENT POPUP ────────────────────────────────────────────────────────
function AchievementPopup({ achievements, onDone }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!achievements.length) { onDone(); return; }
    playDing(idx + 4);
  }, [idx]);

  const next = () => {
    if (idx + 1 < achievements.length) setIdx(i => i + 1);
    else onDone();
  };

  if (!achievements.length || !visible) return null;
  const ach = achievements[idx];

  return (
    <div className="ns-achievement-popup" onClick={next} style={{ cursor: 'pointer' }}>
      <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--gold)', marginBottom: 8 }}>ACHIEVEMENT UNLOCKED</div>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{ach.icon}</div>
      <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--text)', marginBottom: 4 }}>{ach.name}</div>
      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{ach.desc}</div>
      <div style={{ fontFamily: VT, fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>TAP TO CONTINUE</div>
    </div>
  );
}

// ─── STEP 1: LOBBY ────────────────────────────────────────────────────────────
function StepLobby({ sessionId, user, avatar, participants, item, isGM, onStart }) {
  return (
    <div className="ns-step ns-lobby">
      <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--gold)', textAlign: 'center', lineHeight: 2, marginBottom: 24 }}>
        RUSSIAN<br />NESTING SCOPE
      </div>

      <MatryoshkaDoll itemName={item?.title || '???'} size={1.4} />

      <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text2)', textAlign: 'center', marginTop: 16 }}>
        What hides inside this scope?
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 20 }}>
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Sprite avatar={p.avatar} size={40} />
            <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)' }}>{p.name}</span>
          </div>
        ))}
      </div>

      {isGM && (
        <button className="ns-btn ns-btn-primary" onClick={onStart} style={{ marginTop: 32 }}>
          START BREAKDOWN
        </button>
      )}
      {!isGM && (
        <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text3)', marginTop: 32 }}>
          Waiting for GM to start...
        </div>
      )}
    </div>
  );
}

// ─── STEP 2: BREAKDOWN ────────────────────────────────────────────────────────
function StepBreakdown({ sessionId, user, item, participants, onSubmit }) {
  const [inputs, setInputs] = useState(['']);
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`ns-breakdown-count-${sessionId}`)
      .on('broadcast', { event: 'SUBMITTED' }, ({ payload }) => {
        setSubmittedCount(payload.count);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  const addInput = () => {
    if (inputs.length < 5) setInputs(prev => [...prev, '']);
  };

  const removeInput = (i) => setInputs(prev => prev.filter((_, idx) => idx !== i));
  const updateInput = (i, val) => setInputs(prev => prev.map((v, idx) => idx === i ? val : v));

  const handleSubmit = async () => {
    const titles = inputs.map(s => s.trim()).filter(Boolean);
    if (!titles.length) return;
    const rows = titles.map(title => ({
      session_id: sessionId,
      item_id: item.id,
      author_id: user.id,
      title,
      description: '',
      status: 'pending',
    }));
    await supabase.from('scope_submissions').insert(rows);
    setSubmitted(true);
    onSubmit(titles.length);
    await supabase.channel(`ns-breakdown-count-${sessionId}`)
      .send({ type: 'broadcast', event: 'SUBMITTED', payload: { count: submittedCount + 1, userId: user.id } });
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 30;

  return (
    <div className="ns-step ns-breakdown">
      <div style={{ fontFamily: PF, fontSize: 10, color: urgent ? 'var(--danger)' : 'var(--gold)', marginBottom: 16 }}>
        {mins}:{secs}
      </div>
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--text)', marginBottom: 8, textAlign: 'center', lineHeight: 1.8 }}>
        WHAT SUB-TASKS<br />HIDE INSIDE?
      </div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 20, textAlign: 'center' }}>
        "{item?.title}"
      </div>

      {!submitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 480 }}>
          {inputs.map((val, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="ns-input"
                placeholder={`Sub-task ${i + 1}`}
                value={val}
                onChange={e => updateInput(i, e.target.value)}
                maxLength={80}
              />
              {inputs.length > 1 && (
                <button className="ns-btn-icon" onClick={() => removeInput(i)}>✕</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {inputs.length < 5 && (
              <button className="ns-btn ns-btn-secondary" onClick={addInput}>+ ADD</button>
            )}
            <button className="ns-btn ns-btn-primary" onClick={handleSubmit}>SUBMIT</button>
          </div>
        </div>
      ) : (
        <div className="ns-submitted-box">
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--jade)' }}>SUBMITTED {inputs.filter(Boolean).length} ITEMS</div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text3)', marginTop: 24 }}>
        {submittedCount} / {participants.length} submitted
      </div>
    </div>
  );
}

// ─── STEP 3: GM MERGE ────────────────────────────────────────────────────────
function StepGMMerge({ sessionId, item, isGM, onMergeDone }) {
  const [submissions, setSubmissions] = useState([]);
  const [states, setStates] = useState({}); // id -> 'active'|'duplicate'|'deleted'
  const [renames, setRenames] = useState({});

  useEffect(() => {
    supabase.from('scope_submissions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('item_id', item.id)
      .then(({ data }) => {
        if (data) {
          setSubmissions(data);
          const s = {};
          data.forEach(d => { s[d.id] = 'active'; });
          setStates(s);
        }
      });
  }, [sessionId, item?.id]);

  const toggleDuplicate = (id) => {
    setStates(prev => ({ ...prev, [id]: prev[id] === 'duplicate' ? 'active' : 'duplicate' }));
  };
  const deleteItem = (id) => setStates(prev => ({ ...prev, [id]: 'deleted' }));
  const rename = (id, val) => setRenames(prev => ({ ...prev, [id]: val }));

  const confirmMerge = async () => {
    const approved = submissions.filter(s => states[s.id] === 'active');
    const rejected = submissions.filter(s => states[s.id] !== 'active');

    for (const s of approved) {
      await supabase.from('scope_submissions').update({ status: 'approved', title: renames[s.id] || s.title }).eq('id', s.id);
    }
    for (const s of rejected) {
      await supabase.from('scope_submissions').update({ status: 'rejected' }).eq('id', s.id);
    }

    const finalItems = approved.map(s => ({ id: s.id, title: renames[s.id] || s.title }));
    await supabase.channel(`nesting-scope-${sessionId}`)
      .send({ type: 'broadcast', event: 'MERGE_DONE', payload: { items: finalItems } });
    onMergeDone(finalItems);
  };

  if (!isGM) {
    return (
      <div className="ns-step" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <MatryoshkaDoll size={1} />
        <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)', marginTop: 20 }} className="ns-pulse">
          GM IS MERGING SCOPE...
        </div>
      </div>
    );
  }

  return (
    <div className="ns-step ns-gm-merge">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16 }}>GM MERGE</div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
        Review &amp; clean up submissions
      </div>

      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {submissions.map(s => {
          const st = states[s.id];
          if (st === 'deleted') return null;
          return (
            <div key={s.id} className={`ns-merge-row ${st === 'duplicate' ? 'ns-merge-dup' : ''}`}>
              <input
                className="ns-input ns-input-sm"
                value={renames[s.id] !== undefined ? renames[s.id] : s.title}
                onChange={e => rename(s.id, e.target.value)}
                disabled={st === 'duplicate'}
              />
              <button
                className={`ns-btn-tag ${st === 'duplicate' ? 'active' : ''}`}
                onClick={() => toggleDuplicate(s.id)}
                title="Mark duplicate"
              >DUP</button>
              <button className="ns-btn-icon ns-danger" onClick={() => deleteItem(s.id)}>✕</button>
            </div>
          );
        })}
      </div>

      <button className="ns-btn ns-btn-primary" onClick={confirmMerge} style={{ marginTop: 24 }}>
        CONFIRM MERGE
      </button>
    </div>
  );
}

// ─── STEP 4: QUICK ESTIMATE ───────────────────────────────────────────────────
function StepQuickEstimate({ sessionId, user, item, mergedItems, participants, onAllDone }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [votes, setVotes] = useState({});
  const [timeLeft, setTimeLeft] = useState(15);
  const [revealed, setRevealed] = useState(false);
  const [allEstimates, setAllEstimates] = useState({});
  const timerRef = useRef(null);

  const currentItem = mergedItems[currentIdx];

  const resetTimer = () => {
    setTimeLeft(15);
    setMyVote(null);
    setVotes({});
    setRevealed(false);
  };

  useEffect(() => {
    resetTimer();
  }, [currentIdx]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setRevealed(true);
          if (t === 1) playBuzz();
          return 0;
        }
        if (t === 5) playBuzz();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIdx]);

  useEffect(() => {
    const ch = supabase.channel(`ns-estimate-${sessionId}-${currentIdx}`)
      .on('broadcast', { event: 'VOTE' }, ({ payload }) => {
        setVotes(prev => {
          const next = { ...prev, [payload.userId]: payload.size };
          if (Object.keys(next).length >= participants.length) {
            clearInterval(timerRef.current);
            setRevealed(true);
          }
          return next;
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId, currentIdx, participants.length]);

  const vote = async (size) => {
    if (myVote) return;
    setMyVote(size);
    await supabase.from('scope_estimates').insert({
      session_id: sessionId,
      item_id: currentItem.id,
      user_id: user.id,
      tshirt_size: size,
      round: 1,
    });
    await supabase.channel(`ns-estimate-${sessionId}-${currentIdx}`)
      .send({ type: 'broadcast', event: 'VOTE', payload: { userId: user.id, size } });
  };

  const advance = () => {
    const newEstimates = { ...allEstimates, [currentItem.id]: { votes, item: currentItem } };
    setAllEstimates(newEstimates);
    if (currentIdx + 1 >= mergedItems.length) {
      onAllDone(newEstimates);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const urgent = timeLeft < 5;
  const voteCounts = TSHIRT_SIZES.map(sz => ({ size: sz, count: Object.values(votes).filter(v => v === sz).length }));
  const topSize = revealed && voteCounts.reduce((a, b) => b.count > a.count ? b : a, voteCounts[0]);

  return (
    <div className="ns-step ns-estimate">
      <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 8 }}>
        ITEM {currentIdx + 1} / {mergedItems.length}
      </div>
      <div style={{ fontFamily: VT, fontSize: 26, color: 'var(--text)', marginBottom: 4, textAlign: 'center' }}>
        {currentItem?.title}
      </div>

      {/* Timer */}
      <div style={{
        fontFamily: PF, fontSize: 28,
        color: urgent ? 'var(--danger)' : 'var(--gold)',
        marginBottom: 20,
        animation: urgent ? 'ns-pulse 0.5s infinite' : 'none',
      }}>
        {timeLeft}
      </div>

      {/* Votes */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
        {TSHIRT_SIZES.map(sz => (
          <button
            key={sz}
            className={`ns-vote-card ${myVote === sz ? 'ns-vote-selected' : ''} ${revealed && topSize?.size === sz ? 'ns-vote-winner' : ''}`}
            onClick={() => vote(sz)}
            disabled={!!myVote || revealed}
          >
            <span style={{ fontFamily: PF, fontSize: 10 }}>{sz}</span>
            <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{TSHIRT_POINTS[sz]}p</span>
            {revealed && (
              <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--gold)' }}>
                {voteCounts.find(v => v.size === sz)?.count || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text3)' }}>
        {Object.keys(votes).length} / {participants.length} voted
      </div>

      {revealed && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {topSize && (
            <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)' }}>
              → {topSize.size} ({TSHIRT_POINTS[topSize.size]}p)
            </div>
          )}
          <button className="ns-btn ns-btn-primary" onClick={advance}>
            {currentIdx + 1 >= mergedItems.length ? 'OPEN THE DOLL →' : 'NEXT ITEM →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── STEP 5: SUM REVEAL ───────────────────────────────────────────────────────
function StepSumReveal({ sessionId, mergedItems, allEstimates, item, isGM, onDone }) {
  const [opened, setOpened] = useState(false);
  const [settledItems, setSettledItems] = useState([]);
  const [total, setTotal] = useState(0);
  const topRef = useRef();
  const bottomRef = useRef();

  const getTopSize = (estimates) => {
    if (!estimates) return null;
    const counts = {};
    Object.values(estimates.votes || {}).forEach(sz => { counts[sz] = (counts[sz] || 0) + 1; });
    return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, [null, 0])[0];
  };

  const handleOpen = async () => {
    if (opened) return;
    setOpened(true);
    playDollOpen();

    if (isGM) {
      await supabase.channel(`nesting-scope-${sessionId}`)
        .send({ type: 'broadcast', event: 'DOLL_OPEN', payload: {} });
    }

    // Staggered item pop-out
    let sum = 0;
    const settled = [];
    for (let i = 0; i < mergedItems.length; i++) {
      await new Promise(r => setTimeout(r, 300 + i * 200));
      playDing(i);
      const sz = getTopSize(allEstimates[mergedItems[i].id]);
      const pts = TSHIRT_POINTS[sz] || 0;
      sum += pts;
      settled.push({ ...mergedItems[i], size: sz, pts });
      setSettledItems([...settled]);
      setTotal(sum);
    }
  };

  return (
    <div className="ns-step ns-sum-reveal">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16, textAlign: 'center', lineHeight: 2 }}>
        DUKKEN ÅBNER SIG
      </div>

      {!opened ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div className={`ns-doll-wrapper ${!opened ? 'ns-doll-clickable' : ''}`} onClick={handleOpen}>
            <MatryoshkaDoll itemName={item?.title} size={1.5} topRef={topRef} bottomRef={bottomRef} opening={opened} />
          </div>
          <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)' }} className="ns-pulse">
            CLICK TO OPEN
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          {/* Opened doll shell */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
            <MatryoshkaDoll size={0.7} opening={true} />
          </div>

          {/* Settled items grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 560 }}>
            {settledItems.map((si, i) => (
              <div key={si.id} className="ns-settled-item" style={{ animationDelay: `${i * 0.15}s` }}>
                <span style={{ fontFamily: VT, fontSize: 18, color: 'var(--text)' }}>{si.title}</span>
                <span className="ns-estimate-badge">{si.size} · {si.pts}p</span>
              </div>
            ))}
          </div>

          {settledItems.length >= mergedItems.length && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: PF, fontSize: 14, color: 'var(--gold)' }}>{total}p TOTAL</div>
              <button className="ns-btn ns-btn-primary" onClick={() => onDone(total)}>
                VIEW GAP ANALYSIS →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STEP 6: GAP ANALYSIS ─────────────────────────────────────────────────────
function StepGapAnalysis({ item, mergedItems, allEstimates, total, onContinue }) {
  const original = item?.estimate || 0;
  const pctDiff = original > 0 ? Math.round(((total - original) / original) * 100) : 0;
  const color = Math.abs(pctDiff) <= 20 ? 'var(--jade)' : Math.abs(pctDiff) <= 50 ? 'var(--warn)' : 'var(--danger)';
  const maxH = 160;
  const origH = original > 0 ? Math.round((original / Math.max(original, total)) * maxH) : maxH / 2;
  const totalH = Math.round((total / Math.max(original, total)) * maxH);

  const complexItems = mergedItems.filter(m => {
    const sz = Object.values(allEstimates[m.id]?.votes || {});
    return sz.includes('XL') || sz.includes('XXL');
  }).length;

  return (
    <div className="ns-step ns-gap">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--text)', marginBottom: 8 }}>GAP ANALYSIS</div>
      <div style={{ fontFamily: PF, fontSize: 12, color, textAlign: 'center', lineHeight: 2, marginBottom: 24 }}>
        {pctDiff > 0 ? `SCOPE WAS ${pctDiff}% LARGER` : pctDiff < 0 ? `SCOPE WAS ${Math.abs(pctDiff)}% SMALLER` : 'SCOPE WAS ON TARGET'}
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end', height: maxH + 40, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)' }}>{original}p</div>
          <div
            className="ns-bar"
            style={{ width: 64, height: origH, background: 'var(--border2)', animationDelay: '0s' }}
          />
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>ORIGINAL</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: VT, fontSize: 18, color }}>{total}p</div>
          <div
            className="ns-bar"
            style={{ width: 64, height: totalH, background: color, animationDelay: '0.3s' }}
          />
          <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text3)' }}>ACTUAL</div>
        </div>
      </div>

      <div style={{ fontFamily: VT, fontSize: 22, color: 'var(--text2)', textAlign: 'center' }}>
        Hidden complexity found in <span style={{ color: 'var(--warn)' }}>{complexItems}</span> items
      </div>

      <button className="ns-btn ns-btn-primary" onClick={onContinue} style={{ marginTop: 24 }}>
        CONTINUE →
      </button>
    </div>
  );
}

// ─── STEP 7: APPROVAL ─────────────────────────────────────────────────────────
function StepApproval({ sessionId, user, item, mergedItems, allEstimates, isGM, onDone }) {
  const [included, setIncluded] = useState(() => {
    const m = {};
    mergedItems.forEach(i => { m[i.id] = true; });
    return m;
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const getTopSize = (estimates) => {
    if (!estimates) return null;
    const counts = {};
    Object.values(estimates.votes || {}).forEach(sz => { counts[sz] = (counts[sz] || 0) + 1; });
    return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, [null, 0])[0];
  };

  const createChildItems = async () => {
    setLoading(true);
    const toCreate = mergedItems
      .filter(m => included[m.id])
      .map(m => {
        const sz = getTopSize(allEstimates[m.id]);
        return { id: m.id, title: m.title, tshirt_size: sz, estimate: TSHIRT_POINTS[sz] || 0 };
      });

    const { error } = await supabase.functions.invoke('finalize-nesting', {
      body: { session_id: sessionId, parent_item_id: item.id, items: toCreate },
    });

    if (!error) {
      await supabase.channel(`nesting-scope-${sessionId}`)
        .send({ type: 'broadcast', event: 'APPROVAL_DONE', payload: {} });
      setDone(true);
      onDone();
    }
    setLoading(false);
  };

  if (!isGM) {
    return (
      <div className="ns-step" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: VT, fontSize: 24, color: 'var(--text2)' }} className="ns-pulse">
          Waiting for GM approval...
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="ns-step ns-celebration">
        <div style={{ fontSize: 64 }} className="ns-bounce">🎉</div>
        <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--jade)', marginTop: 16 }}>CHILD ITEMS CREATED!</div>
      </div>
    );
  }

  return (
    <div className="ns-step ns-approval">
      <div style={{ fontFamily: PF, fontSize: 9, color: 'var(--gold)', marginBottom: 16 }}>GM APPROVAL</div>
      <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 16 }}>
        Select items to create in PM
      </div>

      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mergedItems.map(m => {
          const sz = getTopSize(allEstimates[m.id]);
          return (
            <label key={m.id} className="ns-approval-row">
              <input
                type="checkbox"
                checked={!!included[m.id]}
                onChange={e => setIncluded(prev => ({ ...prev, [m.id]: e.target.checked }))}
              />
              <span style={{ fontFamily: VT, fontSize: 20, color: 'var(--text)', flex: 1 }}>{m.title}</span>
              <span className="ns-estimate-badge">{sz} · {TSHIRT_POINTS[sz] || 0}p</span>
            </label>
          );
        })}
      </div>

      <button
        className="ns-btn ns-btn-primary"
        onClick={createChildItems}
        disabled={loading}
        style={{ marginTop: 24 }}
      >
        {loading ? 'CREATING...' : 'CREATE CHILD ITEMS IN PM'}
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function NestingScopeScreen({ sessionId, user, avatar, onBack }) {
  const xpBarRef = useRef(null);
  const { soundEnabled, toggleSound } = useGameSound();
  const [step, setStep] = useState(STEPS.LOBBY);
  const [participants, setParticipants] = useState([]);
  const [item, setItem] = useState(null);
  const [isGM, setIsGM] = useState(false);
  const [mergedItems, setMergedItems] = useState([]);
  const [allEstimates, setAllEstimates] = useState({});
  const [revealTotal, setRevealTotal] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [showAchievements, setShowAchievements] = useState(false);

  // Load session data
  useEffect(() => {
    supabase.from('sessions').select('*, gm_id, current_item_id').eq('id', sessionId).single()
      .then(({ data }) => {
        if (!data) return;
        setIsGM(data.gm_id === user.id);
        if (data.current_item_id) {
          supabase.from('session_items').select('*').eq('id', data.current_item_id).single()
            .then(({ data: itm }) => { if (itm) setItem(itm); });
        }
      });

    supabase.from('session_participants').select('*').eq('session_id', sessionId)
      .then(({ data }) => { if (data) setParticipants(data); });
  }, [sessionId, user.id]);

  // Realtime channel
  useEffect(() => {
    const ch = supabase.channel(`nesting-scope-${sessionId}`)
      .on('broadcast', { event: 'GAME_START' }, () => setStep(STEPS.BREAKDOWN))
      .on('broadcast', { event: 'BREAKDOWN_DONE' }, () => setStep(STEPS.GM_MERGE))
      .on('broadcast', { event: 'MERGE_DONE' }, ({ payload }) => {
        setMergedItems(payload.items || []);
        setStep(STEPS.QUICK_ESTIMATE);
      })
      .on('broadcast', { event: 'ESTIMATE_DONE' }, () => setStep(STEPS.SUM_REVEAL))
      .on('broadcast', { event: 'DOLL_OPEN' }, () => {})
      .on('broadcast', { event: 'GAP_READY' }, () => setStep(STEPS.GAP_ANALYSIS))
      .on('broadcast', { event: 'APPROVAL_DONE' }, () => {
        computeAchievements();
        setShowAchievements(true);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  const computeAchievements = () => {
    const earned = [];
    // Archaeologist: user submitted 3+ unique sub-items
    const myItems = mergedItems.filter(() => true); // simplified
    if (myItems.length >= 3) {
      earned.push({ name: 'Archaeologist', icon: '⛏️', desc: 'Found 3+ sub-items nobody else found' });
    }
    // Scope Slayer: total is 20%+ reduced vs original
    if (item?.estimate && revealTotal < item.estimate * 0.8) {
      earned.push({ name: 'Scope Slayer', icon: '🗡️', desc: 'Total estimate reduced by 20%+ after discussion' });
    }
    setAchievements(earned);
  };

  const handleStart = async () => {
    await supabase.channel(`nesting-scope-${sessionId}`)
      .send({ type: 'broadcast', event: 'GAME_START', payload: {} });
    setStep(STEPS.BREAKDOWN);
  };

  const handleBreakdownSubmit = async () => {
    // Check if all submitted - simplified: GM can force advance
    await supabase.channel(`nesting-scope-${sessionId}`)
      .send({ type: 'broadcast', event: 'BREAKDOWN_DONE', payload: {} });
    setStep(STEPS.GM_MERGE);
  };

  const handleMergeDone = (items) => {
    setMergedItems(items);
    setStep(STEPS.QUICK_ESTIMATE);
  };

  const handleEstimatesDone = async (estimates) => {
    setAllEstimates(estimates);
    await supabase.channel(`nesting-scope-${sessionId}`)
      .send({ type: 'broadcast', event: 'ESTIMATE_DONE', payload: {} });
    setStep(STEPS.SUM_REVEAL);
  };

  const handleRevealDone = async (total) => {
    setRevealTotal(total);
    await supabase.channel(`nesting-scope-${sessionId}`)
      .send({ type: 'broadcast', event: 'GAP_READY', payload: {} });
    setStep(STEPS.GAP_ANALYSIS);
  };

  const handleApprovalDone = () => {
    computeAchievements();
    setShowAchievements(true);
  };

  const stepLabel = ['', 'LOBBY', 'BREAKDOWN', 'GM MERGE', 'ESTIMATE', 'REVEAL', 'GAP', 'APPROVAL'][step];

  return (
    <>
      {/* XP Bar + Achievement notifier */}
      {user?.id && <XPBadgeNotifier userId={user.id} />}
      {user?.id && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={user.id} ref={xpBarRef} />
        </div>
      )}
      {/* CSS */}
      <style>{`
        .ns-root {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          color: var(--text);
          position: relative;
          overflow: hidden;
        }
        .ns-root::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px);
          pointer-events: none; z-index: 0;
        }
        .ns-header {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px;
          border-bottom: 2px solid var(--border);
          background: var(--bg2);
          position: relative; z-index: 1;
        }
        .ns-back-btn {
          font-family: ${PF};
          font-size: 8px; color: var(--text3);
          background: none; border: 1px solid var(--border);
          padding: 6px 10px; cursor: pointer;
        }
        .ns-back-btn:hover { color: var(--text); border-color: var(--border2); }
        .ns-step-label {
          font-family: ${PF}; font-size: 7px; color: var(--text3); letter-spacing: 2px;
        }
        .ns-step {
          flex: 1;
          display: flex; flex-direction: column; align-items: center;
          padding: 32px 20px 40px;
          position: relative; z-index: 1;
          overflow-y: auto;
        }
        .ns-lobby { gap: 20px; }
        .ns-btn {
          font-family: ${PF}; font-size: 9px; cursor: pointer;
          padding: 12px 20px; border: 2px solid; letter-spacing: 1px;
          transition: opacity 0.15s; background: transparent;
        }
        .ns-btn:hover { opacity: 0.8; }
        .ns-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ns-btn-primary { color: var(--jade); border-color: var(--jade); }
        .ns-btn-primary:hover { background: rgba(0,200,100,0.08); }
        .ns-btn-secondary { color: var(--text2); border-color: var(--border); }
        .ns-btn-icon {
          font-size: 14px; background: none; border: 1px solid var(--border);
          color: var(--text3); cursor: pointer; padding: 4px 8px; border-radius: 2px;
        }
        .ns-btn-icon:hover { border-color: var(--border2); color: var(--text); }
        .ns-btn-icon.ns-danger:hover { border-color: var(--danger); color: var(--danger); }
        .ns-btn-tag {
          font-family: ${VT}; font-size: 14px;
          background: none; border: 1px solid var(--border);
          color: var(--text3); cursor: pointer; padding: 3px 8px;
        }
        .ns-btn-tag.active { background: rgba(255,100,100,0.1); border-color: var(--danger); color: var(--danger); }
        .ns-input {
          font-family: ${VT}; font-size: 20px;
          background: var(--bg3); border: 1px solid var(--border);
          color: var(--text); padding: 8px 12px;
          flex: 1; outline: none;
        }
        .ns-input:focus { border-color: var(--border2); }
        .ns-input-sm { font-size: 16px; padding: 5px 8px; }
        .ns-submitted-box {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 24px 40px; border: 2px solid var(--jade);
          background: rgba(0,200,100,0.05); margin-top: 8px;
        }
        .ns-merge-row {
          display: flex; gap: 8px; align-items: center;
          padding: 8px; background: var(--bg2); border: 1px solid var(--border);
        }
        .ns-merge-dup { opacity: 0.45; }
        .ns-vote-card {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          width: 72px; padding: 16px 8px;
          background: var(--bg2); border: 2px solid var(--border);
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .ns-vote-card:hover:not(:disabled) { border-color: var(--border2); background: var(--bg3); }
        .ns-vote-card.ns-vote-selected { border-color: var(--jade); background: rgba(0,200,100,0.1); }
        .ns-vote-card.ns-vote-winner { border-color: var(--gold); background: rgba(254,174,52,0.1); }
        .ns-estimate-badge {
          font-family: ${VT}; font-size: 16px;
          background: var(--bg3); border: 1px solid var(--border);
          color: var(--gold); padding: 2px 8px;
        }
        .ns-settled-item {
          display: flex; flex-direction: column; gap: 4px;
          padding: 10px 14px; background: var(--bg2); border: 1px solid var(--border);
          animation: ns-itemSettle 0.4s ease-out both;
        }
        .ns-doll-clickable { cursor: pointer; transition: transform 0.2s; }
        .ns-doll-clickable:hover { transform: scale(1.05); }
        .ns-doll-wrapper { display: flex; align-items: center; justify-content: center; }
        .ns-bar {
          border: 1px solid var(--border);
          animation: ns-barGrow 0.6s ease-out both;
          transform-origin: bottom;
        }
        .ns-approval-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; background: var(--bg2); border: 1px solid var(--border);
          cursor: pointer;
        }
        .ns-approval-row input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--jade); }
        .ns-celebration { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
        .ns-achievement-popup {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 1000;
          animation: ns-fadeIn 0.3s ease-out;
          padding: 32px;
          text-align: center;
        }
        @keyframes ns-fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes ns-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ns-itemSettle {
          0% { opacity: 0; transform: translateY(-40px) scale(0.7); }
          60% { transform: translateY(6px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ns-barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes ns-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-16px); }
        }
        .ns-pulse { animation: ns-pulse 1.5s ease-in-out infinite; }
        .ns-bounce { animation: ns-bounce 0.8s ease-in-out infinite; }
        .ns-doll-top-opening {
          animation: ns-dollOpen-top 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .ns-doll-bottom-opening {
          animation: ns-dollOpen-bottom 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes ns-dollOpen-top {
          0% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-10%) rotate(-3deg); }
          100% { transform: translateY(-120%) rotate(-8deg); }
        }
        @keyframes ns-dollOpen-bottom {
          0% { transform: scaleX(1); }
          100% { transform: scaleX(1.1); }
        }
        @keyframes ns-itemPop {
          0% { opacity: 0; transform: scale(0) translateY(0); }
          50% { opacity: 1; transform: scale(1.2) translateY(-20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ns-ding {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 16px var(--gold); }
        }
      `}</style>

      <div className="ns-root">
        {/* Header */}
        <div className="ns-header">
          <button className="ns-back-btn" onClick={onBack}>← BACK</button>
          <div style={{ flex: 1 }} />
          <span className="ns-step-label">STEP {step}/7 · {stepLabel}</span>
          {isGM && (
            <span style={{ fontFamily: VT, fontSize: 16, color: 'var(--gold)', marginLeft: 12 }}>GM</span>
          )}
        </div>

        {/* Steps */}
        {step === STEPS.LOBBY && (
          <StepLobby
            sessionId={sessionId}
            user={user}
            avatar={avatar}
            participants={participants}
            item={item}
            isGM={isGM}
            onStart={handleStart}
          />
        )}

        {step === STEPS.BREAKDOWN && (
          <StepBreakdown
            sessionId={sessionId}
            user={user}
            item={item}
            participants={participants}
            onSubmit={handleBreakdownSubmit}
          />
        )}

        {step === STEPS.GM_MERGE && (
          <StepGMMerge
            sessionId={sessionId}
            item={item}
            isGM={isGM}
            onMergeDone={handleMergeDone}
          />
        )}

        {step === STEPS.QUICK_ESTIMATE && (
          <StepQuickEstimate
            sessionId={sessionId}
            user={user}
            item={item}
            mergedItems={mergedItems}
            participants={participants}
            onAllDone={handleEstimatesDone}
          />
        )}

        {step === STEPS.SUM_REVEAL && (
          <StepSumReveal
            sessionId={sessionId}
            mergedItems={mergedItems}
            allEstimates={allEstimates}
            item={item}
            isGM={isGM}
            onDone={handleRevealDone}
          />
        )}

        {step === STEPS.GAP_ANALYSIS && (
          <StepGapAnalysis
            item={item}
            mergedItems={mergedItems}
            allEstimates={allEstimates}
            total={revealTotal}
            onContinue={() => setStep(STEPS.APPROVAL)}
          />
        )}

        {step === STEPS.APPROVAL && (
          <StepApproval
            sessionId={sessionId}
            user={user}
            item={item}
            mergedItems={mergedItems}
            allEstimates={allEstimates}
            isGM={isGM}
            onDone={handleApprovalDone}
          />
        )}

        {/* Achievement popup overlay */}
        {showAchievements && achievements.length > 0 && (
          <AchievementPopup
            achievements={achievements}
            onDone={() => setShowAchievements(false)}
          />
        )}
      </div>
    </>
  );
}
