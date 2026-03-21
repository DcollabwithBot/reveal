import { useState, useEffect } from 'react'

// ─── Fake data ───────────────────────────────────────────────────────────────
const FAKE_TEAM = [
  { name: "Sara M.",   avatar: "🧙‍♀️", level: 14, xp: 2840 },
  { name: "Thomas K.", avatar: "⚔️",  level: 11, xp: 1920 },
  { name: "Lena R.",   avatar: "🔮",  level: 9,  xp: 1450 },
  { name: "Jonas B.",  avatar: "🎯",  level: 16, xp: 3200 },
  { name: "Du",        avatar: "⭐",  level: 7,  xp: 980,  isUser: true },
]
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21]

// ─── Styles ───────────────────────────────────────────────────────────────────
const BG   = '#0f1117'
const JADE = '#22c55e'
const GOLD = '#f59e0b'
const DIM  = '#374151'
const TEXT = '#e5e7eb'
const TEXT2 = '#9ca3af'

const s = {
  root: {
    minHeight: '100vh',
    background: BG,
    fontFamily: "'DM Sans', sans-serif",
    color: TEXT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem 1rem',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.2rem',
    color: JADE,
    letterSpacing: '2px',
    marginBottom: '0.25rem',
    textAlign: 'center',
  },
  demoBadge: {
    fontSize: '0.7rem',
    background: 'rgba(34,197,94,0.15)',
    border: `1px solid ${JADE}44`,
    color: JADE,
    padding: '2px 10px',
    borderRadius: '999px',
    marginBottom: '2rem',
    letterSpacing: '1px',
  },
  card: {
    background: '#161b27',
    border: `1px solid ${DIM}`,
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
  },
  sectionTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: '1.4rem',
    color: TEXT,
    marginBottom: '0.4rem',
  },
  sectionSub: {
    color: TEXT2,
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  btn: {
    display: 'inline-block',
    background: JADE,
    color: '#0f1117',
    fontWeight: '700',
    border: 'none',
    borderRadius: '8px',
    padding: '0.7rem 1.4rem',
    cursor: 'pointer',
    fontSize: '0.95rem',
    marginTop: '1rem',
    transition: 'opacity .15s',
  },
}

// ─── Phase 1: World Map ───────────────────────────────────────────────────────
const ZONES = [
  { id: 'scrum',    label: '🎮 Scrum',    glow: true  },
  { id: 'scope',    label: '🗺️ Scope',    glow: false },
  { id: 'speed',    label: '⚡ Speed',    glow: false },
  { id: 'strategy', label: '♟️ Strategy', glow: false },
]

function WorldMap({ onNext }) {
  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>🌍 World Map</p>
      <p style={s.sectionSub}>Vælg en zone for at starte en session</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {ZONES.map(z => (
          <div
            key={z.id}
            style={{
              background: z.glow ? 'rgba(34,197,94,0.08)' : '#1e2533',
              border: `2px solid ${z.glow ? JADE : DIM}`,
              borderRadius: '10px',
              padding: '1rem',
              textAlign: 'center',
              cursor: z.glow ? 'pointer' : 'default',
              boxShadow: z.glow ? `0 0 18px ${JADE}44` : 'none',
              transition: 'box-shadow .2s',
            }}
            onClick={z.glow ? onNext : undefined}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>
              {z.label.split(' ')[0]}
            </div>
            <div style={{ fontSize: '0.85rem', color: z.glow ? JADE : TEXT2, fontWeight: z.glow ? 700 : 400 }}>
              {z.label.split(' ').slice(1).join(' ')}
              {z.glow && <span style={{ display: 'block', fontSize: '0.7rem', marginTop: '2px', opacity: 0.7 }}>● AKTIV</span>}
            </div>
          </div>
        ))}
      </div>

      <button style={s.btn} onClick={onNext}>
        Start Planning Poker →
      </button>
    </div>
  )
}

// ─── Phase 2: Poker ──────────────────────────────────────────────────────────
function PokerPhase({ onNext }) {
  const [userVote, setUserVote]     = useState(null)
  const [teamVotes, setTeamVotes]   = useState({})   // name → value
  const [revealed, setRevealed]     = useState(false)
  const [xpFloater, setXpFloater]   = useState(false)

  function handleCardClick(val) {
    if (userVote !== null) return
    setUserVote(val)

    // Simulate other players voting with random delays 800–2000ms
    const others = FAKE_TEAM.filter(m => !m.isUser)
    others.forEach((member, i) => {
      const delay = 800 + Math.random() * 1200
      setTimeout(() => {
        const pick = FIBONACCI[Math.floor(Math.random() * FIBONACCI.length)]
        // Thomas always picks low (1 or 2) for the outlier gag
        const vote = member.name === 'Thomas K.' ? (Math.random() < 0.7 ? 1 : 2) : pick
        setTeamVotes(prev => ({ ...prev, [member.name]: vote }))

        // After last player → reveal
        if (i === others.length - 1) {
          setTimeout(() => {
            setRevealed(true)
            setXpFloater(true)
            setTimeout(() => setXpFloater(false), 2200)
          }, 300)
        }
      }, delay)
    })
  }

  const pendingCount = FAKE_TEAM.filter(m => !m.isUser && !teamVotes[m.name]).length

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>🃏 Planning Poker</p>
      <p style={s.sectionSub}>
        Story: <strong style={{ color: TEXT }}>Checkout flow redesign</strong>
      </p>

      {/* Team avatars */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {FAKE_TEAM.map(m => {
          const voted = m.isUser ? userVote !== null : teamVotes[m.name] !== undefined
          const voteVal = m.isUser ? userVote : teamVotes[m.name]
          return (
            <div key={m.name} style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{
                fontSize: '1.6rem',
                background: voted ? 'rgba(34,197,94,0.12)' : '#1e2533',
                border: `2px solid ${voted ? JADE : DIM}`,
                borderRadius: '10px',
                width: '50px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {m.avatar}
              </div>
              <div style={{ fontSize: '0.65rem', color: TEXT2, marginTop: '3px', maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name.split(' ')[0]}
              </div>
              {revealed && voteVal !== undefined && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-8px',
                  background: JADE,
                  color: '#0f1117',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '1px 5px',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {voteVal}
                </div>
              )}
              {!revealed && !voted && !m.isUser && (
                <div style={{ fontSize: '0.6rem', color: TEXT2, opacity: 0.5 }}>venter…</div>
              )}
              {/* XP floater on user avatar */}
              {m.isUser && xpFloater && (
                <div style={{
                  position: 'absolute',
                  top: '-28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: GOLD,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  animation: 'floatUp 2s ease-out forwards',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}>
                  +50 XP ⭐
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Fibonacci card grid */}
      {!revealed && (
        <>
          <p style={{ fontSize: '0.8rem', color: TEXT2, marginBottom: '0.75rem' }}>
            {userVote === null ? 'Vælg dit estimat:' : `Du estimerede: ${userVote} — venter på teamet… (${pendingCount} tilbage)`}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {FIBONACCI.map(n => (
              <button
                key={n}
                onClick={() => handleCardClick(n)}
                disabled={userVote !== null}
                style={{
                  width: '44px',
                  height: '60px',
                  background: userVote === n ? JADE : '#1e2533',
                  color: userVote === n ? '#0f1117' : TEXT,
                  border: `2px solid ${userVote === n ? JADE : DIM}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: userVote !== null ? 'default' : 'pointer',
                  transition: 'all .15s',
                  boxShadow: userVote === n ? `0 0 10px ${JADE}88` : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Revealed state */}
      {revealed && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: `1px solid ${GOLD}55`,
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: GOLD,
            marginBottom: '0.75rem',
          }}>
            🎯 Thomas K. estimerer MEGET lavt — mulig outlier!
          </div>

          <button style={s.btn} onClick={onNext}>
            Se leaderboard →
          </button>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
        }
      `}</style>
    </div>
  )
}

// ─── Phase 3: Leaderboard ────────────────────────────────────────────────────
const SORTED_TEAM = [...FAKE_TEAM].sort((a, b) => b.level - a.level)

function Leaderboard() {
  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>🏅 Leaderboard</p>
      <p style={s.sectionSub}>Team XP efter sessionen</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {SORTED_TEAM.map((m, i) => (
          <div
            key={m.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: m.isUser ? 'rgba(34,197,94,0.08)' : '#1e2533',
              border: `1px solid ${m.isUser ? JADE + '55' : DIM}`,
              borderRadius: '8px',
              padding: '0.6rem 0.9rem',
            }}
          >
            <span style={{ fontSize: '1rem', width: '24px', textAlign: 'center', color: i === 0 ? GOLD : TEXT2 }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
            </span>
            <span style={{ fontSize: '1.3rem' }}>{m.avatar}</span>
            <span style={{ flex: 1, fontSize: '0.9rem', color: m.isUser ? JADE : TEXT, fontWeight: m.isUser ? 700 : 400 }}>
              {m.name}
            </span>
            <span style={{ fontSize: '0.75rem', color: TEXT2 }}>Lv.{m.level}</span>
            <span style={{ fontSize: '0.8rem', color: GOLD, fontWeight: 600 }}>{m.xp.toLocaleString()} XP</span>
          </div>
        ))}
      </div>

      {/* Achievement */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        background: 'rgba(245,158,11,0.08)',
        border: `1px solid ${GOLD}44`,
        borderRadius: '8px',
        padding: '0.6rem 0.9rem',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
        color: GOLD,
      }}>
        🏆 Achievement unlocked: <strong>Første session!</strong>
      </div>

      {/* CTA box */}
      <div style={{
        background: 'rgba(34,197,94,0.07)',
        border: `1px solid ${JADE}44`,
        borderRadius: '10px',
        padding: '1.25rem',
        fontSize: '0.875rem',
        color: TEXT2,
        lineHeight: '1.6',
      }}>
        <p style={{ margin: '0 0 0.75rem', color: TEXT }}>
          <strong>Dette er en demo.</strong> Din rigtige session gemmer estimaterne til dit PM-board, tracker nøjagtighed over tid og giver dit team XP. Prøv det med dit team →
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          style={{
            display: 'inline-block',
            background: JADE,
            color: '#0f1117',
            fontWeight: 700,
            borderRadius: '8px',
            padding: '0.6rem 1.2rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          ⚔️ Start gratis
        </button>
      </div>
    </div>
  )
}

// ─── DemoScreen ───────────────────────────────────────────────────────────────
export default function DemoScreen() {
  const [phase, setPhase] = useState('worldMap') // worldMap | poker | leaderboard

  return (
    <div style={s.root}>
      {/* Fixed topbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(15,17,23,0.9)', backdropFilter: 'blur(8px)',
        zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <a href="/" style={{
          fontFamily: 'Instrument Serif, serif', fontSize: '1.25rem',
          color: '#22c55e', textDecoration: 'none', fontWeight: 700
        }}>REVEAL</a>
        <span style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em'}}>
          DEMO MODE
        </span>
        <a href="/login" style={{
          fontSize: '0.85rem', color: '#22c55e', textDecoration: 'none',
          border: '1px solid #22c55e', padding: '0.35rem 0.85rem', borderRadius: '6px'
        }}>Log ind →</a>
      </div>

      {/* Subtle scanlines */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '560px', paddingTop: '4rem' }}>
        {/* Logo */}
        <p style={s.header}>⚔️ REVEAL</p>
        <div style={{ textAlign: 'center' }}>
          <span style={s.demoBadge}>LIVE DEMO</span>
        </div>

        {/* Phase stepper */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {['worldMap', 'poker', 'leaderboard'].map((p, i) => (
            <div
              key={p}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: phase === p ? JADE : DIM,
                transition: 'background .2s',
              }}
            />
          ))}
        </div>

        {/* Phase content */}
        {phase === 'worldMap'    && <WorldMap   onNext={() => setPhase('poker')} />}
        {phase === 'poker'       && <PokerPhase onNext={() => setPhase('leaderboard')} />}
        {phase === 'leaderboard' && <Leaderboard />}
      </div>
    </div>
  )
}
