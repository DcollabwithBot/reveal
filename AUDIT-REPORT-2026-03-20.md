# REVEAL — Full Audit + Architecture Plan
**Dato:** 2026-03-20
**Auditor:** Senior Architect (Claude Opus)
**Scope:** app/src/screens/ + app/src/components/ + hooks + lib + shared

---

## TL;DR

**54 findings** fordelt: 12 HIGH, 22 MED, 20 LOW.
Største problemer:
1. Game-laget (Session, Overworld, WorldSelect) er 100% hardcoded — ingen DB-kobling overhovedet
2. Game widget i sidebar har hardcoded "Team Level 7", XP, streak — aldrig fra DB
3. RetroScreen har en React hook-violation der crasher i strict mode
4. "Export sprint rapport" og "Accept → Næste sprint" knapper gør ingenting
5. Session.jsx gemmer INTET til DB — hverken votes, XP eller achievements

---

## DEL 1: AUDIT

### A) Hardcoded værdier der burde komme fra DB

| # | FIL | LINJE | PROBLEM | PRIORITET |
|---|-----|-------|---------|-----------|
| A1 | AppShell.jsx | 188-194 | Game widget: "Team Level 7", "2,840 / 4,200 XP", "68%" width, "Lv.8", "🔥 4" streak — alt hardcoded, intet fra DB | HIGH |
| A2 | Overworld.jsx | 97 | XP display: `⭐1240` hardcoded i topbar | HIGH |
| A3 | Overworld.jsx | 99-100 | Progress bar bruger `project.prog/project.tot` — men det kommer fra WORLDS-konstant, ikke fra DB | HIGH |
| A4 | constants.js | WORLDS[] | Alle 3 worlds er 100% statiske: team-navne, sprint-navne, nodes, progression, boss-typer. Intet fra DB. | HIGH |
| A5 | WorldSelect.jsx | NPC_DEFS | "Mia", "Jonas", "Sara", "Emil" — hardcoded NPC-navne. Også i constants.js NPC_TEAM. | MED |
| A6 | Overworld.jsx | 66 | Belønning i node-popup: "+30 XP", "+50 XP", "+80 XP" hardcoded baseret på node-type | MED |
| A7 | Overworld.jsx | 59-60 | Tid i popup: "5m", "8m", "15m" hardcoded | LOW |
| A8 | Overworld.jsx | 57 | Sværhed i popup: "★", "★★", "★★★" hardcoded | LOW |
| A9 | RetroScreen.jsx | 225 | Achievement XP: `+{done.length * 20} XP` er client-side beregning, gemmes ikke i DB | MED |
| A10 | RetroScreen.jsx | 231 | Level progress: `Lv.{Math.floor(done.length / 3) + 4}` — pure client-side beregning, ikke persisteret | MED |
| A11 | ProjectWorkspace.jsx | 302-310 | "Zero blocker sprint" challenge XP "+80 XP" — hardcoded, ikke fra projection config | LOW |
| A12 | ProjectWorkspace.jsx | 293 | Side Quests XP: `+{Math.max(30, Math.round((item.estimated_hours || 8) * 4))} XP` — client-only | LOW |
| A13 | TimelogScreen.jsx | 191 | hourly_rate: `1200` hardcoded — burde komme fra projekt/org-config | MED |
| A14 | TimelogScreen.jsx | 251 | km-sats: `3.76` hardcoded — burde komme fra org config | LOW |
| A15 | Landing.jsx | footer | `{new Date().getFullYear()}` — dette er OK, men copyright text er hardcoded | LOW |

### B) Broken/Dead funktioner

| # | FIL | LINJE | PROBLEM | PRIORITET |
|---|-----|-------|---------|-----------|
| B1 | RetroScreen.jsx | 268 | "Accept → Næste sprint" knap: `onClick={() => {/* future: create task from note */}}` — tom handler, gør ingenting | HIGH |
| B2 | RetroScreen.jsx | 283 | "Export sprint rapport" knap: ingen onClick handler overhovedet — dead button | HIGH |
| B3 | RetroScreen.jsx | 254-264 | **React hooks violation:** `useState` kaldt INDE i en callback/render-funktion (IIFE med `const [dismissed, setDismissed] = useState([])`). Crasher i React strict mode, er ulovlig hook-brug. | HIGH |
| B4 | Session.jsx | hele filen | Session gemmer INTET til DB: votes, final_estimate, XP, achievements, boss-outcome — alt forsvinder ved page refresh | HIGH |
| B5 | Session.jsx | ~22 | `useSessionOrchestration` importeres men variablen `orchestration` refereres uden at være deklareret (linje ~60+). Koden kalder `orchestration.flash()`, `orchestration.shake()`, `orchestration.runNpcAttackSequence()` og `orchestration.runRevealCountdown()` men hook-kald mangler i komponent-body. | HIGH |
| B6 | Session.jsx | ~22 | `setBossHp`, `setBossBattleHp` bruges direkte men er ikke deklareret — reduceren bruger `dispatchFlow` med merge, men direkte setter-kald til `setBossHp(h => ...)` vil fejle. | HIGH |
| B7 | Session.jsx | ~14 | `projectApprovalOverlay` funktionen bruges men er ikke importeret eller defineret i filen | MED |
| B8 | Session.jsx | ~14 | `CLASSES` bruges i TEAM-array men importeres ikke fra constants | MED |
| B9 | Session.jsx | ~14 | `maxHp` bruges som argument til `createInitialSessionFlowState` men er defineret EFTER via `projectBossEncounter()` — temporal dead zone | MED |
| B10 | TeamKanban.jsx | 306-307 | "Jira —" og "TopDesk —" SyncChips — rendered men har ingen funktionalitet | LOW |
| B11 | Landing.jsx | 12-21 | `joinSessionByCode` API-kald — finder sessions med `join_code`, men der er ingen UI-feedback for hvad sker efter join (det kalder `onJoinSession(session)` men Landing modtager det bare som callback) | MED |
| B12 | Lobby.jsx | 49 | "SPIL SOM GÆST" — kalder `onGuest` som sætter `authScreen = "game"` men gæste-data gemmes aldrig (ingen session tracking for uautoriserede brugere) | MED |
| B13 | lib/api.js | getSprintItems | `select()` henter IKKE `item_status` feltet — kun `status`, `estimated_hours`, `hours_fak` osv. Men ProjectWorkspace filtrerer på `item_status`. Feltet mangler i select. | HIGH |

### C) Links/navigation der går galt

| # | FIL | LINJE | PROBLEM | PRIORITET |
|---|-----|-------|---------|-----------|
| C1 | App.jsx | hele | Ingen URL-routing for `/retro`, `/teamkanban`, `/game` — kun `syncAuthScreenFromPath` håndterer `/dashboard`, `/settings`, `/projects/:id`, `/projects/:id/timelog`. Deep link til `/retro` vil falde igennem til lobby. | HIGH |
| C2 | AppShell.jsx | Timelog nav | Sidebar har "Timelog" nav-item men `onNavigate('timelog')` uden projectId — TimelogScreen kræver `projectId` prop. Klik på sidebar-Timelog = blank/fejl. | MED |
| C3 | RetroScreen.jsx | 280 | `onNavigate('game')` — virker korrekt i App.jsx's `handleShellNavigate` | LOW |
| C4 | App.jsx | popstate | Browser back-button virker kun for `/dashboard`, `/settings`, `/projects/:id`, `/projects/:id/timelog` — alle andre screens har ingen URL-state | MED |
| C5 | Overworld.jsx | onNode | Kalder `onNode(nodeToEnter)` som i App.jsx sætter `node` og `screen = "session"` — men session-state overlever ikke page refresh (ingen URL-params) | MED |
| C6 | App.jsx | /auth/callback | OAuth callback leder til lobby — men `syncAuthScreenFromPath` for `/auth/callback` falder igennem til lobby. Funky men virker. | LOW |

### D) Data der ikke opdaterer DB

| # | FIL | LINJE | PROBLEM | PRIORITET |
|---|-----|-------|---------|-----------|
| D1 | Session.jsx | hele | **Alle** useState-opdateringer (pv, votes, bossHp, combo, achievements, loot, confidence) er rent client-side. Intet gemmes i Supabase. | HIGH |
| D2 | ProjectWorkspace.jsx | handleDrop | `updateItem(draggingId, { item_status: targetStatus })` — opdaterer DB, men INGEN rollback ved fejl. Optimistisk update mangler rollback-logik. | MED |
| D3 | RetroScreen.jsx | "Dismiss" | `setDismissed(prev => [...prev, note.id])` — dismiss-state er pure client-side, forsvinder ved reload | LOW |
| D4 | Overworld.jsx | onComplete | Når en node markeres done: `setWorld(w => w ? { ...w, nodes: w.nodes.map(n => n.id === nodeId ? { ...n, dn: true } : n) } : w)` — dette er kun lokal state, gemmes aldrig i DB | MED |
| D5 | AvatarCreator.jsx | onDone | Avatar-valg (klasse, udstyr, skin) gemmes kun i komponent-state og sendes op som prop — aldrig persisteret i DB | MED |
| D6 | WorkspaceSettings.jsx | updateGameMode | GameMode-valg gemmes via context men kontrollér om `GameModeContext` persisterer til DB eller kun localStorage | LOW |
| D7 | AppShell.jsx | game widget | Streak "🔥 4" er hardcoded — men selv hvis den var dynamisk, er der intet streak-system i DB | MED |

---

## DEL 2: ARKITEKTUR — Kobling af PM → Game

### Flow A: Estimation Session

**NUVÆRENDE TILSTAND:**
- Session.jsx henter items via `useSessionData` hook som kalder `getProjectionConfig()` — dette henter `game_profiles`, `boss_profiles`, `reward_rules` og `achievement_definitions` fra DB
- Men de RIGTIGE items (session_items) hentes ALDRIG. Session.jsx opererer på hardcoded `WORLDS[x].nodes` fra constants.js
- Votes genereres client-side med `gv()` funktionen (tilfældige NPC-votes baseret på spillerens valg)
- Consensus/final_estimate gemmes ALDRIG
- XP beregnes i `buildRewardLoot()` men gemmes aldrig

**MANGLER:**
1. Ingen kobling mellem PM-session og game-session: Session.jsx ved ikke hvilken sprint/project der estimeres
2. Ingen hentning af session_items fra DB til estimation
3. Ingen persistering af votes eller final_estimate
4. Ingen XP-tildeling i DB efter session
5. Ingen realtime-synkronisering mellem spillere (hvert vindue er solo)

**KONKRET FIX:**
1. **Ny DB-tabel:** `estimation_sessions` (id, sprint_id, project_id, status, created_by, created_at)
2. **Ny DB-tabel:** `estimation_votes` (id, session_id, item_id, user_id, vote_value, round, created_at)
3. **Ændring i Session.jsx:**
   - Modtag `sprintId` som prop (fra App.jsx routing)
   - Kald `getSprintItems(sprintId)` ved mount
   - Iterér items som "bosses" i stedet for hardcoded nodes
   - Ved hver vote: `INSERT INTO estimation_votes`
   - Ved reveal: beregn final_estimate og `UPDATE session_items SET final_estimate = X`
4. **Ændring i App.jsx:**
   - Tilføj route `/sprints/:sprintId/estimate` → Session med rigtige items
5. **Ny API-funktion:** `saveEstimationResult(itemId, finalEstimate, votes[])`

**ESTIMAT:** Large (3-5 dage) — kræver ny DB-schema, realtime, og omskrivning af Session.jsx's item-flow

---

### Flow B: Done → XP

**NUVÆRENDE TILSTAND:**
- `closeItem(itemId)` i api.js opdaterer `item_status = 'done'` + `status = 'completed'`
- `updateItem(itemId, { item_status: targetStatus })` bruges ved drag-drop i kanban
- INGEN XP-tildeling sker — hverken client-side eller server-side
- Der eksisterer ingen `user_xp` eller `org_level` tabel
- `org_metrics` tabel eksisterer og kan holde aggregerede KPIs, men bruges kun til portfolio confidence / blocked counts

**MANGLER:**
1. Tabel for XP-tracking per user: `user_xp` (id, user_id, org_id, total_xp, level, updated_at)
2. Tabel for XP-transaktioner: `xp_transactions` (id, user_id, item_id, amount, reason, created_at)
3. Trigger/function: Når `item_status` sættes til `done` → beregn XP baseret på `estimated_hours` og indsæt i `xp_transactions`
4. Tabel for org-level: `org_level` (id, org_id, total_xp, level, next_level_xp, updated_at)

**KONKRET FIX:**
1. **Migration SQL:**
   ```sql
   CREATE TABLE user_xp (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id uuid REFERENCES auth.users(id),
     organization_id uuid REFERENCES organizations(id),
     total_xp integer DEFAULT 0,
     level integer DEFAULT 1,
     updated_at timestamptz DEFAULT now()
   );
   
   CREATE TABLE xp_transactions (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id uuid REFERENCES auth.users(id),
     organization_id uuid REFERENCES organizations(id),
     session_item_id uuid REFERENCES session_items(id),
     amount integer NOT NULL,
     reason text,
     created_at timestamptz DEFAULT now()
   );
   
   CREATE TABLE org_level (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     organization_id uuid REFERENCES organizations(id) UNIQUE,
     total_xp integer DEFAULT 0,
     level integer DEFAULT 1,
     next_level_xp integer DEFAULT 1000,
     updated_at timestamptz DEFAULT now()
   );
   ```
2. **Supabase Edge Function eller DB trigger:** `on INSERT INTO xp_transactions` → update `user_xp.total_xp` + `org_level.total_xp`
3. **Frontend:** Når item drag-droppes til Done i ProjectWorkspace/TeamKanban:
   - Beregn XP: `Math.max(10, Math.round(item.estimated_hours * 3))`
   - `INSERT INTO xp_transactions`
   - Vis XP-popup animation
4. **AppShell game widget:** Erstat hardcoded værdier med `SELECT * FROM org_level WHERE organization_id = X`

**ESTIMAT:** Medium (1-2 dage)

---

### Flow C: Sprint Close → Boss Battle outcome

**NUVÆRENDE TILSTAND:**
- RetroScreen.jsx henter sprint items fra `session_items` via Supabase
- RetroScreen viser retrospective board med noter (well/improve/action) via `retro_notes` tabel
- "Accept → Næste sprint" knap er TOM — gør ingenting
- Boss battle i Session.jsx (node type `tp === "b"`) viser BossRetroStage — men outcome (victory/defeat) gemmes ALDRIG
- Sprint status opdateres ALDRIG automatisk — der er ingen "close sprint" funktion
- Action-noter konverteres ALDRIG til session_items

**MANGLER:**
1. Sprint close-funktion: `UPDATE sprints SET status = 'completed', completed_at = now()`
2. Boss battle outcome persistering: ny tabel eller felt
3. Konvertering af action-noter til nye sprint items
4. Automatisk beregning af sprint-score (velocity, completion rate)
5. XP-tildeling ved sprint close

**KONKRET FIX:**
1. **Ny DB-tabel:** `sprint_outcomes` (id, sprint_id, boss_battle_result ['victory'|'defeat'], completion_rate, velocity, xp_earned, notes, created_at)
2. **Ny API-funktion:** `closeSprint(sprintId)`
   ```js
   async function closeSprint(sprintId) {
     // 1. Update sprint status
     await supabase.from('sprints').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sprintId);
     
     // 2. Beregn outcome
     const items = await getSprintItems(sprintId);
     const done = items.filter(i => i.item_status === 'done').length;
     const rate = items.length > 0 ? done / items.length : 0;
     const result = rate >= 0.8 ? 'victory' : 'defeat';
     
     // 3. Gem outcome
     await supabase.from('sprint_outcomes').insert({
       sprint_id: sprintId,
       boss_battle_result: result,
       completion_rate: rate,
       velocity: done,
       xp_earned: done * 20,
     });
     
     // 4. Tilføj XP
     // ... via xp_transactions
   }
   ```
3. **Ny API-funktion:** `convertNoteToItem(noteId, targetSprintId)`
   ```js
   async function convertNoteToItem(noteId, targetSprintId) {
     const { data: note } = await supabase.from('retro_notes').select('*').eq('id', noteId).single();
     await supabase.from('session_items').insert({
       sprint_id: targetSprintId,
       title: note.body,
       item_status: 'backlog',
       priority: 'medium',
       source: 'retro_action',
       source_note_id: noteId,
     });
   }
   ```
4. **RetroScreen.jsx ændringer:**
   - "Accept → Næste sprint" → kald `convertNoteToItem()`
   - Tilføj "Close Sprint" knap → kald `closeSprint()`
   - Vis boss battle outcome når sprint lukkes
5. **BossRetroStage.jsx:** Ved onFinish → persist boss outcome til DB

**ESTIMAT:** Large (2-3 dage)

---

## PRIORITERET BACKLOG — Top 10

| # | Titel | Type | Impact | Effort | Fil(er) |
|---|-------|------|--------|--------|---------|
| 1 | **Fix React hooks violation i RetroScreen** | Bug | Crasher i strict mode | Small | RetroScreen.jsx:254 — flyt `useState` ud af IIFE |
| 2 | **Fix Session.jsx undefined references** | Bug | Session-mode er potentielt broken | Medium | Session.jsx — deklarér `orchestration`, `setBossHp`, import `CLASSES`, `projectApprovalOverlay` |
| 3 | **Fix getSprintItems missing item_status** | Bug | ProjectWorkspace kanban kan vise forkerte kolonner | Small | lib/api.js — tilføj `item_status` til select |
| 4 | **Erstat hardcoded game widget med DB-data** | Feature | Game-layer føles fake — brugere ser altid "Level 7" | Medium | AppShell.jsx + ny `org_level` tabel + API |
| 5 | **Implementér Done → XP flow** | Feature | Core gamification loop er ikke-eksisterende | Medium | ProjectWorkspace.jsx, TeamKanban.jsx, ny `xp_transactions` + `user_xp` tabeller |
| 6 | **Implementér "Accept → Næste sprint"** | Feature | Retro action items forsvinder — nul accountability | Small | RetroScreen.jsx + ny `convertNoteToItem()` API |
| 7 | **Implementér Sprint Close** | Feature | Sprints kan aldrig lukkes ordentligt | Medium | RetroScreen.jsx + ny `closeSprint()` + `sprint_outcomes` tabel |
| 8 | **Persist estimation session results** | Feature | Al estimation-data forsvinder ved close | Large | Session.jsx + nye tabeller + API |
| 9 | **Tilføj deep-link routing** | Infra | `/retro`, `/teamkanban`, `/game` virker ikke ved reload | Medium | App.jsx — udvid `syncAuthScreenFromPath` |
| 10 | **Tilføj rollback til optimistic updates** | Quality | Data-inkonsistens ved fejl i ProjectWorkspace drag-drop | Small | ProjectWorkspace.jsx — tilføj try/catch rollback |

---

## NOTER

### Kode-kvalitet generelt
- Domain-model under `app/src/domain/session/` er velstruktureret — boss projection, achievements, rewards er godt separeret
- Governance-laget (approval requests, sync health, conflicts) er FULDT implementeret med DB-kobling
- PM-siden (Dashboard, ProjectWorkspace, TeamKanban, RetroScreen, TimelogScreen) er solid og DB-backed
- Game-siden (Session, Overworld, WorldSelect, AvatarCreator) er 100% client-side demo — intet er persisteret
- Der er et fundamentalt arkitekturelt gap: PM-data lever i DB, game-data lever i client-memory

### DB-tabeller der eksisterer og virker
- `organizations`, `organization_members`, `profiles`
- `projects`, `sprints`, `session_items`
- `sessions`, `session_participants`
- `approval_requests`, `audit_log`, `event_ledger`
- `risk_items`, `org_metrics`
- `time_entries`, `excel_imports`
- `retro_notes`
- `item_comments`
- `game_profiles`, `boss_profiles`, `reward_rules`, `achievement_definitions`

### DB-tabeller der MANGLER for fuld PM→Game kobling
- `user_xp` — XP per bruger
- `xp_transactions` — XP audit trail
- `org_level` — team level + XP
- `estimation_sessions` — estimation session tracking
- `estimation_votes` — individuelle votes
- `sprint_outcomes` — boss battle results ved sprint close
- `user_streaks` — streak tracking for game widget
