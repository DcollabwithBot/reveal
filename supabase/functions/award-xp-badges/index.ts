import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// XP Event values
const XP_EVENTS = {
  session_participated: 10,
  risk_card_confirmed: 25,
  estimation_accurate: 20,
  sprint_on_time: 30,
  truth_serum_response: 15,
};

// Level thresholds
const LEVELS = [
  { min: 0, level: 1, label: 'Novice' },
  { min: 100, level: 2, label: 'Apprentice' },
  { min: 300, level: 3, label: 'Practitioner' },
  { min: 700, level: 4, label: 'Expert' },
  { min: 1500, level: 5, label: 'Master' },
];

function getLevel(xp: number): number {
  let level = 1;
  for (const l of LEVELS) {
    if (xp >= l.min) level = l.level;
  }
  return level;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use user token to identify the caller, but service role for writes
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'No user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { event, session_id, sprint_id } = body;

    let xpEarned = 0;
    const newBadges: string[] = [];

    // Get current profile
    const { data: profile } = await adminClient.from('profiles')
      .select('id, xp, level, accuracy_score')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'No profile' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentXp = profile.xp || 0;

    // Get user's org
    const { data: orgMember } = await adminClient.from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const orgId = orgMember?.organization_id;

    if (event === 'session_complete' && session_id) {
      // +10 XP for participation
      xpEarned += XP_EVENTS.session_participated;

      // Check if user submitted truth serum
      const { count: truthCount } = await adminClient.from('truth_serum_responses')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session_id);
      if (truthCount && truthCount > 0) {
        xpEarned += XP_EVENTS.truth_serum_response;
      }

      // Check session count for Team Anchor badge
      if (orgId) {
        const { count: sessionCount } = await adminClient.from('session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (sessionCount && sessionCount >= 20) {
          await tryAwardBadge(adminClient, user.id, 'team_anchor', session_id);
          newBadges.push('team_anchor');
        }
      }

      // Check truth serum count for Truth Teller badge
      const { count: totalTruthSessions } = await adminClient.from('truth_serum_responses')
        .select('session_id', { count: 'exact', head: true });
      if (totalTruthSessions && totalTruthSessions >= 3) {
        await tryAwardBadge(adminClient, user.id, 'truth_teller', session_id);
        newBadges.push('truth_teller');
      }
    }

    if (event === 'sprint_close' && sprint_id) {
      xpEarned += XP_EVENTS.sprint_on_time;

      // Check estimation accuracy
      const { data: items } = await adminClient.from('session_items')
        .select('id, estimate_accuracy')
        .eq('sprint_id', sprint_id)
        .not('estimate_accuracy', 'is', null);

      const accurateItems = (items || []).filter(i => i.estimate_accuracy >= 85);
      if (accurateItems.length > 0) {
        xpEarned += XP_EVENTS.estimation_accurate * Math.min(accurateItems.length, 5);
      }

      // Estimation Sniper badge: 5+ sessions with >85% accuracy
      const { data: allAccurate } = await adminClient.from('session_items')
        .select('sprint_id, estimate_accuracy')
        .not('estimate_accuracy', 'is', null)
        .gte('estimate_accuracy', 85);
      const accurateSprints = new Set((allAccurate || []).map(i => i.sprint_id));
      if (accurateSprints.size >= 5) {
        await tryAwardBadge(adminClient, user.id, 'estimation_sniper', null);
        newBadges.push('estimation_sniper');
      }

      // Risk Hunter badge: check risk cards vs actuals
      if (orgId) {
        const { data: riskCards } = await adminClient.from('session_risk_cards')
          .select('id, session_item_id, session_id')
          .eq('played_by', user.id);

        // Count risk cards where actual exceeded estimate by >20%
        let confirmedRisks = 0;
        for (const card of riskCards || []) {
          if (!card.session_item_id) continue;
          const { data: item } = await adminClient.from('session_items')
            .select('estimated_hours, actual_hours_logged')
            .eq('id', card.session_item_id)
            .maybeSingle();
          if (item?.actual_hours_logged && item?.estimated_hours) {
            if (item.actual_hours_logged > item.estimated_hours * 1.2) {
              confirmedRisks++;
              xpEarned += XP_EVENTS.risk_card_confirmed;
            }
          }
        }
        if (confirmedRisks >= 3) {
          await tryAwardBadge(adminClient, user.id, 'risk_hunter', null);
          newBadges.push('risk_hunter');
        }
      }

      // Sprint Streak badge
      if (orgId) {
        const { data: recentSprints } = await adminClient.from('sprints')
          .select('id, status, closed_at')
          .eq('organization_id', orgId)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false })
          .limit(3);

        if ((recentSprints || []).length >= 3) {
          await tryAwardBadge(adminClient, user.id, 'sprint_streak', null);
          newBadges.push('sprint_streak');
        }
      }
    }

    // Update XP and level
    const newXp = currentXp + xpEarned;
    const newLevel = getLevel(newXp);

    if (xpEarned > 0) {
      await adminClient.from('profiles')
        .update({ xp: newXp, level: newLevel })
        .eq('id', user.id);
    }

    return new Response(JSON.stringify({
      xp_earned: xpEarned,
      total_xp: newXp,
      new_level: newLevel,
      new_badges: [...new Set(newBadges)],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function tryAwardBadge(client: any, userId: string, badgeType: string, sessionId: string | null) {
  try {
    await client.from('user_badges').insert({
      user_id: userId,
      badge_type: badgeType,
      session_id: sessionId,
    });
  } catch {
    // UNIQUE constraint — badge already awarded, ignore
  }
}
