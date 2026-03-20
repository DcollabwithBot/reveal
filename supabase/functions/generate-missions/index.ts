import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
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

    // Get all global + org-specific missions
    const { data: allMissions } = await db
      .from("missions")
      .select("*")
      .eq("is_active", true)
      .or(`organization_id.is.null,organization_id.eq.${org_id}`);

    if (!allMissions?.length) {
      return new Response(JSON.stringify({ missions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing active user_missions for today
    const today = new Date();
    const { data: existingMissions } = await db
      .from("user_missions")
      .select("id, mission_id, status, progress, expires_at, completed_at, xp_earned")
      .eq("user_id", user.id)
      .eq("organization_id", org_id)
      .eq("status", "active");

    const existingMissionIds = new Set((existingMissions || []).map((m: { mission_id: string }) => m.mission_id));

    // Context analysis for smart mission selection
    // 1. Projects with 0 items → Spec Detective
    const { data: projects } = await db
      .from("projects")
      .select("id, sprints(id, session_items(count))")
      .eq("organization_id", org_id)
      .eq("status", "active");

    const emptyProjects = (projects || []).filter((p: { sprints?: { session_items?: { count: number }[] }[] }) => {
      const totalItems = (p.sprints || []).reduce((sum: number, s: { session_items?: { count: number }[] }) =>
        sum + ((s.session_items?.[0] as { count: number })?.count || 0), 0);
      return totalItems === 0;
    });

    // 2. Active sprint items missing estimates → Quick Draw
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

      // Items with no actual hours (completed but no actuals)
      const { count: noAct } = await db
        .from("session_items")
        .select("id", { count: "exact", head: true })
        .in("sprint_id", sprintIds)
        .in("item_status", ["completed", "done"])
        .is("actual_hours", null);
      noActualsCount = noAct || 0;
    }

    // 3. Orphan items (no sprint, older than 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: orphans } = await db
      .from("session_items")
      .select("id", { count: "exact", head: true })
      .is("sprint_id", null)
      .lt("created_at", weekAgo);
    orphanCount = orphans || 0;

    // Build prioritized mission list
    const selectedMissions: {
      mission_id: string;
      title: string;
      description: string;
      icon: string;
      xp_reward: number;
      scope: string;
      progress: number;
      context: string;
    }[] = [];

    const missionByType = new Map(allMissions.map((m: { mission_type: string }) => [m.mission_type, m]));

    // Context-driven missions (priority)
    if (emptyProjects.length > 0 && missionByType.has("spec_detective")) {
      const m = missionByType.get("spec_detective")!;
      selectedMissions.push({
        mission_id: m.id,
        title: m.title,
        description: `${emptyProjects.length} projekt(er) har ingen items endnu`,
        icon: m.icon,
        xp_reward: m.xp_reward,
        scope: m.scope,
        progress: 0,
        context: `projects:${emptyProjects.map((p: { id: string }) => p.id).join(",")}`,
      });
    }

    if (orphanCount >= 3 && missionByType.has("orphan_hunter")) {
      const m = missionByType.get("orphan_hunter")!;
      selectedMissions.push({
        mission_id: m.id,
        title: m.title,
        description: `${orphanCount} items mangler sprint-tilknytning`,
        icon: m.icon,
        xp_reward: m.xp_reward,
        scope: m.scope,
        progress: 0,
        context: `orphans:${orphanCount}`,
      });
    }

    if (unestimatedCount >= 3 && missionByType.has("quick_estimate")) {
      const m = missionByType.get("quick_estimate")!;
      selectedMissions.push({
        mission_id: m.id,
        title: m.title,
        description: `${unestimatedCount} items i aktiv sprint mangler estimat`,
        icon: m.icon,
        xp_reward: m.xp_reward,
        scope: m.scope,
        progress: 0,
        context: `unestimated:${unestimatedCount}`,
      });
    }

    if (noActualsCount >= 3 && missionByType.has("update_actuals")) {
      const m = missionByType.get("update_actuals")!;
      selectedMissions.push({
        mission_id: m.id,
        title: m.title,
        description: `${noActualsCount} færdige items mangler actual hours`,
        icon: m.icon,
        xp_reward: m.xp_reward,
        scope: m.scope,
        progress: 0,
        context: `no_actuals:${noActualsCount}`,
      });
    }

    // Fill remaining slots with daily missions
    const dailyTypes = ["join_session", "confidence_vote", "comment_item", "play_risk_card"];
    for (const type of dailyTypes) {
      if (selectedMissions.length >= 3) break;
      if (selectedMissions.some((m) => m.mission_id === missionByType.get(type)?.id)) continue;
      const m = missionByType.get(type);
      if (!m) continue;
      selectedMissions.push({
        mission_id: m.id,
        title: m.title,
        description: m.description || "",
        icon: m.icon,
        xp_reward: m.xp_reward,
        scope: m.scope,
        progress: 0,
        context: "daily",
      });
    }

    // Add one team mission
    const teamMission = allMissions.find((m: { scope: string }) => m.scope === "team");
    if (teamMission && !selectedMissions.some((m) => m.mission_id === teamMission.id)) {
      selectedMissions.push({
        mission_id: teamMission.id,
        title: teamMission.title,
        description: teamMission.description || "",
        icon: teamMission.icon,
        xp_reward: teamMission.xp_reward,
        scope: teamMission.scope,
        progress: 0,
        context: "team",
      });
    }

    // Upsert user_missions for missions not already active
    const midnight = new Date(today);
    midnight.setHours(23, 59, 59, 999);

    const toInsert = selectedMissions
      .filter((m) => !existingMissionIds.has(m.mission_id))
      .map((m) => ({
        user_id: user.id,
        organization_id: org_id,
        mission_id: m.mission_id,
        status: "active",
        progress: 0,
        expires_at: midnight.toISOString(),
        context_data: { context: m.context },
      }));

    if (toInsert.length) {
      await db.from("user_missions").insert(toInsert);
    }

    // Merge existing progress into selected missions
    for (const m of selectedMissions) {
      const existing = (existingMissions || []).find(
        (e: { mission_id: string }) => e.mission_id === m.mission_id
      );
      if (existing) {
        m.progress = existing.progress || 0;
      }
    }

    return new Response(JSON.stringify({ missions: selectedMissions.slice(0, 4) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
