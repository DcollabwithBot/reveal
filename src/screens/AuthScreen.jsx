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
  const [email, setEmail] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#0a0a1a', border: `2px solid ${C.border}`, borderRadius: '6px',
    color: C.text, padding: '12px 14px', fontFamily: VT, fontSize: '20px', outline: 'none',
    marginBottom: '14px'
  }

  const handleGoogle = async () => {
    setError(null)
    setLoadingGoogle(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    if (error) {
      setError(error.message)
      setLoadingGoogle(false)
    }
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setError(null)
    setSent(false)
    setSendingLink(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })

    setSendingLink(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: PIXEL, fontSize: '24px', color: C.gold, marginBottom: '8px',
            textShadow: `0 0 20px ${C.gold}88`
          }}>⚔️ REVEAL</div>
          <div style={{ fontFamily: VT, fontSize: '20px', color: C.dim }}>
            Agile Team Quest Platform
          </div>
        </div>

        <div style={{
          background: C.panel, border: `2px solid ${C.border}`, borderRadius: '12px',
          padding: '28px'
        }}>
          <div style={{ fontFamily: PIXEL, fontSize: '11px', color: C.gold, marginBottom: '20px' }}>
            🗝️ LOGIN TO CONTINUE
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loadingGoogle || sendingLink}
            style={{
              width: '100%', background: '#1f2937', border: `2px solid ${C.border}`, borderRadius: '6px',
              color: C.text, padding: '14px', fontFamily: PIXEL, fontSize: '10px',
              cursor: loadingGoogle ? 'wait' : 'pointer', opacity: loadingGoogle ? 0.7 : 1,
              marginBottom: '16px'
            }}
          >
            {loadingGoogle ? '⚙️ CONNECTING...' : 'G SIGN IN WITH GOOGLE'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ height: '1px', flex: 1, background: C.border }} />
            <div style={{ fontFamily: VT, fontSize: '16px', color: C.dim }}>OR</div>
            <div style={{ height: '1px', flex: 1, background: C.border }} />
          </div>

          <form onSubmit={handleMagicLink}>
            <label style={{ display: 'block', fontFamily: VT, fontSize: '16px', color: C.dim, marginBottom: '4px' }}>
              Email (magic link)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hero@guild.com"
              required
              style={inputStyle}
            />

            <button type="submit" disabled={sendingLink || loadingGoogle} style={{
              width: '100%', background: C.gold, border: 'none', borderRadius: '6px',
              color: '#1a1000', padding: '14px', fontFamily: PIXEL, fontSize: '10px',
              cursor: sendingLink ? 'wait' : 'pointer', opacity: sendingLink ? 0.7 : 1,
              marginBottom: sent ? '10px' : 0
            }}>
              {sendingLink ? '⚙️ SENDING...' : '✉️ SEND MAGIC LINK'}
            </button>
          </form>

          {sent && (
            <div style={{ color: C.green, fontFamily: VT, fontSize: '18px', marginTop: '10px' }}>
              ✓ Check your email for the login link.
            </div>
          )}
          {error && (
            <div style={{ color: C.red, fontFamily: VT, fontSize: '18px', marginTop: '10px' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontFamily: VT, fontSize: '16px', color: C.dim }}>
            Have a join code? Login first, then enter it in the lobby.
          </div>
        </div>
      </div>
    </div>
  )
}
