# Reveal REST API

Ekstern REST API til Reveal-data. Designet til PowerBI, Zapier, Make, og alle andre integrationer.

**Base URL:** `https://<supabase-project>.supabase.co/functions/v1/reveal-api`

---

## Authentication

Alle endpoints (undtagen `/generate-key`) kræver en API-nøgle som Bearer token:

```http
Authorization: Bearer rvl_<din-nøgle>
```

### Opret API-nøgle

1. Gå til **Workspace Settings → API-nøgler**
2. Klik **+ Ny nøgle**
3. Vælg navn, scopes og evt. udløbsdato
4. Kopiér nøglen — den vises **kun én gang**

API-nøgler gemmes aldrig i klartext — kun SHA-256 hash.

### Generér nøgle via API (programmatisk)

```http
POST /generate-key
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "name": "PowerBI rapport",
  "scopes": ["read:projects", "read:sprints", "read:items"],
  "expires_at": "2027-01-01T00:00:00Z"  // valgfrit
}
```

**Response (201):**
```json
{
  "key": "rvl_abc123...",
  "prefix": "rvl_abc123de",
  "name": "PowerBI rapport",
  "scopes": ["read:projects", "read:sprints", "read:items"]
}
```

> **OBS:** `key` returneres kun i dette svar. Gem det sikkert.

---

## Scopes

| Scope | Beskrivelse |
|---|---|
| `read:projects` | Adgang til projekter |
| `read:sprints` | Adgang til sprints |
| `read:items` | Adgang til backlog-items og estimater |
| `read:time` | Adgang til tidsregistreringer |
| `read:sessions` | Adgang til game sessions og historik |
| `read:team` | Adgang til teammedlemmer og leaderboard |

---

## Pagination

Alle list-endpoints understøtter pagination:

```
?page=1&per_page=100
```

- Default: `page=1`, `per_page=100`
- Max: `per_page=500`

Response inkluderer altid `meta`:
```json
{
  "data": [...],
  "meta": {
    "total": 247,
    "page": 1,
    "per_page": 100
  }
}
```

---

## Endpoints

### Projects

#### `GET /projects`
*Scope: `read:projects`*

Henter alle projekter i din organisation.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/projects
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Kombit WiFi",
      "description": "Migrering til ny WiFi-infrastruktur",
      "status": "active",
      "created_at": "2026-01-15T09:00:00Z",
      "updated_at": "2026-03-10T14:22:00Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "per_page": 100 }
}
```

---

#### `GET /projects/:id`
*Scope: `read:projects`*

Henter et enkelt projekt.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/projects/uuid-her
```

---

#### `GET /projects/:id/sprints`
*Scope: `read:projects` + `read:sprints`*

Henter alle sprints for et projekt.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/projects/uuid-her/sprints
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Sprint 3",
      "goal": "Afslut WiFi-konfiguration for bygning A",
      "status": "active",
      "start_date": "2026-03-10T00:00:00Z",
      "end_date": "2026-03-24T00:00:00Z",
      "created_at": "2026-03-09T10:00:00Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "per_page": 100 }
}
```

---

### Sprints

#### `GET /sprints/:id/items`
*Scope: `read:sprints` + `read:items`*

Henter alle items i en sprint.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/sprints/uuid-her/items
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sprint_id": "uuid",
      "project_id": "uuid",
      "title": "Konfigurér RADIUS-server",
      "description": "...",
      "estimate": 8,
      "status": "in_progress",
      "priority": 1,
      "risk_score": 2,
      "item_type": "task",
      "assignee_id": "uuid",
      "created_at": "2026-03-10T10:00:00Z",
      "updated_at": "2026-03-15T12:00:00Z"
    }
  ],
  "meta": { "total": 12, "page": 1, "per_page": 100 }
}
```

---

### Items

#### `GET /items`
*Scope: `read:items`*

Henter items med valgfrit filter på sprint.

```bash
# Alle items
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/items

# Filtrér på sprint
curl -H "Authorization: Bearer rvl_xxx" \
  "https://<url>/functions/v1/reveal-api/items?sprint_id=uuid"
```

---

### Time Entries

#### `GET /time-entries`
*Scope: `read:time`*

Henter tidsregistreringer med valgfrie filtre.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  "https://<url>/functions/v1/reveal-api/time-entries?project_id=uuid&from=2026-03-01&to=2026-03-31"
```

**Query parameters:**
- `project_id` — filtrér på projekt
- `from` — fra dato (ISO 8601)
- `to` — til dato (ISO 8601)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "project_id": "uuid",
      "sprint_id": "uuid",
      "item_id": "uuid",
      "description": "Konfiguration af RADIUS",
      "minutes": 90,
      "logged_at": "2026-03-15T14:00:00Z",
      "created_at": "2026-03-15T16:22:00Z"
    }
  ],
  "meta": { "total": 47, "page": 1, "per_page": 100 }
}
```

---

### Sessions

#### `GET /sessions`
*Scope: `read:sessions`*

Henter game sessions.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  "https://<url>/functions/v1/reveal-api/sessions?project_id=uuid"
```

**Query parameters:**
- `project_id` — filtrér på projekt

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "game_mode": "planning_poker",
      "status": "completed",
      "created_by": "uuid",
      "completed_at": "2026-03-15T15:30:00Z",
      "items_covered": ["uuid1", "uuid2"],
      "participants": ["uuid1", "uuid2", "uuid3"],
      "summary": "Estimerede 8 items, konsensus opnået på 6",
      "created_at": "2026-03-15T14:00:00Z"
    }
  ],
  "meta": { "total": 23, "page": 1, "per_page": 100 }
}
```

---

### Team

#### `GET /leaderboard`
*Scope: `read:team`*

Henter XP-leaderboard for organisationen.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/leaderboard
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "uuid",
      "display_name": "Anders Hansen",
      "avatar_class": "wizard",
      "xp": 2840,
      "level": 7,
      "organization_id": "uuid"
    }
  ],
  "meta": { "total": 8, "page": 1, "per_page": 100 }
}
```

---

#### `GET /members`
*Scope: `read:team`*

Henter alle teammedlemmer med profil-data.

```bash
curl -H "Authorization: Bearer rvl_xxx" \
  https://<url>/functions/v1/reveal-api/members
```

**Response:**
```json
{
  "data": [
    {
      "user_id": "uuid",
      "role": "admin",
      "joined_at": "2026-01-01T00:00:00Z",
      "display_name": "Anders Hansen",
      "avatar_class": "wizard",
      "avatar_color": "#7B4FFF",
      "xp": 2840,
      "level": 7
    }
  ],
  "meta": { "total": 8, "page": 1, "per_page": 100 }
}
```

---

## Error Responses

| HTTP Status | Error | Beskrivelse |
|---|---|---|
| 401 | `unauthorized` | Ugyldig, udløbet eller tilbagekaldt API-nøgle |
| 403 | `forbidden` | Nøglen mangler det påkrævede scope |
| 404 | `not_found` | Ressource eller route ikke fundet |
| 500 | `internal` | Intern serverfejl |

**Format:**
```json
{
  "error": "forbidden",
  "message": "Key does not have scope: read:time"
}
```

---

## PowerBI Setup Guide

### Trin 1: Åbn Power Query Editor

1. Åbn Power BI Desktop
2. Klik **Hent data** → **Web**
3. Vælg **Avanceret**

### Trin 2: Konfigurér forbindelsen

**URL:** `https://<supabase-url>/functions/v1/reveal-api/projects`

**HTTP-anmodningsheadere:**
- Header: `Authorization`
- Værdi: `Bearer rvl_<din-nøgle>`

### Trin 3: Naviger i dataene

Power Query viser JSON-responsen. Udvid `data`-feltet for at se projekterne.

### Trin 4: Opret parameteriseret forespørgsel (avanceret)

```powerquery
let
    ApiKey = "rvl_<din-nøgle>",
    BaseUrl = "https://<supabase-url>/functions/v1/reveal-api",
    
    // Hent projekter
    ProjectsSource = Json.Document(
        Web.Contents(BaseUrl & "/projects", [
            Headers = [Authorization = "Bearer " & ApiKey]
        ])
    ),
    ProjectsData = ProjectsSource[data],
    ProjectsTable = Table.FromList(ProjectsData, Splitter.SplitByNothing()),
    ProjectsExpanded = Table.ExpandRecordColumn(ProjectsTable, "Column1",
        {"id", "name", "status", "created_at"}),
    
    // Hent items
    ItemsSource = Json.Document(
        Web.Contents(BaseUrl & "/items", [
            Headers = [Authorization = "Bearer " & ApiKey]
        ])
    ),
    ItemsData = ItemsSource[data],
    ItemsTable = Table.FromList(ItemsData, Splitter.SplitByNothing()),
    ItemsExpanded = Table.ExpandRecordColumn(ItemsTable, "Column1",
        {"id", "sprint_id", "project_id", "title", "estimate", "status", "priority"})
in
    ItemsExpanded
```

### Trin 5: Hent alle sider (pagination)

Til store datasæt kan du loope over sider:

```powerquery
let
    ApiKey = "rvl_<din-nøgle>",
    BaseUrl = "https://<supabase-url>/functions/v1/reveal-api",
    PerPage = 500,
    
    GetPage = (page as number) =>
        Json.Document(Web.Contents(
            BaseUrl & "/items?page=" & Number.ToText(page) & "&per_page=" & Number.ToText(PerPage),
            [Headers = [Authorization = "Bearer " & ApiKey]]
        )),
    
    FirstPage = GetPage(1),
    Total = FirstPage[meta][total],
    Pages = Number.RoundUp(Total / PerPage),
    
    AllPages = List.Generate(
        () => [page = 1, data = FirstPage[data]],
        each [page] <= Pages,
        each [page = [page] + 1, data = GetPage([page] + 1)[data]],
        each [data]
    ),
    
    Combined = List.Combine(AllPages),
    Table = Table.FromList(Combined, Splitter.SplitByNothing()),
    Expanded = Table.ExpandRecordColumn(Table, "Column1",
        {"id", "sprint_id", "project_id", "title", "estimate", "status"})
in
    Expanded
```

### Tips til PowerBI

- **Datoer:** Alle datoer er ISO 8601 — brug `DateTime.FromText()` til konvertering
- **Flat struktur:** Alle responses er flade (ingen nested objects) — klar til direkte brug i Power Query
- **Filtrering:** Brug query parameters for at reducere datamængde: `?project_id=uuid&from=2026-01-01`
- **Refresh:** Sæt scheduled refresh i Power BI Service — API-nøglen gemmes sikkert i datasource credentials

---

## Sikkerhed

- API-nøgler gemmes som SHA-256 hash i databasen — råteksten er aldrig gemt
- Nøgler er organisationsspecifikke — du kan kun tilgå data fra din egen organisation
- RLS (Row Level Security) er aktiveret — alle queries filtreres automatisk på `organization_id`
- Tilbagekald nøgler øjeblikkeligt via Settings → API-nøgler → Tilbagekald
- Brug udløbsdatoer til midlertidige integrationer
