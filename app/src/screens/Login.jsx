import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { C, PF, BF } from '../shared/constants'

export default function Login({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(true)

  useEffect(() => {
    const t = setInterval(() => setTick(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && onNavigate) onNavigate('dashboard')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session && onNavigate) onNavigate('dashboard')
    })
    return () => subscription.unsubscribe()
  }, [onNavigate])

  const handleGoogle = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' }
    })
    if (error) setError(error.message)
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/dashboard' }
    })
    setSending(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={s.root}>
      <div style={s.scanlines} />

      <div style={s.panel}>
        {/* Title */}
        <div style={s.titleRow}>
          <span style={s.sword}>⚔️</span>
          <span style={s.logo}>REVEAL</span>
          <span style={s.cursor}>{tick ? '█' : ' '}</span>
        </div>
        <p style={s.sub}>SIGN IN TO CONTINUE YOUR ADVENTURE</p>

        <div style={s.divider}>
          <div style={s.line} />
        </div>

        {/* Google */}
        <button
          style={s.googleBtn}
          onClick={handleGoogle}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '2px 2px 0 #000' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0 #000' }}
        >
          <span style={s.gIcon}>G</span>
          SIGN IN WITH GOOGLE
        </button>

        {/* OR divider */}
        <div style={s.orRow}>
          <div style={s.orLine} />
          <span style={s.orText}>─── OR ───</span>
          <div style={s.orLine} />
        </div>

        {/* Magic link */}
        {sent ? (
          <div style={s.sentBox}>
            <div style={s.sentIcon}>✉️</div>
            <div style={s.sentText}>CHECK YOUR EMAIL</div>
            <div style={s.sentSub}>Magic link sent to {email}</div>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} style={s.form}>
            <input
              style={s.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              style={{ ...s.magicBtn, opacity: sending ? 0.6 : 1 }}
              disabled={sending}
              onMouseEnter={e => { if (!sending) { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '2px 2px 0 #000' } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0 #000' }}
            >
              {sending ? '...' : 'SEND LINK'}
            </button>
          </form>
        )}

        {error && <div style={s.error}>{error}</div>}

        <div style={s.flavor}>
          <span style={{ color: C.dim }}>FIRST TIME? CREATE YOUR AVATAR AFTER SIGNING IN</span>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100vh',
    background: C.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: PF,
    position: 'relative',
    overflow: 'hidden',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  panel: {
    position: 'relative',
    zIndex: 1,
    background: C.bgC,
    border: `3px solid ${C.grn}`,
    boxShadow: `4px 4px 0 #000, 0 0 24px rgba(56,183,100,0.2)`,
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
    boxSizing: 'border-box',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  sword: { fontSize: '20px' },
  logo: {
    fontFamily: PF,
    fontSize: '28px',
    color: C.grn,
    textShadow: `0 0 12px ${C.grn}, 2px 2px 0 #000`,
    letterSpacing: '4px',
  },
  cursor: {
    fontFamily: PF,
    fontSize: '24px',
    color: C.grn,
  },
  sub: {
    fontFamily: PF,
    fontSize: '7px',
    color: C.dim,
    textAlign: 'center',
    letterSpacing: '1px',
    margin: '0 0 24px',
  },
  divider: {
    borderTop: `1px solid ${C.brd}`,
    marginBottom: '24px',
  },
  line: { flex: 1 },
  googleBtn: {
    width: '100%',
    padding: '14px 16px',
    background: C.bgL,
    border: `3px solid ${C.grn}`,
    boxShadow: '4px 4px 0 #000',
    color: C.wht,
    fontFamily: PF,
    fontSize: '9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    letterSpacing: '1px',
    transition: 'transform 0.08s, box-shadow 0.08s',
    boxSizing: 'border-box',
  },
  gIcon: {
    display: 'inline-flex',
    width: '20px',
    height: '20px',
    background: C.wht,
    color: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 'bold',
    fontFamily: 'Arial, sans-serif',
    flexShrink: 0,
  },
  orRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '20px 0',
  },
  orLine: {
    flex: 1,
    height: '1px',
    background: C.brd,
  },
  orText: {
    fontFamily: BF,
    fontSize: '14px',
    color: C.dim,
    whiteSpace: 'nowrap',
    letterSpacing: '2px',
  },
  form: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '12px 10px',
    background: C.bg,
    border: `3px solid ${C.brd}`,
    color: C.wht,
    fontFamily: BF,
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  magicBtn: {
    padding: '12px 14px',
    background: C.yel,
    border: '3px solid #000',
    boxShadow: '4px 4px 0 #000',
    color: '#000',
    fontFamily: PF,
    fontSize: '7px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    letterSpacing: '1px',
    transition: 'transform 0.08s, box-shadow 0.08s',
  },
  sentBox: {
    textAlign: 'center',
    padding: '20px',
    border: `2px solid ${C.grn}`,
    background: C.bg,
  },
  sentIcon: { fontSize: '32px', marginBottom: '10px' },
  sentText: {
    fontFamily: PF,
    fontSize: '10px',
    color: C.grn,
    marginBottom: '8px',
  },
  sentSub: {
    fontFamily: BF,
    fontSize: '14px',
    color: C.dim,
  },
  error: {
    fontFamily: PF,
    fontSize: '7px',
    color: C.red,
    textAlign: 'center',
    marginTop: '12px',
    letterSpacing: '1px',
  },
  flavor: {
    fontFamily: PF,
    fontSize: '6px',
    textAlign: 'center',
    marginTop: '24px',
    letterSpacing: '1px',
    lineHeight: 1.8,
  },
}
