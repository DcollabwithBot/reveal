# Reveal Professional Mode — UX Rework Spec

Date: 2026-03-19  
Owner: Reveal product/dev team  
Scope: Dashboard + Projects area (research + diagnosis + redesign spec, no implementation)

---

## 1) Executive summary

Reveal’s current dashboard/projects experience is functionally promising but visually and structurally still “internal tool + retro game shell.” For professional daily use, the biggest blockers are:

1. **Project creation can fail silently** for users without membership/org bootstrap.
2. **No user-visible error handling** on critical actions (create project/sprint/item).
3. **Information architecture is flat** (projects list + project details are basic, no clear ownership/health/date model).
4. **Visual style conflicts with intended buyer context** (pixel-art aesthetics in admin/productivity area).

Recommendation: introduce **Professional Mode** (modern SaaS UI) for `/dashboard`, `/projects`, `/projects/:id`, while keeping game modes for session gameplay.

---

## 2) Current-state audit (code-based)

### Frontend findings

**Files reviewed:**
- `src/screens/DashboardScreen.jsx`
- `src/screens/ProjectsScreen.jsx`
- `src/lib/api.js`
- `src/App.jsx`

#### A. Silent failure risk in project creation
- `ProjectsScreen.jsx` line 26-30: `createProject()` awaits `apiFetch('/api/projects', ...)` but has no `try/catch` and no error UI.
- If backend returns 400/500, user gets no actionable feedback (only promise rejection in console).

#### B. Silent failure risk in list load
- `ProjectsScreen.jsx` line 18: `apiFetch('/api/projects').then(setProjects).catch(() => {})`
- Errors are swallowed; UI just looks empty (could be interpreted as “create is broken”).

#### C. Weak validation in create flow
- Create button always enabled (`line 65`), no inline validation state (`name required` only handled server-side).

#### D. Dashboard IA is mixed and low signal
- `DashboardScreen.jsx` combines sessions + project kanban in one dense screen.
- No KPI summaries (project health, overdue count, velocity trend, owner load).

#### E. Styling is inline + retro-oriented
- Heavy inline styles and retro palette in admin surfaces make consistency/scaling hard.

### Backend/API findings

**File reviewed:** `server/app.js`

#### F. Likely root cause of “cannot create projects” for some users
- `POST /api/projects` (`line 558+`) requires resolved membership/org:
  - `const membership = await resolveMembership(user.id)`
  - if missing: `return res.status(400).json({ error: 'No org' })` (`line 562`)
- Unlike `POST /api/sessions` (`line 325-342`), projects endpoint **does not auto-bootstrap** org/team.

This creates an inconsistent first-run path:
- User can sign in and reach `/projects`, but if no `team_members` + org relation exists yet, create fails with `No org`.

#### G. Authorization gaps (security + data integrity)
- `PATCH /api/projects/:id`, `GET /api/projects/:id`, `GET /api/projects/:id/sprints` do not enforce org ownership in query filters.
- Not directly the create bug, but should be fixed in same hardening wave.

---

## 3) Root-cause hypotheses for project creation bug

### Hypothesis 1 (highest confidence): missing org/team bootstrap
- **Why:** `POST /api/projects` returns 400 `No org` for users without membership.
- **Evidence:** `server/app.js` line 561-563.
- **Repro pattern:** new/edge user that never hit auto-provision path in sessions endpoint.

### Hypothesis 2: frontend error is invisible, interpreted as broken feature
- **Why:** create call has no catch + no toast/inline error.
- **Evidence:** `ProjectsScreen.jsx` line 26-30.
- **Effect:** user clicks “Create”, nothing appears, assumes broken.

### Hypothesis 3: auth token/session race on first load
- **Why:** `apiFetch()` depends on `supabase.auth.getSession()`, but no request-level UX for expired session.
- **Effect:** API 401 can happen and still appear as empty/broken due to swallowed catches.

---

## 4) Exact bugfix recommendations (frontend + API)

## API fixes (must-do)

1. **Unify membership bootstrap logic**
   - Reuse bootstrap from `POST /api/sessions` inside `POST /api/projects`.
   - Prefer helper: `resolveOrProvisionMembership(user)` used by all write endpoints.
   - Touchpoint: `server/app.js` around lines 325-342 + 558-582.

2. **Return structured errors**
   - Standard shape: `{ code, message, hint }`.
   - Example for missing org: `code: 'ORG_NOT_PROVISIONED', hint: 'Run /api/auth/provision or auto-provision now'`.

3. **Enforce org scoping on project endpoints**
   - Add `organization_id = membership.organization_id` filters on read/update routes.
   - Touchpoints: `/api/projects/:id`, `/api/projects/:id/sprints`, `/api/projects/:id (PATCH)`.

4. **Add observability log fields**
   - Log `user.id`, route, status code, error code for create failures.

## Frontend fixes (must-do)

1. **Handle create errors visibly**
   - Wrap `createProject` with `try/catch`; show inline error banner/toast.
   - Touchpoint: `src/screens/ProjectsScreen.jsx` line 26-30.

2. **Disable submit when invalid/loading**
   - Validate `name.trim().length >= 2`; disable button while pending.

3. **Do optimistic insert only on success**
   - Keep current append behavior, but only after resolved response.

4. **Don’t swallow initial-load errors**
   - Replace `.catch(() => {})` with tracked error state + “Retry” CTA.

5. **Add empty state diagnostics**
   - “No projects yet” vs “Could not load projects.”

---

## 5) Market pattern research (what modern tools do)

Sources sampled:
- Linear docs (`/docs/projects`) + Linear Plan page
- Atlassian Jira roadmap filters docs
- Asana PM features page
- Notion help (Board + Timeline views)
- Shortcut product page

### Practical patterns to adopt

1. **Multi-view project surfaces** (list/board/timeline) — Linear, Notion, Asana.
2. **Health states & updates** (On track / At risk / Off track) — Linear.
3. **Portfolio-level filtering** (assignee, status, sprint, labels, dependencies) — Jira.
4. **Centralized project overview** (summary, milestones, linked work/docs) — Linear.
5. **Ownership clarity** (lead/assignee mandatory on creation) — Asana/Linear norms.
6. **Status-first boards** with customizable grouping — Notion board model.
7. **Workload/capacity visibility** (owner load by period) — Monday pattern.
8. **Quick-create + keyboard-driven flow** — Linear/Shortcut style efficiency.
9. **Template-driven consistency** for repeated project structures — broad SaaS norm.
10. **Actionable empty states** with import/start options — Asana/Notion style onboarding.

---

## 6) Professional Mode redesign spec

## 6.1 Product IA (routes/screens)

### Keep
- `/dashboard` (reworked)
- `/projects` (reworked)
- `/projects/:id` (reworked)

### Add
- `/projects/new` (full-page creation form; modal optional as shortcut)
- `/projects/:id/settings` (metadata, integrations, archive)
- `/projects/:id/activity` (audit trail)

### Navigation
- Left sidebar (persistent): Dashboard, Projects, Sessions, Templates, Integrations
- Top bar: global search, filters chip row, “New project” CTA, user menu

## 6.2 Dashboard layout (professional)

Section order:
1. **KPI row (4 cards)**
   - Active projects
   - At-risk projects
   - Upcoming sessions
   - Completed this week
2. **Project health table (primary panel)**
   - Columns: Project, Owner, Status, Health, Progress, Updated, Next milestone
3. **Upcoming sessions panel**
4. **My tasks/items panel**
5. **Recent activity feed**

Interaction:
- Row click -> project detail
- Quick status/health update inline
- Saved filters per user

## 6.3 Projects list page layout

- Header: title + create button + view switch (Table / Board / Timeline)
- Filter bar: search, owner, status, health, date range, tags
- Table default columns:
  - Name
  - Owner
  - Status
  - Health
  - Items open/total
  - Progress %
  - Updated at
- Bulk actions: archive, change owner, status

Empty state:
- “No projects yet” + buttons: `Create project`, `Import template`, `Learn setup`

## 6.4 Project detail IA

Tabs:
- Overview
- Work items
- Sprints
- Timeline
- Activity
- Settings

Overview blocks:
- Left: summary, goals, key dates, risks
- Right: owner/team, health badge, progress ring, quick actions
- Milestones timeline strip
- Linked sessions/results snapshot

Work items:
- Kanban + table toggle
- Column grouping by status
- Fields: title, owner, estimate, actual, progress, priority, due date

## 6.5 Project creation flow (professional)

### Recommended form fields
Required:
- Project name
- Owner
- Status (default Active)

Optional:
- Description
- Start/end date
- Team
- Color/icon (non-blocking)
- Initial sprint template

### Flow
1. Open `/projects/new`
2. Fill required fields
3. Optional “Advanced settings” accordion
4. Submit -> success toast + redirect to `/projects/:id`
5. Offer “Create first sprint” guided step

### Microcopy examples
- Primary CTA: `Create project`
- Error (org issue): `We couldn’t create this project because your workspace isn’t fully set up yet. Click “Fix workspace” to continue.`
- Empty list: `No projects yet. Start your first project to organize sessions and sprint work.`

---

## 7) Visual style direction (no pixel-art)

Design language: **Modern B2B SaaS (clean, dense, calm)**

- Typography: Inter / system sans
- Spacing scale: 4/8/12/16/24
- Radius: 8-12
- Shadows: subtle, layered
- Colors:
  - Neutral base surfaces
  - Semantic status colors (success/warning/danger/info)
  - One brand accent
- Components from design system (or shadcn-like primitives)
- Reduce emoji dependence in core productivity UI (optional in playful mode)

Mode strategy:
- Keep gameplay screens stylized.
- Professional mode applies to work/admin routes.

---

## 8) Accessibility + responsiveness checklist

Accessibility:
- WCAG AA contrast minimum
- Full keyboard support (tab order, enter/space actions)
- Focus-visible rings on all controls
- Form labels + error associations (`aria-describedby`)
- Toasts + async states announced for screen readers
- Drag-drop has keyboard alternative actions

Responsive:
- Breakpoints: 360 / 768 / 1024 / 1280+
- Mobile: table -> stacked cards
- Filter drawer collapses on small screens
- Sticky primary CTA in mobile create flow

---

## 9) Phased implementation plan

## Phase 0 — Quick wins (1-2 PRs)
- Fix project create bug (API bootstrap parity).
- Add explicit create/load error handling in ProjectsScreen.
- Add loading/disabled states + success/failure toast.
- Add empty state messaging.

## Phase 1 — UX stabilization (2-4 PRs)
- Introduce shared UI primitives (button/input/card/table/badge).
- Refactor inline styles to theme tokens.
- Rework `/projects` into professional table-first list with filters.
- Add `/projects/new` route and guided create flow.

## Phase 2 — Full professional dashboard (3-6 PRs)
- Rebuild `/dashboard` with KPI row + health table + activity feed.
- Add health model and project updates workflow.
- Add timeline/board view toggles on projects.
- Add activity/settings routes per project.

---

## 10) Suggested first PR scope (shippable now)

**PR title:** `fix(projects): reliable project creation + visible error states`

Include:
1. API: `POST /api/projects` uses `resolveOrProvisionMembership()` (or same fallback logic as sessions).
2. API: normalize error payloads for create failures.
3. Frontend: `ProjectsScreen` wraps create/load in `try/catch`, shows inline banner/toast.
4. Frontend: disable create when name empty or request pending.
5. Add smoke test checklist in PR description:
   - new user without membership can create project
   - failed create shows clear message
   - successful create updates list + clears form

Out of scope for PR1:
- Visual redesign
- Route restructuring
- Dashboard layout overhaul

---

## 11) Validation run

Command run:
- `npm run build` (project root)

Result:
- ✅ Build passed (Vite build successful)
- Bundle output generated under `dist/`

---

## 12) Definition of done for professional mode

- Project creation works for first-time and returning users.
- Errors are visible and actionable.
- `/dashboard` and `/projects` align with modern SaaS IA.
- Pixel-art styling removed from professional routes.
- A11y + responsive checklist verified.
- Security/org scoping checks applied on project APIs.
