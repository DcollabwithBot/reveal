# SPRINT 4 — Reveal: Multiplayer + Admin + DB Arkitektur

> **Formål:** Gå fra single-player prototype til rigtig SaaS-platform med multiplayer, Game Master flow og multi-tenant database.
> **Output:** Komplet teknisk blueprint. Byggeklart. Ingen filler.

---

## A. BLINDE VINKLER

### 1. Onboarding flow for ny organisation
**Problem:** Ingen tænkt på det endnu. En ny CTO der tilmelder sig ved ikke hvad de klikker på.

Onboarding-flow:
1. Signup → Org-navn → Plan-valg
2. Opret første team (med navn + invitation via email/link)
3. Guided "første session" (template-baseret, 5 items, én mode)
4. Avatar-oprettelse for alle nye brugere (første login)

Mangler: session-templates, velkomst-email flow, trial-limit logik.

### 2. Pricing/billing implikationer
Anbefalet model (Stripe):

| Plan | Teams | Brugere | Modes | AI | Pris |
|------|-------|---------|-------|----|------|
| Free | 1 | 5 | Poker + Roulette | ❌ | €0 |
| Starter | 3 | 20 | Alle | ❌ | €29/md |
| Pro | ∞ | 50 | Alle | ✅ | €99/md |
| Enterprise | ∞ | ∞ | Alle + SSO | ✅ | Aftale |

**Billing-implikation:** `organizations.plan` styrer feature flags. RLS kan ikke alene håndtere dette — application-layer check nødvendig.

### 3. GDPR — kritisk blindspot
- Stemmer er persondata (stemme + bruger + tidsstempel = profilering)
- Session-logs med chat/kommentarer = persondata
- Velocity-data på team = aggregeret persondata

**Handling:**
- `votes.user_id` kan anonymiseres ("Spiller A") under selve sessionen
- Data retention policy: sessions slettes efter X måneder (konfigurér per org)
- Slet-bruger = anonymisér alle votes (`user_id → NULL`, `display_name → "Deleted User"`)
- DPA (Data Processing Agreement) nødvendig for Enterprise
- Gem aldrig stemme-data i logs/exports med navn som default

### 4. Realtime fallback
Supabase Realtime kan falde ned. Plan:

- **Primær:** Supabase Realtime channels (WebSocket)
- **Fallback:** Polling hvert 3. sekund hvis WS disconnects
- **Client-side:** Connection state indicator ("📡 Live" / "🔄 Syncing" / "❌ Offline")
- **State:** Al session-state gemmes i `sessions.state_snapshot` (JSONB) — fuld genoprettelse mulig

### 5. Session der crasher midt i
- Al state autosaves til `sessions.state_snapshot` ved hvert step
- GM kan "Resume session" — loader state fra snapshot
- Players der disconnecter genopkobler automatisk og genhenter state
- Session får status `interrupted` hvis GM disconnecter i >5 min

### 6. Facilitator der ikke møder op
- Sessions har `co_game_master_id` (optional backup GM)
- Enhver med `role = team_admin` kan "tage over" en session i status `waiting`
- "Tage over"-knap aktiveres efter 10 min uden GM-aktivitet
- Notification til co-GM via email/Supabase Edge Functions

### 7. Andre blinde vinkler ikke tænkt på

**Mobil-oplevelse:**
- Spillere stemmer fra mobil (vigtigt!) — responsive vote-UI er MVP
- GM bruger typisk laptop — admin panel behøver ikke mobiloptimeres i Sprint 4

**Store teams (20+ i samme session):**
- Supabase Realtime håndterer ~200 concurrent connections per kanal
- Over 50 brugere: overvej "audience mode" (observer-only) frem for aktiv spiller

**Tidszoner:**
- Sessions har start-tid — gem altid UTC, vis lokaltid i UI
- Internationalt teams: `sessions.timezone` felt til visning

**Session-templates:**
- GMs vil genbruge setups. `session_templates` tabel fra start.
- "Gem som template" knap i session-opsætning

**Webhook / notifikationer:**
- Teams bruger Slack/Teams → webhook integration fra start (session invite, session resultat)
- Implementér i Sprint 6+, men design schema nu

**Rate limiting:**
- En spiller bør ikke kunne sende 100 stemmer i sekundet
- Application-layer: én aktiv stemme per `(session_id, item_id, user_id)`

**Audit log (Enterprise):**
- Hvem ændrede hvad hvornår i admin panel
- `audit_log` tabel fra start (skriv til den, brug den i Enterprise plan)

**Observer/viewer rolle:**
- Kunder, stakeholders, Product Owner vil følge med uden at stemme
- Separate "invite as observer" link
- Observers ser live data men kan ikke stemme

---

## B. ADMIN PANEL — SITEMAP

### Rolle-hierarki
```
org_owner > org_admin > team_admin > game_master > player > observer
```

---

### B1. IT-Admin / Org Owner Panel

```
/admin
├── Dashboard
│   ├── Aktive sessions akkurat nu
│   ├── Teams overblik (antal, sidste aktivitet)
│   ├── Bruger-statistik (MAU, avg session tid)
│   └── Plan + forbrug (seats, sessions denne måned)
│
├── Teams
│   ├── Team-liste (navn, medlemmer, seneste session)
│   ├── [Opret team]
│   └── [Team] → detailside
│       ├── Medlemmer + roller
│       ├── Velocity-historik (graf)
│       └── Sessions-historik
│
├── Brugere
│   ├── Bruger-liste (email, rolle, last login)
│   ├── [Inviter bruger] (email + rolle)
│   └── [Bruger] → tildel/fjern teams, skift rolle, slet
│
├── Indhold (Niveau 1 customization)
│   ├── Custom Challenges (Roulette)
│   │   ├── Org-specifikke challenges (CRUD)
│   │   └── Preview: "Sæt 'SAP-integration er involveret' som challenge"
│   ├── Custom Events (Retro)
│   │   ├── Org-specifikke events (CRUD)
│   │   └── Kategorier: well/wrong/improve/surprise
│   └── Sprog & Brand
│       ├── Display-sprog (da/en)
│       ├── Boss-navne til egne projects
│       └── (Sprint 6+) Logo + farvetema
│
├── Integrationer (Sprint 10+)
│   ├── Jira (OAuth)
│   ├── Azure DevOps
│   └── Webhooks (Slack, Teams)
│
├── Billing
│   ├── Nuværende plan
│   ├── Fakturerings-historik
│   └── Opgradér / ændr plan (Stripe portal)
│
└── Indstillinger
    ├── Org-navn, slug
    ├── Data retention (måneder)
    ├── GDPR: Eksportér / slet al data
    └── SSO (Enterprise only)
```

---

### B2. Scrum Master / Game Master Panel

```
/app
├── Mine sessions
│   ├── Kommende (draft + scheduled)
│   ├── Aktive (resume-knap)
│   └── Historik (resultater, export)
│
├── [Opret session] — WIZARD (se afsnit C)
│
├── [Session] — Forberedelse
│   ├── Items (backlog-opgaver)
│   │   ├── Import fra Jira/ADO (Sprint 10+)
│   │   └── Manuel tilføjelse (titel, beskrivelse, URL)
│   ├── Game modes (vælg hvilke nodes/modes)
│   ├── Custom challenges (override default)
│   ├── Deltagere (invitér link + roller)
│   └── Agenda (rækkefølge + tidsallokering)
│
├── [Session] — Live GM-view
│   ├── Deltager-status (online / offline / har stemt)
│   ├── Live vote-fordeling (skjult for spillere)
│   ├── Kontroller (reveal, næste item, stop session)
│   ├── Nuværende item (titel, beskrivelse)
│   └── Chat/noter til egne noter
│
└── [Session] — Afslutning
    ├── Summary (alle items + konsensus-estimat)
    ├── Velocity-delta (estimat vs. historik)
    ├── Export (CSV, Jira push, copy-paste)
    └── XP + achievements uddelt
```

---

### B3. Spiller-view

```
/play/:sessionCode
├── Lobby (venter på GM starter)
│   ├── Avatar-visning (alle deltagere)
│   └── Session-info (navn, items-count)
│
├── Aktiv session (game canvas — eksisterende UI)
│   ├── Stem (Planning Poker kort)
│   ├── Boss battle animationer
│   ├── Achievements unlock
│   └── XP gain
│
└── Profil (/profile)
    ├── Avatar + equipment
    ├── XP + level
    ├── Achievements (unlocked/locked)
    └── Session-historik (mine stemmer)
```

---

### B4. Observer/Viewer

```
/watch/:sessionCode
├── Read-only live view
│   ├── Aktive deltagere (anonyme avatarer)
│   ├── Nuværende item titel
│   ├── Aggregate vote (kun efter reveal)
│   └── Boss HP bar
└── Session summary (efter afslutning)
```

---

## C. GAME MASTER FLOW — TRIN FOR TRIN

### C1. Forberedelse (før session starter)

```
Trin 1: Opret session
  → Navn: "Sprint 14 Planning"
  → Tilknyt team: "Platform Team"
  → Session type: Estimation / Scope / Retro
  → Dato/tid (valgfri — kan startes ad hoc)

Trin 2: Tilføj items
  → Manuel: Titel + beskrivelse + URL (Jira-link)
  → Import (Sprint 10): Jira JQL query → hent sprint backlog
  → AI-assistent (Sprint 11): "Forbedre beskrivelse" knap per item

Trin 3: Konfigurér game modes
  → Vælg node-rækkefølge (Poker → Roulette → Boss → Checkpoint)
  → Override standard challenges med org-custom eller session-custom
  → Sæt tidsbegrænsning per item (valgfri)

Trin 4: Invitér team
  → Kopier session-link (unikt join-code)
  → Send til team (Slack/Teams/email — manuelt i Sprint 4)
  → Sæt roller: hvem er players, hvem er observers

Trin 5: Preview
  → GM kan gennemgå session som "dry run"
  → Check: alle items har titler, modes er sat op korrekt
```

### C2. Under session (live)

```
GM-kontrolpanel:
  - "Start session" → broadcaster state til alle clients via Supabase Realtime
  - Item-kontrol: [Næste] [Forrige] [Skip]
  - Vote-kontrol: [Reveal stemmer] (skjult indtil GM revealer)
  - Se live: hvem har stemt (grønt ikon), hvem venter (grå)
  - Override: GM kan sætte endeligt estimat manuelt
  - Pause: session pauses (timer stopper, spillere ser "pause"-screen)
  - Abort item: spring over, mark som "diskuteret separat"

Live-data GM ser (spillere ser det IKKE før reveal):
  - Stem-fordeling histogram
  - Konfidensscorer
  - Hvem outlier (stemt ekstrem value)
  - Tid brugt på dette item
```

### C3. Session slutter

```
Automatisk afslutning:
  - Alle items gennemgået → "Afslut session"-prompt til GM
  - GM bekræfter → state = 'completed'

Session-summary genereres:
  - Per item: konsensus-estimat (median/mode), konfidenssnit, outlier-noter
  - Team-statistik: avg stemme-tid, konfidensfordeling, achievements earned
  - Velocity: estimeret total vs. team historik

XP uddeling:
  - Alle deltagere får XP (tilstedeværelse + konsensus-bonus + achievements)
  - Supabase Edge Function håndterer XP-beregning

Export-muligheder (Sprint 4 MVP):
  - Copy-paste tabel (estimater per item)
  - CSV download
  (Sprint 10+: Jira push, Azure DevOps update)

Arkivering:
  - Session status → 'completed'
  - State snapshot fastfrosset
  - Tilgængeligt i historik i 12 måneder (default, konfigurerbart)
```

---

## D. AI-ASSISTENT — HVAD GIVER MENING

### D1. Konkrete use cases (prioriteret)

**Sprint 11 scope (begræns AI til disse):**

**1. Item-formulering (lav risiko, høj værdi)**
> "Hjælp mig med at skrive en bedre opgavebeskrivelse"
- Input: rå titel fra GM
- Output: struktureret beskrivelse med acceptancekriterier
- Trigger: knap per item i session-forberedelse
- Max: 3 AI-kald per session (cost-control)

**2. Duplikat-detektion (lav risiko, medium værdi)**
> "Disse 3 opgaver ligner hinanden — overvej at slå dem sammen"
- Sammenligner item-titler + beskrivelser via embedding similarity
- Vises som advarsel, ikke auto-handling
- GM beslutter selv

**3. Estimat-forventning baseret på historik**
> "Baseret på jeres velocity: denne type opgave estimeres typisk 5-8 point"
- Kræver: minimum 10 sessions i historik for pålideligt signal
- Vises EFTER GM har tilføjet item, FØR session startes
- Formål: kalibrering, ikke fastsættelse

**4. Retro-insight (post-session)**
> "Jeres team har haft 'Scope Creep' i 4 af 5 sprints — overvej at adressere dette"
- Pattern-match på session-historik
- Præsenteres i session-summary som "AI-observation"
- Aldrig i selve sessionen (distraherer)

**5. Challenge-anbefaling**
> "Baseret på jeres projekt (SAP-integration) anbefaler vi disse challenges"
- Matcher org-custom challenges med item-kategorier
- Ren regel-baseret + AI-ranking

### D2. Hvad AI IKKE må gøre

- ❌ **Fastsætte estimater** — teamet ejer konsensus. Altid.
- ❌ **Vise AI-forslag under selve stemme-fasen** — anchoring bias er reelt og farligt
- ❌ **Auto-merge items** — GM beslutter. AI advarer.
- ❌ **Kommentere på individuelle spilleres stemmer** — "Du stemmer altid lavt" er giftig
- ❌ **Erstatte facilitator** — AI er lifeline, ikke lead
- ❌ **Gemme stemmedata til AI-træning** — GDPR + trust-problem

### D3. Risici ved AI

- **Anchoring:** AI-forslag FØR afstemning forurener resultater. Løsning: AI vises KUN til GM, aldrig til spillere, og kun i forberedelse/post-session.
- **Trust erosion:** Hvis AI "altid har ret", holder teamet op med at tænke selv.
- **Cost:** GPT-4/Claude kald per session er dyre. Rate limit + caching er nødvendigt.
- **GDPR:** Stemmedata må ikke sendes til tredjeparts LLM API uden DPA. Anonymisér inden kald.

---

## E. DATABASE SCHEMA — KOMPLET SQL

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS (tenant root)
-- ============================================================
create table organizations (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text not null unique,
  plan          text not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  language      text not null default 'da',
  data_retention_months int not null default 12,
  custom_boss_names jsonb default '{}',    -- {"project_slug": "Boss Name"}
  brand_settings jsonb default '{}',       -- {logo_url, primary_color} — Sprint 6+
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_orgs_slug on organizations(slug);

-- RLS: org members can read own org. Only service_role writes.
alter table organizations enable row level security;
create policy "org_members_read" on organizations
  for select using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- ORGANIZATION MEMBERS (user ↔ org)
-- ============================================================
create table organization_members (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'player'
                  check (role in ('org_owner','org_admin','team_admin','game_master','player','observer')),
  invited_by      uuid references auth.users(id),
  joined_at       timestamptz not null default now(),
  unique(organization_id, user_id)
);

create index idx_org_members_user on organization_members(user_id);
create index idx_org_members_org on organization_members(organization_id);

alter table organization_members enable row level security;
-- Members can see other members in same org
create policy "org_members_see_each_other" on organization_members
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
-- Only org_admin/org_owner can insert/update/delete
create policy "org_admin_manage_members" on organization_members
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('org_owner','org_admin')
    )
  );

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_class    text default 'warrior',     -- warrior/mage/archer/healer/rogue/berserker/necro
  skin_color      text default '#fdd',
  helmet_id       text default 'h0',
  armor_id        text default 'a0',
  boots_id        text default 'b0',
  weapon_id       text default 'w0',
  amulet_id       text default 'm0',
  xp              int not null default 0,
  level           int not null default 1,
  gdpr_anonymized boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table profiles enable row level security;
-- Public read (display name + avatar for session participants)
create policy "profiles_public_read" on profiles
  for select using (true);
-- User can update own profile
create policy "profiles_own_write" on profiles
  for update using (id = auth.uid());

-- ============================================================
-- TEAMS
-- ============================================================
create table teams (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  velocity_data   jsonb default '[]',   -- [{sprint, estimated, actual, date}]
  settings        jsonb default '{}',   -- team-specific overrides
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_teams_org on teams(organization_id);

alter table teams enable row level security;
create policy "team_members_read" on teams
  for select using (
    id in (
      select team_id from team_members where user_id = auth.uid()
    )
  );
create policy "team_admin_write" on teams
  for all using (
    id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('team_admin','game_master')
    )
  );

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
create table team_members (
  id         uuid primary key default uuid_generate_v4(),
  team_id    uuid not null references teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'player'
             check (role in ('team_admin','game_master','player','observer')),
  joined_at  timestamptz not null default now(),
  unique(team_id, user_id)
);

create index idx_team_members_user on team_members(user_id);
create index idx_team_members_team on team_members(team_id);

alter table team_members enable row level security;
create policy "team_members_see_each_other" on team_members
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

-- ============================================================
-- ROOMS (persistent game rooms)
-- ============================================================
create table rooms (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,
  room_type   text not null default 'estimation'
              check (room_type in ('estimation','scope','retro')),
  config      jsonb default '{}',    -- default modes, challenge overrides
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index idx_rooms_team on rooms(team_id);

alter table rooms enable row level security;
create policy "room_team_members_read" on rooms
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

-- ============================================================
-- SESSIONS
-- ============================================================
create table sessions (
  id                uuid primary key default uuid_generate_v4(),
  room_id           uuid references rooms(id) on delete set null,
  team_id           uuid not null references teams(id) on delete cascade,
  game_master_id    uuid not null references auth.users(id),
  co_game_master_id uuid references auth.users(id),
  name              text not null,
  description       text,
  session_type      text not null default 'estimation'
                    check (session_type in ('estimation','scope','retro')),
  status            text not null default 'draft'
                    check (status in ('draft','waiting','active','paused','interrupted','completed','abandoned')),
  join_code         text not null unique default substr(md5(random()::text), 1, 8),
  observer_join_code text unique default substr(md5(random()::text), 1, 8),
  node_sequence     jsonb default '[]',   -- [{type, mode_config}]
  custom_challenges jsonb default null,   -- override org/team challenges
  custom_events     jsonb default null,   -- override org/team retro events
  state_snapshot    jsonb default '{}',   -- full restorable state
  current_item_id   uuid,                 -- FK added after session_items
  timezone          text default 'Europe/Copenhagen',
  scheduled_at      timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_sessions_team on sessions(team_id);
create index idx_sessions_gm on sessions(game_master_id);
create index idx_sessions_join_code on sessions(join_code);
create index idx_sessions_status on sessions(status);

alter table sessions enable row level security;
-- Team members can see sessions for their team
create policy "session_team_read" on sessions
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );
-- GM + co-GM can update
create policy "session_gm_update" on sessions
  for update using (
    game_master_id = auth.uid() or co_game_master_id = auth.uid()
  );
-- Team admin/GM can create
create policy "session_create" on sessions
  for insert with check (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('team_admin','game_master')
    )
  );

-- ============================================================
-- SESSION PARTICIPANTS (join tracking)
-- ============================================================
create table session_participants (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'player'
                check (role in ('game_master','player','observer')),
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  is_online     boolean default false,
  unique(session_id, user_id)
);

create index idx_session_participants_session on session_participants(session_id);
create index idx_session_participants_user on session_participants(user_id);

alter table session_participants enable row level security;
create policy "session_participants_read" on session_participants
  for select using (
    session_id in (
      select id from sessions
      where team_id in (select team_id from team_members where user_id = auth.uid())
    )
  );
create policy "session_participants_self_write" on session_participants
  for all using (user_id = auth.uid());

-- ============================================================
-- SESSION ITEMS (backlog items for a session)
-- ============================================================
create table session_items (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references sessions(id) on delete cascade,
  title        text not null,
  description  text,
  external_url text,           -- Jira/ADO link
  external_id  text,           -- Jira issue key e.g. "PROJ-123"
  item_order   int not null default 0,
  status       text not null default 'pending'
               check (status in ('pending','active','skipped','completed')),
  final_estimate text,         -- GM-confirmed estimate (could be "5", "L", "XL", etc.)
  notes        text,           -- GM notes post-discussion
  created_at   timestamptz not null default now()
);

create index idx_session_items_session on session_items(session_id);
create index idx_session_items_order on session_items(session_id, item_order);

alter table session_items enable row level security;
create policy "session_items_team_read" on session_items
  for select using (
    session_id in (
      select id from sessions
      where team_id in (select team_id from team_members where user_id = auth.uid())
    )
  );

-- Add FK for current_item_id now that session_items exists
alter table sessions
  add constraint fk_current_item
  foreign key (current_item_id) references session_items(id) on delete set null;

-- ============================================================
-- VOTES
-- ============================================================
create table votes (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references sessions(id) on delete cascade,
  session_item_id uuid not null references session_items(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete set null,
  value           text not null,          -- "1","2","3","5","8","13","21","?","☕"
  confidence      int check (confidence between 1 and 5),
  round           int not null default 1, -- re-vote tracking
  submitted_at    timestamptz not null default now(),
  unique(session_id, session_item_id, user_id, round)
);

create index idx_votes_session on votes(session_id);
create index idx_votes_item on votes(session_item_id);
create index idx_votes_user on votes(user_id);

alter table votes enable row level security;
-- User can see OWN votes always
create policy "votes_own_read" on votes
  for select using (user_id = auth.uid());
-- GM sees all votes in their sessions
create policy "votes_gm_read" on votes
  for select using (
    session_id in (
      select id from sessions
      where game_master_id = auth.uid() or co_game_master_id = auth.uid()
    )
  );
-- After reveal: all session participants can see (handle via RPC/function)
-- Insert: session participant
create policy "votes_insert" on votes
  for insert with check (
    user_id = auth.uid()
    and session_id in (
      select session_id from session_participants where user_id = auth.uid()
    )
  );

-- ============================================================
-- ACHIEVEMENTS (global catalog)
-- ============================================================
create table achievements (
  id           uuid primary key default uuid_generate_v4(),
  key          text not null unique,   -- "first_blood", "consensus_master", etc.
  name         text not null,
  description  text,
  icon         text,
  xp_reward    int not null default 50,
  rarity       text default 'common'
               check (rarity in ('common','rare','epic','legendary')),
  condition    jsonb not null default '{}'  -- {type: "vote_count", threshold: 10}
);

-- No RLS needed — public catalog
alter table achievements enable row level security;
create policy "achievements_public_read" on achievements for select using (true);

-- ============================================================
-- USER ACHIEVEMENTS (unlocked)
-- ============================================================
create table user_achievements (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  session_id     uuid references sessions(id) on delete set null,
  unlocked_at    timestamptz not null default now(),
  unique(user_id, achievement_id)
);

create index idx_user_achievements_user on user_achievements(user_id);

alter table user_achievements enable row level security;
create policy "user_achievements_own_read" on user_achievements
  for select using (user_id = auth.uid());
create policy "user_achievements_session_read" on user_achievements
  for select using (
    session_id in (
      select session_id from session_participants where user_id = auth.uid()
    )
  );

-- ============================================================
-- WORLDS (overworld per team)
-- ============================================================
create table worlds (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,        -- "Platform Team"
  sprint_name text,                 -- "Sprint 14"
  icon        text default '⚔️',
  color       text default '#38b764',
  boss_icon   text default '👾',
  sky_color   text,
  grass_color text,
  dirt_color  text,
  status      text not null default 'active'
              check (status in ('active','completed','archived')),
  created_at  timestamptz not null default now()
);

create index idx_worlds_team on worlds(team_id);

alter table worlds enable row level security;
create policy "worlds_team_read" on worlds
  for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

-- ============================================================
-- WORLD NODES
-- ============================================================
create table world_nodes (
  id         uuid primary key default uuid_generate_v4(),
  world_id   uuid not null references worlds(id) on delete cascade,
  x          int not null,
  y          int not null,
  node_type  text not null check (node_type in ('s','p','r','q','c','b','bf','pp','sw','rn','ss')),
  label      text not null,
  node_order int not null default 0,
  session_id uuid references sessions(id) on delete set null,
  is_current boolean default false,
  created_at timestamptz not null default now()
);

create index idx_world_nodes_world on world_nodes(world_id);

alter table world_nodes enable row level security;
create policy "world_nodes_team_read" on world_nodes
  for select using (
    world_id in (
      select id from worlds
      where team_id in (select team_id from team_members where user_id = auth.uid())
    )
  );

-- ============================================================
-- NODE COMPLETIONS
-- ============================================================
create table node_completions (
  id           uuid primary key default uuid_generate_v4(),
  node_id      uuid not null references world_nodes(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid references sessions(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique(node_id, user_id)
);

create index idx_node_completions_user on node_completions(user_id);

alter table node_completions enable row level security;
create policy "node_completions_own_read" on node_completions
  for select using (user_id = auth.uid());
create policy "node_completions_team_read" on node_completions
  for select using (
    node_id in (
      select id from world_nodes
      where world_id in (
        select id from worlds
        where team_id in (select team_id from team_members where user_id = auth.uid())
      )
    )
  );

-- ============================================================
-- CUSTOM CHALLENGES (org-level Niveau 1)
-- ============================================================
create table custom_challenges (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade, -- NULL = org-wide
  cat             text not null check (cat in ('human','tech','extern','custom')),
  icon            text not null,
  title           text not null,
  description     text not null,
  modifier        numeric(3,1) not null default 1.0,
  color           text default '#feae34',
  is_active       boolean default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index idx_custom_challenges_org on custom_challenges(organization_id);
create index idx_custom_challenges_team on custom_challenges(team_id);

alter table custom_challenges enable row level security;
create policy "custom_challenges_org_read" on custom_challenges
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
create policy "custom_challenges_admin_write" on custom_challenges
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('org_owner','org_admin','team_admin')
    )
  );

-- ============================================================
-- CUSTOM EVENTS (retro events, org-level)
-- ============================================================
create table custom_events (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade,
  cat             text not null check (cat in ('well','wrong','improve','surprise')),
  icon            text not null,
  title           text not null,
  description     text not null,
  dmg             int,     -- damage dealt to boss (positive outcome)
  hp              int,     -- HP removed from team (negative outcome)
  is_active       boolean default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index idx_custom_events_org on custom_events(organization_id);

alter table custom_events enable row level security;
create policy "custom_events_org_read" on custom_events
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- SESSION TEMPLATES
-- ============================================================
create table session_templates (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade,
  name            text not null,
  description     text,
  session_type    text not null,
  node_sequence   jsonb default '[]',
  default_items   jsonb default '[]',    -- [{title, description}]
  custom_challenges jsonb default null,
  is_public       boolean default false, -- org-wide template
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table session_templates enable row level security;
create policy "session_templates_read" on session_templates
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- AUDIT LOG (enterprise feature, write always)
-- ============================================================
create table audit_log (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  action          text not null,           -- "session.created", "member.removed", etc.
  target_type     text,                    -- "session", "team", "member"
  target_id       uuid,
  metadata        jsonb default '{}',
  ip_address      inet,
  created_at      timestamptz not null default now()
);

create index idx_audit_log_org on audit_log(organization_id);
create index idx_audit_log_user on audit_log(user_id);
create index idx_audit_log_created on audit_log(created_at desc);

-- Audit log: users can read their own actions; org_admin reads all in org
alter table audit_log enable row level security;
create policy "audit_log_own_read" on audit_log
  for select using (user_id = auth.uid());
create policy "audit_log_admin_read" on audit_log
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('org_owner','org_admin')
    )
  );
-- Only service_role inserts audit log
create policy "audit_log_service_insert" on audit_log
  for insert with check (false); -- block client-side; use service_role only

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Session summary view (for GM dashboard)
create view session_summary as
select
  s.id,
  s.name,
  s.status,
  s.session_type,
  s.join_code,
  s.started_at,
  s.ended_at,
  s.game_master_id,
  t.name as team_name,
  count(distinct sp.user_id) as participant_count,
  count(distinct si.id) as item_count,
  count(distinct si.id) filter (where si.status = 'completed') as items_completed
from sessions s
join teams t on t.id = s.team_id
left join session_participants sp on sp.session_id = s.id
left join session_items si on si.session_id = s.id
group by s.id, t.name;

-- Vote aggregate view (ONLY revealed data — enforce in application layer)
create view vote_aggregates as
select
  v.session_id,
  v.session_item_id,
  v.round,
  count(*) as vote_count,
  mode() within group (order by v.value) as consensus_value,
  avg(v.confidence) as avg_confidence,
  jsonb_agg(jsonb_build_object('value', v.value, 'count', count(*)))
    over (partition by v.session_id, v.session_item_id, v.round) as distribution
from votes v
group by v.session_id, v.session_item_id, v.round, v.value;
```

---

## F. PRIORITERET IMPLEMENTERINGSPLAN — SPRINT 4

### Sprint 4 MVP definition
**"Rigtig multiplayer med admin"** = GM kan oprette session, invitere team, køre Planning Poker live med realtime stemmer, og se resultater efter.

---

### Uge 1 — Foundation (Dag 1-5)

**Dag 1-2: Supabase setup**
- [ ] Opret nyt Supabase projekt (ikke madro.ai's)
- [ ] Kør komplet schema SQL (ovenfor)
- [ ] Seed: default achievements (10 stk), demo org + team
- [ ] Konfigurér Google OAuth i Supabase dashboard
- [ ] `.env` filer: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Dag 3-4: Auth flow**
- [ ] Login-side (Google OAuth + email magic link)
- [ ] Avatar Creator → gemmer til `profiles` table
- [ ] Auth guard (redirect til login hvis ikke autentificeret)
- [ ] Profile-fetch ved app-start

**Dag 5: Realtime test**
- [ ] Proof-of-concept: én kanal, to browsers, én sender besked
- [ ] Dokumentér channel-navngivning: `session:{session_id}`

---

### Uge 2 — Multiplayer Core (Dag 6-10)

**Dag 6-7: Session oprettelse**
- [ ] Enkel session-oprettelse (navn, type, tilknyt team)
- [ ] Tilføj items manuelt (CRUD)
- [ ] Generer join_code automatisk
- [ ] Session gemmes i `sessions` table med status `draft`

**Dag 8-9: Realtime multiplayer**
- [ ] Spiller joiner via join_code → `session_participants` insert
- [ ] Realtime channel: `presence` tracking (hvem er online)
- [ ] GM sender `{type: 'session_state', payload: {...}}` events
- [ ] Spiller modtager og rendrer state
- [ ] Vote submission → `votes` table insert + broadcast til GM

**Dag 10: Vote reveal**
- [ ] GM trykker "Reveal" → Supabase function eller direct broadcast
- [ ] Alle klienter viser stemmer
- [ ] GM sætter `final_estimate` på item
- [ ] Næste item flow

---

### Uge 3 — Admin Panel v1 (Dag 11-15)

**Dag 11-12: GM Dashboard**
- [ ] `/admin` route (kun game_master+ kan tilgå)
- [ ] Mine sessions (liste: draft/active/completed)
- [ ] Opret session-wizard (3 trin: info → items → preview)
- [ ] Invitations-link (copy join_code)

**Dag 13-14: Live GM View**
- [ ] Deltager-status grid (online/stemte/venter)
- [ ] Live histogram over modtagne stemmer (hidden for spillere)
- [ ] Kontroller: Reveal, Næste item, Pause, Afslut

**Dag 15: Session afslutning**
- [ ] Status → `completed` ved afslutning
- [ ] Summary-side: items + estimater + deltager-liste
- [ ] CSV export (simpel JSON → download)

---

### Uge 4 — Polish + Integration (Dag 16-20)

**Dag 16-17: Persistence**
- [ ] XP-beregning ved session-afslutning (Supabase Edge Function eller client-side)
- [ ] Achievement-check + unlock
- [ ] Overworld node-completion gemmes
- [ ] Avatar persistence ved login (genindlæs fra `profiles`)

**Dag 18: Org + Team admin**
- [ ] Opret/edit team (team admin only)
- [ ] Invite user til team (send link)
- [ ] Roller-tildeling (UI)

**Dag 19: Error states + fallback**
- [ ] Realtime disconnect detection + polling fallback
- [ ] Session crash recovery (load from `state_snapshot`)
- [ ] "GM er offline" advarsel til spillere

**Dag 20: QA + deploy**
- [ ] End-to-end test: signup → create session → play → results
- [ ] Deploy til Nordicway (statiske filer)
- [ ] Supabase RLS policy audit
- [ ] GDPR check: ingen persondata i logs

---

### Sprint 4 — Ikke med (gem til Sprint 5+)

| Feature | Sprint |
|---------|--------|
| Org-level custom challenges UI | 5 |
| Team velocity tracking | 5 |
| Bluff Poker mode | 5 |
| Session templates | 6 |
| Slack/Teams webhooks | 6 |
| Jira import | 10 |
| AI lifelines | 11 |
| Billing/Stripe | Post-MVP |
| SSO (Enterprise) | Post-MVP |
| GDPR data export UI | Post-MVP |

---

### Supabase Realtime Channel-design (reference)

```
Channel: session:{session_id}
Events:
  GM → Players:
    - session_started       {items, current_item_id, node_sequence}
    - item_changed          {item_id, title, description}
    - votes_revealed        {votes: [{user_id, value, confidence}]}
    - item_completed        {item_id, final_estimate}
    - session_ended         {summary_url}
    - session_paused        {}
    - gm_heartbeat          {timestamp}  ← hvert 30s, mangler = GM offline

  Players → GM (via Supabase DB insert + Realtime):
    - vote_submitted        → insert to votes table (GM listens to DB changes)
    - presence_update       → Supabase presence built-in

Channel: session:{session_id}:gm
  → Kun GM lytter. Modtager vote-aggregater løbende.
```

---

*Genereret: 2026-03-18*
*Projekt: Reveal v0.3 → Sprint 4*
*Fil: /root/.openclaw/workspace/projects/reveal/SPRINT4-PLAN.md*
