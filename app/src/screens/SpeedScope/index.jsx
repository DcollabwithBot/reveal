import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../../shared/constants.js';
import { getDisplaySprites } from '../../lib/participantHelpers.js';
import { fetchRawParticipants } from '../../lib/sessionHelpers.js';
import GameXPBar from '../../components/session/GameXPBar.jsx';
import SoundToggle from '../../components/session/SoundToggle.jsx';
import { useGameSound } from '../../hooks/useGameSound.js';
import XPBadgeNotifier from '../../components/XPBadgeNotifier.jsx';

import { injectSSStyles } from './ssStyles.js';
import { makeAnonMember, PF, VT, avgEstimate } from './ssHelpers.js';
import StepSpeed from './StepSpeed.jsx';
import StepDiscuss from './StepDiscuss.jsx';
import StepDelta from './StepDelta.jsx';
import StepStats from './StepStats.jsx';

export default function SpeedScopeScreen({ sessionId, user, avatar, onBack }) {
  const xpBarRef = useRef(null);
  const { soundEnabled, toggleSound } = useGameSound();
  const [step, setStep] = useState('loading');
  const [items, setItems] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [isGM, setIsGM] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [round1Votes, setRound1Votes] = useState({});
  const [round2Votes, setRound2Votes] = useState({});
  const [round1All, setRound1All] = useState({});
  const [round2All, setRound2All] = useState({});
  const [voteCount, setVoteCount] = useState(0);
  const [showSpeedVotes, setShowSpeedVotes] = useState(false);
  const [responseTimes, setResponseTimes] = useState({});
  const channelRef = useRef(null);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1200);
  }
  function triggerLoot() { setLootActive(true); setTimeout(() => setLootActive(false), 2000); }

  useEffect(() => {
    injectSSStyles();
    loadData();
    return () => { channelRef.current?.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      const { data: sessionItems } = await supabase.from('session_items').select('*').eq('session_id', sessionId).order('position', { ascending: true });
      const parts = await fetchRawParticipants(sessionId);
      if (sessionItems) setItems(sessionItems);
      if (parts.length > 0) {
        setParticipants(parts);
        const me = parts.find(p => p.user_id === user?.id);
        if (me) setIsGM(me.is_host);
      }
      setupRealtime();
      setStep('lobby');
    } catch (err) {
      console.error('SpeedScope load error:', err);
      setStep('lobby');
    }
  }

  function setupRealtime() {
    const ch = supabase.channel('speed-scope-' + sessionId)
      .on('broadcast', { event: 'GAME_START' }, () => setStep('speed'))
      .on('broadcast', { event: 'NEXT_ITEM' }, ({ payload }) => { setCurrentItemIndex(payload.itemIndex || 0); setVoteCount(0); })
      .on('broadcast', { event: 'ROUND2_START' }, () => { setStep('discuss'); setCurrentItemIndex(0); setVoteCount(0); })
      .on('broadcast', { event: 'DELTA_READY' }, () => setStep('delta'))
      .on('broadcast', { event: 'STATS_READY' }, () => setStep('stats'))
      .on('broadcast', { event: 'VOTE_CAST' }, () => setVoteCount(c => c + 1))
      .subscribe();
    channelRef.current = ch;
  }

  async function handleSpeedVote(itemId, estimate, responseTimeMs) {
    if (!estimate) return;
    setRound1Votes(v => ({ ...v, [itemId]: estimate }));
    setResponseTimes(rt => { const existing = rt[user?.id] || []; return { ...rt, [user?.id]: [...existing, responseTimeMs] }; });
    await supabase.from('speed_estimates').upsert({ session_id: sessionId, item_id: itemId, user_id: user?.id, estimate, round: 1, response_time_ms: responseTimeMs }, { onConflict: 'session_id,item_id,user_id,round' });
    channelRef.current?.send({ type: 'broadcast', event: 'VOTE_CAST', payload: { itemId } });
  }

  async function handleDiscussVote(itemId, estimate) {
    setRound2Votes(v => ({ ...v, [itemId]: estimate }));
    await supabase.from('speed_estimates').upsert({ session_id: sessionId, item_id: itemId, user_id: user?.id, estimate, round: 2 }, { onConflict: 'session_id,item_id,user_id,round' });
    channelRef.current?.send({ type: 'broadcast', event: 'VOTE_CAST', payload: { itemId } });
  }

  async function gmAdvanceSpeed() {
    const nextIdx = currentItemIndex + 1;
    if (nextIdx >= items.length) {
      const { data } = await supabase.from('speed_estimates').select('item_id, estimate, user_id').eq('session_id', sessionId).eq('round', 1);
      const byItem = {};
      (data || []).forEach(e => { if (!byItem[e.item_id]) byItem[e.item_id] = []; byItem[e.item_id].push(e.estimate); });
      setRound1All(byItem);
      channelRef.current?.send({ type: 'broadcast', event: 'ROUND2_START', payload: {} });
    } else {
      setCurrentItemIndex(nextIdx);
      setVoteCount(0);
      channelRef.current?.send({ type: 'broadcast', event: 'NEXT_ITEM', payload: { itemIndex: nextIdx } });
    }
  }

  async function gmAdvanceDiscuss() {
    const nextIdx = currentItemIndex + 1;
    if (nextIdx >= items.length) {
      const { data } = await supabase.from('speed_estimates').select('item_id, estimate, round, user_id').eq('session_id', sessionId);
      const r1 = {}, r2 = {};
      (data || []).forEach(e => {
        if (e.round === 1) { if (!r1[e.item_id]) r1[e.item_id] = []; r1[e.item_id].push(e.estimate); }
        if (e.round === 2) { if (!r2[e.item_id]) r2[e.item_id] = []; r2[e.item_id].push(e.estimate); }
      });
      setRound1All(r1);
      setRound2All(r2);
      channelRef.current?.send({ type: 'broadcast', event: 'DELTA_READY', payload: {} });
      addDmg('⚡ +XP', '#8b5cf6');
      triggerLoot();
    } else {
      setCurrentItemIndex(nextIdx);
      setVoteCount(0);
      channelRef.current?.send({ type: 'broadcast', event: 'NEXT_ITEM', payload: { itemIndex: nextIdx } });
    }
  }

  async function startGame() {
    channelRef.current?.send({ type: 'broadcast', event: 'GAME_START', payload: {} });
    setStep('speed');
  }

  const xpBarEl = user?.id ? (
    <>
      <XPBadgeNotifier userId={user.id} />
      <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
        <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
        <GameXPBar userId={user.id} ref={xpBarRef} />
      </div>
    </>
  ) : null;

  const gameSoulOverlays = (
    <>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '⚡', label: '+XP', color: '#8b5cf6' }, { icon: '🎯', label: 'SPEED', color: C.gld }]} />
      </div>
      <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
        {getDisplaySprites(participants, NPC_TEAM).map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
      </div>
    </>
  );

  if (step === 'loading') {
    return (
      <Scene mc="#8b5cf6">
        <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {xpBarEl}
          {gameSoulOverlays}
          <div style={{ fontFamily: PF, fontSize: 10, color: 'var(--text3)' }}>LOADING...</div>
        </div>
      </Scene>
    );
  }

  if (step === 'lobby') {
    return (
      <Scene mc="#8b5cf6">
        <div style={{ minHeight: '100vh', background: 'transparent', padding: '24px 20px' }}>
          {xpBarEl}
          <div style={{ position: 'fixed', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div className="ss-speed-title" style={{ fontFamily: PF, fontSize: 18, color: '#00aaff', letterSpacing: 2, marginBottom: 8 }}>⚡ SPEED SCOPE</div>
            <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text2)', marginBottom: 32 }}>Estimate fast. Reflect slow. Find hidden complexity.</div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 32 }}>
              {participants.map((p, i) => {
                const member = makeAnonMember(i, p.profiles?.display_name || p.display_name);
                return <div key={p.id} className="ss-pop" style={{ textAlign: 'center', animation: `ss-pop 0.4s ease ${i * 0.1}s both` }}><Sprite m={member} size={1.5} /></div>;
              })}
            </div>

            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontFamily: PF, fontSize: 8, color: 'var(--text3)', marginBottom: 8 }}>HOW IT WORKS</div>
              <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', lineHeight: 1.6 }}>
                Round 1: 10 seconds per item. No discussion. Just gut feeling.<br/>
                Round 2: 2 minutes per item. Discuss, then re-vote.<br/>
                Delta: See where speed and discussion differ → hidden complexity!
              </div>
            </div>

            {isGM && (
              <button onClick={startGame} style={{ fontFamily: PF, fontSize: 10, color: 'var(--bg)', background: '#00aaff', border: '3px solid #00aaff', borderBottom: '6px solid #004488', padding: '14px 32px', cursor: 'pointer', letterSpacing: 1 }}>
                ⚡ START SPEED ROUND
              </button>
            )}
            {!isGM && <div style={{ fontFamily: VT, fontSize: 20, color: 'var(--text3)' }}>Waiting for GM to start...</div>}

            <div style={{ marginTop: 24 }}>
              <button onClick={onBack} style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', padding: '8px 16px', cursor: 'pointer' }}>
                ← BACK
              </button>
            </div>
          </div>
          {gameSoulOverlays}
        </div>
      </Scene>
    );
  }

  if (step === 'speed') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepSpeed items={items} currentItemIndex={currentItemIndex} onVote={handleSpeedVote} votedItems={round1Votes} isGM={isGM} participantCount={participants.length} voteCount={voteCount} onGMAdvance={gmAdvanceSpeed} />
      </Scene>
    );
  }

  if (step === 'discuss') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepDiscuss items={items} currentItemIndex={currentItemIndex} onVote={handleDiscussVote} votedItems={round2Votes} mySpeedEstimates={round1Votes} isGM={isGM} participantCount={participants.length} voteCount={voteCount} showSpeedVotes={showSpeedVotes} allRound1={round1All} onGMAdvance={gmAdvanceDiscuss} onToggleShowSpeed={() => setShowSpeedVotes(v => !v)} />
      </Scene>
    );
  }

  if (step === 'delta') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepDelta items={items} round1Estimates={round1All} round2Estimates={round2All} isGM={isGM}
          onContinue={() => { channelRef.current?.send({ type: 'broadcast', event: 'STATS_READY', payload: {} }); setStep('stats'); }}
          onApplyEstimates={async () => {
            for (const item of items) {
              const avg = avgEstimate(round2All[item.id] || []);
              if (avg) await supabase.from('session_items').update({ estimate: avg }).eq('id', item.id);
            }
          }}
        />
      </Scene>
    );
  }

  if (step === 'stats') {
    return (
      <Scene mc="#8b5cf6">
        {gameSoulOverlays}
        {xpBarEl}
        <StepStats items={items} round1Estimates={round1All} round2Estimates={round2All} participants={participants} responseTimes={responseTimes} onBack={onBack} sessionId={sessionId} />
      </Scene>
    );
  }

  return null;
}
