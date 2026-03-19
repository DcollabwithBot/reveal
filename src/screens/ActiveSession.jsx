import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'
import { ROULETTE_CHALLENGES, SPRINT_EVENTS, CLASSES } from '../shared/constants'

const API_BASE = import.meta.env.VITE_API_URL || ''

const PIXEL = "'Press Start 2P', monospace"
const VT = "'VT323', monospace"

const C = {
  bg: '#0a0a1a',
  bgDark: '#050510',
  panel: '#111130',
  border: '#2a2a5a',
  accent: '#7c5cbf',
  gold: '#f0c040',
  green: '#4ade80',
  red: '#f87171',
  orange: '#fb923c',
  text: '#e0d8f0',
  dim: '#6060a0',
  boss: '#ff4444',
}

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, '?']
const TSHIRT    = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?']
const PERSPECTIVES = ['Dev', 'QA', 'PM', 'Security']

function average(nums) {
  if (!nums.length) return null
  return nums.reduce((sum, n) => sum + n, 0) / nums.length
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const low = Math.floor(idx)
  const high = Math.ceil(idx)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (idx - low)
}

// Calculate mode (most common value) for T-shirt reveal
function calcMode(values) {
  if (!values.length) return null
  const freq = {}
  values.forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
}

function copyText(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}

async function apiFetch(path, options = {}) {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'API error')
  }
  return res.json()
}

function VoteCard({ value, isMyVote, onSelect }) {
  return (
    <button
      onClick={() => onSelect(value)}
      style={{
        width: '60px',
        height: '90px',
        background: isMyVote ? C.accent : C.panel,
        border: `3px solid ${isMyVote ? C.gold : C.border}`,
        borderRadius: '8px',
        color: isMyVote ? C.gold : C.text,
        fontFamily: isMyVote ? PIXEL : VT,
        fontSize: isMyVote ? '14px' : '24px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        transform: isMyVote ? 'translateY(-8px) scale(1.05)' : 'none',
        boxShadow: isMyVote ? `0 8px 20px ${C.accent}66` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {value}
    </button>
  )
}

function HPBar({ pct }) {
  const color = pct > 60 ? C.boss : pct > 30 ? C.orange : C.red
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: PIXEL, fontSize: '9px', color: C.red }}>BOSS HP</span>
        <span style={{ fontFamily: PIXEL, fontSize: '9px', color: C.red }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: '12px', background: '#1a0000', border: '2px solid #440000', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          boxShadow: `0 0 8px ${color}88`, transition: 'width 0.5s'
        }} />
      </div>
    </div>
  )
}

export default function ActiveSession({ sessionId, onBack }) {
  const { session, items, votes, participants, loading, castVote } = useSession(sessionId)
  const [myVoteValue, setMyVoteValue] = useState(null)
  const [selectedPerspective, setSelectedPerspective] = useState('Dev')
  const [voteError, setVoteError] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [challenges, setChallenges] = useState([])
  const [retroEvents, setRetroEvents] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data?.user))
  }, [])

  // Load challenges from DB (with fallback to constants)
  useEffect(() => {
    async function loadChallenges() {
      try {
        const { data, error } = await supabase
          .from('challenges')
          .select('*')
          .is('organization_id', null) // global defaults
          .eq('is_active', true)
          .order('created_at')
        if (!error && data && data.length > 0) {
          setChallenges(data)
        } else {
          // Fallback to constants
          setChallenges(ROULETTE_CHALLENGES)
        }
      } catch {
        setChallenges(ROULETTE_CHALLENGES)
      }
    }
    loadChallenges()
  }, [])

  // Load retro events from DB (with fallback to constants)
  useEffect(() => {
    async function loadRetroEvents() {
      try {
        const { data, error } = await supabase
          .from('retro_events')
          .select('*')
          .is('organization_id', null) // global defaults
          .eq('is_active', true)
          .order('created_at')
        if (!error && data && data.length > 0) {
          setRetroEvents(data)
        } else {
          // Fallback to constants
          setRetroEvents(SPRINT_EVENTS)
        }
      } catch {
        setRetroEvents(SPRINT_EVENTS)
      }
    }
    loadRetroEvents()
  }, [])

  // Reset reveal when item changes
  const prevItemRef = useRef(null)
  const currentItemIndex = session?.current_item_index || 0
  useEffect(() => {
    if (prevItemRef.current !== currentItemIndex) {
      setRevealed(false)
      setMyVoteValue(null)
      setVoteError(null)
      prevItemRef.current = currentItemIndex
    }
  }, [currentItemIndex])

  const isGM = session?.game_master_id === currentUser?.id || session?.created_by === currentUser?.id
  const currentItem = items[currentItemIndex] || null
  const currentItemVotes = votes.filter(v => v.session_item_id === currentItem?.id)
  const myCurrentVote = currentItemVotes.find(v => v.user_id === currentUser?.id)

  // Determine card values based on voting_mode from DB
  const isTshirt = session?.voting_mode === 'tshirt'
  const isPerspectivePoker = session?.voting_mode === 'perspective_poker'
  const cardValues = isTshirt ? TSHIRT : FIBONACCI

  const handleVote = async (value) => {
    if (!currentItem) return
    if (isPerspectivePoker && !selectedPerspective) {
      setVoteError('Vælg et perspektiv før du stemmer')
      return
    }

    setVoteError(null)
    setMyVoteValue(value)
    await castVote(currentItem.id, String(value), {
      perspective: isPerspectivePoker ? selectedPerspective : null,
      metadata: isPerspectivePoker ? { mode: 'perspective_poker' } : {}
    })
  }

  const handleNextItem = async () => {
    if (!session || updating) return
    const nextIndex = currentItemIndex + 1
    const nextItem = items[nextIndex]
    setUpdating(true)
    try {
      await apiFetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          current_item_index: nextIndex,
          ...(nextItem ? { current_item_id: nextItem.id } : {})
        })
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleComplete = async () => {
    if (!session || updating) return
    setUpdating(true)
    try {
      await apiFetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' })
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleCopyCode = () => {
    copyText(session?.join_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: PIXEL, fontSize: '14px', color: C.gold }}>⚙️ LOADING QUEST...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: PIXEL, fontSize: '14px', color: C.red }}>⚠️ SESSION NOT FOUND</div>
        <button onClick={onBack} style={{ background: C.accent, border: 'none', borderRadius: '4px', color: '#fff', padding: '12px 24px', fontFamily: PIXEL, fontSize: '10px', cursor: 'pointer' }}>
          ← BACK
        </button>
      </div>
    )
  }

  const sessionDone = session.status === 'completed'
  const numericVotes = currentItemVotes.map(v => Number(v.value)).filter(n => !isNaN(n))
  const stringVotes = currentItemVotes.map(v => v.value).filter(Boolean)
  const avgVote = numericVotes.length ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length) : null
  const modeVote = stringVotes.length ? calcMode(stringVotes) : null
  const minVote = numericVotes.length ? Math.min(...numericVotes) : null
  const maxVote = numericVotes.length ? Math.max(...numericVotes) : null
  const hpPct = Math.max(10, 100 - (currentItemIndex / Math.max(items.length, 1)) * 100)

  const perspectiveBreakdown = PERSPECTIVES
    .map((perspective) => {
      const pvotes = currentItemVotes.filter(v => v.perspective === perspective)
      const nums = pvotes.map(v => Number(v.value)).filter(n => !Number.isNaN(n))
      const consensus = nums.length ? Math.round(average(nums)) : null
      return { perspective, count: pvotes.length, consensus }
    })
    .filter(p => p.count > 0)

  const perspectiveNumbers = perspectiveBreakdown.map(p => p.consensus).filter(v => typeof v === 'number')
  const recommendedEstimate = perspectiveNumbers.length ? Math.round(average(perspectiveNumbers)) : null
  const q1 = percentile(numericVotes, 0.25)
  const q3 = percentile(numericVotes, 0.75)
  const iqr = q1 != null && q3 != null ? q3 - q1 : null
  const outlierThreshold = iqr != null ? (q3 + iqr * 1.5) : null

  // Write final estimate to DB when GM reveals
  const handleRevealAndSave = async () => {
    setRevealed(true)
    // Write final estimate to session_items
    if (currentItem?.id && currentItemVotes.length > 0) {
      const finalEstimate = isTshirt
        ? modeVote
        : (isPerspectivePoker
          ? (recommendedEstimate !== null ? String(recommendedEstimate) : null)
          : (avgVote !== null ? String(Math.round(avgVote)) : null))
      if (finalEstimate) {
        try {
          await supabase
            .from('session_items')
            .update({ final_estimate: finalEstimate, status: 'completed' })
            .eq('id', currentItem.id)
        } catch (err) {
          console.warn('Could not save final estimate:', err)
        }
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgDark, padding: '16px', fontFamily: VT, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '4px',
          color: C.dim, padding: '8px 12px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer'
        }}>← EXIT</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: PIXEL, fontSize: '10px', color: C.gold }}>{session.name}</div>
          <div style={{ fontSize: '14px', color: C.dim, marginTop: '2px' }}>
            {sessionDone ? '✅ QUEST COMPLETE' : `Enemy ${currentItemIndex + 1}/${items.length}`}
          </div>
        </div>

        <button onClick={handleCopyCode} style={{
          background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '4px',
          color: copied ? C.green : C.gold, padding: '8px 10px', fontFamily: PIXEL,
          fontSize: '11px', cursor: 'pointer', letterSpacing: '2px'
        }}>
          {copied ? '✓' : session.join_code}
        </button>
      </div>

      {/* Presence */}
      {participants.length > 0 && (
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: '8px',
          padding: '8px 14px', marginBottom: '14px',
          display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'
        }}>
          <span style={{ fontFamily: PIXEL, fontSize: '9px', color: C.dim }}>🟢</span>
          {participants.map((p, i) => (
            <span key={i} style={{ color: C.green, fontSize: '16px', fontFamily: VT }}>
              🧙 {p.user_id?.slice(0, 6) || '???'}
            </span>
          ))}
        </div>
      )}

      {sessionDone ? (
        <div style={{
          background: C.panel, border: `2px solid ${C.gold}`, borderRadius: '12px',
          padding: '32px', textAlign: 'center'
        }}>
          <div style={{ fontFamily: PIXEL, fontSize: '18px', color: C.gold, marginBottom: '16px' }}>🏆 QUEST COMPLETE!</div>
          <div style={{ fontSize: '20px', color: C.text, marginBottom: '24px' }}>All enemies defeated.</div>
          <button onClick={onBack} style={{
            background: C.gold, border: 'none', borderRadius: '6px',
            color: '#1a1000', padding: '14px 32px', fontFamily: PIXEL, fontSize: '11px', cursor: 'pointer'
          }}>← RETURN TO LOBBY</button>
        </div>
      ) : !currentItem ? (
        <div style={{ textAlign: 'center', color: C.dim, fontFamily: VT, fontSize: '20px', padding: '40px' }}>
          No items in this session yet.
        </div>
      ) : (
        <>
          {/* Boss Battle */}
          <div style={{
            background: 'linear-gradient(180deg, #1a0000, #111130)',
            border: '2px solid #440000', borderRadius: '12px',
            padding: '20px', marginBottom: '16px'
          }}>
            <div style={{ fontFamily: PIXEL, fontSize: '9px', color: C.red, marginBottom: '12px', letterSpacing: '2px' }}>
              ⚔️ CURRENT ENEMY
            </div>
            <HPBar pct={hpPct} />
            <div style={{
              fontFamily: PIXEL, fontSize: '13px', color: C.red,
              textShadow: `0 0 10px ${C.red}88`, marginTop: '12px',
              lineHeight: 1.7, wordBreak: 'break-word'
            }}>
              👹 {currentItem.title}
            </div>
          </div>

          {/* Vote cards */}
          <div style={{
            background: C.panel, border: `2px solid ${C.border}`, borderRadius: '12px',
            padding: '16px', marginBottom: '16px'
          }}>
            <div style={{ fontFamily: PIXEL, fontSize: '9px', color: C.gold, marginBottom: '16px' }}>
              🎴 CAST YOUR SPELL
            </div>

            {isPerspectivePoker && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontFamily: PIXEL, fontSize: '8px', color: C.dim, marginBottom: '8px' }}>PERSPECTIVE CARD</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {PERSPECTIVES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPerspective(p)}
                      style={{
                        background: selectedPerspective === p ? '#1a1040' : '#0a0a1a',
                        border: `2px solid ${selectedPerspective === p ? C.accent : C.border}`,
                        borderRadius: '6px',
                        color: selectedPerspective === p ? C.gold : C.text,
                        fontFamily: PIXEL,
                        fontSize: '8px',
                        padding: '8px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {cardValues.map(val => (
                <VoteCard
                  key={val}
                  value={val}
                  isMyVote={myVoteValue === val || myCurrentVote?.value === String(val)}
                  onSelect={handleVote}
                />
              ))}
            </div>
            {voteError && (
              <div style={{ textAlign: 'center', marginTop: '10px', color: C.red, fontFamily: VT, fontSize: '18px' }}>
                ⚠ {voteError}
              </div>
            )}
            {myCurrentVote && (
              <div style={{ textAlign: 'center', marginTop: '12px', color: C.green, fontFamily: VT, fontSize: '18px' }}>
                ✓ Your vote: <strong>{myCurrentVote.value}</strong>
                {isPerspectivePoker && myCurrentVote.perspective ? ` as ${myCurrentVote.perspective}` : ''}
              </div>
            )}
          </div>

          {/* Votes display */}
          <div style={{
            background: C.panel, border: `2px solid ${C.border}`, borderRadius: '12px',
            padding: '16px', marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontFamily: PIXEL, fontSize: '9px', color: C.dim }}>
                🗳️ VOTES ({currentItemVotes.length})
              </div>
            </div>

            {currentItemVotes.length === 0 ? (
              <div style={{ color: C.dim, fontSize: '18px', textAlign: 'center', padding: '12px' }}>
                Waiting for votes...
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentItemVotes.map((vote, i) => (
                  <div key={vote.id || i} style={{
                    background: '#0a0a1a', border: `2px solid ${C.border}`, borderRadius: '8px',
                    padding: '10px 14px', textAlign: 'center', minWidth: '70px'
                  }}>
                    <div style={{ fontSize: '13px', color: C.dim, marginBottom: '4px' }}>
                      {(CLASSES.find(c => c.id === vote.profiles?.avatar_class)?.icon || '🧙')} {vote.profiles?.display_name || vote.user_id?.slice(0, 6) || '???'}
                    </div>
                    <div style={{
                      fontFamily: PIXEL, fontSize: '16px',
                      color: revealed ? C.gold : C.dim,
                      filter: revealed ? 'none' : 'blur(6px)',
                      transition: 'all 0.4s'
                    }}>
                      {revealed ? vote.value : '?'}
                    </div>
                    {revealed && isPerspectivePoker && vote.perspective && (
                      <div style={{ fontFamily: PIXEL, fontSize: '8px', color: C.accent, marginTop: '6px' }}>
                        {vote.perspective}
                      </div>
                    )}
                    {revealed && outlierThreshold != null && Number(vote.value) > outlierThreshold && (
                      <div style={{ fontFamily: PIXEL, fontSize: '8px', color: C.red, marginTop: '4px' }}>
                        OUTLIER
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {revealed && currentItemVotes.length > 0 && (
              <div style={{
                marginTop: '16px', display: 'flex', gap: '16px', justifyContent: 'center',
                background: '#0a0a1a', borderRadius: '8px', padding: '12px'
              }}>
                {isTshirt ? (
                  // T-shirt mode: show mode (most common) + distribution
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>CONSENSUS</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '18px', color: C.gold }}>{modeVote}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>VOTES</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.text }}>{currentItemVotes.length}</div>
                    </div>
                  </>
                ) : isPerspectivePoker ? (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>RECOMMENDED</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '18px', color: C.gold }}>{recommendedEstimate ?? '-'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>PERSPECTIVES</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.text }}>{perspectiveBreakdown.length}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>OUTLIER CUT</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '14px', color: C.red }}>{outlierThreshold?.toFixed?.(1) ?? '-'}</div>
                    </div>
                  </>
                ) : (
                  // Fibonacci mode: show avg/min/max
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>AVG</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.gold }}>{avgVote?.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>MIN</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.green }}>{minVote}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.dim }}>MAX</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '16px', color: C.red }}>{maxVote}</div>
                    </div>
                  </>
                )}
              </div>
            )}
            {revealed && isPerspectivePoker && perspectiveBreakdown.length > 0 && (
              <div style={{ marginTop: '12px', background: '#0a0a1a', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontFamily: PIXEL, fontSize: '8px', color: C.dim, marginBottom: '8px' }}>CONSENSUS PER PERSPECTIVE</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {perspectiveBreakdown.map((row) => (
                    <div key={row.perspective} style={{ border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 8px' }}>
                      <div style={{ fontFamily: PIXEL, fontSize: '8px', color: C.accent }}>{row.perspective}</div>
                      <div style={{ fontFamily: PIXEL, fontSize: '12px', color: C.gold }}>{row.consensus ?? '-'}</div>
                      <div style={{ fontSize: '12px', color: C.dim }}>{row.count} vote(s)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GM Controls */}
          {isGM && (
            <div style={{
              background: 'linear-gradient(180deg, #0a1a0a, #111130)',
              border: '2px solid #1a4a1a', borderRadius: '12px', padding: '16px'
            }}>
              <div style={{ fontFamily: PIXEL, fontSize: '9px', color: C.green, marginBottom: '12px' }}>
                👑 GM CONTROLS
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!revealed && currentItemVotes.length > 0 && (
                  <button onClick={handleRevealAndSave} style={{
                    flex: 1, background: C.gold, border: 'none', borderRadius: '6px',
                    color: '#1a1000', padding: '12px', fontFamily: PIXEL, fontSize: '9px', cursor: 'pointer'
                  }}>
                    👁️ REVEAL VOTES
                  </button>
                )}
                {currentItemIndex < items.length - 1 ? (
                  <button onClick={handleNextItem} disabled={updating} style={{
                    flex: 1, background: C.green, border: 'none', borderRadius: '6px',
                    color: '#001a00', padding: '12px', fontFamily: PIXEL, fontSize: '9px',
                    cursor: updating ? 'wait' : 'pointer', opacity: updating ? 0.7 : 1
                  }}>
                    ⚔️ NEXT ENEMY
                  </button>
                ) : (
                  <button onClick={handleComplete} disabled={updating} style={{
                    flex: 1, background: C.accent, border: 'none', borderRadius: '6px',
                    color: '#fff', padding: '12px', fontFamily: PIXEL, fontSize: '9px',
                    cursor: updating ? 'wait' : 'pointer', opacity: updating ? 0.7 : 1
                  }}>
                    🏆 COMPLETE QUEST
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
