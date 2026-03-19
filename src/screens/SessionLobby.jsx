import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || ''

const FONTS = {
  pixel: "'Press Start 2P', monospace",
  vt: "'VT323', monospace",
}

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

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

function getAuthToken() {
  // Try to get the current session token
  return supabase.auth.getSession().then(({ data }) => data?.session?.access_token)
}

async function apiFetch(path, options = {}) {
  const token = await getAuthToken()
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'API error')
  }
  return res.json()
}

const SESSION_TYPES = [
  { id: 'estimation', label: '⚔️ Boss Battle', desc: 'Planning Poker' },
  { id: 'roulette', label: '🎰 Scope Roulette', desc: 'Scope Review' },
  { id: 'retro', label: '🏰 Dungeon Raid', desc: 'Retrospective' },
]

function sessionTypeLabel(type) {
  if (type === 'poker') return SESSION_TYPES.find(t => t.id === 'estimation')?.label
  return SESSION_TYPES.find(t => t.id === type)?.label || type
}

const STATUS_COLORS = { draft: C.gold, waiting: C.gold, active: C.green, completed: C.dim }
const STATUS_LABELS = { draft: '⏳ Lobby', waiting: '⏳ Waiting', active: '⚔️ Active', completed: '✅ Done' }

export default function SessionLobby({ onJoin, onCreate, onSetup }) {
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [sessionType, setSessionType] = useState('estimation')
  const [itemsText, setItemsText] = useState('')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user))
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/sessions')
      setSessions(data)
    } catch (e) {
      // Not logged in yet, or no sessions
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Session navn er påkrævet'); return }
    setCreating(true)
    setError(null)
    try {
      const items = itemsText.split('\n').map(s => s.trim()).filter(Boolean)
      const session = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), session_type: sessionType, items })
      })
      setSessions(prev => [session, ...prev])
      setName('')
      setItemsText('')
      setShowCreate(false)
      onCreate?.(session.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleStart = async (session) => {
    try {
      const updated = await apiFetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      })
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, ...updated } : s))
      onCreate?.(session.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setError(null)
    try {
      const session = await apiFetch(`/api/sessions/join/${joinCode.trim().toUpperCase()}`)
      onJoin?.(session.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  const handleCopy = (code) => {
    copyToClipboard(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleJoinExisting = (session) => {
    onJoin?.(session.id)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '20px', fontFamily: C.vt, color: C.text }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontFamily: FONTS.pixel, fontSize: '20px', color: C.gold, marginBottom: '8px', textShadow: `0 0 20px ${C.gold}88` }}>
          ⚔️ REVEAL
        </div>
        <div style={{ fontFamily: FONTS.vt, fontSize: '20px', color: C.dim }}>
          Multiplayer Quest Lobby
        </div>
        {user && (
          <div style={{ marginTop: '8px', fontSize: '16px', color: C.accent }}>
            🧙 {user.email?.split('@')[0] || 'Adventurer'}
          </div>
        )}
        {onSetup && (
          <div style={{ marginTop: '12px' }}>
            <button onClick={onSetup} style={{
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '4px',
              color: C.dim, padding: '6px 14px', fontFamily: FONTS.pixel, fontSize: '8px', cursor: 'pointer'
            }}>
              🏰 ADVANCED SESSION SETUP →
            </button>
          </div>
        )}
      </div>

      {/* Join by code */}
      <div style={{ background: C.panel, border: `2px solid ${C.border}`, borderRadius: '8px', padding: '20px', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
        <div style={{ fontFamily: FONTS.pixel, fontSize: '11px', color: C.gold, marginBottom: '12px' }}>🗝️ JOIN QUEST</div>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: '8px' }}>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={6}
            style={{
              flex: 1, background: '#0a0a1a', border: `2px solid ${C.border}`, borderRadius: '4px',
              color: C.gold, padding: '10px 12px', fontFamily: FONTS.pixel, fontSize: '14px',
              letterSpacing: '4px', textTransform: 'uppercase', outline: 'none'
            }}
          />
          <button type="submit" disabled={joining || !joinCode.trim()} style={{
            background: C.accent, border: 'none', borderRadius: '4px', color: '#fff',
            padding: '10px 16px', fontFamily: FONTS.pixel, fontSize: '10px', cursor: 'pointer',
            opacity: joining ? 0.7 : 1
          }}>
            {joining ? '...' : 'JOIN'}
          </button>
        </form>
      </div>

      {/* Create new session */}
      <div style={{ maxWidth: '480px', margin: '0 auto 24px' }}>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            width: '100%', background: showCreate ? C.border : C.accent, border: `2px solid ${C.accent}`,
            borderRadius: '8px', color: '#fff', padding: '14px', fontFamily: FONTS.pixel,
            fontSize: '11px', cursor: 'pointer', transition: 'background 0.2s'
          }}
        >
          {showCreate ? '✕ CANCEL' : '⚔️ CREATE NEW QUEST'}
        </button>

        {showCreate && (
          <form onSubmit={handleCreate} style={{
            background: C.panel, border: `2px solid ${C.border}`, borderRadius: '8px',
            padding: '20px', marginTop: '8px'
          }}>
            <div style={{ fontFamily: FONTS.pixel, fontSize: '11px', color: C.gold, marginBottom: '16px' }}>
              🏰 QUEST SETUP
            </div>

            <label style={{ display: 'block', fontSize: '14px', color: C.dim, marginBottom: '4px' }}>Quest Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Sprint 42 Boss Battle..."
              style={{
                width: '100%', boxSizing: 'border-box', background: '#0a0a1a',
                border: `2px solid ${C.border}`, borderRadius: '4px',
                color: C.text, padding: '10px 12px', fontFamily: FONTS.vt, fontSize: '18px',
                outline: 'none', marginBottom: '16px'
              }}
            />

            <label style={{ display: 'block', fontSize: '14px', color: C.dim, marginBottom: '8px' }}>Quest Type</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {SESSION_TYPES.map(st => (
                <button key={st.id} type="button" onClick={() => setSessionType(st.id)} style={{
                  flex: 1, background: sessionType === st.id ? C.accent : '#0a0a1a',
                  border: `2px solid ${sessionType === st.id ? C.accent : C.border}`,
                  borderRadius: '6px', color: C.text, padding: '8px 4px',
                  fontFamily: FONTS.vt, fontSize: '16px', cursor: 'pointer', lineHeight: 1.3
                }}>
                  <div>{st.label}</div>
                  <div style={{ fontSize: '13px', color: C.dim }}>{st.desc}</div>
                </button>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '14px', color: C.dim, marginBottom: '4px' }}>
              Items / Enemies (one per line)
            </label>
            <textarea
              value={itemsText}
              onChange={e => setItemsText(e.target.value)}
              placeholder={"Implement login\nFix payment bug\nRefactor auth module"}
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box', background: '#0a0a1a',
                border: `2px solid ${C.border}`, borderRadius: '4px',
                color: C.text, padding: '10px 12px', fontFamily: FONTS.vt, fontSize: '18px',
                outline: 'none', resize: 'vertical', marginBottom: '16px'
              }}
            />

            {error && (
              <div style={{ color: C.red, fontSize: '14px', marginBottom: '12px', fontFamily: FONTS.vt }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={creating} style={{
              width: '100%', background: C.gold, border: 'none', borderRadius: '6px',
              color: '#1a1000', padding: '14px', fontFamily: FONTS.pixel, fontSize: '11px',
              cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1
            }}>
              {creating ? '⚙️ CREATING...' : '🏰 CREATE QUEST LOBBY'}
            </button>
          </form>
        )}
      </div>

      {/* Existing sessions */}
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ fontFamily: FONTS.pixel, fontSize: '11px', color: C.dim, marginBottom: '12px' }}>
          📜 YOUR QUESTS
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: C.dim, fontSize: '20px', padding: '20px' }}>Loading...</div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{
            background: C.panel, border: `2px solid ${C.border}`, borderRadius: '8px',
            padding: '24px', textAlign: 'center', color: C.dim, fontFamily: FONTS.vt, fontSize: '18px'
          }}>
            No quests yet. Create one above!
          </div>
        )}

        {sessions.map(session => (
          <div key={session.id} style={{
            background: C.panel, border: `2px solid ${C.border}`, borderRadius: '8px',
            padding: '16px', marginBottom: '10px', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontFamily: FONTS.pixel, fontSize: '11px', color: C.text, marginBottom: '4px' }}>
                  {session.name}
                </div>
                <div style={{ fontFamily: FONTS.vt, fontSize: '16px', color: C.dim }}>
                  {sessionTypeLabel(session.session_type)}
                </div>
              </div>
              <div style={{ color: STATUS_COLORS[session.status] || C.dim, fontFamily: FONTS.vt, fontSize: '16px' }}>
                {STATUS_LABELS[session.status] || session.status}
              </div>
            </div>

            {session.join_code && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontFamily: FONTS.pixel, fontSize: '18px', color: C.gold, letterSpacing: '4px' }}>
                  {session.join_code}
                </span>
                <button onClick={() => handleCopy(session.join_code)} style={{
                  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '4px',
                  color: copied === session.join_code ? C.green : C.dim, padding: '4px 8px',
                  fontFamily: FONTS.vt, fontSize: '14px', cursor: 'pointer'
                }}>
                  {copied === session.join_code ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              {(session.status === 'waiting' || session.status === 'draft') && (
                <button onClick={() => handleStart(session)} style={{
                  flex: 1, background: C.green, border: 'none', borderRadius: '4px',
                  color: '#001a00', padding: '10px', fontFamily: FONTS.pixel, fontSize: '9px',
                  cursor: 'pointer'
                }}>
                  ⚔️ START QUEST
                </button>
              )}
              {session.status === 'active' && (
                <button onClick={() => handleJoinExisting(session)} style={{
                  flex: 1, background: C.accent, border: 'none', borderRadius: '4px',
                  color: '#fff', padding: '10px', fontFamily: FONTS.pixel, fontSize: '9px',
                  cursor: 'pointer'
                }}>
                  ▶ ENTER SESSION
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
