import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Random Event Templates ───────────────────────────────────────────────────
const RANDOM_EVENT_TEMPLATES = [
  {
    event_type: "cursed_sprint",
    title: "CURSED SPRINT!",
    description: "Alle estimater er fordoblet denne session! Bevis jeres præcision.",
    xp_multiplier: 1.5,
    duration_hours: 4,
  },
  {
    event_type: "golden_hour",
    title: "GOLDEN HOUR!",
    description: "Double XP de næste 2 timer! Sæt gang i spillet nu.",
    xp_multiplier: 2.0,
    duration_hours: 2,
  },
  {
    event_type: "mystery_mode",
    title: "MYSTERY MODE!",
    description: "Du starter et spil — men ikke hvilken mode. Kun formålet afsløres.",
    xp_multiplier: 1.3,
    duration_hours: 3,
  },
  {
    event_type: "boss_rush",
    title: "BOSS RUSH!",
    description: "5 items på 15 min — kan teamet nå det?",
    xp_multiplier: 1.4,
    duration_hours: 1,
  },
  {
    event_type: "xp_storm",
    title: "XP STORM!",
    description: "Triple XP på næste teamspil i dag!",
    xp_multiplier: 3.0,
    duration_hours: 1,
  },
];

// ─── Difficulty Tiers ─────────────────────────────────────────────────────────
function getDifficulty(totalXp: number): "easy" | "normal" | "hard" | "expert" {
  if (totalXp < 500) return "easy";
  if (totalXp < 2000) return "normal";
  if (totalXp < 5000) return "hard";
  return "expert";
}

function xpMultiplierForDifficulty(d: string): number {
  return { easy: 0.7, normal: 1.0, hard: 1.3, expert: 1.6 }[d] ?? 1.0;
}

// ─── Side Quest Selection ─────────────────────────────────────────────────────
function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil(diff / oneWeek);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { org_id } = body;

    if (!org_id) {
      return new Response(JSON.stringify({ error: "Missing org_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get team total XP for difficulty scaling ───────────────────────────
    const { data: xpData } = await db
      .from("user_xp")
      .select("total_xp")
      .eq("organization_id", org_id);

    const totalTeamXp = (xpData || []).reduce(
      (sum: number, u: { total_xp: number }) => sum + (u.total_xp || 0),
      0
    );
    const difficulty = getDifficulty(totalTeamXp);
    const xpMult = xpMultiplierForDifficulty(difficulty);

    // ── Get all active missions matching difficulty range ──────────────────
    const { data: allMissions } = await db
      .from("missions")
      .select("*")
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${org_id}`)
      .lte("min_team_xp", totalTeamXp)
      .gte("max_team_xp", totalTeamXp);

    if (!allMissions?.length) {
      // Fallback: fetch without xp filter
      const { data: allFallback } = await db
        .from("missions")
        .select("*")
        .eq("is_active", true)
        .or(`organization_id.is.null,organization_id.eq.${org_id}`);

      return new Response(JSON.stringify({ missions: allFallback?.slice(0, 4) || [], difficulty, totalTeamXp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Context analysis ───────────────────────────────────────────────────
    const { data: activeSprints } = await db
      .from("sprints")
      .select("id")
      .eq("organization_id", org_id)
      .eq("status", "active");

    let unestimatedCount = 0;
    let noActualsCount = 0;
    let orphanCount = 0;

    if (activeSprints?.length) {
      const sprintIds = activeSprints.map((s: { id: string }) => s.id);

      const { count: unest } = await db
        .from("session_items")
        .select("id", { count: "exact", head: true })
        .in("sprint_id", sprintIds)
        .is("estimated_hours", null);
      unestimatedCount = unest || 0;

      const { count: noAct } = await db
        .from("session_items")
        .select("id", { count: "exact", head: true })
        .in("sprint_id", sprintIds)
        .in("item_status", ["completed", "done"])
        .is("actual_hours", null);
      noActualsCount = noAct || 0;
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: orphans } = await db
      .from("session_items")
      .select("id", { count: "exact", head: true })
      .is("sprint_id", null)
      .lt("created_at", weekAgo);
    orphanCount = orphans || 0;

    // ── Get existing active user_missions ─────────────────────────────────
    const { data: existingMissions } = await db
      .from("user_missions")
      .select("id, mission_id, status, progress, expires_at, completed_at, xp_earned, mission_type")
      .eq("user_id", user.id)
      .eq("organization_id", org_id)
      .eq("status", "active");

    const existingMissionIds = new Set(
      (existingMissions || []).map((m: { mission_id: string }) => m.mission_id)
    );

    // ── Daily Missions selection ───────────────────────────────────────────
    type MissionRow = {
      id: string; title: string; description: string; icon: string;
      xp_reward: number; scope: string; mission_type: string;
      required_mode: string | null; difficulty: string;
    };
    const dailyMissions = (allMissions as MissionRow[]).filter(m => m.mission_type === "daily");
    const selectedDaily: MissionRow[] = [];

    // Context-driven priority
    const contextPriority: string[] = [];
    if (unestimatedCount >= 3) contextPriority.push("planning_poker", "speed_scope");
    if (orphanCount >= 3) contextPriority.push("refinement_roulette");
    if (noActualsCount >= 3) contextPriority.push("flow_poker");

    // Sort: context-driven first, then shuffle remainder
    const sorted = [...dailyMissions].sort((a, b) => {
      const aContext = a.required_mode && contextPriority.includes(a.required_mode) ? -1 : 0;
      const bContext = b.required_mode && contextPriority.includes(b.required_mode) ? -1 : 0;
      return aContext - bContext + (Math.random() - 0.5) * 0.3;
    });

    // Pick 3 diverse daily missions
    const usedModes = new Set<string>();
    for (const m of sorted) {
      if (selectedDaily.length >= 3) break;
      if (m.required_mode && usedModes.has(m.required_mode)) continue;
      selectedDaily.push(m);
      if (m.required_mode) usedModes.add(m.required_mode);
    }

    // ── Bonus Mission (20% chance) ─────────────────────────────────────────
    const includeBonusMission = Math.random() < 0.20;
    let bonusMission: MissionRow | null = null;
    if (includeBonusMission) {
      const bonusCandidates = (allMissions as MissionRow[]).filter(m =>
        m.mission_type === "daily" &&
        !selectedDaily.some(d => d.id === m.id)
      );
      if (bonusCandidates.length) {
        bonusMission = bonusCandidates[Math.floor(Math.random() * bonusCandidates.length)];
      }
    }

    // ── Slip The Beast (10% chance) ───────────────────────────────────────
    const includeSlipTheBeast = Math.random() < 0.10;
    let slipMission: MissionRow | null = null;
    if (includeSlipTheBeast) {
      const slipCandidates = (allMissions as MissionRow[]).filter(m => m.mission_type === "slip_the_beast");
      if (slipCandidates.length) {
        slipMission = slipCandidates[Math.floor(Math.random() * slipCandidates.length)];
      }
    }

    // ── Side Quests (weekly, 1-2 per week) ───────────────────────────────
    const currentWeek = getCurrentWeek();
    const { data: existingSideQuests } = await db
      .from("user_missions")
      .select("id, mission_id, status, progress, expires_at, mission_type")
      .eq("user_id", user.id)
      .eq("organization_id", org_id)
      .eq("mission_type", "side_quest")
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString());

    const activeSideQuestCount = (existingSideQuests || []).length;
    const sideQuestCandidates = (allMissions as MissionRow[]).filter(m => m.mission_type === "side_quest");

    const newSideQuests: MissionRow[] = [];
    if (activeSideQuestCount < 2 && sideQuestCandidates.length > 0) {
      const needed = 2 - activeSideQuestCount;
      const existingSideIds = new Set((existingSideQuests || []).map((m: { mission_id: string }) => m.mission_id));
      const available = sideQuestCandidates.filter(m => !existingSideIds.has(m.id));
      const shuffled = available.sort(() => Math.random() - 0.5);
      newSideQuests.push(...shuffled.slice(0, needed));
    }

    // ── Random Event (10-15% chance per call) ─────────────────────────────
    const includeRandomEvent = Math.random() < 0.12;
    let activeRandomEvent = null;

    // Check if there's already an active random event
    const { data: existingEvent } = await db
      .from("random_events")
      .select("*")
      .eq("organization_id", org_id)
      .gte("active_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingEvent) {
      activeRandomEvent = existingEvent;
    } else if (includeRandomEvent) {
      const template = RANDOM_EVENT_TEMPLATES[
        Math.floor(Math.random() * RANDOM_EVENT_TEMPLATES.length)
      ];
      const activeUntil = new Date(
        Date.now() + template.duration_hours * 60 * 60 * 1000
      ).toISOString();

      const { data: newEvent } = await db
        .from("random_events")
        .insert({
          organization_id: org_id,
          event_type: template.event_type,
          title: template.title,
          description: template.description,
          xp_multiplier: template.xp_multiplier,
          active_until: activeUntil,
          metadata: {},
        })
        .select()
        .single();

      activeRandomEvent = newEvent;
    }

    // ── Upsert user_missions ──────────────────────────────────────────────
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    const allToUpsert = [
      ...selectedDaily.map(m => ({
        user_id: user.id,
        organization_id: org_id,
        mission_id: m.id,
        status: "active",
        progress: 0,
        mission_type: "daily",
        expires_at: midnight.toISOString(),
        context_data: {},
      })),
      ...(bonusMission ? [{
        user_id: user.id,
        organization_id: org_id,
        mission_id: bonusMission.id,
        status: "active",
        progress: 0,
        mission_type: "bonus",
        expires_at: midnight.toISOString(),
        context_data: { is_bonus: true },
      }] : []),
      ...(slipMission ? [{
        user_id: user.id,
        organization_id: org_id,
        mission_id: slipMission.id,
        status: "active",
        progress: 0,
        mission_type: "slip_the_beast",
        expires_at: midnight.toISOString(),
        context_data: { is_slip: true },
      }] : []),
      ...newSideQuests.map(m => ({
        user_id: user.id,
        organization_id: org_id,
        mission_id: m.id,
        status: "active",
        progress: 0,
        mission_type: "side_quest",
        expires_at: weekEnd.toISOString(),
        context_data: { week: currentWeek },
      })),
    ].filter(m => !existingMissionIds.has(m.mission_id));

    if (allToUpsert.length) {
      await db.from("user_missions").insert(allToUpsert);
    }

    // ── Merge existing progress ───────────────────────────────────────────
    function mergeProgress(missions: MissionRow[]) {
      return missions.map(m => {
        const existing = (existingMissions || []).find(
          (e: { mission_id: string; progress: number }) => e.mission_id === m.id
        );
        const xpAdjusted = Math.round(m.xp_reward * xpMult);
        return {
          ...m,
          xp_reward: xpAdjusted,
          progress: existing?.progress || 0,
          is_completed: (existing?.progress || 0) >= 1,
        };
      });
    }

    const result = {
      missions: mergeProgress(selectedDaily).slice(0, 3),
      bonus_mission: bonusMission ? mergeProgress([bonusMission])[0] : null,
      slip_the_beast: slipMission ? mergeProgress([slipMission])[0] : null,
      side_quests: mergeProgress(newSideQuests),
      active_side_quests: existingSideQuests || [],
      random_event: activeRandomEvent,
      difficulty,
      total_team_xp: totalTeamXp,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
