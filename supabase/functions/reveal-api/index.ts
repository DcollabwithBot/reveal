import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, message: string, status: number) {
  return json({ error, message }, status);
}

async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateApiKey(): { raw: string; hash: Promise<string>; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw =
    "rvl_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return {
    raw,
    hash: hashKey(raw),
    prefix: raw.slice(0, 12),
  };
}

function getPagination(url: URL): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(500, Math.max(1, parseInt(url.searchParams.get("per_page") || "100", 10)));
  return { page, perPage, offset: (page - 1) * perPage };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface ApiKeyRecord {
  user_id: string;
  organization_id: string;
  scopes: string[];
  expires_at: string | null;
}

async function authenticateRequest(
  request: Request,
  supabase: ReturnType<typeof createClient>
): Promise<{ apiKey: ApiKeyRecord; keyId: string } | Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer rvl_")) {
    return errorResponse("unauthorized", "Invalid or expired API key", 401);
  }

  const rawKey = authHeader.slice(7); // Remove "Bearer "
  if (!rawKey.startsWith("rvl_")) {
    return errorResponse("unauthorized", "Invalid or expired API key", 401);
  }

  const keyHash = await hashKey(rawKey);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, organization_id, scopes, expires_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .single();

  if (error || !data) {
    return errorResponse("unauthorized", "Invalid or expired API key", 401);
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return errorResponse("unauthorized", "API key has expired", 401);
  }

  // Update last_used_at (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { apiKey: data as ApiKeyRecord, keyId: data.id };
}

function checkScope(apiKey: ApiKeyRecord, requiredScope: string): Response | null {
  if (!apiKey.scopes.includes(requiredScope)) {
    return errorResponse("forbidden", `Key does not have scope: ${requiredScope}`, 403);
  }
  return null;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function handleProjects(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL,
  pathParts: string[]
) {
  const { page, perPage, offset } = getPagination(url);

  if (pathParts.length === 1) {
    // GET /projects
    const { data, error, count } = await supabase
      .from("projects")
      .select("id, name, description, status, created_at, updated_at", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) throw error;
    return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
  }

  const projectId = pathParts[1];

  if (pathParts.length === 2) {
    // GET /projects/:id
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, status, created_at, updated_at")
      .eq("id", projectId)
      .eq("organization_id", orgId)
      .single();

    if (error || !data) return errorResponse("not_found", "Project not found", 404);
    return json({ data });
  }

  if (pathParts[2] === "sprints") {
    // GET /projects/:id/sprints
    const { data, error, count } = await supabase
      .from("sprints")
      .select("id, project_id, name, goal, status, start_date, end_date, created_at", { count: "exact" })
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) throw error;
    return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
  }

  return errorResponse("not_found", "Route not found", 404);
}

async function handleSprints(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL,
  pathParts: string[]
) {
  const { page, perPage, offset } = getPagination(url);
  const sprintId = pathParts[1];

  if (pathParts[2] === "items") {
    // GET /sprints/:id/items
    const { data, error, count } = await supabase
      .from("session_items")
      .select(
        "id, sprint_id, project_id, title, description, estimate, status, priority, risk_score, item_type, assignee_id, created_at, updated_at",
        { count: "exact" }
      )
      .eq("sprint_id", sprintId)
      .order("priority", { ascending: true })
      .range(offset, offset + perPage - 1);

    if (error) throw error;
    return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
  }

  return errorResponse("not_found", "Route not found", 404);
}

async function handleItems(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const { page, perPage, offset } = getPagination(url);
  const sprintId = url.searchParams.get("sprint_id");

  let query = supabase
    .from("session_items")
    .select(
      "id, sprint_id, project_id, title, description, estimate, status, priority, risk_score, item_type, assignee_id, created_at, updated_at",
      { count: "exact" }
    )
    .order("priority", { ascending: true })
    .range(offset, offset + perPage - 1);

  if (sprintId) {
    query = query.eq("sprint_id", sprintId);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
}

async function handleTimeEntries(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const { page, perPage, offset } = getPagination(url);
  const projectId = url.searchParams.get("project_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabase
    .from("time_entries")
    .select(
      "id, user_id, project_id, sprint_id, item_id, description, minutes, logged_at, created_at",
      { count: "exact" }
    )
    .order("logged_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (projectId) query = query.eq("project_id", projectId);
  if (from) query = query.gte("logged_at", from);
  if (to) query = query.lte("logged_at", to);

  const { data, error, count } = await query;
  if (error) throw error;
  return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
}

async function handleSessions(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const { page, perPage, offset } = getPagination(url);
  const projectId = url.searchParams.get("project_id");

  let query = supabase
    .from("sessions")
    .select(
      "id, project_id, game_mode, status, created_by, completed_at, items_covered, participants, summary, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (projectId) query = query.eq("project_id", projectId);

  const { data, error, count } = await query;
  if (error) throw error;
  return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
}

async function handleLeaderboard(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const { page, perPage, offset } = getPagination(url);

  const { data, error, count } = await supabase
    .from("leaderboard_org")
    .select("user_id, display_name, avatar_class, xp, level, organization_id", { count: "exact" })
    .eq("organization_id", orgId)
    .order("xp", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw error;
  return json({ data: data || [], meta: { total: count || 0, page, per_page: perPage } });
}

async function handleMembers(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  url: URL
) {
  const { page, perPage, offset } = getPagination(url);

  const { data, error, count } = await supabase
    .from("organization_members")
    .select(
      "user_id, role, created_at, profiles(display_name, avatar_class, avatar_color, xp, level)",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .range(offset, offset + perPage - 1);

  if (error) throw error;

  // Flatten nested profiles for PowerBI compatibility
  const flat = (data || []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.created_at,
    display_name: m.profiles?.display_name ?? null,
    avatar_class: m.profiles?.avatar_class ?? null,
    avatar_color: m.profiles?.avatar_color ?? null,
    xp: m.profiles?.xp ?? 0,
    level: m.profiles?.level ?? 1,
  }));

  return json({ data: flat, meta: { total: count || 0, page, per_page: perPage } });
}

// ─── Key Generation endpoint ──────────────────────────────────────────────────

async function handleGenerateKey(
  request: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string
) {
  if (request.method !== "POST") {
    return errorResponse("method_not_allowed", "Use POST /generate-key", 405);
  }

  let body: { name?: string; scopes?: string[]; expires_at?: string } = {};
  try {
    body = await request.json();
  } catch {
    // use defaults
  }

  const allScopes = ["read:projects", "read:sprints", "read:items", "read:time", "read:sessions", "read:team"];
  const scopes = body.scopes || allScopes;
  const name = body.name || "Default";

  const { raw, hash: hashPromise, prefix } = generateApiKey();
  const hash = await hashPromise;

  const { error } = await supabase.from("api_keys").insert({
    user_id: userId,
    organization_id: orgId,
    key_hash: hash,
    key_prefix: prefix,
    name,
    scopes,
    expires_at: body.expires_at || null,
  });

  if (error) {
    console.error("Insert error:", error);
    return errorResponse("internal", "Failed to create API key", 500);
  }

  // Return raw key ONCE — never stored, never shown again
  return json({ key: raw, prefix, name, scopes }, 201);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  // Path: /reveal-api/... or just /...
  // Normalize: strip function prefix if present
  let pathname = url.pathname.replace(/^\/reveal-api/, "").replace(/^\/v1/, "");
  if (!pathname.startsWith("/")) pathname = "/" + pathname;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── POST /generate-key — requires Supabase JWT (not API key) ──
  if (pathname === "/generate-key" && request.method === "POST") {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("unauthorized", "Supabase JWT required", 401);
    }
    // Validate JWT via user session
    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse("unauthorized", "Invalid session", 401);
    }

    const userId = userData.user.id;
    // Get the user's organization
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!memberData) {
      return errorResponse("forbidden", "User is not a member of any organization", 403);
    }

    return handleGenerateKey(request, supabaseAdmin, userId, memberData.organization_id);
  }

  // ── All other routes require API key auth ──
  const authResult = await authenticateRequest(request, supabaseAdmin);
  if (authResult instanceof Response) return authResult;
  const { apiKey } = authResult;
  const orgId = apiKey.organization_id;

  const pathParts = pathname.slice(1).split("/").filter(Boolean);
  const resource = pathParts[0];

  try {
    if (resource === "projects") {
      const scopeError = checkScope(apiKey, "read:projects");
      // /projects/:id/sprints needs read:sprints
      if (pathParts.length >= 3 && pathParts[2] === "sprints") {
        const sprintScopeError = checkScope(apiKey, "read:sprints");
        if (sprintScopeError) return sprintScopeError;
      } else if (scopeError) return scopeError;
      return await handleProjects(supabaseAdmin, orgId, url, pathParts);
    }

    if (resource === "sprints") {
      const scopeError = checkScope(apiKey, "read:sprints");
      if (scopeError) return scopeError;
      if (pathParts.length >= 3 && pathParts[2] === "items") {
        const itemScopeError = checkScope(apiKey, "read:items");
        if (itemScopeError) return itemScopeError;
      }
      return await handleSprints(supabaseAdmin, orgId, url, pathParts);
    }

    if (resource === "items") {
      const scopeError = checkScope(apiKey, "read:items");
      if (scopeError) return scopeError;
      return await handleItems(supabaseAdmin, orgId, url);
    }

    if (resource === "time-entries") {
      const scopeError = checkScope(apiKey, "read:time");
      if (scopeError) return scopeError;
      return await handleTimeEntries(supabaseAdmin, orgId, url);
    }

    if (resource === "sessions") {
      const scopeError = checkScope(apiKey, "read:sessions");
      if (scopeError) return scopeError;
      return await handleSessions(supabaseAdmin, orgId, url);
    }

    if (resource === "leaderboard") {
      const scopeError = checkScope(apiKey, "read:team");
      if (scopeError) return scopeError;
      return await handleLeaderboard(supabaseAdmin, orgId, url);
    }

    if (resource === "members") {
      const scopeError = checkScope(apiKey, "read:team");
      if (scopeError) return scopeError;
      return await handleMembers(supabaseAdmin, orgId, url);
    }

    return errorResponse("not_found", `Route '/${resource}' not found`, 404);
  } catch (err) {
    console.error("Unhandled error:", err);
    return errorResponse("internal", "Internal server error", 500);
  }
});
