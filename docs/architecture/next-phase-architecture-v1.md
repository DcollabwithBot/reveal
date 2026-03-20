# Reveal — Next Phase Architecture v1

**Status:** Draft  
**Dato:** 2026-03-20  
**Kontekst:** Reveal er pt. Mode A (Standalone). Alle designs her forbereder Mode B (Connected sync) uden at kræve det.

---

## 1. FEATURE-ARKITEKTUR

---

### 1A. Notifikationer + Admin Panel

#### Nye tabeller

```sql
-- SMTP konfiguration per organisation
CREATE TABLE smtp_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  host            text NOT NULL,
  port            int NOT NULL DEFAULT 587,
  username        text,
  password_enc    text,            -- krypteret med server-side key
  from_address    text NOT NULL,
  from_name       text DEFAULT 'Reveal',
  tls             boolean DEFAULT true,
  verified        boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- OAuth credentials per provider per organisation
CREATE TABLE oauth_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('jira','topdesk','azure_devops','slack','teams')),
  client_id       text NOT NULL,
  client_secret_enc text NOT NULL,  -- krypteret
  scopes          text[],
  redirect_uri    text,
  status          text DEFAULT 'configured' CHECK (status IN ('configured','connected','error')),
  token_data_enc  jsonb,            -- access_token, refresh_token, expires_at (krypteret)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

-- In-app notifikationer
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  title           text NOT NULL,
  body            text,
  target_type     text,             -- 'item', 'session', 'sprint', 'approval'
  target_id       uuid,
  read            boolean DEFAULT false,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);

-- Notifikations-regler (org-niveau)
CREATE TABLE notification_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  channel         text NOT NULL CHECK (channel IN ('in_app','email','webhook','slack','teams')),
  enabled         boolean DEFAULT true,
  config          jsonb DEFAULT '{}',  -- fx filter på rolle, team, etc.
  created_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, event_type, channel)
);
```

#### Events der trigger notifikationer

| Event | In-app (default) | Email (opt-in) | Webhook |
|-------|:-:|:-:|:-:|
| `item.assigned` | ✅ | ✅ | ✅ |
| `item.status_changed` | ✅ | — | ✅ |
| `item.blocked` | ✅ | ✅ | ✅ |
| `sprint.started` | ✅ | ✅ | ✅ |
| `sprint.completed` | ✅ | ✅ | ✅ |
| `approval.pending` | ✅ | ✅ | ✅ |
| `approval.resolved` | ✅ | — | ✅ |
| `estimation.completed` | ✅ | — | ✅ |
| `session.started` | ✅ | — | ✅ |
| `session.completed` | ✅ | — | ✅ |
| `comment.mention` | ✅ | ✅ | — |
| `retro.action_item_created` | ✅ | — | ✅ |

#### In-app vs Email

- **In-app:** Bell icon i topbar med unread count badge. Dropdown viser seneste 20. Klik → naviger til target. Mark as read on click + "mark all read".
- **Email:** Opt-in per event via notification_rules. Uses smtp_configs. Digest-mode mulig (samler 15 min → 1 email).

#### Udvidbarhed til Slack/Teams

`notification_rules.channel` er allerede en enum der kan udvides. Config-feltet holder channel-specifik konfiguration:
- Slack: `{ "webhook_url": "...", "channel": "#reveals" }`
- Teams: `{ "webhook_url": "..." }`

Notify-service i Express (`server/domain/notificationService.js`):
```js
// Interface — alle channels implementerer dette:
// dispatch(event, recipients, config) → Promise<void>
const channels = {
  in_app: new InAppChannel(supabase),
  email: new EmailChannel(smtpPool),
  webhook: new WebhookChannel(),  // eksisterende webhook_configs
  slack: new SlackChannel(),      // fremtidig
  teams: new TeamsChannel(),      // fremtidig
};
```

#### API Endpoints

```
GET    /api/notifications              — liste (paginated, user's own)
PATCH  /api/notifications/:id/read     — mark as read
POST   /api/notifications/read-all     — mark all as read
GET    /api/admin/smtp                 — hent SMTP config
PUT    /api/admin/smtp                 — gem/opdatér SMTP config
POST   /api/admin/smtp/test            — send test-email
GET    /api/admin/oauth/:provider      — hent OAuth status
PUT    /api/admin/oauth/:provider      — gem OAuth credentials
GET    /api/admin/notification-rules   — hent regler
PUT    /api/admin/notification-rules   — batch-opdatér regler
```

#### UI Placering

- **Topbar:** Bell icon med unread badge → dropdown panel
- **Settings → Admin Panel:** Ny side `/settings/admin` med tabs:
  - Notifications (regler matrix)
  - SMTP Configuration
  - Integrations (OAuth per provider — forberedelse til sync)

#### Implementerings-rækkefølge

1. `notifications` tabel + in-app channel + bell UI
2. `notification_rules` tabel + admin regler-UI
3. `smtp_configs` + email channel
4. `oauth_credentials` (genbrug ved sync-integration)

---

### 1B. Roller og Permissions

#### Rolle-model

Bruger `organization_members.role` (tilføj kolonne hvis mangler) + `team_members.role`:

**Org-niveau roller:**
| Rolle | Beskrivelse |
|-------|-------------|
| `owner` | Fuld adgang. Kan slette org, ændre billing, invitere alle roller. Max 2 per org. |
| `admin` | Alt undtagen slet org og ændre billing. Kan ændre SMTP, OAuth, notification rules. |
| `member` | Standard. Kan oprette projekter, sessions, items. Kan ikke admin panel. |
| `observer` | Read-only. Kan se dashboard, projekter, sessions. Kan ikke ændre noget. |

**Team-niveau roller (override for session-kontekst):**
| Rolle | Beskrivelse |
|-------|-------------|
| `pm` | Kan approve estimates, edit items, starte sprints, oprette sessions. Kan se governance. |
| `tech_lead` | Kan oprette sessions, approve estimates. Kan ikke starte sprints. |
| `developer` | Kan deltage i sessions, time-tracke, kommentere. Kan ikke oprette sprints. |
| `guest` | Kan deltage i inviterede sessions. Kan ikke se dashboard/projekter. |

#### Permission Matrix (Org-rolle × Action)

| Action | owner | admin | member | observer |
|--------|:-----:|:-----:|:------:|:--------:|
| org.settings | ✅ | ✅ | — | — |
| org.billing | ✅ | — | — | — |
| org.delete | ✅ | — | — | — |
| org.invite | ✅ | ✅ | — | — |
| admin.smtp | ✅ | ✅ | — | — |
| admin.oauth | ✅ | ✅ | — | — |
| admin.notification_rules | ✅ | ✅ | — | — |
| project.create | ✅ | ✅ | ✅ | — |
| project.edit | ✅ | ✅ | ✅ | — |
| project.delete | ✅ | ✅ | — | — |
| sprint.create | ✅ | ✅ | ✅ | — |
| sprint.start | ✅ | ✅ | ✅* | — |
| session.create | ✅ | ✅ | ✅ | — |
| session.join | ✅ | ✅ | ✅ | ✅ |
| item.create | ✅ | ✅ | ✅ | — |
| item.edit | ✅ | ✅ | ✅ | — |
| item.delete | ✅ | ✅ | — | — |
| approval.approve | ✅ | ✅ | ✅* | — |
| approval.reject | ✅ | ✅ | ✅* | — |
| comment.create | ✅ | ✅ | ✅ | — |
| timelog.own | ✅ | ✅ | ✅ | — |
| view.dashboard | ✅ | ✅ | ✅ | ✅ |
| view.reports | ✅ | ✅ | ✅ | ✅ |

*`✅*` = kun hvis team-rolle er `pm` eller `tech_lead` for det pågældende team.

#### Schema-ændringer

```sql
-- Tilføj rolle på organization_members (hvis ikke eksisterer)
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member','observer'));

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'developer'
    CHECK (role IN ('pm','tech_lead','developer','guest'));
```

#### Håndhævelse

**Express middleware** (`server/domain/authMiddleware.js`):
```js
function requireOrgRole(...roles) {
  return async (req, res, next) => {
    const { organization_id } = req.body || req.query;
    const userId = req.user?.id;
    const { data } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', userId)
      .single();
    if (!data || !roles.includes(data.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.orgRole = data.role;
    next();
  };
}

// Brug:
app.put('/api/admin/smtp', requireOrgRole('owner', 'admin'), async (req, res) => { ... });
```

**Supabase RLS:** Eksisterende policies checker allerede `organization_members`. Tilføj rolle-check:
```sql
-- Eksempel: kun pm/tech_lead kan approve
CREATE POLICY "pm_can_manage_approvals" ON approval_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = approval_requests.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('pm', 'tech_lead')
    )
  );
```

#### API Endpoints

```
GET    /api/org/:id/members           — liste med roller
PATCH  /api/org/:id/members/:userId   — ændr rolle
POST   /api/org/:id/invite            — invitér med rolle
DELETE /api/org/:id/members/:userId   — fjern medlem
```

#### UI Placering

- **Settings → Members:** Tabel med roller, dropdown til ændring (kun owner/admin ser)
- **Team Settings:** Rolle per team-medlem

---

### 1C. Comments

#### Tabel

```sql
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE,  -- threading
  mentions    uuid[] DEFAULT '{}',  -- user IDs nævnt i body
  edited      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_item ON comments(item_id, created_at);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read comments" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_items si
      JOIN sprints sp ON sp.id = si.sprint_id
      JOIN projects p ON p.id = sp.project_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE si.id = comments.item_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated can create comments" ON comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "authors can edit own comments" ON comments
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "authors can delete own comments" ON comments
  FOR DELETE USING (author_id = auth.uid());
```

#### Mentions

**Ja, men simpelt.** Markdown-format `@[displayName](userId)` i body. Frontend parser og rendrer som links. `mentions` array bruges til notifikationer (trigger `comment.mention` event). Ingen autocomplete i v1 — dropdown af teammedlemmer ved `@` keystroke.

#### API Endpoints

```
GET    /api/items/:id/comments            — liste (nested threading)
POST   /api/items/:id/comments            — opret { body, parent_id? }
PATCH  /api/comments/:id                  — rediger { body }
DELETE /api/comments/:id                  — slet (kun egen)
```

#### UI Placering

- **ItemDetailModal** (eksisterer i ProjectWorkspace): Kommentar-sektion i bunden. Input felt + send knap. Threaded visning med indent.
- **Kanban-kort:** Lille kommentar-count badge (💬 3)

---

### 1D. Dependencies og Blockers

#### Tabel

```sql
CREATE TABLE item_dependencies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  depends_on_id     uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  dependency_type   text NOT NULL DEFAULT 'blocks'
    CHECK (dependency_type IN ('blocks','relates_to')),
  created_by        uuid REFERENCES profiles(id),
  external_link_id  text,           -- Jira issue link ID (for sync)
  created_at        timestamptz DEFAULT now(),
  CHECK (item_id != depends_on_id)  -- no self-reference
);

CREATE UNIQUE INDEX idx_item_deps_unique ON item_dependencies(item_id, depends_on_id, dependency_type);
CREATE INDEX idx_item_deps_depends_on ON item_dependencies(depends_on_id);
```

**Note:** Ingen `blocked_by` type — det er den inverse relation af `blocks`. Query begge retninger.

#### Circular Dependency Detection

Server-side check ved oprettelse — BFS/DFS i Express:
```js
async function hasCircularDependency(itemId, dependsOnId, supabase) {
  const visited = new Set();
  const queue = [dependsOnId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === itemId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const { data } = await supabase
      .from('item_dependencies')
      .select('depends_on_id')
      .eq('item_id', current);
    for (const dep of data || []) queue.push(dep.depends_on_id);
  }
  return false;
}
```

#### Jira-sync mapping

Jira issue links (`blocks`, `is blocked by`, `relates to`) mapper direkte til `item_dependencies.dependency_type`. Ved sync:
- Pull: Jira issue link → opret `item_dependencies` med `external_link_id`
- Push: `item_dependencies` → opret Jira issue link
- Slet i enten side → slet i den anden (soft-delete consideration)

#### API Endpoints

```
GET    /api/items/:id/dependencies        — liste (begge retninger)
POST   /api/items/:id/dependencies        — opret { depends_on_id, type }
DELETE /api/dependencies/:id              — slet
GET    /api/projects/:id/dependency-graph — fuld graph for projekt (vis)
```

#### UI Placering

- **Kanban-kort:** 🚫 blocker badge (rød) hvis item er blocked. Antal dependencies som lille tag.
- **ItemDetailModal:** Dependencies sektion — "Blocks" og "Blocked by" lister med add/remove.
- **ProjectWorkspace:** Optional dependency graph view (dagre-d3 eller react-flow) — **v2 feature**, ikke v1.

---

### 1E. Burndown / Velocity Charts

#### Hvad mangler i skemaet

`sprints` har `start_date` og `end_date` ✅. Men vi mangler **daglige snapshots** for burndown:

```sql
CREATE TABLE sprint_daily_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id       uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  snapshot_date   date NOT NULL,
  total_items     int NOT NULL DEFAULT 0,
  completed_items int NOT NULL DEFAULT 0,
  total_points    numeric(8,1) DEFAULT 0,       -- sum af final_estimate
  completed_points numeric(8,1) DEFAULT 0,
  total_hours_est numeric(8,1) DEFAULT 0,
  completed_hours_actual numeric(8,1) DEFAULT 0,
  scope_added     int DEFAULT 0,                 -- items tilføjet denne dag
  created_at      timestamptz DEFAULT now(),
  UNIQUE(sprint_id, snapshot_date)
);

CREATE INDEX idx_sprint_snapshots ON sprint_daily_snapshots(sprint_id, snapshot_date);
```

**Snapshot-generering:** Daglig cron i Express (eller setInterval 1x/dag kl 00:00 UTC):
```js
// For hver aktiv sprint:
// 1. Count items/points/hours i sprint
// 2. INSERT INTO sprint_daily_snapshots
```

#### Charts

| Chart | X-akse | Y-akse | Datakilde |
|-------|--------|--------|-----------|
| Sprint Burndown | Dage (start→end) | Remaining points/items | sprint_daily_snapshots |
| Velocity | Sprint (historisk) | Completed points | SUM(final_estimate) WHERE item_status='done' per sprint |
| Estimation Accuracy | Session | Predicted vs Actual | session_items.final_estimate vs actual_hours |
| Cycle Time | Items | Dage fra backlog→done | session_items.created_at → status='done' timestamp |

#### Bibliotek

**Recharts.** Begrundelse:
- React-native, declarative API
- Allerede i React-økosystemet (ingen ekstra paradigme)
- Covers line, bar, area, scatter (alt vi behøver)
- Recharts er ~40KB gzipped — acceptabelt
- D3 er overkill til disse charts; simpel SVG er for lav-niveau

#### API Endpoints

```
GET /api/sprints/:id/burndown           — daglige snapshots
GET /api/projects/:id/velocity          — points per sprint
GET /api/sessions/:id/accuracy          — predicted vs actual
GET /api/projects/:id/cycle-time        — median dage per item
```

#### UI Placering

- **Dashboard:** Velocity chart som widget (seneste 6 sprints)
- **Sprint-view (ProjectWorkspace):** Burndown chart i sprint-header section
- **Session Results:** Estimation accuracy chart (eksisterer delvist)
- **Ny route `/reports`:** Samlet rapport-side med alle charts + filtre

---

### 1F. Søgning

#### Strategi

**Fase 1: pg_trgm + ILIKE** (simpelt, ingen ekstern dependency):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fuzzy search
CREATE INDEX idx_items_title_trgm ON session_items USING gin (title gin_trgm_ops);
CREATE INDEX idx_items_desc_trgm ON session_items USING gin (description gin_trgm_ops);
CREATE INDEX idx_projects_name_trgm ON projects USING gin (name gin_trgm_ops);
CREATE INDEX idx_comments_body_trgm ON comments USING gin (body gin_trgm_ops);
```

**Fase 2 (optional):** `to_tsvector` full-text search med vægtning — kun hvis pg_trgm er for langsomt (unlikely under 100k rows).

#### API Endpoint

```
GET /api/search?q=...&type=all|items|projects|sprints|sessions|comments&project_id=...&status=...&assignee=...&from=...&to=...
```

Response:
```json
{
  "results": [
    { "type": "item", "id": "...", "title": "...", "snippet": "...", "project": "..." },
    { "type": "project", "id": "...", "title": "...", "snippet": "..." },
    { "type": "comment", "id": "...", "title": "...", "snippet": "...", "item_id": "..." }
  ],
  "total": 42
}
```

#### UI: Spotlight Modal (Cmd+K)

- Global keyboard shortcut `Cmd+K` / `Ctrl+K` → modal overlay
- Input felt med debounce (300ms)
- Resultater grupperet per type med icons
- Klik → naviger til target
- Filtre som pills (type, projekt, status)
- Recent searches i tom state

#### UI Placering

- **Topbar:** Søge-ikon + "Search... ⌘K" placeholder
- **Spotlight Modal:** Overlay centered, 500px bred

---

## 2. UNIVERSAL SYNC ARCHITECTURE

---

### Canonical Model

Reveal's interne model ER canonical. `session_items` er WorkItems, `sprints` er Sprints, `projects` er Projects. Ingen separat `work_items` tabel — det ville duplikere `session_items`.

Mapping:

| Reveal | Jira | TopDesk | Azure DevOps |
|--------|------|---------|-------------|
| `projects` | Project | Category/Subcategory | Team Project + Area Path |
| `sprints` | Sprint (Scrum board) | — (emuleret via dato-range) | Iteration |
| `session_items` | Issue | Incident / Change / Request | Work Item |
| `profiles` (via user mapping) | Account | Operator | Identity |
| `session_items.item_status` | Status | Processing Status | State |
| `session_items.priority` | Priority | Priority | Priority |
| `session_items.final_estimate` | Story Points | — | Story Points / Effort |

### Nye tabeller

```sql
-- Sync connections (per org, per provider)
CREATE TABLE sync_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('jira','topdesk','azure_devops')),
  display_name      text,
  config            jsonb NOT NULL DEFAULT '{}',  -- provider-specifik (project key, board id, area path, etc.)
  credentials_id    uuid REFERENCES oauth_credentials(id),  -- link til OAuth/API key
  sync_mode         text NOT NULL DEFAULT 'read_only' CHECK (sync_mode IN ('read_only','bidirectional')),
  status            text DEFAULT 'active' CHECK (status IN ('active','paused','error','disconnected')),
  last_sync_at      timestamptz,
  last_error        text,
  poll_interval_sec int DEFAULT 300,  -- 5 min default
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(organization_id, provider)
);

-- Entity mapping (Reveal ID ↔ External ID)
CREATE TABLE sync_entity_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  entity_type     text NOT NULL CHECK (entity_type IN ('project','sprint','item','user')),
  reveal_id       uuid NOT NULL,
  external_id     text NOT NULL,
  external_key    text,             -- Jira key (PROJ-123), ADO id, TopDesk number
  last_synced_at  timestamptz,
  reveal_hash     text,             -- hash af Reveal-feltværdier ved sync
  external_hash   text,             -- hash af external feltværdier ved sync
  created_at      timestamptz DEFAULT now(),
  UNIQUE(connection_id, entity_type, external_id)
);

CREATE INDEX idx_sync_entity_reveal ON sync_entity_map(connection_id, entity_type, reveal_id);

-- Sync log (audit trail + conflict resolution)
CREATE TABLE sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('pull','push')),
  entity_type     text NOT NULL,
  external_id     text,
  reveal_id       uuid,
  action          text NOT NULL CHECK (action IN ('created','updated','deleted','conflict','skipped','error')),
  changes         jsonb DEFAULT '{}',  -- hvad ændrede sig
  conflict_data   jsonb,               -- begge siders data ved conflict
  resolved_by     text,                -- 'auto_remote_wins' | 'auto_reveal_wins' | 'manual' | null
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_sync_log_connection ON sync_log(connection_id, created_at DESC);
CREATE INDEX idx_sync_log_conflicts ON sync_log(connection_id, action) WHERE action = 'conflict';

-- Status mapping per connection (Reveal status ↔ Provider status)
CREATE TABLE sync_status_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  reveal_status   text NOT NULL,
  external_status text NOT NULL,
  UNIQUE(connection_id, external_status)
);
```

### Provider Interface

```js
// server/domain/sync/SyncProvider.js
class SyncProvider {
  constructor(connection, supabase) { ... }

  // Lifecycle
  async connect()     { throw new Error('not implemented'); }
  async disconnect()  { throw new Error('not implemented'); }
  async testConnection() { throw new Error('not implemented'); }

  // Pull (read from provider)
  async fetchChanges(since) { throw new Error('not implemented'); }
  // Returns: [{ externalId, externalKey, entityType, action, data, updatedAt }]

  // Push (write to provider) — kun i bidirectional mode
  async pushCreate(entityType, canonicalItem) { throw new Error('not implemented'); }
  async pushUpdate(entityType, externalId, changes) { throw new Error('not implemented'); }
  async pushDelete(entityType, externalId) { throw new Error('not implemented'); }

  // Mapping
  mapToCanonical(entityType, rawData)   { throw new Error('not implemented'); }
  mapFromCanonical(entityType, item)    { throw new Error('not implemented'); }
}

// server/domain/sync/providers/JiraProvider.js
// server/domain/sync/providers/TopDeskProvider.js
// server/domain/sync/providers/AzureDevOpsProvider.js
```

### Sync Worker

```js
// server/domain/sync/syncWorker.js
class SyncWorker {
  constructor(supabase) { ... }

  async runOnce(connectionId) {
    // 1. Load connection + provider
    // 2. fetchChanges(last_sync_at)
    // 3. For each change:
    //    a. Find/create sync_entity_map entry
    //    b. Compare hashes → detect conflict
    //    c. If conflict → log + apply conflict strategy
    //    d. If clean → apply change to Reveal DB
    // 4. Update last_sync_at
    // 5. If bidirectional: find local changes since last_sync → push
  }

  async startPolling() {
    // Load all active connections
    // setInterval per connection based on poll_interval_sec
    // Stagger starts to avoid thundering herd
  }
}
```

### Conflict Resolution

**Strategi: Remote wins by default (read-only baseline).**

I `read_only` mode: provider er altid source of truth. Ingen conflicts mulige.

I `bidirectional` mode:
1. Sammenlign `reveal_hash` og `external_hash` med current values
2. Kun én side ændret → apply den ændring
3. Begge ændret → **conflict**:
   - Default: remote wins (provider er ekstern source of truth — jf. beslutning)
   - Log conflict med begge siders data i `sync_log`
   - Vis i Conflict Center (eksisterer allerede som feed)
   - PM kan override manuelt (klik "use Reveal version")
4. Estimation fields (final_estimate, story_points) → **Reveal wins altid** (Reveal er estimation authority)

### Sync scenarie-håndtering

| # | Scenarie | Håndtering |
|---|----------|------------|
| 1 | Item oprettet i Reveal → push | Kun i bidirectional. `pushCreate()` → gem external_id i entity_map |
| 2 | Item ændret i provider → pull | `fetchChanges()` → `mapToCanonical()` → update session_items |
| 3 | Conflict | Hash comparison. Remote wins default. Log + UI. |
| 4 | Slettet i provider | Reveal item → `item_status = 'archived'` (soft delete). Aldrig hard delete. |
| 5 | Ny sprint i Jira | Auto-opret i Reveal med mapping. Notificér PM. |
| 6 | Estimation i Reveal → push points | Reveal wins. Push `final_estimate` → Jira `story_points`. |
| 7 | TopDesk eskaleret | Pull priority change → update `session_items.priority`. Notificér. |
| 8 | ADO iteration move | Pull → update `session_items.sprint_id` via entity_map lookup. |

### API Endpoints

```
GET    /api/sync/connections              — liste
POST   /api/sync/connections              — opret ny
PATCH  /api/sync/connections/:id          — opdatér config/status
DELETE /api/sync/connections/:id          — slet
POST   /api/sync/connections/:id/test     — test forbindelse
POST   /api/sync/connections/:id/sync-now — trigger manual sync
GET    /api/sync/connections/:id/log      — sync log (paginated)
GET    /api/sync/conflicts                — unresolved conflicts
POST   /api/sync/conflicts/:id/resolve   — manual resolution
GET    /api/sync/status-map/:id           — status mapping
PUT    /api/sync/status-map/:id           — opdatér mapping
```

---

## 3. GAME ↔ DASHBOARD INTEGRATION

---

### 3A. Planning Poker fra Dashboard

#### Flow

```
ProjectWorkspace → Sprint header → [⚡ Start Estimation] knap
                                     ↓
                              Item selector (checkbox)
                                     ↓
                              [Start Session] → POST /api/sessions
                              (type: 'planning_poker', items pre-selected)
                                     ↓
                              Redirect til /session/:id
                              ELLER
                              In-page overlay (embedded SessionView)
```

**Anbefalring: Redirect til `/session/:id`.**
- Estimation kræver multiplayer realtime, fuld session UI, voting cards
- Overlay ville kræve at genimplementere hele session-flowet i en modal
- Redirect er simpelt, konsistent, og allerede bygget

#### Estimation pipeline (eksisterer)

`source_item_id` på session_items linker allerede PM-item → estimation-item.
`estimation_session_id` linker item → den session der estimerede den.

#### Auto-apply estimat

I dag: manuelt "Anvend estimat" (`POST /api/estimation-results/:id/apply`).

Ændring: Ny kolonne `auto_apply` på sessions:
```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_apply_estimates boolean DEFAULT false;
```

Når session completes og `auto_apply = true`:
```js
// I session-complete handler:
if (session.auto_apply_estimates) {
  for (const item of completedItems) {
    if (item.source_item_id) {
      await supabase.from('session_items')
        .update({ final_estimate: item.final_estimate, estimated_hours: item.final_estimate })
        .eq('id', item.source_item_id);
    }
  }
}
```

**Default: auto_apply = false** (governance respekteres). PM kan slå til per session.

#### Bulk select

ProjectWorkspace: Checkbox per item i sprint-view → floating action bar:
- "Estimer valgte (N)" → opretter session med alle valgte items
- "Flyt til sprint..." → batch-move
- "Ændr status..." → batch-status

### 3B. Sprint Planning Session

**Ny session type: `sprint_planning`.**

Forskel fra `planning_poker`:
- Sprint planning inkluderer backlog-browsing + item selection + estimation + prioritering + commit
- Planning poker er bare estimation af pre-valgte items

#### Flow

```
1. GM opretter sprint_planning session (vælger projekt + sprint)
2. Team ser backlog items (ikke i nogen sprint endnu)
3. Drag items fra backlog → "Sprint candidates"
4. For hvert candidate: Planning Poker estimation (inline)
5. Team sorterer priority (drag-drop)
6. GM klikker "Commit Sprint"
   → Items flyttes til sprint (sprint_id sættes)
   → Sprint status → 'active'
   → Sync til Jira hvis connected
   → Notifikation: "Sprint X started with N items"
```

```sql
-- Session type udvidelse
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_type_check;
-- (Eller brug voting_mode/session_type kolonne)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'planning_poker'
  CHECK (session_type IN ('planning_poker','sprint_planning','retrospective','perspective_poker'));
```

### 3C. Retrospective ↔ Dashboard

#### Retro output → PM tasks

Retro producerer allerede:
- Root causes (fra boss battle)
- Action items (fra retro event decisions)
- Oracle insights

**Design:** "Promote to Task" knap på retro-resultater:
```js
// Klik "Promote to Task" på en retro action item:
POST /api/items {
  title: actionItem.text,
  description: `From retrospective: ${session.name}\nRoot cause: ${rootCause}`,
  sprint_id: nextSprint.id,  // eller backlog
  item_status: 'backlog',
  priority: 'medium',
  source_type: 'retro',
  source_session_id: session.id
}
```

Tilføj kolonne:
```sql
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS source_type text CHECK (source_type IN ('manual','estimation','retro','sync')),
  ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES sessions(id);
```

#### Retro history på sprint

Dashboard → Sprint detail → "Retrospective" tab:
- Viser retro session summary (hvis den eksisterer for denne sprint)
- Root causes, action items, boss battle result
- Link til fuld retro session

#### Game stats i retro

Ja — vis disse i retro-flowet (efter boss battle, før action items):
- Sprint velocity (points completed)
- Estimation accuracy (this sprint)
- Cycle time median
- Comparison med forrige sprint

### 3D. Gamification i Dashboard

**Anbefaling: Subtil, opt-in, professionel.**

V7 retningen er klar: "serious execution platform with a game soul." Gamification i dashboard skal være **ambient signals**, ikke dekorativt.

#### Hvad vises:

| Signal | Hvor | Hvordan |
|--------|------|---------|
| Team streak | Sprint header | "🔥 3 sprints completed on time" — tekst, ingen animation |
| Estimation accuracy trend | Sprint header / Reports | "📊 Accuracy: 87% (↑ 4%)" |
| Sprint health | Dashboard widget | Farvekode: grøn/gul/rød baseret på burndown slope. Ingen HP bar. |
| Achievement badges | Brugerprofil dropdown | Diskrete badges (seneste 3). Klik → fuld liste. Ikke synlig for andre default. |
| Session completion rate | Dashboard widget | "12/14 items estimated this sprint" — ren data |

#### Hvad vises IKKE i dashboard:

- XP/level (for game-agtigt for PM-fladen)
- Boss HP bar (hører til session)
- Loot drops (hører til session)
- Leaderboards (potentielt toxic i PM-kontekst)

#### Princip:

Game metrics **oversættes** til PM-sprog i dashboard. Streak = "consistent delivery". Boss HP = "sprint health". XP = "estimation confidence". Selve game-UI og game-sprog forbliver i session-mode.

**Optional toggle:** Org admin kan vælge "Show game signals in dashboard" (default: on for indie teams, off for enterprise).

---

## 4. HVAD MANGLER ELLERS

---

### Onboarding flow

**Kritisk for betalende kunder.**

```
1. Sign up (Google OAuth) → Create Organization
2. "What do you use for project management?" → [Standalone / Jira / Azure DevOps / TopDesk]
   → Standalone: continue
   → Connected: OAuth flow → initial sync
3. Create first project (name, icon)
4. Import items (paste, CSV, eller sync)
5. Invite team (email invites med roller)
6. Start first session (guided — "Let's estimate your first items!")
7. Done → Dashboard
```

**Implementering:** Wizard-komponent, 5-7 steps. Gem progress i `organizations.onboarding_step`.

### Billing / Stripe

**Timing: Efter 10 betalende pilot-kunder bruger det gratis.**

Reveal's model:
- **Free:** 1 projekt, 5 team members, basis sessions
- **Pro ($12/user/mo):** Unlimited projekter, integrations, alle session types, reports
- **Enterprise ($25/user/mo):** SSO, audit log, priority support, custom game profiles

Stripe integration via Stripe Checkout + Customer Portal. Ikke custom billing UI.

```sql
CREATE TABLE subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan            text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  status          text DEFAULT 'active',
  current_period_end timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

### Mobile experience

**Ikke native app. PWA.**

Prioritér:
1. Responsive dashboard (works on tablet)
2. Session participation on mobile (voting cards)
3. Notifications via Web Push (allerede erfaring fra Madro.ai)
4. Offline: ikke nødvendigt — realtime sessions kræver connectivity

### Audit log (bruger-synlig)

Eksisterer allerede som `audit_log` tabel. Mangler: **UI**.

- **Settings → Activity:** Filtrerbar liste af audit events
- Per item: "Activity" tab i ItemDetailModal (hvem ændrede hvad hvornår)
- Eksisterende `event_ledger` + `audit_log` er sufficient — tilføj blot query endpoints + UI

```
GET /api/audit-log?org_id=...&target_type=...&target_id=...&limit=50&offset=0
```

### Data eksport (GDPR)

```
POST /api/org/:id/export              — generér fuld data export (async)
GET  /api/org/:id/export/:jobId       — download når klar
DELETE /api/org/:id                    — slet hele org + al data (GDPR right to deletion)
```

Format: ZIP med JSON files per tabel. Async job (kan tage minutter for store orgs).

### API rate limiting

```js
// server/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 500,                    // per IP
  standardHeaders: true,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,                     // login attempts
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

Plus: helmet, CORS whitelist, input validation (zod), SQL injection prevention (Supabase handles), CSRF tokens.

### Multi-language

**Ikke nu. Engelsk first.**

Reveal's marked er internationalt (PM tools). Dansk er nice-to-have men ikke kritisk. Forbered med `i18next` + namespace-baserede translation files når der er behov.

Forberedelse: Hold alle user-facing strings i constants (ikke inline JSX). Gør det nemt at extracte later.

---

## 5. ANBEFALET IMPLEMENTERINGS-RÆKKEFØLGE

---

### Fase 1: Foundation (Sprint 13-14) — "Can work professionally"

| # | Feature | Effort | Begrundelse |
|---|---------|--------|-------------|
| 1 | **Roller & Permissions** | 3-4 dage | Alt andet afhænger af access control. Uden roller kan vi ikke lade kunder bruge det. |
| 2 | **Comments** | 2-3 dage | Basis samarbejds-feature. Triviel at bygge, stor perceived value. |
| 3 | **Søgning (Cmd+K)** | 2-3 dage | UX table stakes. Brugere forventer det. |

### Fase 2: Insight (Sprint 15-16) — "Can measure execution"

| # | Feature | Effort | Begrundelse |
|---|---------|--------|-------------|
| 4 | **Burndown/Velocity** | 4-5 dage | Snapshot cron + Recharts. PM-kernefeature. |
| 5 | **Dependencies** | 3-4 dage | Blocker-awareness er kritisk for seriøs PM. |
| 6 | **Notifikationer (in-app)** | 3-4 dage | Bell icon + events. Bruger det til engagement. |

### Fase 3: Game ↔ PM Bridge (Sprint 17-18) — "Game soul activates"

| # | Feature | Effort | Begrundelse |
|---|---------|--------|-------------|
| 7 | **Planning Poker fra Dashboard** | 3 dage | Bridge-feature. Estimation pipeline eksisterer, dette er UI + flow. |
| 8 | **Retro → PM tasks** | 2-3 dage | Promote action items. Lille feature, stor forbindelse. |
| 9 | **Gamification signals** | 2 dage | Streak, accuracy, health badges. Subtilt. |

### Fase 4: Sprint Draft (Sprint 19-20) — "The planning game"

Design: `docs/working/sprint-planning-game-mode-design.md`

| # | Feature | Effort | Begrundelse |
|---|---------|--------|-------------|
| 10 | **Sprint Draft — session_type='sprint_draft'** | 6-8 dage | Ny game-mode: Budget Draft. 5 faser: GM Setup → Priority Vote → The Draft → Stretch Goals → Approval. |
| 11 | **Mystery Cards (unestimererede items)** | 2 dage | 3D card-flip, T-shirt quick estimate in-draft, strict mode. |
| 12 | **Capacity Gauge + game moments** | 2 dage | Consensus Flash ⚡, Capacity Lock 🔒, Mystery Reveal 🃏. |

Skema-krav: `capacity_points` + `velocity_actual` på sprints, `sprint_draft_picks` + `sprint_draft_priority_votes` tabeller, `sprint_velocity` view.

### TODO: Fase 5 — Connectivity (parkeret)

> Afventer fase 1-4 er stabile. Aktiveres når første betalende kunde kræver det.

- Sync architecture + Jira read-only (8-10 dage)
- Admin Panel: SMTP + OAuth credentials UI (4-5 dage)
- Email notifikationer via SMTP (2-3 dage)
- Jira bidirektionel write-back (gated: INT-G1/G2/G3) (5-6 dage)
- TopDesk + Azure DevOps provider implementations (5-6 dage/provider)

### TODO: Fase 6 — Monetization (parkeret)

> Aktiveres efter 10 pilotkunder.

- Onboarding wizard (3-4 dage)
- Stripe billing — checkout + portal + plan enforcement (4-5 dage)
- GDPR export (2 dage)
- Rate limiting + security hardening (2 dage)
- Audit log UI (2 dage)

---

### Total estimate: ~70-85 dage developer-tid

Med 1 full-time dev: ~4-5 måneder.
Med 2 devs + AI-assisted coding: ~2-3 måneder.

**Kritisk path:** Roller → Comments → Søgning → Charts → Sync. Alt andet kan paralleliseres.

---

### Arkitektur-principper der gælder hele vejen

1. **PM-data er source of truth.** Game-layer er advisory. Ingen game-writes direkte til PM-tabeller.
2. **Governance først.** Nye mutations går gennem approval pipeline hvor relevant.
3. **Provider-agnostisk fra dag 1.** Sync interface designet til N providers, ikke hardcoded til Jira.
4. **Feature flags.** Nye features bag feature flags (org-niveau). Graduel rollout.
5. **Eksisterende patterns.** Brug session_items (ikke ny work_items tabel), brug existing RLS patterns, brug existing event_ledger for audit.
