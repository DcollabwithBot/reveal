import { supabase } from '../supabase';
import { edgeFn, resolveMembership } from './shared';

// ── Game Stats ────────────────────────────────────────────────────────────────
export async function getGameStats() {
  const membership = await resolveMembership();
  if (!membership?.organization_id) throw new Error('No org');
  const orgId = membership.organization_id;

  const { data: sprints } = await supabase
    .from('sprints')
    .select('id, name, status, end_date, project_id')
    .eq('organization_id', orgId)
    .order('end_date', { ascending: false })
    .limit(20);

  const completedSprints = (sprints || []).filter(s => s.status === 'completed');
  const activeSprint = (sprints || []).find(s => s.status === 'active');

  let sprint_streak = 0;
  for (const _s of completedSprints) {
    sprint_streak++;
    if (sprint_streak >= 10) break;
  }

  let estimation_accuracy = null;
  const recentCompletedIds = completedSprints.slice(0, 5).map(s => s.id);
  if (recentCompletedIds.length) {
    const { data: estItems } = await supabase
      .from('session_items')
      .select('estimated_hours, actual_hours')
      .in('sprint_id', recentCompletedIds)
      .not('estimated_hours', 'is', null)
      .not('actual_hours', 'is', null);

    const pairs = (estItems || []).filter(i => i.estimated_hours > 0 && i.actual_hours > 0);
    if (pairs.length) {
      const accuracies = pairs.map(i => {
        const ratio = i.actual_hours / i.estimated_hours;
        return ratio > 1 ? 1 / ratio : ratio;
      });
      estimation_accuracy = Number((accuracies.reduce((s, v) => s + v, 0) / accuracies.length).toFixed(2));
    }
  }

  let team_velocity_trend = 'stable';
  if (completedSprints.length >= 3) {
    const lastThreeIds = completedSprints.slice(0, 3).map(s => s.id);
    const { data: velItems } = await supabase
      .from('session_items')
      .select('sprint_id, estimated_hours')
      .in('sprint_id', lastThreeIds)
      .eq('item_status', 'done');

    const pointsBySprint = {};
    for (const item of velItems || []) {
      pointsBySprint[item.sprint_id] = (pointsBySprint[item.sprint_id] || 0) + (item.estimated_hours || 1);
    }

    const velocities = lastThreeIds.map(id => pointsBySprint[id] || 0);
    if (velocities[0] > velocities[1]) team_velocity_trend = 'up';
    else if (velocities[0] < velocities[1]) team_velocity_trend = 'down';
  }

  let sessions_this_sprint = 0;
  if (activeSprint) {
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('sprint_id', activeSprint.id)
      .eq('session_type', 'estimation');
    sessions_this_sprint = count || 0;
  }

  let items_estimated_pct = 0;
  if (activeSprint) {
    const { data: allItems } = await supabase
      .from('session_items')
      .select('id, estimated_hours')
      .eq('sprint_id', activeSprint.id);

    const total = (allItems || []).length;
    const estimated = (allItems || []).filter(i => i.estimated_hours != null).length;
    items_estimated_pct = total > 0 ? Number((estimated / total).toFixed(2)) : 0;
  }

  return { sprint_streak, estimation_accuracy, team_velocity_trend, sessions_this_sprint, items_estimated_pct };
}

// ── Projection Config ─────────────────────────────────────────────────────────
export async function getProjectionConfig() {
  const membership = await resolveMembership();
  const organizationId = membership?.organization_id || null;

  let query = supabase.from('game_profiles').select('*');
  if (organizationId) {
    query = query
      .or(`organization_id.eq.${organizationId},and(organization_id.is.null,is_default.eq.true)`)
      .order('organization_id', { ascending: false })
      .limit(1);
  } else {
    query = query.eq('is_default', true).is('organization_id', null).limit(1);
  }

  const { data: profiles } = await query;
  const profile = (profiles || [])[0] || null;
  if (!profile) return { profile: null, bossProfiles: [], rewardRules: [], achievements: [] };

  const [{ data: bossProfiles }, { data: rewardRules }, { data: achievements }] = await Promise.all([
    supabase.from('boss_profiles').select('*').eq('game_profile_id', profile.id).order('key'),
    supabase.from('reward_rules').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key'),
    supabase.from('achievement_definitions').select('*').eq('game_profile_id', profile.id).eq('is_active', true).order('key')
  ]);

  return {
    profile,
    bossProfiles: bossProfiles || [],
    rewardRules: rewardRules || [],
    achievements: achievements || []
  };
}

// ── v3.1 XP / Badges ─────────────────────────────────────────────────────────
export async function getUserBadges(userId) {
  const { data } = await supabase.from('user_badges')
    .select('badge_type, earned_at, session_id')
    .eq('user_id', userId);
  return data || [];
}

export async function getUserProfile(userId) {
  const { data } = await supabase.from('profiles')
    .select('id, display_name, avatar_class, xp, level, accuracy_score')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function awardXpBadges(event, sessionId, sprintId) {
  return edgeFn('award-xp-badges', { event, session_id: sessionId, sprint_id: sprintId });
}

// ── Sprint E: Leaderboard ─────────────────────────────────────────────────────
export async function getLeaderboard({ organizationId, category = 'xp', limit = 10 } = {}) {
  try {
    let orgId = organizationId;
    if (!orgId) {
      const m = await resolveMembership();
      orgId = m?.organization_id;
    }
    if (!orgId) return [];

    // Base: profiles in org
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId);

    const userIds = (members || []).map(m => m.user_id).filter(Boolean);
    if (!userIds.length) return [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_class, xp, level')
      .in('id', userIds)
      .order('xp', { ascending: false })
      .limit(limit);

    if (category === 'xp' || !profiles?.length) {
      return (profiles || []).map((p, i) => ({
        rank: i + 1,
        user_id: p.id,
        display_name: p.display_name || p.id?.slice(0, 8) || 'Anonym',
        avatar_class: p.avatar_class || null,
        xp: p.xp || 0,
        level: p.level || 1,
        score: p.xp || 0,
        scoreLabel: `${p.xp || 0} XP`,
      }));
    }

    // For other categories, compute from session data
    const baseEntries = (profiles || []).map(p => ({
      user_id: p.id,
      display_name: p.display_name || p.id?.slice(0, 8) || 'Anonym',
      avatar_class: p.avatar_class || null,
      xp: p.xp || 0,
      level: p.level || 1,
      score: 0,
      scoreLabel: '0',
    }));

    if (category === 'accuracy') {
      // Estimation accuracy: compare final_estimate vs actual_hours
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, value, session_items(final_estimate, actual_hours)')
        .in('user_id', userIds)
        .not('session_items.actual_hours', 'is', null)
        .limit(500);

      const accuracyByUser = {};
      for (const v of votes || []) {
        const actual = v.session_items?.actual_hours;
        const estimate = Number(v.value);
        if (!actual || !estimate || isNaN(estimate)) continue;
        const ratio = actual / estimate;
        const acc = ratio > 1 ? 1 / ratio : ratio;
        if (!accuracyByUser[v.user_id]) accuracyByUser[v.user_id] = { total: 0, count: 0 };
        accuracyByUser[v.user_id].total += acc;
        accuracyByUser[v.user_id].count += 1;
      }

      return baseEntries
        .map(e => {
          const a = accuracyByUser[e.user_id];
          const pct = a ? Math.round((a.total / a.count) * 100) : 0;
          return { ...e, score: pct, scoreLabel: `${pct}% acc` };
        })
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }

    // Default fallback: XP
    return baseEntries
      .sort((a, b) => b.xp - a.xp)
      .map((e, i) => ({ ...e, rank: i + 1, score: e.xp, scoreLabel: `${e.xp} XP` }));
  } catch (err) {
    console.warn('[getLeaderboard]', err.message);
    return [];
  }
}

export async function getCurrentUserProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_class, xp, level')
      .eq('id', user.id)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function getUserMissions() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('user_missions')
    .select('*, missions(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false });
  return data || [];
}

// ── XP & Achievement Persistence ──────────────────────────────────────────────
export async function awardXP(userId, amount, reason, organizationId) {
  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, level, total_sessions, display_name, avatar_class')
      .eq('id', userId)
      .single();

    const currentXP = profile?.xp || 0;
    const newXP = currentXP + amount;
    const newLevel = Math.floor(newXP / 1000) + 1;
    const newTotalSessions = (profile?.total_sessions || 0) + (reason === 'session_complete' ? 1 : 0);

    // Update profiles
    await supabase.from('profiles')
      .update({ xp: newXP, level: newLevel, total_sessions: newTotalSessions })
      .eq('id', userId);

    // Note: leaderboard_org is a VIEW — it auto-reflects profiles.xp, no direct write needed.

    return { newXP, newLevel, totalSessions: newTotalSessions };
  } catch (err) {
    console.warn('[awardXP]', err.message);
    return { newXP: 0, newLevel: 1, error: err.message };
  }
}

export async function unlockAchievement(userId, achievementKey, sessionId, organizationId) {
  try {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_key', achievementKey)
      .maybeSingle();

    if (existing) return { alreadyUnlocked: true };

    const { data, error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_key: achievementKey,
        session_id: sessionId || null,
        organization_id: organizationId || null
      })
      .select()
      .single();

    if (error) throw error;
    return { unlocked: true, achievement: data };
  } catch (err) {
    console.warn('[unlockAchievement]', err.message);
    return { error: err.message };
  }
}

export async function getUserAchievements(userId) {
  try {
    const { data } = await supabase
      .from('user_achievements')
      .select('id, achievement_key, session_id, organization_id, unlocked_at')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });
    return data || [];
  } catch (err) {
    console.warn('[getUserAchievements]', err.message);
    return [];
  }
}

// ── Sprint E: Game Availability ───────────────────────────────────────────────
export async function getGameAvailability(sprintId) {
  if (!sprintId) return null;
  try {
    // Items without estimate
    const { data: items } = await supabase
      .from('session_items')
      .select('id, final_estimate, estimated_hours, acceptance_criteria, item_status')
      .eq('sprint_id', sprintId);

    const allItems = items || [];
    const withoutEstimate = allItems.filter(i => !i.final_estimate && !i.estimated_hours);
    const withoutAC = allItems.filter(i => !i.acceptance_criteria);

    // Recent sessions for this sprint
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('id, session_type, status, ended_at, created_at')
      .eq('sprint_id', sprintId)
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(20);

    const sessions = recentSessions || [];

    // Get sprint info
    const { data: sprint } = await supabase
      .from('sprints')
      .select('id, status, end_date, name')
      .eq('id', sprintId)
      .maybeSingle();

    const isActive = sprint?.status === 'active';
    const isClosed = sprint?.status === 'completed' || sprint?.status === 'closed';
    const daysLeft = sprint?.end_date
      ? Math.ceil((new Date(sprint.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    const sprintEndingSoon = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;

    function lastPlayed(type) {
      const s = sessions.find(s => s.session_type === type || s.session_type?.includes(type));
      return s?.ended_at || null;
    }

    function dayLabel(dt) {
      if (!dt) return null;
      const d = new Date(dt);
      const now = new Date();
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'i dag';
      if (diff === 1) return 'i går';
      return `${diff} dage siden`;
    }

    // planning_poker
    const ppLast = lastPlayed('estimation');
    let ppState = 'locked';
    let ppReason = 'Ingen aktiv sprint';
    if (isActive || isClosed) {
      if (withoutEstimate.length > 0) {
        ppState = sprintEndingSoon ? 'recommended' : 'available';
        ppReason = `${withoutEstimate.length} items uden estimate`;
      } else if (ppLast) {
        ppState = 'completed';
        ppReason = `Alle items estimeret`;
      } else {
        ppState = 'available';
        ppReason = 'Klar til estimering';
      }
    }

    // spec_wars
    const swLast = lastPlayed('spec_wars');
    let swState = 'locked';
    let swReason = 'Ingen aktiv sprint';
    if (isActive) {
      if (withoutAC.length > 0) {
        swState = sprintEndingSoon ? 'recommended' : 'available';
        swReason = `${withoutAC.length} items mangler acceptance criteria`;
      } else if (swLast) {
        swState = 'completed';
        swReason = 'Spec Wars gennemført';
      } else {
        swState = 'available';
        swReason = 'Klar';
      }
    }

    // perspective_poker
    const pLast = lastPlayed('perspective_poker');
    let pState = 'locked';
    let pReason = 'Ingen aktiv sprint';
    if (isActive) {
      pState = 'available';
      pReason = 'Klar til perspektiv-estimering';
      if (pLast) { pState = 'completed'; pReason = 'Perspektiv-Poker gennemført'; }
      if (withoutEstimate.length > 3) { pState = 'recommended'; pReason = `${withoutEstimate.length} items med store estimat-gaps`; }
    }

    // retro / boss battle
    const rLast = lastPlayed('retro');
    let rState = 'locked';
    let rReason = 'Sprint skal lukkes for retro';
    if (isClosed) {
      rState = rLast ? 'completed' : 'recommended';
      rReason = rLast ? 'Retro gennemført' : 'Sprint er lukket — tid til retro!';
    } else if (sprintEndingSoon) {
      rState = 'recommended';
      rReason = `Sprint slutter om ${daysLeft} dag${daysLeft !== 1 ? 'e' : ''}`;
    }

    return {
      planning_poker: { state: ppState, reason: ppReason, lastPlayedAt: ppLast, lastPlayedLabel: dayLabel(ppLast) },
      spec_wars: { state: swState, reason: swReason, lastPlayedAt: swLast, lastPlayedLabel: dayLabel(swLast) },
      perspective_poker: { state: pState, reason: pReason, lastPlayedAt: pLast, lastPlayedLabel: dayLabel(pLast) },
      retro: { state: rState, reason: rReason, lastPlayedAt: rLast, lastPlayedLabel: dayLabel(rLast) },
      meta: { withoutEstimate: withoutEstimate.length, withoutAC: withoutAC.length, daysLeft, sprintEndingSoon },
    };
  } catch (e) {
    console.warn('[getGameAvailability]', e.message);
    return null;
  }
}

// ── Daily Missions ────────────────────────────────────────────────────────────
export async function generateMissions(orgId) {
  return edgeFn('generate-missions', { org_id: orgId });
}
