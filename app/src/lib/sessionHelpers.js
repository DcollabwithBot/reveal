/**
 * Shared helpers for game sessions.
 * All cross-screen Supabase queries for sessions, items, voting, and org members
 * must live here — no copy-pasting in individual screen files.
 *
 * See also: participantHelpers.js (sprite mapping for participants)
 */
import { supabase } from './supabase.js';
import { mapParticipantToSprite } from './participantHelpers.js';

// ---------------------------------------------------------------------------
// Session + items
// ---------------------------------------------------------------------------

/**
 * Fetch a session row together with its session_items.
 * @param {string} sessionId
 * @returns {Promise<{ session: object|null, items: object[] }>}
 */
export async function fetchSessionWithItems(sessionId) {
  if (!sessionId) return { session: null, items: [] };
  try {
    const [{ data: session }, { data: items }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
      supabase.from('session_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    ]);
    return { session: session || null, items: items || [] };
  } catch {
    return { session: null, items: [] };
  }
}

// ---------------------------------------------------------------------------
// Raw participants (screens that need DB-level fields)
// ---------------------------------------------------------------------------

/**
 * Fetch raw session_participants rows (with profiles join).
 * Use this when the screen needs low-level fields like user_id, is_host,
 * profiles.display_name etc. and does its own mapping.
 * @param {string} sessionId
 * @returns {Promise<object[]>}
 */
export async function fetchRawParticipants(sessionId) {
  if (!sessionId) return [];
  try {
    const { data, error } = await supabase
      .from('session_participants')
      .select('*, profiles(id, username, display_name, avatar_class, avatar_config, level, name, avatar_color)')
      .eq('session_id', sessionId);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

/**
 * Subscribe to a game session's broadcast channel with standard event handlers.
 * Returns the Supabase channel — caller MUST clean up with supabase.removeChannel(ch).
 *
 * @param {string} sessionId
 * @param {string} channelName - unique name, e.g. `speed-scope-${sessionId}`
 * @param {Record<string, function>} handlers - map of event name → handler fn
 * @returns {object} Supabase RealtimeChannel
 *
 * @example
 * const ch = subscribeToGameSession(sessionId, `my-game-${sessionId}`, {
 *   GAME_START: () => setStep('playing'),
 *   VOTE:       ({ payload }) => handleVote(payload),
 * });
 * // cleanup:
 * return () => supabase.removeChannel(ch);
 */
export function subscribeToGameSession(sessionId, channelName, handlers = {}) {
  let ch = supabase.channel(channelName);
  for (const [event, handler] of Object.entries(handlers)) {
    ch = ch.on('broadcast', { event }, handler);
  }
  ch.subscribe();
  return ch;
}

// ---------------------------------------------------------------------------
// Voting / broadcast
// ---------------------------------------------------------------------------

/**
 * Persist a vote to the DB (generic votes table) and broadcast it on the channel.
 * Screens with custom vote tables (bluff_assignments etc.) should write directly.
 *
 * @param {object} channel - active Supabase RealtimeChannel
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} itemId
 * @param {*} value - the vote value
 * @returns {Promise<void>}
 */
export async function broadcastVote(channel, sessionId, userId, itemId, value) {
  try {
    await supabase.from('session_votes').upsert({
      session_id: sessionId,
      user_id: userId,
      item_id: itemId,
      value: String(value),
    }, { onConflict: 'session_id,user_id,item_id' });

    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'VOTE',
        payload: { userId, itemId, value },
      });
    }
  } catch (err) {
    console.error('broadcastVote error:', err);
  }
}

// ---------------------------------------------------------------------------
// Org members
// ---------------------------------------------------------------------------

/**
 * Fetch organization members as sprite-ready objects.
 * @param {string} orgId
 * @returns {Promise<object[]>} sprite-compatible member array
 */
export async function fetchOrgMembersAsSprites(orgId) {
  if (!orgId) return [];
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*, profiles(id, username, display_name, avatar_class, avatar_config, level)')
      .eq('organization_id', orgId);
    if (error || !data) return [];
    return data.map((m, i) => mapParticipantToSprite(m, i));
  } catch {
    return [];
  }
}
