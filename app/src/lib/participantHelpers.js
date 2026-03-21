/**
 * Shared helpers for session participants.
 * Used by all game screens to avoid copy-pasting Supabase queries
 * and sprite-mapping logic in every file.
 */
import { supabase } from './supabase.js';

// Available character classes for visual display
const SPRITE_CLASSES = [
  { id: "warrior",  icon: "⚔️",  color: "#f04f78" },
  { id: "mage",     icon: "🧙",  color: "#b55088" },
  { id: "archer",   icon: "🏹",  color: "#feae34" },
  { id: "healer",   icon: "🛡️",  color: "#5fcde4" },
  { id: "rogue",    icon: "🗡️",  color: "#38b764" },
  { id: "berserker",icon: "🪓",  color: "#d77643" },
  { id: "necro",    icon: "💀",  color: "#8855aa" },
];

/**
 * Map a DB participant row to a sprite-compatible member object.
 * @param {object} p - participant row from session_participants + profiles join
 * @param {number} index - position index for fallback class assignment
 * @returns {object} sprite-compatible member
 */
export function mapParticipantToSprite(p, index = 0) {
  const avatarClass = p.profiles?.avatar_class || p.avatar_class;
  const cls = avatarClass || SPRITE_CLASSES[index % SPRITE_CLASSES.length];
  const color = cls.color || SPRITE_CLASSES[index % SPRITE_CLASSES.length].color;
  return {
    id: p.id || `p-${index}`,
    userId: p.user_id,
    name: p.profiles?.display_name || p.profiles?.username || p.name || `P${index + 1}`,
    isP: false,
    lv: p.profiles?.level || 1,
    cls,
    hat: color,
    body: color,
    btc: color,
    skin: '#fdd',
  };
}

/**
 * Fetch session participants from DB, excluding the current user.
 * Returns sprite-compatible member objects.
 * @param {string} sessionId
 * @param {string} [currentUserId] - user to exclude (yourself)
 * @returns {Promise<object[]>} array of sprite-compatible members
 */
export async function fetchSessionParticipants(sessionId, currentUserId = null) {
  if (!sessionId) return [];
  try {
    const { data: rows, error } = await supabase
      .from('session_participants')
      .select('*, profiles(id, username, display_name, avatar_class, avatar_config, level)')
      .eq('session_id', sessionId);
    if (error || !rows) return [];
    return rows
      .filter(p => !currentUserId || p.user_id !== currentUserId)
      .map((p, i) => mapParticipantToSprite(p, i));
  } catch {
    return [];
  }
}

/**
 * Get sprite-ready members for decorative display.
 * Uses participants when available, falls back to NPC_TEAM.
 * @param {object[]} participants - already-fetched participants (from state)
 * @param {object[]} npcFallback - NPC_TEAM from constants.js
 * @returns {object[]} sprite-ready members
 */
export function getDisplaySprites(participants, npcFallback) {
  if (participants && participants.length > 0) {
    return participants.map((p, i) => {
      // If already sprite-formatted (has .hat, .cls), return as-is
      if (p.hat && p.cls) return p;
      // Otherwise map from raw participant
      return mapParticipantToSprite(p, i);
    });
  }
  return npcFallback;
}
