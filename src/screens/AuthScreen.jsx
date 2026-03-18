import { useState } from 'react'
import { supabase } from '../lib/supabase'

const PIXEL = "'Press Start 2P', monospace"
const VT = "'VT323', monospace"

const C = {
  bg: '#0a0a1a',
  panel: '#111130',
  border: '#2a2a5a',
  accent: '#7c5cbf',
  gold: '#f0c040',
  green: '#4ade80',
  red: '#f87171',
  text: '#e0d8f0',
  dim: '#6060a0',
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#0a0a1a', border: `2px solid ${C.border}`, borderRadius: '6px',
    color: C.text, padding: '12px 14px', fontFamily: VT, fontSize: '20px', outline: 'none',
    marginBottom: '14px'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App.jsx auth listener handles the redirect
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: PIXEL, fontSize: '24px', color: C.gold, marginBottom: '8px',
            textShadow: `0 0 20px ${C.gold}88`
          }}>⚔️ REVEAL</div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: C.dim }}>
            Agile Team Quest Platform
          </div>
        </div>

        {/* Auth form */}
        <div style={{
          background: C.panel, border: `2px solid ${C.border}`, borderRadius: '12px',
          padding: '28px'
        }}>
          <div style={{ fontFamily: PIXEL, fontSize: '11px', color: C.gold, marginBottom: '20px' }}>
            {mode === 'login' ? '🗝️ ENTER THE DUNGEON' : '⚔️ CREATE HERO'}
          </div>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontFamily: VT, fontSize: '16px', color: C.dim, marginBottom: '4px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hero@guild.com"
              required
              style={inputStyle}
            />

            <label style={{ display: 'block', fontFamily: VT, fontSize: '16px', color: C.dim, marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={inputStyle}
            />

            {error && (
              <div style={{ color: C.red, fontFamily: VT, fontSize: '18px', marginBottom: '12px' }}>
                ⚠️ {error}
              </div>
            )}
            {message && (
              <div style={{ color: C.green, fontFamily: VT, fontSize: '18px', marginBottom: '12px' }}>
                ✓ {message}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: C.gold, border: 'none', borderRadius: '6px',
              color: '#1a1000', padding: '14px', fontFamily: PIXEL, fontSize: '11px',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              marginBottom: '16px'
            }}>
              {loading ? '⚙️ ...' : mode === 'login' ? '🗝️ LOGIN' : '⚔️ CREATE ACCOUNT'}
            </button>
          </form>

          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }} style={{
              background: 'transparent', border: 'none', color: C.accent,
              fontFamily: VT, fontSize: '18px', cursor: 'pointer', textDecoration: 'underline'
            }}>
              {mode === 'login' ? 'No account? Sign up →' : '← Back to login'}
            </button>
          </div>
        </div>

        {/* Quick join without auth */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontFamily: VT, fontSize: '16px', color: C.dim }}>
            Have a join code? Login first, then enter it in the lobby.
          </div>
        </div>
      </div>
    </div>
  )
}
