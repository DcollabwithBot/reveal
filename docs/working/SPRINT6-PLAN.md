# SPRINT 6 PLAN — Reveal

## Goal
Build the boring-but-essential project side: dashboard, project/sprint management, session results, backlog import, and session templates — the foundation that turns Reveal from a game into a real tool.

---

## Context: Where we are

- Sprint 5 delivered DB-driven content (challenges, retro events), voting modes (Fibonacci / T-shirt), and a functional SessionSetup UI — game is now fully DB-backed
- The two flows (solo game → `Session.jsx` and multiplayer → `ActiveSession.jsx`) are still disconnected islands; `Session.jsx` has zero Supabase writes
- There is no dashboard, no results view, no way to see what happened after a session ends — the product stops at the game and resumes nowhere

---

## What we're building

### A. Dashboard (`/dashboard`)

**What it is:** The landing screen after login. Replaces the current post-auth dead end.

**What it shows:**
- Active sessions (join_code visible, player count, which item they're on)
- Upcoming/scheduled sessions (created but not started)
- Recently completed sessions (last 30 days, with final estimate count)
- Quick actions: "New Session", "Join Session by code", "Browse Projects"

**Mechanical flow:**
1. On load: `GET /api/dashboard` (new endpoint) — server queries `sessions` joined with `session_items` count + `session_participants` count, filtered by `organization_id` from current user's org
2. Active = `sessions.status = 'active'`
3. Completed = `sessions.status = 'completed'`
4. Upcoming = `sessions.status = 'pending'`

**UI components needed:**
- `SessionCard` — shows name, item count, participant count, status badge, join/view button
- `DashboardScreen.jsx` (new file: `src/screens/DashboardScreen.jsx`)
- Status badges: pixel-art style (green = ACTIVE, yellow = PENDING, grey = DONE)

**DB requirements:** No new tables. Uses existing `sessions`, `session_items`, `session_participants`. Needs a compound index: `sessions(organization_id, status, created_at DESC)`.

---

### B. Project & Sprint Management (`/projects`)

**What it is:** The hierarchy view: Organization → Project → Sprint → Backlog Items. GM can create and manage without going into a live session.

**Hierarchy:**
```
Organization (already exists)
  └── Project (new concept — maps to a team/product/client)
        └── Sprint (a planning session container)
              └── Backlog Item (title, description, priority, status, final_estimate)
```

**What GM can do:**
- Create a project (name, description, icon/color)
- Create a sprint under a project (name, goal, start/end date — optional)
- Add backlog items manually or via import (see section D)
- Start a session from a sprint (pulls its items into a new session)
- Archive a sprint (locks it, visible in history)

**UI components needed:**
- `ProjectsScreen.jsx` (new: `src/screens/ProjectsScreen.jsx`)
- `ProjectCard` — name, sprint count, last activity
- `SprintPanel` — expandable, shows items, item count, estimated vs unestimated
- `ItemRow` — title, priority badge, final_estimate if done, edit button
- `CreateProjectModal` — name + description + color picker
- `CreateSprintModal` — name + goal + optional dates
- `CreateItemModal` / inline add row (faster UX)

**Routing:**
- `/projects` — list all projects
- `/projects/:projectId` — project detail with sprint list
- `/projects/:projectId/sprints/:sprintId` — sprint detail with item list

**DB requirements:** See DB section below. New `projects` and `sprints` tables, extend `session_items`.

---

### C. Session Results View (`/sessions/:id/results`)

**What it is:** Post-session summary. What did we estimate? Where did we disagree? What were the outliers?

**What it shows:**
- Session name, date, team/participants
- Per-item table: Item title | Votes (anonymized or named, configurable) | Final estimate | Confidence avg | Outlier flag
- Outlier detection: if any vote is >2x or <0.5x the median, flag that item with ⚠️
- Confidence breakdown: per-item average confidence score (if votes include confidence)
- Summary stats: total items, estimated, skipped, avg confidence, total story points
- Export button: Download as CSV (see section D)
- Share link: `/sessions/:id/results?token=xxx` — read-only shareable link (no auth required with valid token)

**Mechanical flow:**
1. `GET /api/sessions/:id/results` — server aggregates `votes` joined with `profiles`, grouped by `session_item_id`
2. Compute per-item: all vote values, median, mean, outliers (|vote - median| > 0.5 * median)
3. Compute session-level stats
4. Return structured JSON

**UI components needed:**
- `SessionResultsScreen.jsx` (new: `src/screens/SessionResultsScreen.jsx`)
- `ResultsItemRow` — item title, vote chips per participant, final estimate, outlier badge
- `StatsBanner` — total points, item count, avg confidence, outlier count
- `ExportButton` — triggers CSV download (client-side, no server needed)
- `ShareLinkBanner` — shows shareable URL with copy button

**DB requirements:** No new tables. Needs `sessions` to store `share_token` (UUID, nullable). Generate on first share click.

---

### D. Excel / CSV Import for Backlog Items

**Primary approach: Paste from Excel (tab-separated)**

**How it works:**
1. GM clicks "Import from Excel" in Sprint detail or SessionSetup
2. Modal opens with a large `<textarea>` — instructional text: "Copy rows from Excel or Google Sheets and paste here"
3. On paste: detect tab-separated content, parse rows
4. Column mapping step: show first 3 rows in a preview table, let GM pick which column maps to Title / Description / Priority via dropdowns
5. Preview: show parsed items (count: X items found)
6. Confirm → INSERT into `session_items` (or backlog items if in project context)

**Parser logic:**
```js
// In src/utils/importUtils.js
export function parseTabSeparated(text) {
  const rows = text.trim().split('\n').map(row => row.split('\t'));
  return { headers: rows[0], rows: rows.slice(1) };
}

export function mapToItems(rows, mapping) {
  // mapping = { title: 0, description: 1, priority: 2 }
  return rows.map(row => ({
    title: row[mapping.title] || '',
    description: row[mapping.description] || '',
    priority: row[mapping.priority] || 'medium',
  })).filter(item => item.title.trim());
}
```

**Stretch: CSV file upload (approach 2)**
- File input (`.csv`) → read as text → same parser pipeline
- Add after paste-import works. Not required for sprint 6 completion.

**UI components needed:**
- `ImportModal.jsx` (new: `src/components/ImportModal.jsx`)
  - Step 1: Paste area
  - Step 2: Column mapping (dropdowns over preview table)
  - Step 3: Confirm import
- Wire into `SessionSetup.jsx` ("Import items" button next to "Add item")
- Wire into `SprintPanel` in projects view ("Import" button)

---

### E. Session Templates (save + reuse configs)

**What a template is:** A saved session configuration that GM can reuse. Stores voting mode, item list (optional), game modes enabled, challenge categories, retro event set.

**How it works:**
- After creating a session in `/setup`, GM sees "Save as Template" button
- Template gets a name (e.g., "Standard Sprint Planning", "Bug Triage", "Scope Workshop")
- On new session creation: "Load from template" dropdown at top of form — pre-fills all fields
- Templates are per-organization (shared across GMs in same org)
- GM can delete templates they own

**What a template stores (JSON):**
```json
{
  "name": "Standard Sprint Planning",
  "voting_mode": "fibonacci",
  "default_items": [
    { "title": "User Story: Login flow", "description": "..." }
  ],
  "game_modes_enabled": ["poker", "roulette"],
  "challenge_categories": ["human", "tech", "extern"],
  "max_retro_events": 6,
  "challenge_modifier_cap": 2.0
}
```

**UI components needed:**
- "Save as Template" button in `SessionSetup.jsx` → `SaveTemplateModal`
- `SaveTemplateModal` — just name input + confirm
- `LoadTemplateDropdown` — in `SessionSetup.jsx` header — select template → populate form

**DB requirements:** New `session_templates` table. See below.

---

### F. Kanban Board (`/dashboard` — projektstatus-visning)

**Hvad det er:** Projektkort organiseret i kolonner efter status. Ikke et ticket-board — det er et overblik over projekter, ikke enkeltopgaver.

**Kolonner:** Aktiv | Pauset/On-hold | Afsluttet

**Default visning:** Kun *Aktive* projekter vises. Toggle-knap: "Vis alle" afslører Pauset + Afsluttet.

**Projektkort viser:**
- Projektnavn + icon/farve
- Aktivt sprint-navn
- Antal items (estimerede / total)
- Progress % (items done / total)
- Assigned members (avatar-pile, maks 4 + overflow)
- Klik → `/projects/:id`

**Drag-to-move:** Simpel CSS-baseret drag (HTML5 Drag API) — ingen bibliotek. Drag projekt fra Aktiv → Pauset ændrer `projects.status` via PATCH.

**DB:** `projects` tabel skal have `status` kolonne: `'active' | 'on_hold' | 'completed'` (DEFAULT `'active'`). Tilføjes i sprint6.sql.

---

### G. Item-felter: Assigned, Timer, Progress, Status

**Hvad det er:** Enkle felter på backlog items — IKKE et ticket-system. Ingen kommentartråde, ingen notifikationer, ingen workflow-regler.

**Felter der tilføjes:**
- `assigned_to` (uuid, FK til profiles) — hvem ejer opgaven
- `estimated_hours` (numeric) — estimeret tidsforbrug i timer
- `actual_hours` (numeric) — faktisk forbrug (manuelt opdateret)
- `progress` (int, 0-100) — procent completion
- `status` (text): `'backlog' | 'in_progress' | 'done' | 'blocked'`

**Visning i `ItemRow`:** Inline editable felter — klik på status → dropdown, klik på timer → input. Gem on-blur via PATCH.

**DB:** Tilføjes til `session_items` via ALTER TABLE i sprint6.sql.

---

### H. Integration-readiness (fremtidssikring — koster nul nu)

**Formål:** Når Jira/Azure DevOps/TopDesk/Teams Planner-integration bygges (sprint 8+), er det bare at mappe `external_id` — ingen DB-refactor nødvendig.

**DB-ændringer:**
```sql
ALTER TABLE session_items 
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text; -- 'jira', 'devops', 'topdesk', 'planner', 'teams'

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text;

ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text;
```

**Ingen UI i sprint 6.** Felterne eksisterer bare i DB klar til fremtidig brug.

**Fremtidig integration-vision (roadmap, IKKE sprint 6):**
- Azure DevOps, Jira, TopDesk, Teams Planner — tosidet sync
- Opret issues direkte fra Reveal + link via `external_id`
- Webhook: issue opdateres i Jira → Reveal opdateres automatisk
- Teams Planner: tasks synkroniseres begge veje

---

### I. Velocity Tracking (simple)

**What it is:** Per-team, per-sprint: total story points estimated, delivered, ratio. No ML, no forecasting. Just the number.

**Where it lives:** On the Project detail page (`/projects/:projectId`), a "Velocity" tab showing:
- Sprint-by-sprint bar chart (simple CSS bars — no chart library)
- Columns: Sprint name | Items estimated | Total points | Avg confidence
- Trend: are estimates getting more consistent? (std dev, shown as "Spread: low/medium/high")

**Data source:** Aggregated from `session_items.final_estimate` grouped by sprint/session. No new tables needed — just a query.

**DB requirements:** The `session_items` table needs a `sprint_id` FK (or derive via session → project → sprint). See DB section.

---

### G. Tech Debt from Sprint 5 (address now)

These are small but should ship in sprint 6 to avoid rot:

1. **`reveal-session.jsx` in repo root** — delete it. It's a Sprint 1 prototype superseded by `src/screens/Session.jsx`. Confirmed dead code per audit.

2. **`Session.jsx` duplicate CHAL array** — `Session.jsx` has a local 5-item `CHAL` array that duplicates `ROULETTE_CHALLENGES`. Delete the local copy, import from constants (or DB fallback). Sprint 5 already seeds the DB — wire `Session.jsx` to use it.

3. **`profiles.avatar_class` not rendered** — `useSession.js` already fetches it. `ActiveSession.jsx` shows a generic 🧙 for all participants. Wire `avatar_class` to look up class icon from `CLASSES` constant. One-liner fix.

4. **Verify `node_completions` table exists** — CONTEXT.md flags this as unverified. Run `SELECT to_regclass('public.node_completions')` in Supabase SQL editor. If missing, add to sprint6.sql migration.

5. **Verify `session_items.description` column exists** — Same: flagged as unverified in CONTEXT.md. Add to migration if missing.

---

## DB Changes

File: `supabase/migrations/sprint6.sql`

```sql
-- ============================================================
-- SPRINT 6 MIGRATIONS
-- ============================================================

-- 1. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT '📋',
  color       TEXT DEFAULT '#4488dd',
  archived_at TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(organization_id, archived_at NULLS FIRST);

-- 2. Sprints table
CREATE TABLE IF NOT EXISTS sprints (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal        TEXT,
  status      TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','archived')),
  start_date  DATE,
  end_date    DATE,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sprints_project ON sprints(project_id, status);

-- 3. Add sprint_id to session_items (optional FK — allows velocity tracking)
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority  TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS description TEXT; -- verify this exists; safe to re-add with IF NOT EXISTS

-- 4. Add project_id and sprint_id to sessions (for project management flow)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_id  UUID REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_share_token ON sessions(share_token);

-- 5. Session templates
CREATE TABLE IF NOT EXISTS session_templates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES profiles(id),
  name            TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  -- config shape: { voting_mode, default_items[], game_modes_enabled[], challenge_categories[], max_retro_events, challenge_modifier_cap }
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_templates_org ON session_templates(organization_id);

-- 6. node_completions (verify / create if missing)
CREATE TABLE IF NOT EXISTS node_completions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_completions_uniq ON node_completions(session_id, node_id);

-- 7. Status on projects (for Kanban board)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'on_hold', 'completed'));

-- 8. Item fields: assigned, hours, progress, status
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'backlog' 
    CHECK (item_status IN ('backlog', 'in_progress', 'done', 'blocked'));

-- 9. Integration-readiness (external_id + external_source)
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT; -- 'jira', 'devops', 'topdesk', 'planner', 'teams'

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT;

ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT;

-- 10. Performance indexes
CREATE INDEX IF NOT EXISTS idx_sessions_org_status ON sessions(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_session_item ON votes(session_item_id, created_at);

-- 8. RLS — projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read projects"
  ON projects FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org members can insert projects"
  ON projects FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "creators can update projects"
  ON projects FOR UPDATE
  USING (created_by = auth.uid());

-- 9. RLS — sprints (mirrors projects)
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read sprints"
  ON sprints FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org members can insert sprints"
  ON sprints FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- 10. RLS — session_templates
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read templates"
  ON session_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org members can insert templates"
  ON session_templates FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "creators can delete templates"
  ON session_templates FOR DELETE
  USING (created_by = auth.uid());
```

---

## Frontend Tasks

### Priority 1 — Foundation (do first, everything depends on it)

1. **`src/utils/importUtils.js`** — new file. `parseTabSeparated()` + `mapToItems()`. Unit-testable, no React deps.

2. **`src/screens/DashboardScreen.jsx`** — new file. Fetch sessions by status, render SessionCard grid. Route: `/dashboard`. After login, redirect here instead of current dead end.

3. **`src/App.jsx`** — add routes: `/dashboard`, `/projects`, `/projects/:projectId`, `/projects/:projectId/sprints/:sprintId`, `/sessions/:id/results`. Wire post-auth redirect to `/dashboard`.

4. **`server/app.js`** — add endpoints:
   - `GET /api/dashboard` — aggregated session list for org
   - `GET /api/projects` — list projects for org
   - `POST /api/projects` — create project
   - `GET /api/projects/:id/sprints` — list sprints
   - `POST /api/projects/:id/sprints` — create sprint
   - `GET /api/sessions/:id/results` — aggregated results with outlier detection
   - `GET /api/templates` — list org templates
   - `POST /api/templates` — save template
   - `DELETE /api/templates/:id` — delete template

### Priority 2 — Project management UI

5. **`src/screens/ProjectsScreen.jsx`** — list all projects, ProjectCard per project, "+ New Project" button → `CreateProjectModal`.

6. **`src/screens/ProjectDetailScreen.jsx`** — sprint list + velocity tab. SprintPanel per sprint, expandable to show items. "+ New Sprint" + "Import items" buttons.

7. **`src/components/CreateProjectModal.jsx`** — name, description, icon (emoji picker — 6 options), color picker.

8. **`src/components/CreateSprintModal.jsx`** — name, goal (optional), date range (optional).

9. **`src/components/ImportModal.jsx`** — 3-step paste importer (paste → map columns → confirm). Wire into SessionSetup and ProjectDetailScreen.

### Priority 3 — Session results

10. **`src/screens/SessionResultsScreen.jsx`** — fetch results via API, render ResultsItemRow per item, StatsBanner at top, ExportButton, ShareLinkBanner.

11. **`server/app.js`** — `GET /api/sessions/:id/results` endpoint: aggregate votes, compute median per item, flag outliers (|vote - median| > threshold), return structured payload.

12. **CSV export** — client-side only, no server needed:
    ```js
    // In SessionResultsScreen
    const exportCSV = () => {
      const rows = items.map(i => [i.title, i.final_estimate, i.avg_confidence, i.outlier ? 'YES' : '']);
      const csv = ['Title,Estimate,Confidence,Outlier', ...rows.map(r => r.join(','))].join('\n');
      downloadFile(csv, `reveal-results-${sessionId}.csv`, 'text/csv');
    };
    ```

13. **Share link** — `sessions.share_token` already added in migration. On click "Share", show URL: `https://reveal.blichert.net/sessions/:id/results?token=:share_token`. Results screen reads token from query param, skips auth check if valid token present (server validates).

### Priority 4 — Session templates

14. **`SessionSetup.jsx`** — add "Load template" dropdown at top (fetch from `/api/templates`, populate form on select). Add "Save as Template" button at bottom → `SaveTemplateModal`.

15. **`src/components/SaveTemplateModal.jsx`** — single text input for name + confirm. POST to `/api/templates` with current form state serialized as config JSON.

### Priority 5 — Tech debt

16. **Delete `reveal-session.jsx`** from repo root — confirmed dead code.

17. **`Session.jsx` dedup** — remove local `CHAL` array, import from constants. 2-line change.

18. **`ActiveSession.jsx` avatar fix** — in vote display, look up `vote.profiles.avatar_class` in `CLASSES` constant, render class icon instead of generic 🧙.

---

## What NOT to build in sprint 6

- **Perspektiv-Poker** — moves to Sprint 7
- **Slack/Teams webhooks** — moves to Sprint 7
- **Character classes / equipment from DB** — Sprint 8+ (cosmetic, low impact)
- **Worlds/world_nodes from DB** — Sprint 8+ (big lift, low business value right now)
- **Overworld from DB** — same
- **Jira/Azure integration** — Sprint 10
- **AI lifelines** — Sprint 11
- **Pretty design on project management UI** — functional is enough; pixel-art polish later
- **CSV file upload (approach 1)** — paste-from-Excel ships first; file upload is stretch if time allows

---

## Acceptance Criteria

- [ ] Logged-in GM lands on `/dashboard` showing active, upcoming, and completed sessions
- [ ] GM can create a project and a sprint under it via `/projects`
- [ ] GM can add backlog items to a sprint manually (inline add)
- [ ] GM can paste Excel rows into ImportModal, map columns, and bulk-insert items
- [ ] `/sessions/:id/results` shows per-item votes, final estimate, outlier flags, and summary stats
- [ ] Results page has working CSV export (downloads file client-side)
- [ ] Results page generates a shareable read-only link (no auth required with token)
- [ ] Velocity tab on project detail shows sprint-by-sprint point totals
- [ ] GM can save current SessionSetup config as a named template
- [ ] GM can load a saved template to pre-fill SessionSetup form
- [ ] `reveal-session.jsx` prototype deleted from repo root
- [ ] `Session.jsx` local CHAL array removed (uses constants/DB)
- [ ] `profiles.avatar_class` renders class icon in ActiveSession participant list
- [ ] Kanban board på `/dashboard` viser projekter i kolonner (Aktiv/Pauset/Afsluttet), kun Aktive som default
- [ ] Drag-to-move mellem kanban-kolonner opdaterer `projects.status` i DB
- [ ] Backlog items har assigned, timer og progress felter der kan redigeres inline
- [ ] DB er integration-klar: `external_id` + `external_source` på session_items, projects, sprints
- [ ] All sprint6.sql migrations run cleanly with no errors

---

## Estimated Scope

| Area | Effort |
|------|--------|
| Dashboard screen + API | 0.5 day |
| Projects + sprints UI + API | 1.5 days |
| Import modal (paste-from-Excel) | 0.5 day |
| Session results screen + API | 1 day |
| Share link + CSV export | 0.25 day |
| Velocity tab | 0.5 day |
| Session templates | 0.5 day |
| DB migration (sprint6.sql) | 0.25 day |
| Tech debt cleanup | 0.25 day |
| Kanban board | 0.5 day |
| Item felter (assigned/timer/progress) | 0.5 day |
| Integration-readiness (DB kolonner kun) | 0.1 day |
| **Total** | **~6.35 days** |

Tight but doable. If velocity tab or templates slip, they're lowest risk to push to Sprint 7.

---

## Branch

`james/sprint-6-project-management`

Final commit: `feat: sprint 6 - dashboard, project management, results, import, templates`

---

*Written: 2026-03-19*
*Scope decision: "boring project side" first — Perspektiv-Poker → Sprint 7, Webhooks → Sprint 7*
