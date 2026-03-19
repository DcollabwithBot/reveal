import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSession(sessionId) {
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [votes, setVotes] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    const load = async () => {
      const [sessionRes, itemsRes, votesRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('session_items').select('*').eq('session_id', sessionId).order('item_order'),
        supabase.from('votes').select('*, profiles(display_name, avatar_class)').eq('session_id', sessionId)
      ])
      if (sessionRes.data) setSession(sessionRes.data)
      if (itemsRes.data) setItems(itemsRes.data)
      if (votesRes.data) setVotes(votesRes.data)
      setLoading(false)
    }
    load()

    // Realtime subscriptions
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}`
      }, (payload) => {
        if (payload.new) setSession(payload.new)
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setVotes(prev => [...prev.filter(v => v.id !== payload.new.id), payload.new])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setVotes(prev => prev.map(v => v.id === payload.new.id ? payload.new : v))
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setParticipants(Object.values(state).flat())
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() })
          }
        }
      })

    return () => supabase.removeChannel(channel)
  }, [sessionId])

  // Cast vote — uses real schema: session_item_id, round defaults to 1
  const castVote = async (sessionItemId, value, extra = {}) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      session_id: sessionId,
      session_item_id: sessionItemId,
      user_id: user.id,
      value: String(value),
      perspective: extra.perspective || null,
      metadata: extra.metadata || {},
      round: 1,
      submitted_at: new Date().toISOString()
    }

    // Upsert: update if user already voted for this item in this session/round
    const { error } = await supabase.from('votes').upsert(payload, { onConflict: 'session_id,session_item_id,user_id,round' })

    if (error) {
      // Fallback: insert new vote
      await supabase.from('votes').insert(payload)
    }
  }

  return { session, items, votes, participants, loading, castVote }
}
