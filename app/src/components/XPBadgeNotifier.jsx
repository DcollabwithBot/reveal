/**
 * B3: XP/Badge System Live
 * - Listens to Supabase realtime for user_achievements and user_missions
 * - Shows toast notifications + achievement popup
 * - Mount once near app root, pass user + organizationId
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const PF = "'Press Start 2P', monospace";
const VT = "'VT323', monospace";

// Inject CSS keyframes once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes xbn-slideIn {
      from { opacity: 0; transform: translateX(120px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes xbn-slideOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(120px); }
    }
    @keyframes xbn-popIn {
      0%   { opacity: 0; transform: scale(0.4) rotate(-8deg); }
      70%  { transform: scale(1.1) rotate(2deg); }
      100% { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    @keyframes xbn-sparkle {
      0%   { opacity: 0; transform: scale(0); }
      50%  { opacity: 1; }
      100% { opacity: 0; transform: scale(2); }
    }
    @keyframes xbn-glow {
      0%, 100% { box-shadow: 0 0 10px var(--epic); }
      50%       { box-shadow: 0 0 25px var(--epic), 0 0 50px var(--epic); }
    }
    .xbn-toast {
      animation: xbn-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .xbn-toast.leaving {
      animation: xbn-slideOut 0.3s ease forwards;
    }
    .xbn-popup {
      animation: xbn-popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .xbn-glow {
      animation: xbn-glow 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(s);
}

// ── Web Audio: Achievement chime ───────────────────────────────────────────────
function playAchievementSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch { /* audio blocked */ }
}

function playXPSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch { /* blocked */ }
}

// ── Toast component ────────────────────────────────────────────────────────────
function XPToast({ toast, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDone, 300);
    }, toast.duration || 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`xbn-toast${leaving ? ' leaving' : ''}`}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${toast.color || 'var(--gold)'}`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 220,
        maxWidth: 300,
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${toast.color || 'var(--gold)'}44`,
      }}
    >
      <span style={{ fontSize: 22 }}>{toast.icon}</span>
      <div>
        <div style={{ fontFamily: PF, fontSize: 7, color: toast.color || 'var(--gold)', marginBottom: 2 }}>
          {toast.title}
        </div>
        <div style={{ fontFamily: VT, fontSize: 16, color: 'var(--text2)' }}>
          {toast.body}
        </div>
      </div>
    </div>
  );
}

// ── Achievement popup ──────────────────────────────────────────────────────────
function AchievementPopup({ achievement, onClose }) {
  useEffect(() => {
    playAchievementSound();
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      pointerEvents: 'none',
    }}>
      <div
        className="xbn-popup xbn-glow"
        style={{
          background: 'var(--bg2)',
          border: '2px solid var(--epic)',
          borderRadius: 14,
          padding: '28px 36px',
          textAlign: 'center',
          maxWidth: 320,
          pointerEvents: 'auto',
        }}
      >
        {/* Sparkles */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          {['✦','✧','✦'].map((s, i) => (
            <span key={i} style={{
              position: 'absolute',
              top: -20 + i * 10,
              left: 10 + i * 60,
              fontSize: 14,
              color: 'var(--gold)',
              animation: `xbn-sparkle 1.5s ease ${i * 0.3}s infinite`,
            }}>{s}</span>
          ))}
          <div style={{ fontSize: 52 }}>{achievement.icon}</div>
        </div>
        <div style={{ fontFamily: PF, fontSize: 7, color: 'var(--text3)', letterSpacing: 2, marginBottom: 8 }}>
          ACHIEVEMENT UNLOCKED
        </div>
        <div style={{ fontFamily: PF, fontSize: 11, color: 'var(--epic)', marginBottom: 6 }}>
          {achievement.name}
        </div>
        <div style={{ fontFamily: VT, fontSize: 18, color: 'var(--text2)', marginBottom: 12 }}>
          {achievement.description}
        </div>
        <div style={{
          fontFamily: PF,
          fontSize: 9,
          color: 'var(--gold)',
          background: 'var(--gold-dim)',
          border: '1px solid var(--gold-mid)',
          borderRadius: 4,
          padding: '6px 12px',
          display: 'inline-block',
        }}>
          +{achievement.xp} XP
        </div>
        <div style={{ marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: PF,
              fontSize: 7,
              color: 'var(--text3)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            NICE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Notifier ──────────────────────────────────────────────────────────────
export default function XPBadgeNotifier({ userId, organizationId }) {
  const [toasts, setToasts] = useState([]);
  const [achievement, setAchievement] = useState(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    injectStyles();
  }, []);

  function addToast(t) {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...t, id }]);
    if (t.sound === 'xp') playXPSound();
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  useEffect(() => {
    if (!userId) return;

    // Listen for mission completions
    const missionSub = supabase
      .channel(`user-missions-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_missions',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const um = payload.new;
        if (um.status === 'completed' && um.xp_earned > 0) {
          addToast({
            icon: '🎯',
            title: 'MISSION COMPLETE',
            body: `+${um.xp_earned} XP earned!`,
            color: 'var(--jade)',
            sound: 'xp',
            duration: 3500,
          });
        }
      })
      .subscribe();

    // Listen for new achievements
    const achievementSub = supabase
      .channel(`user-achievements-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_achievements',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const ua = payload.new;
        // Fetch achievement details
        const { data: def } = await supabase
          .from('achievement_definitions')
          .select('name, description, icon, rule')
          .eq('id', ua.achievement_id)
          .maybeSingle();

        if (def) {
          const xp = def.rule?.xp || ua.xp_at_unlock || 0;
          setAchievement({
            name: def.name,
            description: def.description,
            icon: def.icon || '🏆',
            xp,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(missionSub);
      supabase.removeChannel(achievementSub);
    };
  }, [userId]);

  return (
    <>
      {/* Toast stack — bottom right */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        {toasts.map(t => (
          <XPToast key={t.id} toast={t} onDone={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Achievement popup */}
      {achievement && (
        <AchievementPopup
          achievement={achievement}
          onClose={() => setAchievement(null)}
        />
      )}
    </>
  );
}
