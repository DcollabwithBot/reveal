import { useState, useEffect, useRef } from 'react';
import { handleSoftError } from '../../lib/errorHandler';
import PostSessionSummary from '../../components/session/PostSessionSummary.jsx';
import { supabase } from '../../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../../components/session/SessionPrimitives.jsx';
import { NPC_TEAM, C } from '../../shared/constants.js';
import { getDisplaySprites } from '../../lib/participantHelpers.js';
import { fetchRawParticipants } from '../../lib/sessionHelpers.js';
import GameXPBar from '../../components/session/GameXPBar.jsx';
import SoundToggle from '../../components/session/SoundToggle.jsx';
import { useGameSound } from '../../hooks/useGameSound.js';
import XPBadgeNotifier from '../../components/XPBadgeNotifier.jsx';

import { injectBPStyles } from './bpStyles.js';
import { playTick, playCardReveal, playBossRoar, playWin, startSuspenseMusic } from './bpAudio.js';
import { makeMyMember, makeAnonMember } from './bpHelpers.js';
import StepLobby from './StepLobby.jsx';
import StepEstimate from './StepEstimate.jsx';
import StepReveal from './StepReveal.jsx';
import StepGuess from './StepGuess.jsx';
import StepAfsloering from './StepAfsloering.jsx';
import StepScoring from './StepScoring.jsx';
import StepRevote from './StepRevote.jsx';
import { cornerControls, spectatorBar } from '../../shared/styles.js';

export default function BluffPokerScreen({ sessionId, user, avatar, onBack }) {
  injectBPStyles();
  const xpBarRef = useRef(null);
  const { soundEnabled, toggleSound } = useGameSound();

  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [item, setItem] = useState(null);
  const [blufferId, setBlufferId] = useState(null);
  const [isGM, setIsGM] = useState(false);

  const [myVote, setMyVote] = useState(null);
  const [allVotes, setAllVotes] = useState({});
  const [votedCount, setVotedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);

  const [myGuess, setMyGuess] = useState(null);
  const [guessCount, setGuessCount] = useState(0);
  const [guessTimeLeft, setGuessTimeLeft] = useState(120);
  const [guessResults, setGuessResults] = useState({});

  const [scores, setScores] = useState({});
  const [achievements, setAchievements] = useState([]);

  const [myRevote, setMyRevote] = useState(null);
  const [revoteCount, setRevoteCount] = useState(0);
  const [finalEstimate, setFinalEstimate] = useState(null);
  const [showPostSummary, setShowPostSummary] = useState(false);
  const [rationalityWinner, setRationalityWinner] = useState(null);

  const [shaking, setShaking] = useState(false);
  const [showRevealBtn, setShowRevealBtn] = useState(false);
  const [dmgNums, setDmgNums] = useState([]);
  const [lootActive, setLootActive] = useState(false);

  function addDmg(value, color = C.gld) {
    const id = Date.now();
    setDmgNums(p => [...p, { id, value, color }]);
    setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 1200);
  }
  function triggerLoot() { setLootActive(true); setTimeout(() => setLootActive(false), 2000); }

  const timerRef = useRef(null);
  const guessTimerRef = useRef(null);
  const suspenseRef = useRef(null);
  const channelRef = useRef(null);

  // ── Fetch participants ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const pRows = await fetchRawParticipants(sessionId);
      if (!pRows.length) return;
      const mapped = pRows.map((p, i) => {
        const isMe = p.user_id === user?.id;
        const member = isMe ? makeMyMember(avatar) : makeAnonMember(i, p.profiles?.username || `P${i + 1}`);
        return { id: p.id, userId: p.user_id, name: p.profiles?.username || `P${i + 1}`, is_host: p.is_host, member, voted: false };
      });
      setParticipants(mapped);
      const me = pRows.find(p => p.user_id === user?.id);
      if (me?.is_host) setIsGM(true);
    }
    load();
  }, [sessionId, user?.id]);

  // ── Fetch active item ───────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('session_items').select('*').eq('session_id', sessionId).eq('status', 'active').single();
      if (data) setItem(data);
    }
    load();
  }, [sessionId]);

  // ── Realtime channel ────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`bluff-poker-${sessionId}`)
      .on('broadcast', { event: 'GAME_START' }, ({ payload }) => { setBlufferId(payload.bluffer_user_id); setStep(2); })
      .on('broadcast', { event: 'NEW_ESTIMATE' }, ({ payload }) => {
        setVotedCount(payload.count);
        setParticipants(prev => prev.map(p => payload.voter_ids?.includes(p.userId) ? { ...p, voted: true } : p));
      })
      .on('broadcast', { event: 'GUESS_CAST' }, ({ payload }) => { setGuessCount(payload.count); })
      .on('broadcast', { event: 'AFSLOERING' }, ({ payload }) => {
        setBlufferId(payload.bluffer_user_id);
        setAllVotes(payload.votes || {});
        setGuessResults(payload.guess_results || {});
        triggerAfsloering();
        setStep(5);
        setTimeout(() => setStep(6), 3500);
      })
      .on('broadcast', { event: 'FINAL_APPROVED' }, ({ payload }) => { setFinalEstimate(payload.estimate); playWin(); })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // ── Timer: estimate phase ───────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        if (t <= 5) playTick();
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  // ── Timer: guess phase ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    setGuessTimeLeft(120);
    startSuspenseMusic(suspenseRef);
    guessTimerRef.current = setInterval(() => {
      setGuessTimeLeft(t => {
        if (t <= 1) { clearInterval(guessTimerRef.current); if (suspenseRef.current) suspenseRef.current.stop(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(guessTimerRef.current); if (suspenseRef.current) suspenseRef.current.stop(); };
  }, [step]);

  // ── Reveal button delay ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3) { setShowRevealBtn(false); return; }
    const t = setTimeout(() => setShowRevealBtn(true), 2000);
    participants.forEach((_, i) => playCardReveal(i));
    return () => clearTimeout(t);
  }, [step]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleStartGame() {
    if (!item || participants.length === 0) return;
    const randomP = participants[Math.floor(Math.random() * participants.length)];
    const blufferUserId = randomP.userId;
    await supabase.from('bluff_assignments').insert({ session_id: sessionId, item_id: item.id, bluffer_user_id: blufferUserId });
    channelRef.current?.send({ type: 'broadcast', event: 'GAME_START', payload: { bluffer_user_id: blufferUserId } });
  }

  async function handleVote(value) {
    if (!item) return;
    setMyVote(value);
    await supabase.from('bluff_estimates').upsert({ session_id: sessionId, item_id: item.id, user_id: user.id, estimate: value, round: 1 }, { onConflict: 'session_id,item_id,user_id,round' });
    const newCount = votedCount + 1;
    channelRef.current?.send({ type: 'broadcast', event: 'NEW_ESTIMATE', payload: { count: newCount, voter_ids: participants.filter(p => p.voted).map(p => p.userId).concat([user.id]) } });
    if (timeLeft <= 0 || newCount >= participants.length) setTimeout(() => fetchVotesAndReveal(), 1000);
  }

  async function fetchVotesAndReveal() {
    if (!item) return;
    const { data } = await supabase.from('bluff_estimates').select('user_id, estimate').eq('session_id', sessionId).eq('item_id', item.id).eq('round', 1);
    const votes = {};
    data?.forEach(r => { votes[r.user_id] = r.estimate; });
    setAllVotes(votes);
    setStep(3);
  }

  function handleShowGuess() { setStep(4); }

  async function handleGuess(suspectedUserId) {
    if (!item) return;
    setMyGuess(suspectedUserId);
    await supabase.from('bluff_guesses').insert({ session_id: sessionId, item_id: item.id, guesser_id: user.id, suspected_user_id: suspectedUserId });
    const newCount = guessCount + 1;
    channelRef.current?.send({ type: 'broadcast', event: 'GUESS_CAST', payload: { count: newCount } });
    setGuessCount(newCount);
  }

  async function handleAfsloering() {
    if (!item) return;
    const { data: guesses } = await supabase.from('bluff_guesses').select('guesser_id, suspected_user_id').eq('session_id', sessionId).eq('item_id', item.id);
    const results = {};
    guesses?.forEach(g => { results[g.guesser_id] = g.suspected_user_id === blufferId; });
    channelRef.current?.send({ type: 'broadcast', event: 'AFSLOERING', payload: { bluffer_user_id: blufferId, votes: allVotes, guess_results: results } });
  }

  function triggerAfsloering() {
    playBossRoar();
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }

  // ── Score & XP ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 6) return;
    awardScores();
  }, [step]);

  async function awardScores() {
    if (!item) return;
    const newScores = {};
    const newAchievements = [];
    const { data: guesses } = await supabase.from('bluff_guesses').select('guesser_id, suspected_user_id').eq('session_id', sessionId).eq('item_id', item.id);
    const guessMap = {};
    guesses?.forEach(g => { guessMap[g.guesser_id] = g.suspected_user_id; });
    const blufferGuessedBy = guesses?.filter(g => g.suspected_user_id === blufferId) || [];
    const blufferSurvived = blufferGuessedBy.length === 0;
    const voteValues = Object.values(allVotes).filter(v => v != null);
    const avg = voteValues.length ? voteValues.reduce((a, b) => a + b, 0) / voteValues.length : 0;
    const blufferVote = allVotes[blufferId];
    const pokerFace = blufferVote != null && Math.abs(blufferVote - avg) <= 1;

    for (const p of participants) {
      const isBluffer = p.userId === blufferId;
      const guessedCorrectly = guessMap[p.userId] === blufferId;
      let xp = 0; let label = '';
      if (guessedCorrectly && !isBluffer) { xp = 10; label = '+10 XP — Detective!'; }
      if (isBluffer && blufferSurvived) { xp = 15; label = '+15 XP — Bluffer survived!'; }
      if (xp > 0) await supabase.from('xp_events').insert({ session_id: sessionId, user_id: p.userId, xp, reason: isBluffer ? 'bluffer_survived' : 'detective' }).catch(() => {});
      newScores[p.userId] = { xp, label };
    }

    if (blufferSurvived) {
      newAchievements.push({ name: 'Master Bluffer', icon: '🃏', desc: 'Nobody guessed you!', xp: 25 });
      await supabase.from('achievements').upsert({ session_id: sessionId, user_id: blufferId, achievement: 'master_bluffer' }).catch(() => {});
    }
    const detectives = participants.filter(p => p.userId !== blufferId && guessMap[p.userId] === blufferId);
    if (detectives.some(p => p.userId === user?.id)) newAchievements.push({ name: 'Detective', icon: '🔍', desc: 'You found the bluffer!', xp: 10 });
    if (pokerFace && blufferId === user?.id) newAchievements.push({ name: 'Poker Face', icon: '😐', desc: 'Your bluff estimate was within ±1 of consensus!', xp: 10 });

    setScores(newScores);
    if (newAchievements.length > 0) setAchievements(newAchievements);
  }

  async function handleRevote(value) {
    if (!item) return;
    setMyRevote(value);
    await supabase.from('bluff_estimates').upsert({ session_id: sessionId, item_id: item.id, user_id: user.id, estimate: value, round: 2 }, { onConflict: 'session_id,item_id,user_id,round' });
    setRevoteCount(c => c + 1);
  }

  async function handleFinalize() {
    if (!item) return;
    const { data } = await supabase.functions.invoke('finalize-bluff', { body: { session_id: sessionId, item_id: item.id } });
    const estimate = data?.estimate ?? myRevote;
    setFinalEstimate(estimate);
    try {
      const { data: votes } = await supabase.from('bluff_estimates').select('user_id, estimate, discussion_notes').eq('session_id', sessionId).eq('item_id', item.id);
      if (votes && votes.length > 1) {
        const estimates = votes.map(v => v.estimate).filter(e => e != null);
        const median = estimates.sort((a, b) => a - b)[Math.floor(estimates.length / 2)];
        const scored = votes.map(v => { const noteLen = Math.min((v.discussion_notes || '').length, 200); return { userId: v.user_id, score: noteLen / 4 }; }).sort((a, b) => b.score - a.score);
        if (scored[0]) { const winner = participants.find(p => p.userId === scored[0].userId); if (winner) setRationalityWinner(winner.name); }
      }
    } catch (e) { handleSoftError(e, 'rationality-scoring'); }
    channelRef.current?.send({ type: 'broadcast', event: 'FINAL_APPROVED', payload: { estimate } });
    playWin();
    addDmg('🃏 +XP', C.gld);
    triggerLoot();
  }

  function handleAchievementClose(idx) {
    setAchievements(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Scene mc={C.red}>
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '🃏', label: '+XP', color: C.gld }, { icon: '🔍', label: 'BLUFF', color: C.red }]} />
      </div>
      <div style={spectatorBar}>
        {getDisplaySprites(participants.map(p => p.member || p), NPC_TEAM).map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
      </div>
      <div className={shaking ? 'bp-shake' : ''} style={{ minHeight: '100vh', background: 'transparent', color: 'var(--text)', position: 'relative', overflow: 'hidden' }}>
        {user?.id && <XPBadgeNotifier userId={user.id} />}
        {user?.id && (
          <div style={cornerControls}>
            <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
            <GameXPBar userId={user.id} ref={xpBarRef} />
          </div>
        )}
        <div className="scanlines" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
          {step === 1 && <StepLobby participants={participants} item={item} isGM={isGM} onStart={handleStartGame} onBack={onBack} />}
          {step === 2 && <StepEstimate participants={participants} item={item} myVote={myVote} onVote={handleVote} votedCount={votedCount} timeLeft={timeLeft} />}
          {step === 3 && <StepReveal participants={participants} allVotes={allVotes} blufferId={blufferId} onNext={handleShowGuess} showButton={showRevealBtn} />}
          {step === 4 && <StepGuess participants={participants} myGuess={myGuess} onGuess={handleGuess} guessCount={guessCount} isGM={isGM} onAfsloering={handleAfsloering} timeLeft={guessTimeLeft} userId={user?.id} />}
          {step === 5 && <StepAfsloering participants={participants} blufferId={blufferId} guessResults={guessResults} />}
          {step === 6 && <StepScoring participants={participants} scores={scores} blufferId={blufferId} achievements={achievements} onAchievementClose={handleAchievementClose} onNext={() => setStep(7)} />}
          {step === 7 && !showPostSummary && <StepRevote item={item} myRevote={myRevote} onRevote={handleRevote} isGM={isGM} onFinalize={handleFinalize} finalEstimate={finalEstimate} votedCount={revoteCount} participants={participants} onDone={() => setShowPostSummary(true)} />}
          {step === 7 && showPostSummary && (
            <PostSessionSummary sessionType="bluff_poker" results={{ estimate: finalEstimate, item_title: item?.title, discussion_notes: true, rationality_winner: rationalityWinner }} approvalPending={false} approvalItems={[]} onBack={onBack} sessionId={sessionId} />
          )}
        </div>
      </div>
    </Scene>
  );
}
