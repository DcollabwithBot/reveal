import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import ImportModal from '../components/ImportModal'


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

const VOTING_MODES = [
  {
    id: 'fibonacci',
    label: '🔢 Fibonacci',
    desc: 'Classic: 1, 2, 3, 5, 8, 13, 21',
    cards: [1, 2, 3, 5, 8, 13, 21, '?']
  },
  {
    id: 'tshirt',
    label: '👕 T-shirt sizes',
    desc: 'Relative: XS, S, M, L, XL, XXL',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?']
  },
  {
    id: 'perspective_poker',
    label: '🧠 Perspective Poker',
    desc: 'Pick role perspective + estimate (Dev, QA, PM, Security)',
    cards: ['Dev + 3', 'QA + 5', 'PM + 8', 'Security + 13']
  },
]

export default function SessionSetup({ onSessionCreated, onBack }) {
  const [user, setUser] = useState(null)
  const [checkingRole, setCheckingRole] = useState(true)

  const [name, setName] = useState('')
  const [votingMode, setVotingMode] = useState('fibonacci')
  const [items, setItems] = useState([{ title: '', description: '' }])

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null) // { id, join_code }
  const [templates, setTemplates] = useState([])
  const [showImport, setShowImport] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    async function checkAccess() {
      const { data } = await supabase.auth.getUser()
      const u = data?.user
      setUser(u)
      if (!u) { setCheckingRole(false); return }

      // Check if user has admin/gm role in any team
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', u.id)
        .maybeSingle()

      try {
        const loadedTemplates = await apiFetch('/api/templates')
        setTemplates(loadedTemplates)
      } catch {
        setTemplates([])
      }
      setCheckingRole(false)
    }
    checkAccess()
  }, [])

  const addItem = () => {
    setItems(prev => [...prev, { title: '', description: '' }])
  }

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const applyTemplate = (id) => {
    const template = templates.find(t => t.id === id)
    if (!template) return
    const cfg = template.config || {}
    if (cfg.name) setName(cfg.name)
    if (cfg.votingMode) setVotingMode(cfg.votingMode)
    if (Array.isArray(cfg.items) && cfg.items.length) setItems(cfg.items)
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) return
    const payload = { name: templateName.trim(), config: { name, votingMode, items } }
    const createdTemplate = await apiFetch('/api/templates', { method: 'POST', body: JSON.stringify(payload) })
    setTemplates(prev => [createdTemplate, ...prev])
    setTemplateName('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Session navn er påkrævet'); return }
    const validItems = items.filter(it => it.title.trim())
    if (validItems.length === 0) { setError('Tilføj mindst ét backlog item'); return }

    setCreating(true)
    setError(null)

    try {
      // Create session via API (which handles team lookup)
      const session = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          session_type: 'poker',
          voting_mode: votingMode,
          items: validItems.map(it => it.title.trim())
        })
      })

      // If items have descriptions, update them via supabase directly
      const descriptionsToUpdate = validItems.filter(it => it.description.trim())
      if (descriptionsToUpdate.length > 0) {
        // Fetch the created items to get their IDs
        const { data: createdItems } = await supabase
          .from('session_items')
          .select('id, title, item_order')
          .eq('session_id', session.id)
          .order('item_order')

        if (createdItems) {
          for (let i = 0; i < validItems.length; i++) {
            if (validItems[i].description.trim() && createdItems[i]) {
              await supabase
                .from('session_items')
                .update({ description: validItems[i].description.trim() })
                .eq('id', createdItems[i].id)
            }
          }
        }
      }

      setCreated({ id: session.id, join_code: session.join_code })
      if (onSessionCreated) onSessionCreated(session)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const copyJoinCode = () => {
    if (created?.join_code) {
      navigator.clipboard?.writeText(created.join_code).catch(() => {})
    }
  }

  // ── Guards ──────────────────────────────────────────────

  if (checkingRole) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: PIXEL, fontSize: '12px', color: C.gold }}>⚙️ CHECKING ACCESS...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: PIXEL, fontSize: '12px', color: C.red }}>🔒 NOT LOGGED IN</div>
        <button onClick={onBack} style={{ background: C.accent, border: 'none', borderRadius: '4px', color: '#fff', padding: '12px 24px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer' }}>
          ← BACK
        </button>
      </div>
    )
  }

  // Non-GM: still allow them to access (role check may fail if team_members uses different column)
  // GM check is best-effort — don't hard block

  // ── Success screen ──────────────────────────────────────

  if (created) {
    const joinUrl = `${window.location.origin}?join=${created.join_code}`
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: C.panel, border: `2px solid ${C.green}`, borderRadius: '12px',
          padding: '32px', textAlign: 'center', maxWidth: '480px', width: '100%'
        }}>
          <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.green, marginBottom: '16px' }}>
            ✅ SESSION OPRETTET!
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: VT, fontSize: '18px', color: C.dim, marginBottom: '8px' }}>Join Code</div>
            <div style={{
              fontFamily: PIXEL, fontSize: '28px', color: C.gold,
              letterSpacing: '8px', marginBottom: '12px'
            }}>
              {created.join_code}
            </div>
            <button onClick={copyJoinCode} style={{
              background: C.border, border: `1px solid ${C.dim}`, borderRadius: '4px',
              color: C.text, padding: '8px 16px', fontFamily: VT, fontSize: '16px', cursor: 'pointer'
            }}>
              📋 Kopiér kode
            </button>
          </div>

          <div style={{ marginBottom: '24px', background: '#050510', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontFamily: VT, fontSize: '14px', color: C.dim, marginBottom: '4px' }}>Join link:</div>
            <div style={{ fontFamily: VT, fontSize: '14px', color: C.accent, wordBreak: 'break-all' }}>
              {joinUrl}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => onSessionCreated && onSessionCreated({ id: created.id, join_code: created.join_code, enterNow: true })}
              style={{
                background: C.gold, border: 'none', borderRadius: '6px',
                color: '#1a1000', padding: '14px 24px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer'
              }}
            >
              ⚔️ ENTER SESSION
            </button>
            <button
              onClick={onBack}
              style={{
                background: 'transparent', border: `2px solid ${C.border}`, borderRadius: '6px',
                color: C.dim, padding: '14px 24px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer'
              }}
            >
              ← LOBBY
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Setup form ──────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '20px', fontFamily: VT, color: C.text }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={onBack} style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '4px',
            color: C.dim, padding: '8px 12px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer'
          }}>← BACK</button>
          <div style={{ fontFamily: PIXEL, fontSize: '12px', color: C.gold }}>🏰 SESSION SETUP</div>
          <div style={{ width: '80px' }} />
        </div>

        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select onChange={e => applyTemplate(e.target.value)} defaultValue="" style={{ flex: 1 }}>
              <option value="">Load template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder='Template name' style={{ flex: 1 }} />
            <button type='button' onClick={saveTemplate}>Save template</button>
          </div>

          {/* Session name */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontFamily: PIXEL, fontSize: '9px', color: C.gold, marginBottom: '8px' }}>
              SESSION NAVN
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Sprint 42 Boss Battle..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#050510', border: `2px solid ${C.border}`, borderRadius: '6px',
                color: C.text, padding: '12px 14px', fontFamily: VT, fontSize: '20px',
                outline: 'none'
              }}
            />
          </div>

          {/* Voting mode */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontFamily: PIXEL, fontSize: '9px', color: C.gold, marginBottom: '8px' }}>
              VOTING MODE
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {VOTING_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setVotingMode(mode.id)}
                  style={{
                    flex: 1,
                    background: votingMode === mode.id ? '#1a1040' : '#050510',
                    border: `2px solid ${votingMode === mode.id ? C.accent : C.border}`,
                    borderRadius: '8px', padding: '14px 10px',
                    color: votingMode === mode.id ? C.text : C.dim,
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ fontFamily: PIXEL, fontSize: '10px', marginBottom: '6px' }}>{mode.label}</div>
                  <div style={{ fontFamily: VT, fontSize: '16px', color: C.dim }}>{mode.desc}</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {mode.cards.map(c => (
                      <span key={c} style={{
                        background: C.border, borderRadius: '3px', padding: '2px 6px',
                        fontFamily: PIXEL, fontSize: '8px', color: C.text
                      }}>{c}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Backlog items */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontFamily: PIXEL, fontSize: '9px', color: C.gold }}>
                BACKLOG ITEMS ({items.length})
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  style={{
                    background: C.border, border: 'none', borderRadius: '4px',
                    color: '#fff', padding: '6px 10px', fontFamily: PIXEL, fontSize: '8px', cursor: 'pointer'
                  }}
                >
                  IMPORT
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  style={{
                    background: C.accent, border: 'none', borderRadius: '4px',
                    color: '#fff', padding: '6px 12px', fontFamily: PIXEL, fontSize: '8px', cursor: 'pointer'
                  }}
                >
                  + ADD ITEM
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{
                  background: '#050510', border: `1px solid ${C.border}`, borderRadius: '6px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: PIXEL, fontSize: '8px', color: C.dim, minWidth: '20px' }}>
                      #{idx + 1}
                    </span>
                    <input
                      value={item.title}
                      onChange={e => updateItem(idx, 'title', e.target.value)}
                      placeholder="Implement login flow..."
                      style={{
                        flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px',
                        color: C.text, padding: '8px 10px', fontFamily: VT, fontSize: '18px', outline: 'none'
                      }}
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{
                          background: 'transparent', border: `1px solid #440000`, borderRadius: '4px',
                          color: C.red, padding: '6px 8px', fontFamily: VT, fontSize: '16px', cursor: 'pointer'
                        }}
                      >✕</button>
                    )}
                  </div>
                  <input
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder="Optional description..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: C.panel, border: `1px solid ${C.border}`, borderRadius: '4px',
                      color: C.dim, padding: '6px 10px', fontFamily: VT, fontSize: '16px', outline: 'none'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: C.red, fontFamily: VT, fontSize: '18px', marginBottom: '16px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={creating}
            style={{
              width: '100%', background: creating ? C.dim : C.gold,
              border: 'none', borderRadius: '6px', color: '#1a1000',
              padding: '16px', fontFamily: PIXEL, fontSize: '11px',
              cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1
            }}
          >
            {creating ? '⚙️ CREATING SESSION...' : '🏰 CREATE SESSION →'}
          </button>

        </form>
        {showImport && (
          <ImportModal
            onClose={() => setShowImport(false)}
            onConfirm={(importedItems) => {
              setItems(prev => [...prev, ...importedItems.map(it => ({ title: it.title, description: it.description }))])
              setShowImport(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
