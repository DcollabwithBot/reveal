import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Jira status → Reveal item_status
const STATUS_MAP: Record<string, string> = {
  "to do": "backlog",
  "open": "backlog",
  "new": "backlog",
  "backlog": "backlog",
  "in progress": "active",
  "in review": "active",
  "review": "active",
  "done": "completed",
  "closed": "completed",
  "resolved": "completed",
};

// Jira priority → Reveal priority
const PRIORITY_MAP: Record<string, string> = {
  highest: "high",
  high: "high",
  medium: "medium",
  low: "low",
  lowest: "low",
};

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: unknown;
    customfield_10016?: number; // story points
    status?: { name: string };
    priority?: { name: string };
    assignee?: { emailAddress?: string; displayName?: string };
    issuetype?: { name: string };
  };
}

function flattenDescription(desc: unknown): string {
  if (!desc) return "";
  if (typeof desc === "string") return desc;
  // ADF format — extract text nodes
  try {
    const extract = (node: unknown): string => {
      if (!node || typeof node !== "object") return "";
      const n = node as Record<string, unknown>;
      if (n.type === "text" && typeof n.text === "string") return n.text;
      if (Array.isArray(n.content)) return (n.content as unknown[]).map(extract).join(" ");
      return "";
    };
    return extract(desc).trim();
  } catch {
    return String(desc).slice(0, 500);
  }
}

async function fetchJiraIssues(
  baseUrl: string,
  projectKey: string,
  token: string,
  email?: string
): Promise<JiraIssue[]> {
  const jql = `project=${projectKey} ORDER BY created DESC`;
  const url = `${baseUrl.replace(/\/$/, "")}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,description,customfield_10016,status,priority,assignee,issuetype`;

  // Support both PAT (token only) and basic auth (email:token)
  const authValue = email
    ? btoa(`${email}:${token}`)
    : btoa(`:${token}`);

  const resp = await fetch(url, {
    headers: {
      Authorization: `Basic ${authValue}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Jira API error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.issues || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Create admin client for DB ops
    const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const { data: { user }, error: authErr } = await adminDb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "preview") {
      const { jira_token, jira_email, base_url, project_key } = body;
      if (!jira_token || !base_url || !project_key) {
        return new Response(JSON.stringify({ error: "Missing jira_token, base_url, or project_key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const issues = await fetchJiraIssues(base_url, project_key, jira_token, jira_email);

      // Look up org members for assignee matching
      const { data: orgMember } = await adminDb
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let profileMap: Record<string, string> = {};
      if (orgMember?.organization_id) {
        const { data: members } = await adminDb
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgMember.organization_id);

        if (members?.length) {
          const { data: profiles } = await adminDb
            .from("profiles")
            .select("id, display_name, email")
            .in("id", members.map((m: { user_id: string }) => m.user_id));

          for (const p of profiles || []) {
            if (p.email) profileMap[p.email.toLowerCase()] = p.id;
          }
        }
      }

      const preview = issues.map((issue) => {
        const statusName = (issue.fields.status?.name || "").toLowerCase();
        const priorityName = (issue.fields.priority?.name || "").toLowerCase();
        const assigneeEmail = issue.fields.assignee?.emailAddress?.toLowerCase();

        return {
          jira_key: issue.key,
          title: issue.fields.summary,
          description: flattenDescription(issue.fields.description),
          estimated_hours: issue.fields.customfield_10016 || null,
          item_status: STATUS_MAP[statusName] || "backlog",
          priority: PRIORITY_MAP[priorityName] || "medium",
          assignee_email: assigneeEmail || null,
          assignee_name: issue.fields.assignee?.displayName || null,
          assigned_to: assigneeEmail ? profileMap[assigneeEmail] || null : null,
          issue_type: issue.fields.issuetype?.name || null,
        };
      });

      return new Response(JSON.stringify({ issues: preview, total: preview.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      const { connection_id, project_id, sprint_id, items } = body;

      if (!project_id || !items?.length) {
        return new Response(JSON.stringify({ error: "Missing project_id or items" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get org
      const { data: orgMember } = await adminDb
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!orgMember?.organization_id) {
        return new Response(JSON.stringify({ error: "No organization" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create import batch
      const { data: batch, error: batchErr } = await adminDb
        .from("import_batches")
        .insert({
          organization_id: orgMember.organization_id,
          project_id,
          sprint_id: sprint_id || null,
          source_type: "jira",
          items_count: items.length,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (batchErr) throw new Error(`Batch error: ${batchErr.message}`);

      // Get target sprint if not provided — use first active sprint in project
      let targetSprintId = sprint_id;
      if (!targetSprintId) {
        const { data: sprintData } = await adminDb
          .from("sprints")
          .select("id")
          .eq("project_id", project_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        targetSprintId = sprintData?.id;
      }

      // Bulk insert items
      const rows = items.map((item: Record<string, unknown>, idx: number) => ({
        sprint_id: targetSprintId || null,
        title: item.title || item.jira_key || "Untitled",
        description: item.description || null,
        estimated_hours: item.estimated_hours || null,
        item_status: item.item_status || "backlog",
        priority: item.priority || "medium",
        assigned_to: item.assigned_to || null,
        external_id: item.jira_key || null,
        external_source: "jira",
        import_batch_id: batch.id,
        item_order: idx,
        status: "pending",
        progress: 0,
      }));

      const { data: inserted, error: insertErr } = await adminDb
        .from("session_items")
        .insert(rows)
        .select("id, title, external_id");

      if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

      // Log sync entries
      const logRows = (inserted || []).map((item: { id: string; external_id: string }) => ({
        connection_id: connection_id || null,
        direction: "inbound",
        entity_type: "session_item",
        external_id: item.external_id,
        canonical_id: item.id,
        action: "created",
      }));

      if (logRows.length) {
        await adminDb.from("sync_log").insert(logRows);
      }

      // Update batch count
      await adminDb
        .from("import_batches")
        .update({ items_count: inserted?.length || 0 })
        .eq("id", batch.id);

      return new Response(JSON.stringify({
        imported: inserted?.length || 0,
        batch_id: batch.id,
        sprint_id: targetSprintId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'preview' or 'import'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
