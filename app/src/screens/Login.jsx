import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onGuestPlay }) {
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://reveal.blichert.net/auth/callback'
      }
    })
  }

  const handleJoinByCode = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setError('')
    try {
      const res = await fetch(`/api/sessions/join/${joinCode.trim().toUpperCase()}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Session ikke fundet')
        return
      }
      const session = await res.json()
      // Guest join — pass session info up
      if (onGuestPlay) onGuestPlay(session)
    } catch (err) {
      setError('Kunne ikke forbinde til serveren')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Scanlines overlay */}
      <div style={styles.scanlines} />

      {/* Stars background */}
      <div style={styles.stars} />

      <div style={styles.panel}>
        {/* Title */}
        <div style={styles.titleBlock}>
          <div style={styles.sword}>⚔️</div>
          <h1 style={styles.title}>REVEAL</h1>
          <p style={styles.subtitle}>Planning Poker RPG</p>
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>LOGIN</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Google login */}
        <button style={styles.googleBtn} onClick={handleGoogleLogin}>
          <span style={styles.googleIcon}>G</span>
          <span>Login med Google</span>
        </button>

        {/* Guest join */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>ELLER</span>
          <span style={styles.dividerLine} />
        </div>

        <p style={styles.guestLabel}>Join session som gæst</p>

        <form onSubmit={handleJoinByCode} style={styles.form}>
          <input
            style={styles.codeInput}
            type="text"
            placeholder="KODE"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            style={styles.joinBtn}
            disabled={joining || !joinCode.trim()}
          >
            {joining ? '...' : '▶ JOIN'}
          </button>
        </form>

        {error && <p style={styles.error}>⚠️ {error}</p>}

        {/* Flavor text */}
        <p style={styles.flavor}>
          Gem din XP og stats — log ind med Google
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0e1019',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Press Start 2P', monospace",
    position: 'relative',
    overflow: 'hidden',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  stars: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 20% 20%, rgba(120,40,200,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(40,120,200,0.12) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  panel: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '380px',
    padding: '32px 28px',
    background: 'rgba(14, 16, 25, 0.95)',
    border: '2px solid #7c3aed',
    boxShadow: '0 0 0 1px #4c1d95, 0 0 30px rgba(124,58,237,0.3), inset 0 0 30px rgba(0,0,0,0.5)',
    imageRendering: 'pixelated',
  },
  titleBlock: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  sword: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '8px',
    filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.8))',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#a78bfa',
    textShadow: '0 0 10px rgba(167,139,250,0.8), 2px 2px 0 #4c1d95',
    letterSpacing: '4px',
    fontFamily: "'Press Start 2P', monospace",
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '8px',
    color: '#6b7280',
    letterSpacing: '2px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #4c1d95, transparent)',
  },
  dividerText: {
    fontSize: '8px',
    color: '#6b7280',
    letterSpacing: '2px',
    whiteSpace: 'nowrap',
  },
  googleBtn: {
    width: '100%',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #7c3aed 100%)',
    border: '2px solid #a78bfa',
    boxShadow: '0 0 0 1px #4c1d95, 4px 4px 0 #1e1b4b, 0 0 20px rgba(124,58,237,0.4)',
    color: '#fff',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    letterSpacing: '1px',
    transition: 'transform 0.1s, box-shadow 0.1s',
    imageRendering: 'pixelated',
  },
  googleIcon: {
    display: 'inline-flex',
    width: '18px',
    height: '18px',
    background: '#fff',
    color: '#4f46e5',
    borderRadius: '2px',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
  },
  guestLabel: {
    fontSize: '8px',
    color: '#9ca3af',
    textAlign: 'center',
    margin: '0 0 12px',
    letterSpacing: '1px',
  },
  form: {
    display: 'flex',
    gap: '8px',
  },
  codeInput: {
    flex: 1,
    padding: '12px 10px',
    background: '#1a1c2e',
    border: '2px solid #374151',
    color: '#e5e7eb',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '12px',
    letterSpacing: '4px',
    textAlign: 'center',
    outline: 'none',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
  },
  joinBtn: {
    padding: '12px 14px',
    background: '#1a1c2e',
    border: '2px solid #374151',
    color: '#a78bfa',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '9px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    letterSpacing: '1px',
    transition: 'background 0.1s, border-color 0.1s',
  },
  error: {
    fontSize: '8px',
    color: '#f87171',
    textAlign: 'center',
    margin: '10px 0 0',
    letterSpacing: '1px',
  },
  flavor: {
    fontSize: '7px',
    color: '#4b5563',
    textAlign: 'center',
    margin: '20px 0 0',
    letterSpacing: '1px',
    lineHeight: '1.6',
  },
}
