import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Sprite, Scene, DmgNum, LootDrops } from '../components/session/SessionPrimitives.jsx';
import { CLASSES, NPC_TEAM, C } from '../shared/constants.js';
import { dk } from '../shared/utils.js';
import GameXPBar from '../components/session/GameXPBar.jsx';
import SoundToggle from '../components/session/SoundToggle.jsx';
import { useGameSound, isSoundEnabled } from '../hooks/useGameSound.js';
import XPBadgeNotifier from '../components/XPBadgeNotifier.jsx';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";
const FIBS = [1, 2, 3, 5, 8, 13, 21];

// ─── Style injection ───────────────────────────────────────────────────────────
let bpStylesInjected = false;
function injectBPStyles() {
  if (bpStylesInjected) return;
  bpStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes bp-screenShake {
      0%,100%{transform:translate(0,0) rotate(0deg)}
      10%{transform:translate(-4px,-2px) rotate(-1deg)}
      20%{transform:translate(4px,2px) rotate(1deg)}
      30%{transform:translate(-4px,2px) rotate(-1deg)}
      40%{transform:translate(4px,-2px) rotate(1deg)}
      50%{transform:translate(-2px,-4px) rotate(-0.5deg)}
      60%{transform:translate(2px,4px) rotate(0.5deg)}
      70%{transform:translate(-4px,2px) rotate(-1deg)}
      80%{transform:translate(4px,-2px) rotate(1deg)}
      90%{transform:translate(-2px,2px) rotate(-0.5deg)}
    }
    @keyframes bp-spotlight {
      0%{background:radial-gradient(circle 0px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
      60%{background:radial-gradient(circle 160px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
      100%{background:radial-gradient(circle 160px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
    }
    @keyframes bp-confetti-fall {
      0%{transform:translateY(-20px) rotate(0deg);opacity:1}
      100%{transform:translateY(120px) rotate(720deg);opacity:0}
    }
    @keyframes bp-cardFlip {
      0%{transform:rotateY(0deg)}
      50%{transform:rotateY(90deg)}
      100%{transform:rotateY(0deg)}
    }
    @keyframes bp-pop {
      0%{transform:scale(0.5);opacity:0}
      70%{transform:scale(1.1);opacity:1}
      100%{transform:scale(1);opacity:1}
    }
    @keyframes bp-reveal {
      0%{opacity:0;transform:translateY(20px) scale(0.8)}
      100%{opacity:1;transform:translateY(0) scale(1)}
    }
    @keyframes bp-glow {
      0%,100%{box-shadow:0 0 8px var(--epic), 0 0 16px var(--epic)}
      50%{box-shadow:0 0 24px var(--epic), 0 0 48px var(--epic), 0 0 72px var(--epic)}
    }
    @keyframes bp-suspense-bg {
      0%,100%{background-color:var(--bg)}
      50%{background-color:#0a0018}
    }
    @keyframes bp-timer-pulse {
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.25)}
    }
    @keyframes bp-winner-burst {
      0%{transform:scale(0);opacity:1}
      80%{transform:scale(2.5);opacity:0.8}
      100%{transform:scale(3);opacity:0}
    }
    @keyframes bp-float {
      0%,100%{transform:translateY(0)}
      50%{transform:translateY(-6px)}
    }
    @keyframes bp-shimmer {
      0%{background-position:-200% center}
      100%{background-position:200% center}
    }
    @keyframes bp-buzz {
      0%,100%{transform:rotate(0deg)}
      25%{transform:rotate(-8deg) scale(1.1)}
      75%{transform:rotate(8deg) scale(1.1)}
    }
    .bp-shake { animation: bp-screenShake 0.5s ease-in-out; }
    .bp-card-flip { animation: bp-cardFlip 0.6s ease-in-out; }
    .bp-pop-in { animation: bp-pop 0.4s ease-out forwards; }
    .bp-reveal-in { animation: bp-reveal 0.5s ease-out forwards; }
    .bp-floating { animation: bp-float 2s ease-in-out infinite; }
    .bp-buzz { animation: bp-buzz 0.15s ease-in-out infinite; }
    .scanlines {
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px, transparent 3px,
        rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
      );
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function playTone(freq, type = 'square', duration = 0.2, gain = 0.12) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), duration * 1000 + 200);
  } catch {}
}

function playTick() { playTone(880, 'square', 0.05, 0.08); }

function playCardReveal(index) {
  setTimeout(() => playTone(300 + index * 60, 'square', 0.3, 0.1), index * 120);
}

function playBossRoar() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Low rumble
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.type = 'sawtooth'; osc1.frequency.value = 60;
    g1.gain.setValueAtTime(0.2, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc1.start(); osc1.stop(ctx.currentTime + 1.2);
    // High screech
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.type = 'square'; osc2.frequency.value = 1200;
    g2.gain.setValueAtTime(0.0, ctx.currentTime + 0.3);
    g2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc2.start(ctx.currentTime + 0.3); osc2.stop(ctx.currentTime + 1.5);
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

function playWin() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => playTone(f, 'square', 0.3, 0.12), i * 100)
  );
}

// Looping suspense music ref
function startSuspenseMusic(loopRef) {
  let active = true;
  loopRef.current = { stop: () => { active = false; } };
  const notes = [220, 233, 220, 208, 196, 208, 220];
  let i = 0;
  function playNext() {
    if (!active) return;
    playTone(notes[i % notes.length], 'triangle', 0.4, 0.06);
    i++;
    setTimeout(playNext, 450);
  }
  playNext();
}

// ─── Member helpers ────────────────────────────────────────────────────────────
function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return {
    id: 0, name: 'YOU', lv: 3, cls: cl,
    hat: avatar?.helmet?.pv || cl.color,
    body: avatar?.armor?.pv || cl.color,
    btc: avatar?.boots?.pv || dk(cl.color, 60),
    skin: avatar?.skin || '#fdd', isP: true,
  };
}

function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return {
    id: index, name: name || `P${index + 1}`,
    lv: 1 + (index % 5), cls: cl,
    hat: cl.color, body: cl.color,
    btc: dk(cl.color, 60),
    skin: ['#fdd','#fed','#edc','#ffe','#fec'][index % 5],
    isP: false,
  };
}

// ─── Shared UI primitives ──────────────────────────────────────────────────────
function PixelBtn({ onClick, disabled, children, color = 'var(--epic)', style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: PF, fontSize: '10px', padding: '10px 20px',
      background: color, color: '#fff', border: 'none', cursor: disabled ? 'default' : 'pointer',
      borderBottom: `4px solid ${dk(color.replace('var(--','').replace(')',''), 40)}`,
      borderRight: `4px solid ${dk(color.replace('var(--','').replace(')',''), 40)}`,
      opacity: disabled ? 0.5 : 1, imageRendering: 'pixelated',
      transition: 'transform 0.05s', ...style,
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'translate(2px,2px)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = ''; }}
    >{children}</button>
  );
}

function AchievementPopup({ name, icon, desc, xp, onClose }) {
  return (
    <div className="bp-pop-in" style={{
      position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999,
      background: 'var(--bg2)', border: '3px solid var(--epic)',
      boxShadow: '0 0 24px var(--epic)', padding: '16px 20px',
      minWidth: '260px', fontFamily: VT,
      animation: 'bp-glow 2s ease-in-out infinite',
    }}>
      <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--epic)', marginBottom: '6px' }}>
        ACHIEVEMENT UNLOCKED
      </div>
      <div style={{ fontSize: '28px', marginBottom: '4px' }}>{icon} <span style={{ fontSize: '20px' }}>{name}</span></div>
      <div style={{ fontSize: '18px', color: 'var(--text2)', marginBottom: '8px' }}>{desc}</div>
      <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--gold)' }}>+{xp} XP</div>
      <button onClick={onClose} style={{
        position: 'absolute', top: '8px', right: '8px',
        background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: VT, fontSize: '20px',
      }}>✕</button>
    </div>
  );
}

function ConfettiPiece({ color, x, delay }) {
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: '-10px',
      width: '8px', height: '8px', background: color,
      animation: `bp-confetti-fall ${1 + Math.random()}s ease-in ${delay}s forwards`,
      zIndex: 50,
    }} />
  );
}

function Confetti() {
  const colors = ['var(--gold)','var(--epic)','var(--jade)','var(--warn)','var(--danger)'];
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    color: colors[i % colors.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </div>
  );
}

// ─── Step 1: LOBBY ─────────────────────────────────────────────────────────────
function StepLobby({ participants, item, isGM, onStart, onBack }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
        <div style={{ fontFamily: PF, fontSize: '18px', color: 'var(--epic)', letterSpacing: '2px', textShadow: '2px 2px 0 #000' }}>
          BLUFF POKER
        </div>
        <div className="scanlines" style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Purpose banner — kerneværdi: formål klar */}
      <div style={{
        background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
        borderLeft: '3px solid var(--epic)',
        padding: '10px 14px', marginBottom: '20px', textAlign: 'left',
        fontFamily: VT, fontSize: '18px', color: 'var(--text2)', lineHeight: 1.6,
      }}>
        <span style={{ fontFamily: PF, fontSize: '7px', color: 'var(--epic)', display: 'block', marginBottom: '4px', letterSpacing: 1 }}>
          HVAD LØSER DETTE?
        </span>
        En spiller estimerer bevidst forkert. Find blufferen — og lær at kende dit teams estimeringsmønstre.
      </div>

      {item && (
        <div style={{
          background: 'var(--bg2)', border: '2px solid var(--border2)',
          padding: '12px 16px', marginBottom: '24px', fontFamily: VT, fontSize: '20px',
          color: 'var(--gold)',
        }}>
          <div style={{ fontFamily: PF, fontSize: '8px', color: 'var(--text3)', marginBottom: '6px' }}>ESTIMATING</div>
          {item.title}
        </div>
      )}

      <div style={{ fontFamily: PF, fontSize: '8px', color: 'var(--text3)', marginBottom: '12px' }}>
        PLAYERS ({participants.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
        {participants.map((p, i) => (
          <div key={p.id} className="bp-floating" style={{ animationDelay: `${i * 0.2}s`, textAlign: 'center' }}>
            <Sprite m={p.member} size={1.5} />
            <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)', marginTop: '4px' }}>{p.name}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <PixelBtn onClick={onBack} color="var(--bg3)" style={{ fontSize: '8px' }}>← BACK</PixelBtn>
        {isGM && (
          <PixelBtn onClick={onStart} color="var(--jade)" disabled={!item}>
            START GAME
          </PixelBtn>
        )}
        {!isGM && (
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text3)', alignSelf: 'center' }}>
            Waiting for GM to start...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: ESTIMATE ─────────────────────────────────────────────────────────
function StepEstimate({ participants, item, myVote, onVote, votedCount, timeLeft }) {
  const timerColor = timeLeft < 3 ? 'var(--danger)' : timeLeft < 5 ? 'var(--warn)' : 'var(--gold)';
  const timerAnim = timeLeft === 0 ? 'bp-buzz 0.15s ease-in-out infinite' : timeLeft < 3 ? 'bp-timer-pulse 0.5s ease-in-out infinite' : 'none';

  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--epic)', marginBottom: '8px' }}>ESTIMATE</div>

      {item && (
        <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--text)', marginBottom: '16px' }}>
          {item.title}
        </div>
      )}

      <div style={{
        fontFamily: PF, fontSize: '36px', color: timerColor,
        animation: timerAnim, display: 'inline-block', marginBottom: '20px',
        textShadow: `0 0 12px ${timerColor}`,
      }}>
        {timeLeft}
      </div>

      {!myVote ? (
        <div>
          <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text2)', marginBottom: '12px' }}>
            Pick your estimate:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
            {FIBS.map(n => (
              <button key={n} onClick={() => onVote(n)} style={{
                width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                background: 'var(--bg2)', border: '2px solid var(--border2)',
                color: 'var(--text)', cursor: 'pointer',
                borderBottom: '4px solid var(--border)', borderRight: '4px solid var(--border)',
                transition: 'all 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--epic)'; e.currentTarget.style.color = 'var(--epic)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text)'; }}
              >{n}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
            background: 'var(--bg2)', border: '3px solid var(--jade)',
            color: 'var(--jade)', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '8px',
            boxShadow: '0 0 12px var(--jade)',
          }}>{myVote}</div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--jade)' }}>VOTE LOCKED ✓</div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)' }}>
        {votedCount}/{participants.length} voted
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
        {participants.map((p, i) => (
          <div key={p.id} style={{ textAlign: 'center', opacity: p.voted ? 1 : 0.4 }}>
            <Sprite m={p.member} size={1} />
            <div style={{ fontFamily: VT, fontSize: '14px', color: p.voted ? 'var(--jade)' : 'var(--text3)' }}>
              {p.voted ? '✓' : '?'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: REVEAL ───────────────────────────────────────────────────────────
function StepReveal({ participants, allVotes, blufferId, onNext, showButton }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', marginBottom: '20px' }}>
        VOTES REVEALED
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
        {participants.map((p, i) => {
          const vote = allVotes[p.userId];
          const isBluffer = p.userId === blufferId;
          return (
            <div key={p.id} className="bp-reveal-in"
              style={{ textAlign: 'center', animationDelay: `${i * 0.15}s`, opacity: 0 }}>
              <Sprite m={p.member} size={1.3} />
              <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)', margin: '4px 0' }}>{p.name}</div>
              <div className="bp-card-flip" style={{
                width: '48px', height: '64px', margin: '0 auto',
                background: isBluffer ? 'linear-gradient(135deg, var(--bg2), var(--bg3))' : 'var(--bg2)',
                border: `2px solid ${isBluffer ? 'var(--epic)' : 'var(--border2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: PF, fontSize: isBluffer ? '18px' : '14px',
                color: isBluffer ? 'var(--epic)' : 'var(--text)',
                backgroundSize: isBluffer ? '200% auto' : undefined,
                animation: isBluffer ? 'bp-shimmer 2s linear infinite' : 'bp-cardFlip 0.6s ease-in-out',
                backgroundImage: isBluffer
                  ? 'linear-gradient(90deg, var(--bg2) 0%, var(--epic) 50%, var(--bg2) 100%)'
                  : undefined,
              }}>
                {isBluffer ? '?' : (vote ?? '?')}
              </div>
            </div>
          );
        })}
      </div>

      {showButton && (
        <PixelBtn onClick={onNext} color="var(--danger)" style={{ fontSize: '9px' }}>
          WHO IS THE BLUFFER? →
        </PixelBtn>
      )}
    </div>
  );
}

// ─── Step 4: GUESS ────────────────────────────────────────────────────────────
function StepGuess({ participants, myGuess, onGuess, guessCount, isGM, onAfsloering, timeLeft, userId }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px', animation: 'bp-suspense-bg 4s ease-in-out infinite' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--danger)', marginBottom: '8px', textShadow: '0 0 8px var(--danger)' }}>
        HVEM BLUFFER?
      </div>

      <div style={{
        fontFamily: PF, fontSize: '24px',
        color: timeLeft < 30 ? 'var(--danger)' : 'var(--warn)',
        marginBottom: '16px',
        animation: timeLeft < 30 ? 'bp-timer-pulse 0.5s ease-in-out infinite' : 'none',
      }}>
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </div>

      {!myGuess ? (
        <div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text2)', marginBottom: '16px' }}>
            Click on the bluffer!
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', marginBottom: '24px' }}>
            {participants.filter(p => p.userId !== userId).map((p, i) => (
              <div key={p.id} onClick={() => onGuess(p.userId)} style={{ textAlign: 'center', cursor: 'pointer' }}
                className="bp-floating" style2={{ animationDelay: `${i * 0.15}s` }}>
                <div style={{
                  border: '3px solid var(--border2)', padding: '8px',
                  transition: 'all 0.15s',
                  background: 'var(--bg2)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.boxShadow = '0 0 16px var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <Sprite m={p.member} size={1.5} />
                </div>
                <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text)', marginTop: '6px' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--jade)', marginBottom: '8px' }}>VOTE LOCKED</div>
          <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--text2)' }}>
            You suspect: <span style={{ color: 'var(--warn)' }}>
              {participants.find(p => p.userId === myGuess)?.name}
            </span>
          </div>
        </div>
      )}

      <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)', marginBottom: '16px' }}>
        {guessCount}/{participants.length} have voted
      </div>

      {isGM && (
        <PixelBtn onClick={onAfsloering} color="var(--danger)">
          AFSLØRING!
        </PixelBtn>
      )}
    </div>
  );
}

// ─── Step 5: AFSLØRING ────────────────────────────────────────────────────────
function StepAfsloering({ participants, blufferId, guessResults }) {
  const bluffer = participants.find(p => p.userId === blufferId);

  return (
    <div style={{ textAlign: 'center', padding: '16px', position: 'relative' }}>
      {/* Spotlight overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        animation: 'bp-spotlight 1.5s ease-out forwards',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 11 }}>
        <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--danger)', marginBottom: '20px', textShadow: '0 0 16px var(--danger)' }}>
          AFSLØRING!
        </div>

        {bluffer && (
          <div className="bp-pop-in" style={{ marginBottom: '24px' }}>
            <div style={{ animation: 'bp-glow 1.5s ease-in-out infinite', display: 'inline-block', padding: '12px', border: '3px solid var(--epic)' }}>
              <Sprite m={bluffer.member} size={3} />
            </div>
            <div style={{ fontFamily: PF, fontSize: '12px', color: 'var(--epic)', marginTop: '12px', textShadow: '0 0 8px var(--epic)' }}>
              {bluffer.name}
            </div>
            <div style={{ fontFamily: VT, fontSize: '22px', color: 'var(--warn)', marginTop: '4px' }}>
              WAS THE BLUFFER!
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
          {participants.filter(p => p.userId !== blufferId).map((p, i) => {
            const correct = guessResults[p.userId];
            return (
              <div key={p.id} className="bp-reveal-in" style={{ textAlign: 'center', animationDelay: `${0.5 + i * 0.15}s`, opacity: 0 }}>
                <Sprite m={p.member} size={1.2} />
                <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text2)' }}>{p.name}</div>
                <div style={{ fontSize: '24px' }}>{correct ? '✅' : '❌'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 6: SCORING ─────────────────────────────────────────────────────────
function StepScoring({ participants, scores, blufferId, achievements, onAchievementClose, onNext }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px', position: 'relative' }}>
      <Confetti />

      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', marginBottom: '20px' }}>
        RESULTS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto 24px' }}>
        {participants.map((p, i) => {
          const score = scores[p.userId] || { xp: 0, label: '' };
          const isBluffer = p.userId === blufferId;
          return (
            <div key={p.id} className="bp-reveal-in" style={{
              animationDelay: `${i * 0.2}s`, opacity: 0,
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg2)', border: `2px solid ${score.xp > 0 ? 'var(--jade)' : 'var(--border)'}`,
              padding: '10px 14px',
              boxShadow: score.xp > 0 ? '0 0 12px var(--jade)' : 'none',
            }}>
              <Sprite m={p.member} size={1} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text)' }}>
                  {p.name} {isBluffer ? '🃏' : ''}
                </div>
                <div style={{ fontFamily: VT, fontSize: '16px', color: 'var(--text3)' }}>{score.label}</div>
              </div>
              {score.xp > 0 && (
                <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--gold)', animation: 'bp-winner-burst 0.5s ease-out' }}>
                  +{score.xp} XP
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PixelBtn onClick={onNext} color="var(--jade)">
        RE-VOTE →
      </PixelBtn>

      {achievements.map((a, i) => (
        <AchievementPopup key={i} {...a} onClose={() => onAchievementClose(i)} />
      ))}
    </div>
  );
}

// ─── Step 7: RE-VOTE ──────────────────────────────────────────────────────────
function StepRevote({ item, myRevote, onRevote, isGM, onFinalize, finalEstimate, votedCount, participants }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <div style={{ fontFamily: PF, fontSize: '10px', color: 'var(--jade)', marginBottom: '8px' }}>
        RE-VOTE
      </div>

      {finalEstimate ? (
        <div className="bp-pop-in" style={{ marginTop: '32px' }}>
          <Confetti />
          <div style={{ fontFamily: PF, fontSize: '9px', color: 'var(--text3)', marginBottom: '8px' }}>FINAL ESTIMATE</div>
          <div style={{
            fontFamily: PF, fontSize: '48px', color: 'var(--gold)',
            textShadow: '0 0 24px var(--gold)', animation: 'bp-glow 2s ease-in-out infinite',
          }}>{finalEstimate}</div>
          <div style={{ fontFamily: VT, fontSize: '24px', color: 'var(--text2)', marginTop: '16px' }}>
            🎉 CONSENSUS REACHED!
          </div>
        </div>
      ) : (
        <>
          {item && (
            <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--text)', marginBottom: '16px' }}>
              {item.title}
            </div>
          )}

          {!myRevote ? (
            <div>
              <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text2)', marginBottom: '12px' }}>
                Your final estimate:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                {FIBS.map(n => (
                  <button key={n} onClick={() => onRevote(n)} style={{
                    width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                    background: 'var(--bg2)', border: '2px solid var(--border2)',
                    color: 'var(--text)', cursor: 'pointer',
                    borderBottom: '4px solid var(--border)', borderRight: '4px solid var(--border)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--jade)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
                  >{n}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '72px', fontFamily: PF, fontSize: '14px',
                background: 'var(--bg2)', border: '3px solid var(--jade)',
                color: 'var(--jade)', display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '8px',
              }}>{myRevote}</div>
              <div style={{ fontFamily: VT, fontSize: '20px', color: 'var(--jade)' }}>VOTE LOCKED ✓</div>
            </div>
          )}

          <div style={{ fontFamily: VT, fontSize: '18px', color: 'var(--text3)', marginBottom: '16px' }}>
            {votedCount}/{participants.length} voted
          </div>

          {isGM && myRevote && (
            <PixelBtn onClick={onFinalize} color="var(--gold)">
              APPROVE FINAL →
            </PixelBtn>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
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
      const { data: pRows } = await supabase
        .from('session_participants')
        .select('*, profiles(id, username, avatar_config)')
        .eq('session_id', sessionId);

      if (!pRows) return;

      const mapped = pRows.map((p, i) => {
        const isMe = p.user_id === user?.id;
        const member = isMe
          ? makeMyMember(avatar)
          : makeAnonMember(i, p.profiles?.username || `P${i + 1}`);
        return {
          id: p.id,
          userId: p.user_id,
          name: p.profiles?.username || `P${i + 1}`,
          is_host: p.is_host,
          member,
          voted: false,
        };
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
      const { data } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .single();
      if (data) setItem(data);
    }
    load();
  }, [sessionId]);

  // ── Realtime channel ────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`bluff-poker-${sessionId}`)
      .on('broadcast', { event: 'GAME_START' }, ({ payload }) => {
        setBlufferId(payload.bluffer_user_id);
        setStep(2);
      })
      .on('broadcast', { event: 'NEW_ESTIMATE' }, ({ payload }) => {
        setVotedCount(payload.count);
        setParticipants(prev => prev.map(p =>
          payload.voter_ids?.includes(p.userId) ? { ...p, voted: true } : p
        ));
      })
      .on('broadcast', { event: 'GUESS_CAST' }, ({ payload }) => {
        setGuessCount(payload.count);
      })
      .on('broadcast', { event: 'AFSLOERING' }, ({ payload }) => {
        setBlufferId(payload.bluffer_user_id);
        setAllVotes(payload.votes || {});
        setGuessResults(payload.guess_results || {});
        triggerAfsloering();
        setStep(5);
        setTimeout(() => setStep(6), 3500);
      })
      .on('broadcast', { event: 'FINAL_APPROVED' }, ({ payload }) => {
        setFinalEstimate(payload.estimate);
        playWin();
      })
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
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
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
        if (t <= 1) {
          clearInterval(guessTimerRef.current);
          if (suspenseRef.current) suspenseRef.current.stop();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      clearInterval(guessTimerRef.current);
      if (suspenseRef.current) suspenseRef.current.stop();
    };
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

    await supabase.from('bluff_assignments').insert({
      session_id: sessionId,
      item_id: item.id,
      bluffer_user_id: blufferUserId,
    });

    channelRef.current?.send({
      type: 'broadcast',
      event: 'GAME_START',
      payload: { bluffer_user_id: blufferUserId },
    });
  }

  async function handleVote(value) {
    if (!item) return;
    setMyVote(value);

    await supabase.from('bluff_estimates').upsert({
      session_id: sessionId,
      item_id: item.id,
      user_id: user.id,
      estimate: value,
      round: 1,
    }, { onConflict: 'session_id,item_id,user_id,round' });

    const newCount = votedCount + 1;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'NEW_ESTIMATE',
      payload: {
        count: newCount,
        voter_ids: participants.filter(p => p.voted).map(p => p.userId).concat([user.id]),
      },
    });

    // Auto-advance after timer
    if (timeLeft <= 0 || newCount >= participants.length) {
      setTimeout(() => fetchVotesAndReveal(), 1000);
    }
  }

  async function fetchVotesAndReveal() {
    if (!item) return;
    const { data } = await supabase
      .from('bluff_estimates')
      .select('user_id, estimate')
      .eq('session_id', sessionId)
      .eq('item_id', item.id)
      .eq('round', 1);

    const votes = {};
    data?.forEach(r => { votes[r.user_id] = r.estimate; });
    setAllVotes(votes);
    setStep(3);
  }

  // Move to reveal step (button click)
  function handleShowGuess() { setStep(4); }

  async function handleGuess(suspectedUserId) {
    if (!item) return;
    setMyGuess(suspectedUserId);

    await supabase.from('bluff_guesses').insert({
      session_id: sessionId,
      item_id: item.id,
      guesser_id: user.id,
      suspected_user_id: suspectedUserId,
    });

    const newCount = guessCount + 1;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'GUESS_CAST',
      payload: { count: newCount },
    });
    setGuessCount(newCount);
  }

  async function handleAfsloering() {
    if (!item) return;

    // Fetch all guesses
    const { data: guesses } = await supabase
      .from('bluff_guesses')
      .select('guesser_id, suspected_user_id')
      .eq('session_id', sessionId)
      .eq('item_id', item.id);

    const results = {};
    guesses?.forEach(g => {
      results[g.guesser_id] = g.suspected_user_id === blufferId;
    });

    channelRef.current?.send({
      type: 'broadcast',
      event: 'AFSLOERING',
      payload: { bluffer_user_id: blufferId, votes: allVotes, guess_results: results },
    });
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

    // Fetch latest guesses for this session/item
    const { data: guesses } = await supabase
      .from('bluff_guesses')
      .select('guesser_id, suspected_user_id')
      .eq('session_id', sessionId)
      .eq('item_id', item.id);

    const guessMap = {};
    guesses?.forEach(g => { guessMap[g.guesser_id] = g.suspected_user_id; });

    const blufferGuessedBy = guesses?.filter(g => g.suspected_user_id === blufferId) || [];
    const blufferSurvived = blufferGuessedBy.length === 0;

    // Consensus (for poker face check)
    const voteValues = Object.values(allVotes).filter(v => v != null);
    const avg = voteValues.length ? voteValues.reduce((a, b) => a + b, 0) / voteValues.length : 0;
    const blufferVote = allVotes[blufferId];
    const pokerFace = blufferVote != null && Math.abs(blufferVote - avg) <= 1;

    for (const p of participants) {
      const isBluffer = p.userId === blufferId;
      const guessedCorrectly = guessMap[p.userId] === blufferId;
      let xp = 0;
      let label = '';

      if (guessedCorrectly && !isBluffer) {
        xp = 10;
        label = '+10 XP — Detective!';
      }
      if (isBluffer && blufferSurvived) {
        xp = 15;
        label = '+15 XP — Bluffer survived!';
      }
      if (xp > 0) {
        await supabase.from('xp_events').insert({
          session_id: sessionId,
          user_id: p.userId,
          xp,
          reason: isBluffer ? 'bluffer_survived' : 'detective',
        }).catch(() => {});
      }
      newScores[p.userId] = { xp, label };
    }

    // Achievements
    if (blufferSurvived) {
      newAchievements.push({ name: 'Master Bluffer', icon: '🃏', desc: 'Nobody guessed you!', xp: 25 });
      await supabase.from('achievements').upsert({ session_id: sessionId, user_id: blufferId, achievement: 'master_bluffer' }).catch(() => {});
    }

    const detectives = participants.filter(p => p.userId !== blufferId && guessMap[p.userId] === blufferId);
    if (detectives.some(p => p.userId === user?.id)) {
      newAchievements.push({ name: 'Detective', icon: '🔍', desc: 'You found the bluffer!', xp: 10 });
    }

    if (pokerFace && blufferId === user?.id) {
      newAchievements.push({ name: 'Poker Face', icon: '😐', desc: 'Your bluff estimate was within ±1 of consensus!', xp: 10 });
    }

    setScores(newScores);
    if (newAchievements.length > 0) setAchievements(newAchievements);
  }

  async function handleRevote(value) {
    if (!item) return;
    setMyRevote(value);
    await supabase.from('bluff_estimates').upsert({
      session_id: sessionId,
      item_id: item.id,
      user_id: user.id,
      estimate: value,
      round: 2,
    }, { onConflict: 'session_id,item_id,user_id,round' });

    setRevoteCount(c => c + 1);
  }

  async function handleFinalize() {
    if (!item) return;
    const { data } = await supabase.functions.invoke('finalize-bluff', {
      body: { session_id: sessionId, item_id: item.id },
    });

    const estimate = data?.estimate ?? myRevote;
    setFinalEstimate(estimate);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'FINAL_APPROVED',
      payload: { estimate },
    });
    playWin();
    // Game soul: finalize effects
    addDmg('🃏 +XP', C.gld);
    triggerLoot();
  }

  function handleAchievementClose(idx) {
    setAchievements(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Scene mc={C.red}>
      {/* Damage numbers */}
      {dmgNums.map(d => <DmgNum key={d.id} value={d.value} color={d.color} />)}
      {/* Loot drops */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <LootDrops active={lootActive} items={[{ icon: '🃏', label: '+XP', color: C.gld }, { icon: '🔍', label: 'BLUFF', color: C.red }]} />
      </div>
      {/* NPC Spectators */}
      <div style={{ position: 'fixed', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, zIndex: 5, pointerEvents: 'none' }}>
        {NPC_TEAM.map(m => <Sprite key={m.id} m={m} size={0.7} idle />)}
      </div>
    <div className={shaking ? 'bp-shake' : ''} style={{
      minHeight: '100vh',
      background: 'transparent',
      color: 'var(--text)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* XP Bar + Achievement notifier */}
      {user?.id && <XPBadgeNotifier userId={user.id} />}
      {user?.id && (
        <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SoundToggle soundEnabled={soundEnabled} onToggle={toggleSound} size="sm" />
          <GameXPBar userId={user.id} ref={xpBarRef} />
        </div>
      )}
      {/* Scanline overlay */}
      <div className="scanlines" style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
        {step === 1 && (
          <StepLobby
            participants={participants}
            item={item}
            isGM={isGM}
            onStart={handleStartGame}
            onBack={onBack}
          />
        )}
        {step === 2 && (
          <StepEstimate
            participants={participants}
            item={item}
            myVote={myVote}
            onVote={handleVote}
            votedCount={votedCount}
            timeLeft={timeLeft}
          />
        )}
        {step === 3 && (
          <StepReveal
            participants={participants}
            allVotes={allVotes}
            blufferId={blufferId}
            onNext={handleShowGuess}
            showButton={showRevealBtn}
          />
        )}
        {step === 4 && (
          <StepGuess
            participants={participants}
            myGuess={myGuess}
            onGuess={handleGuess}
            guessCount={guessCount}
            isGM={isGM}
            onAfsloering={handleAfsloering}
            timeLeft={guessTimeLeft}
            userId={user?.id}
          />
        )}
        {step === 5 && (
          <StepAfsloering
            participants={participants}
            blufferId={blufferId}
            guessResults={guessResults}
          />
        )}
        {step === 6 && (
          <StepScoring
            participants={participants}
            scores={scores}
            blufferId={blufferId}
            achievements={achievements}
            onAchievementClose={handleAchievementClose}
            onNext={() => setStep(7)}
          />
        )}
        {step === 7 && (
          <StepRevote
            item={item}
            myRevote={myRevote}
            onRevote={handleRevote}
            isGM={isGM}
            onFinalize={handleFinalize}
            finalEstimate={finalEstimate}
            votedCount={revoteCount}
            participants={participants}
          />
        )}
      </div>
    </div>
    </Scene>
  );
}
