import { useState, useEffect } from 'react'

export default function Landing({ onStartPlaying, onJoinSession }) {
  // "Sign In" navigates to /login
  const handleSignIn = () => {
    window.location.href = '/login'
  }

  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [tick, setTick] = useState(true)

  // Blink cursor effect
  useEffect(() => {
    const t = setInterval(() => setTick(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const res = await fetch(`/api/sessions/join/${joinCode.trim().toUpperCase()}`)
      if (!res.ok) {
        const data = await res.json()
        setJoinError(data.error || 'Session not found')
        return
      }
      const session = await res.json()
      if (onJoinSession) onJoinSession(session)
    } catch {
      setJoinError('Could not connect to server')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={s.root}>
      {/* Scanlines */}
      <div style={s.scanlines} />

      {/* Starfield glow */}
      <div style={s.starfield} />

      {/* ══════════ HERO ══════════ */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.swordRow}>
            <span style={s.swordEmoji}>⚔️</span>
            <span style={s.logoText}>REVEAL</span>
            <span style={s.cursor}>{tick ? '█' : ' '}</span>
          </div>

          <h1 style={s.headline}>
            Agile ceremonies.<br />
            <span style={s.headlineAccent}>Gamified.</span>
          </h1>

          <p style={s.subheadline}>
            Reveal turns your boring sprint ceremonies into RPG quests.
            Estimate stories as boss battles. Run retros as dungeon raids.
            Ship better software.
          </p>

          <div style={s.ctaRow}>
            <button style={s.ctaPrimary} onClick={onStartPlaying}>
              ⚔️ Start Playing
            </button>

            <button
              style={s.ctaSecondary}
              onClick={() => setShowJoin(v => !v)}
            >
              🎮 Join a Session
            </button>

            <button style={s.ctaSignIn} onClick={handleSignIn}>
              🔑 Sign In
            </button>
          </div>

          {showJoin && (
            <form onSubmit={handleJoin} style={s.joinForm}>
              <input
                style={s.joinInput}
                type="text"
                placeholder="SESSION CODE"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <button
                type="submit"
                style={s.joinSubmit}
                disabled={joining || !joinCode.trim()}
              >
                {joining ? '...' : '▶ JOIN'}
              </button>
              {joinError && <p style={s.joinError}>⚠️ {joinError}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ══════════ GAME MODES ══════════ */}
      <section style={s.modesSection}>
        <p style={s.sectionLabel}>// GAME MODES</p>
        <h2 style={s.sectionTitle}>Choose Your Battle</h2>

        <div style={s.modeGrid}>
          <GameModeCard
            icon="🃏"
            tag="PLANNING POKER"
            title="Story Estimation"
            desc="Pick your cards. Fight the estimate. Reveal the truth."
            accent="#feae34"
            glow="rgba(155,89,182,0.4)"
          />
          <GameModeCard
            icon="🎲"
            tag="SCOPE ROULETTE"
            title="Scope Roulette"
            desc="Draw a challenge card. Watch the scope creep. Survive the sprint."
            accent="#38b764"
            glow="rgba(46,204,113,0.4)"
          />
          <GameModeCard
            icon="👹"
            tag="SPRINT RETRO"
            title="Sprint Boss Battle"
            desc="The Sprint Demon grows stronger with every problem your team ignores."
            accent="#e74c3c"
            glow="rgba(231,76,60,0.4)"
          />
        </div>
      </section>

      {/* ══════════ PITCH ══════════ */}
      <section style={s.pitchSection}>
        <div style={s.pitchBox}>
          <p style={s.pitchQuote}>
            "Built for teams who take their work seriously —<br />
            <span style={s.pitchAccent}>but not themselves.</span>"
          </p>
          <button style={s.pitchCta} onClick={onStartPlaying}>
            ⚔️ Start Playing
          </button>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={s.footer}>
        <p style={s.footerText}>REVEAL RPG · MADE FOR TEAMS · {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}

function GameModeCard({ icon, tag, title, desc, accent, glow }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        ...cardBase,
        borderColor: hovered ? accent : '#2d2f45',
        boxShadow: hovered
          ? `0 0 0 1px ${accent}44, 0 0 24px ${glow}, 4px 4px 0 ${accent}33`
          : '4px 4px 0 #0a0b12',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>{icon}</span>
      <p style={{ ...cardTag, color: accent }}>{tag}</p>
      <h3 style={{ ...cardTitle, color: accent, textShadow: `0 0 10px ${glow}` }}>{title}</h3>
      <p style={cardDesc}>{desc}</p>
      {/* Pixel corner accents */}
      <div style={{ ...cornerTL, borderColor: accent }} />
      <div style={{ ...cornerBR, borderColor: accent }} />
    </div>
  )
}

/* ───────────────────────────── STYLES ───────────────────────────── */

const BASE_FONT = "'Press Start 2P', monospace"
const BODY_FONT = "'VT323', monospace"
// Match game constants: C.bg = '#0e1019'
const BG = '#0e1019'
// Accent from constants: C.acc = '#f04f78', purple: #38b764, amber: C.yel = '#feae34'

const s = {
  root: {
    minHeight: '100vh',
    backgroundColor: BG,
    color: '#e5e7eb',
    fontFamily: BODY_FONT,
    position: 'relative',
    overflowX: 'hidden',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
    pointerEvents: 'none',
    zIndex: 100,
  },
  starfield: {
    position: 'fixed',
    inset: 0,
    background: `
      radial-gradient(ellipse at 15% 15%, rgba(155,89,182,0.18) 0%, transparent 55%),
      radial-gradient(ellipse at 85% 80%, rgba(46,204,113,0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(52,73,94,0.08) 0%, transparent 70%)
    `,
    pointerEvents: 'none',
    zIndex: 0,
  },

  /* HERO */
  hero: {
    position: 'relative',
    zIndex: 1,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  heroInner: {
    maxWidth: '680px',
    width: '100%',
    textAlign: 'center',
  },
  swordRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '28px',
  },
  swordEmoji: {
    fontSize: '28px',
    filter: 'drop-shadow(0 0 10px rgba(155,89,182,0.9))',
    animation: 'float 3s ease-in-out infinite',
  },
  logoText: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(18px, 5vw, 28px)',
    color: '#38b764',
    letterSpacing: '6px',
    textShadow: '0 0 14px rgba(167,139,250,0.8), 2px 2px 0 #4c1d95',
  },
  cursor: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(14px, 4vw, 22px)',
    color: '#38b764',
    width: '1ch',
    display: 'inline-block',
  },
  headline: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(20px, 5vw, 36px)',
    lineHeight: 1.5,
    color: '#f3f4f6',
    margin: '0 0 8px',
    textShadow: '2px 2px 0 #1a1c2e',
  },
  headlineAccent: {
    color: '#feae34',
    textShadow: '0 0 20px rgba(155,89,182,0.7), 2px 2px 0 #4c1d95',
  },
  subheadline: {
    fontFamily: BODY_FONT,
    fontSize: 'clamp(18px, 3vw, 22px)',
    color: '#9ca3af',
    lineHeight: 1.7,
    margin: '24px auto',
    maxWidth: '520px',
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    justifyContent: 'center',
    marginTop: '16px',
  },
  ctaPrimary: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(9px, 2.5vw, 12px)',
    padding: '16px 28px',
    background: '#38b764',
    border: '3px solid #38b764',
    boxShadow: '4px 4px 0 #000',
    color: '#fff',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  ctaSecondary: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(9px, 2.5vw, 12px)',
    padding: '16px 28px',
    background: 'transparent',
    border: '3px solid #38b764',
    boxShadow: '4px 4px 0 #000',
    color: '#38b764',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  ctaSignIn: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(9px, 2.5vw, 12px)',
    padding: '16px 28px',
    background: 'transparent',
    border: '3px solid #feae34',
    boxShadow: '4px 4px 0 #000',
    color: '#feae34',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  joinForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '24px',
    animation: 'slideUp 0.2s ease',
  },
  joinInput: {
    padding: '14px 16px',
    background: '#1a1c2e',
    border: '2px solid #374151',
    color: '#e5e7eb',
    fontFamily: BASE_FONT,
    fontSize: '14px',
    letterSpacing: '6px',
    textAlign: 'center',
    outline: 'none',
    width: '200px',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
  },
  joinSubmit: {
    padding: '14px 18px',
    background: '#1a1c2e',
    border: '2px solid #38b764',
    color: '#38b764',
    fontFamily: BASE_FONT,
    fontSize: '10px',
    cursor: 'pointer',
    letterSpacing: '1px',
  },
  joinError: {
    width: '100%',
    textAlign: 'center',
    fontSize: '18px',
    color: '#f87171',
    fontFamily: BODY_FONT,
    margin: '4px 0 0',
  },

  /* GAME MODES */
  modesSection: {
    position: 'relative',
    zIndex: 1,
    padding: '60px 20px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  sectionLabel: {
    fontFamily: BASE_FONT,
    fontSize: '9px',
    color: '#4b5563',
    letterSpacing: '3px',
    textAlign: 'center',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(16px, 4vw, 22px)',
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: '40px',
    textShadow: '2px 2px 0 #1a1c2e',
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '24px',
  },

  /* PITCH */
  pitchSection: {
    position: 'relative',
    zIndex: 1,
    padding: '60px 20px 80px',
    display: 'flex',
    justifyContent: 'center',
  },
  pitchBox: {
    maxWidth: '640px',
    textAlign: 'center',
    padding: '40px 32px',
    border: '2px solid #feae34',
    boxShadow: '0 0 0 1px #4c1d95, 0 0 40px rgba(155,89,182,0.3), 4px 4px 0 #1e1b4b',
    position: 'relative',
    background: 'rgba(14,16,25,0.8)',
  },
  pitchQuote: {
    fontFamily: BODY_FONT,
    fontSize: 'clamp(20px, 4vw, 28px)',
    color: '#d1d5db',
    lineHeight: 1.6,
    margin: '0 0 32px',
  },
  pitchAccent: {
    color: '#feae34',
    textShadow: '0 0 14px rgba(155,89,182,0.6)',
  },
  pitchCta: {
    fontFamily: BASE_FONT,
    fontSize: 'clamp(9px, 2.5vw, 12px)',
    padding: '16px 32px',
    background: '#38b764',
    border: '3px solid #38b764',
    boxShadow: '4px 4px 0 #000',
    color: '#fff',
    cursor: 'pointer',
    letterSpacing: '1px',
  },

  /* FOOTER */
  footer: {
    position: 'relative',
    zIndex: 1,
    padding: '20px',
    borderTop: '1px solid #1a1c2e',
    textAlign: 'center',
  },
  footerText: {
    fontFamily: BASE_FONT,
    fontSize: '7px',
    color: '#374151',
    letterSpacing: '2px',
  },
}

const cardBase = {
  background: 'rgba(26,28,46,0.8)',
  border: '2px solid #2d2f45',
  padding: '28px 24px',
  position: 'relative',
  cursor: 'default',
  overflow: 'hidden',
}

const cardTag = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '7px',
  letterSpacing: '2px',
  margin: '0 0 10px',
}

const cardTitle = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 'clamp(11px, 2.5vw, 14px)',
  margin: '0 0 16px',
  lineHeight: 1.5,
}

const cardDesc = {
  fontFamily: "'VT323', monospace",
  fontSize: '20px',
  color: '#9ca3af',
  lineHeight: 1.5,
  margin: 0,
}

// Pixel corner decorations
const cornerTL = {
  position: 'absolute',
  top: 4,
  left: 4,
  width: 10,
  height: 10,
  borderTop: '2px solid',
  borderLeft: '2px solid',
  borderColor: 'inherit',
  opacity: 0.5,
}

const cornerBR = {
  position: 'absolute',
  bottom: 4,
  right: 4,
  width: 10,
  height: 10,
  borderBottom: '2px solid',
  borderRight: '2px solid',
  borderColor: 'inherit',
  opacity: 0.5,
}
