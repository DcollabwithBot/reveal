import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// XP rewards for bonus mechanics
const BONUS_XP = {
  sniper_shot: 15,   // Estimation within 15% of actual
  oracle: 20,        // Confidence prediction hit
  risk_prophet: 25,  // Risk card prediction hit
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const { item_id, user_id, organization_id, sprint_id, final_estimate, acceptance_criteria, op } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_org' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Mission Shield: Check project visibility BEFORE counting progress ──
    if (sprint_id) {
      const { data: sprintRow } = await db
        .from('sprints')
        .select('visibility, projects(visibility)')
        .eq('id', sprint_id)
        .maybeSingle();

      if (sprintRow) {
        // Sprint visibility takes precedence; falls back to project visibility
        const effectiveVisibility = sprintRow.visibility
          ?? (sprintRow as any).projects?.visibility
          ?? 'public';

        if (effectiveVisibility === 'private') {
          return new Response(JSON.stringify({ ok: true, skipped: 'private_project' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ── Determine which trigger events apply ──────────────────────────────
    const triggerEvents: string[] = [];

    if (sprint_id) triggerEvents.push('sprint_assigned');         // orphan_hunter
    if (final_estimate !== null && final_estimate !== undefined) {
      triggerEvents.push('vote_insert');                          // quick_estimate
    }
    if (acceptance_criteria) triggerEvents.push('item_create');   // spec_detective

    if (!triggerEvents.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_triggers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Find active user missions matching trigger events ─────────────────
    const { data: activeMissions } = await db
      .from('user_missions')
      .select('*, missions(*)')
      .eq('user_id', user_id)
      .eq('organization_id', organization_id)
      .eq('status', 'active')
      .in('missions.trigger_event', triggerEvents);

    if (!activeMissions?.length) {
      return new Response(JSON.stringify({ ok: true, updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let completed = 0;

    for (const um of activeMissions) {
      const mission = um.missions;
      if (!mission) continue;

      // Only process if this trigger matches
      if (!triggerEvents.includes(mission.trigger_event)) continue;

      const newProgress = (um.progress || 0) + 1;
      const isCompleted = newProgress >= (mission.trigger_threshold || 1);

      const update: Record<string, unknown> = { progress: newProgress };
      if (isCompleted) {
        update.status = 'completed';
        update.completed_at = new Date().toISOString();
        update.xp_earned = mission.xp_reward;
      }

      await db
        .from('user_missions')
        .update(update)
        .eq('id', um.id);

      if (isCompleted) {
        completed++;
        // Award XP to profile
        await awardXP(db, user_id, organization_id, mission.xp_reward, 'mission_complete');

        // Unlock badge if defined
        if (mission.badge_key) {
          await unlockBadge(db, user_id, organization_id, mission.badge_key, mission.xp_reward);
        }
      }
    }

    // ── Bonus mechanic: Sniper Shot (estimation accuracy) ─────────────────
    if (final_estimate !== null && final_estimate !== undefined && user_id) {
      await checkSniperShot(db, item_id, user_id, organization_id, final_estimate);
    }

    return new Response(
      JSON.stringify({ ok: true, missions_processed: activeMissions.length, completed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('evaluate-mission error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function awardXP(
  db: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  xp: number,
  _reason: string
) {
  // Try to update existing profile xp
  const { data: profile } = await db
    .from('profiles')
    .select('id, xp_total')
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    await db
      .from('profiles')
      .update({ xp_total: (profile.xp_total || 0) + xp })
      .eq('id', userId);
  }
}

async function unlockBadge(
  db: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  badgeKey: string,
  xp: number
) {
  // Find achievement definition
  const { data: achievement } = await db
    .from('achievement_definitions')
    .select('id')
    .eq('key', badgeKey)
    .eq('is_active', true)
    .maybeSingle();

  if (!achievement) return;

  // Insert user achievement (ignore duplicate)
  await db
    .from('user_achievements')
    .upsert({
      user_id: userId,
      achievement_id: achievement.id,
      xp_at_unlock: xp,
      unlocked_at: new Date().toISOString(),
    }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true });
}

async function checkSniperShot(
  db: ReturnType<typeof createClient>,
  itemId: string,
  userId: string,
  organizationId: string,
  finalEstimate: number
) {
  // Check if item has actual_hours and compare
  const { data: item } = await db
    .from('session_items')
    .select('actual_hours, original_estimate')
    .eq('id', itemId)
    .maybeSingle();

  if (!item?.actual_hours || !finalEstimate) return;

  const pct = Math.abs(finalEstimate - item.actual_hours) / item.actual_hours;
  if (pct <= 0.15) {
    // Within 15% — award Sniper Shot
    await awardXP(db, userId, organizationId, BONUS_XP.sniper_shot, 'sniper_shot');
    await unlockBadge(db, userId, organizationId, 'sniper_shot', BONUS_XP.sniper_shot);
  }
}
