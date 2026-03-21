# REVEAL — Arkitektur & Bindingsmodel

**Source of truth for alle agenter og udviklere.**
Opdateret: 2026-03-21 (XP persistence, real team members, Overworld data binding)

---

## Overordnet princip

> PM-data er source of truth. Game-layer er advisory og motiverende.
> Spillet kan ALDRIG skrive direkte til PM-data — kun læse.

---

## Lag 1: PM-data (Supabase)

| Tabel | Beskrivelse | Ejer |
|---|---|---|
| `organizations` | Virksomhed/workspace | PM |
| `projects` | Projekter (Kombit WiFi, HEJ Gruppen etc.) — tilhører en org | PM |
| `sprints` | Sprints — tilhører et projekt, har start/slut + mål | PM |
| `session_items` | Backlog-items (user stories, opgaver) — tilhører et projekt | PM |
| `sessions` | En spil-session — tilhører et projekt + har `game_mode` | PM |
| `session_participants` | Hvem er med i en session | PM |
| `votes` | Hvad der er stemt i en session | PM (via game) |
| `estimates` | Aggregerede estimater — KUN opdateres ved GM approval | PM |

## Lag 2: Game-layer (advisory)

| Tabel | Beskrivelse |
|---|---|
| `profiles.xp` / `profiles.level` | XP og level per bruger — **source of truth for XP** |
| `leaderboard_org` | **VIEW** (ikke tabel) — auto-genereret fra `profiles` + `organization_members` |
| `user_achievements` | Unlocked achievements per bruger (user_id + achievement_key, UNIQUE) |
| `achievement_definitions` | Katalog over alle mulige achievements |
| `missions` / `user_missions` | Daglige missioner + side quests |
| `random_events` | Random events per session |
| `game_mode_config` | Hvilke modes er aktive per projekt |
| `project_templates` | Session-skabeloner |

### ⚠️ XP-arkitektur (opdateret 2026-03-21)
- `profiles.xp` er source of truth — opdateres via `awardXP()` i api.js
- `leaderboard_org` er en **VIEW** der joiner `profiles` + `organization_members` — **skriv ALDRIG direkte til den**
- `awardXP()` opdaterer `profiles.xp` + `profiles.level` — VIEW reflekterer automatisk
- XP tildeles ved session-afslutning i Session.jsx via `awardXP(userId, xpAmount, 'session_complete', orgId)`
- Achievements gemmes via `unlockAchievement()` — idempotent (UNIQUE constraint)

---

## Invarianter — ALDRIG bryde

1. **PM-data ejes af PM-laget.** Game-lag kan læse, ikke skrive direkte.
2. **Estimater fra et spil** → gemmes som `votes` → aggregeres til `session_items.estimate` **KUN ved GM approval**.
3. **XP optjenes uafhængigt af PM-data** — ingen XP-handling kan ændre en sprint, et estimat eller et backlog-item.
4. **Sessions oprettes altid med `project_id`** — ingen session uden projekttilknytning (undtagen Free Road).

---

## Session-flow (korrekt)

```
1. Bruger vælger projekt (World Map)
2. Vælger mode (Planning Poker, Perspective Poker, etc.)
3. SessionLaunchModal: viser mode-info + aktive missions + backlog-items
4. START → opretter session i `sessions` med project_id + game_mode
5. Navigerer DIREKTE til spil-screen med sessionId (ingen Overworld mellemstation)
6. Spillet kører → votes gemmes i `votes`
7. Session afsluttes → GM approver estimates → `session_items.estimate` opdateres
8. XP + achievements tildeles uafhængigt
```

### Hvad der IKKE sker
- Spillet skriver ikke direkte til `session_items.estimate`
- Spillet skriver ikke direkte til `sprints`
- World Map → Overworld → Session (det gamle flow) er **deprecated** for modes der har egne screens

---

## App.jsx routing-model

### State
- `currentSessionId` — session-ID for aktiv session
- `currentSessionMode` — mode-id (fx `planning_poker`, `perspective_poker`)
- `authScreen` — aktuel skærm

### Session launch (alle 14 modes)
```js
// Efter session oprettes i Supabase:
setCurrentSessionId(data.id);       // atomisk
setCurrentSessionMode(modeId);      // atomisk
window.history.pushState(...)       // URL update
setAuthScreen('session_active');    // trigger render
```

### Render-guard (ét enkelt block for alle modes)
```jsx
if (user && authScreen === "session_active" && currentSessionId && currentSessionMode) {
  switch (currentSessionMode) {
    case 'planning_poker': return <Session ... />
    case 'perspective_poker': return <PerspectivePokerScreen ... />
    // ... alle 14 modes
  }
}
```

### URL-slugs
| Mode ID | URL-slug |
|---|---|
| planning_poker | planning-poker |
| boss_battle_retro | boss-battle-retro |
| spec_wars | spec-wars |
| perspective_poker | perspective-poker |
| bluff_poker | bluff-poker |
| nesting_scope | nesting-scope |
| speed_scope | speed-scope |
| truth_serum | truth-serum |
| flow_poker | flow-poker |
| risk_poker | risk-poker |
| assumption_slayer | assumption-slayer |
| refinement_roulette | refinement-roulette |
| dependency_mapper | dependency-mapper |
| sprint_draft | draft |

---

## World Map → Projekter

- WorldSelect.jsx henter projekter via `supabase.from('projects').select(...)` filtreret på `organization_id`
- Hvert projekt = én verden med roterende pixel-art tema
- **Free Road** er en fast verden i bunden → navigerer til `/quest-log` (ingen project_id)
- Opretter du et nyt projekt i Dashboard → det dukker op som ny verden automatisk

---

## Screens & ansvar

| Screen | Ansvar |
|---|---|
| `Dashboard` | PM-overblik, projekter, KPI |
| `ProjectWorkspace` | Et projekts sprints, backlog, items |
| `WorldSelect` | Vælg projekt (verden) + mode — entry til alle spil |
| `SessionLaunchModal` | Mode-info, aktive missions, backlog-valg, START |
| `Session` | Planning Poker + Boss Battle Retro (original spil-engine) |
| `PerspectivePokerScreen` | Perspective Poker |
| `BluffPokerScreen` | Bluff Poker |
| `NestingScopeScreen` | Russian Nesting Scope |
| `SpeedScopeScreen` | Speed Scope |
| `FlowPokerScreen` | Flow Poker |
| `RiskPokerScreen` | Risk Poker |
| `AssumptionSlayerScreen` | Assumption Slayer |
| `RefinementRouletteScreen` | Refinement Roulette |
| `DependencyMapperScreen` | Dependency Mapper |
| `SprintDraftScreen` | Sprint Draft |
| `QuestLogScreen` | Daily missions, side quests, Free Road |
| `Overworld` | **Deprecated** som mellemstation — bruges kun i legacy worlds-flow |

---

## ❤️ Hjertet: PM ↔ Game dataflow (KONTRAKTEN)

Dette afsnit er ikke til diskussion. Det er den præcise kontrakt for hvordan PM og game kommunikerer.

### Del 1 — PM → Game (hente data ind i Overworld)

Når bruger klikker ind i en projekt-verden (portal på World Map), henter Overworld.jsx disse data fra Supabase:

```js
// 1. Aktiv sprint for projektet
const { data: sprint } = await supabase
  .from('sprints')
  .select('id, name, end_date, goal')
  .eq('project_id', projectId)
  .eq('status', 'active')
  .single()

// 2. Items i den aktive sprint → bliver til nodes på kortet
const { data: items } = await supabase
  .from('session_items')
  .select('id, title, description, estimate, status, risk_score')
  .eq('sprint_id', sprint.id)
  .neq('status', 'done')
  .order('priority', { ascending: true })

// 3. Teammedlemmer → karakterer på kortet
const { data: members } = await supabase
  .from('organization_members')
  .select('user_id, profiles(display_name, avatar_class, avatar_color, level)')
  .eq('organization_id', orgId)
```

**Mapping til Overworld:**
- `sprint.end_date` → boss HP-bar (dage tilbage / total sprint-dage)
- `items` → nodes på kortet (én node per item)
- `node.id = item.id` — altid koblet
- `members` → sprites der vandrer på kortet
- `item.status` → node-farve (uestimeret = grå, estimeret = grøn, risiko = rød)

---

### Del 2 — Game → PM (skubbe data tilbage)

Når et spil afsluttes, gemmes output i to trin:

#### Trin 1: Gem rå game-output (sker automatisk ved session-afslutning)
```js
// Votes/estimater gemmes under sessionen løbende
// Ved afslutning: aggreger til session_summary
await supabase.from('session_summary').upsert({
  session_id: sessionId,
  item_id: itemId,
  mode: gameMode,           // 'planning_poker', 'risk_poker' etc.
  consensus_value: value,   // det estimat/score der er opnået konsensus om
  raw_votes: votesArray,    // alle individuelle votes
  completed_at: new Date()
})
```

#### Trin 2: GM approval → skriv til PM (kræver aktiv handling)
```js
// GM ser pending updates i ProjectWorkspace → godkender
// Kun herefter opdateres session_items

// Planning Poker / Speed Scope
await supabase.from('session_items')
  .update({ estimate: consensus_value, estimated_at: new Date() })
  .eq('id', itemId)

// Risk Poker
await supabase.from('session_items')
  .update({ risk_score: consensus_value })
  .eq('id', itemId)

// Nesting Scope — nye child-items
await supabase.from('session_items')
  .insert(newChildItems.map(item => ({
    ...item,
    sprint_id: sprintId,
    parent_item_id: parentItemId,
    status: 'pending'
  })))

// Boss Battle Retro — action items
await supabase.from('session_items')
  .insert(actionItems.map(item => ({
    title: item.title,
    sprint_id: nextSprintId,  // action items går i næste sprint
    item_type: 'action_item',
    created_from_session: sessionId
  })))
```

#### Hvad der ALDRIG sker uden GM approval
- `session_items.estimate` opdateres ikke
- `session_items.status` ændres ikke
- Nye items oprettes ikke i backlog
- Sprint modificeres ikke

---

### Del 3 — Session-log (altid synlig i PM)

Uanset GM approval efterlader enhver session et synligt spor i PM:

```js
// Oprettes automatisk når session starter
await supabase.from('sessions').insert({
  project_id: projectId,
  game_mode: gameMode,
  created_by: userId,
  status: 'active'
})

// Opdateres når session afsluttes
await supabase.from('sessions').update({
  status: 'completed',
  completed_at: new Date(),
  items_covered: itemIds,        // hvilke items der var med
  participants: participantIds,  // hvem deltog
  summary: summaryText           // kort summary
}).eq('id', sessionId)
```

Dette vises i ProjectWorkspace under "Sessions" — **altid, uanset om GM har approved noget**.

---

## GM-rollen og Daily Missions genereret fra PM

### GM = den der frigiver game-output til PM
Project Manager (GM) er den eneste der kan approve game-output tilbage til PM-data. Ingen automatisk write-back. Altid et aktivt valg.

### Daily missions og side quests genereres fra PM-data

**Regel:** Hvis et projekt har backlog-items der IKKE er splittet i sprints, har estimater eller status/assignee — genererer disse items **daily missions og side quests** automatisk.

**Formål:** Gamificeringen presser PM til at strukturere løst arbejde. I stedet for "someday/maybe"-items der rådner, bliver de til missions der aktivt kræver handling.

**Eksempel:**
```
Projekt: "Nyt website" (ingen sprints, ingen estimater)
  → Daily mission: "Bryd 'Nyt website' ned i 3 konkrete tasks"
  → Side quest: "Estimér de første 5 items i backloggen"
  → Bonus mission: "Planlæg Sprint 1 med mindst 8 items"
```

**Privat-flag:** Items markeret `is_private: true` genererer IKKE missions og er usynlige i game-laget.

### Mission-generering logik
```
FOR hvert projekt i org:
  FOR hvert item med is_private = false:
    IF sprint mangler → "Planlæg sprint" mission
    IF item mangler estimat → "Estimér items" mission (→ Planning Poker)
    IF item mangler assignee → "Tildel opgaver" mission
    IF ingen session i >7 dage → "Kør et ritual" mission
```

Free Road missions vises i `/quest-log` uden projekttilknytning og kan tages af alle i org.

**Dette er den centrale gamification-motor** — ikke random events, men faktisk arbejde der mangler.

---

## Game → PM Write-back model

Dette er den centrale binding. **Alt arbejde i et spil skal være synligt i PM.**

### Princip
Spillet producerer outputs. Disse outputs skrives til PM via en **session-log** der altid er synlig i ProjectWorkspace og Dashboard. GM approver kun de dele der ændrer konkrete PM-felter (estimater, status).

### Hvad hvert spil producerer → hvad PM ser

| Game Mode | Output | PM-synlighed |
|---|---|---|
| **Planning Poker** | Votes per item → konsensus-estimat | `session_items.estimate` (pending → approved af GM) |
| **Speed Scope** | Quick round 1+2 estimater + delta | Samme som Planning Poker, men markeret "speed" |
| **Perspective Poker** | Team alignment-score per item | Note på item: "Lav alignment — diskuter" |
| **Bluff Poker** | Afslørede skjulte antagelser | Note på item: "Fundet antagelser: X, Y, Z" |
| **Risk Poker** | Risiko-score per item (lav/mellem/høj) | `session_items.risk_score` + synlig badge i workspace |
| **Assumption Slayer** | Dokumenterede antagelser + danger-scores | Note på item + `assumptions`-liste |
| **Flow Poker** | Cycle time analyse + flaskehalse | Sprint-metrics: "Gennemsnitlig cycle time: X dage" |
| **Nesting Scope** | Sub-items identificeret under estimering | Nye child-items oprettet i backlog (pending approval) |
| **Dependency Mapper** | Dependencies kortlagt mellem items | `item_dependencies`-relationer synlige i workspace |
| **Refinement Roulette** | Refinement-noter per item | Note på item |
| **Sprint Draft** | Foreslåede items til næste sprint | Sprint-forslag til PM approval |
| **Boss Battle Retro** | Retro-findings, root causes, action items | Nye action items oprettet i backlog |
| **Truth Serum** | Anonym survey-resultater | Heatmap synlig i project analytics |

### Session-log (alle modes)
Hver session efterlader **en session-record i PM** med:
- Hvornår sessionen kørte
- Hvem deltog
- Hvilken mode
- Hvad der blev produceret (summary)
- Link til fuldt session-output

Dette er synligt i ProjectWorkspace under "Sessions" og i Dashboard KPI.

---

## Item-selektion ved session-start

Korrekt flow (mangler delvist i UI):
```
1. Bruger vælger projekt (World)
2. Vælger mode
3. SessionLaunchModal åbner:
   - Mode-info
   - Aktive missions
   - [MANGLER] Backlog-items fra projektet — bruger vælger 1-N items til sessionen
4. START → opretter session med valgte items som `session_items`
5. I spillet: items køres igennem én ad gangen
```

Uden item-selektion ved start: spillet kører uden PM-kontekst og output kan ikke kobles til konkrete items.

---

## World Map → Project Hub (Super Mario Party-model)

**Vision:** Hvert projekt er en verden på World Map. Klikker du ind i en verden, åbner projektets **hub** — alt der hører til det projekt lever her.

### Navigationsflow (mål)
```
World Map
  └── [klik på projekt-verden]
        └── Project Hub (ny screen)
              ├── Aktiv sprint + burndown
              ├── Backlog (items til estimering)
              ├── Game Modes
              │     ├── Planning Poker → vælg items → START
              │     ├── Risk Poker → vælg items → START
              │     ├── Retro → Boss Battle Retro → START
              │     ├── Standup → Speed Scope → START
              │     └── ... alle 14 modes
              ├── Session-historik (tidligere sessions)
              └── Final Boss (sprint deadline / release)
```

### Project Hub — hvad der skal vises
- **Sprint-status:** aktiv sprint, burndown, dage tilbage
- **Backlog:** uafsluttede items sorteret efter prioritet — kan vælges til session
- **Final Boss:** sprint-deadline eller milestone — vises som en boss der nærmer sig
- **Seneste session:** hvornår sidst der var en session, hvad der skete
- **Team:** hvem er med i projektet (sprites)

### Final Boss
Hvert projekt har en "Final Boss" — det er sprint-deadlinen eller et defineret milestone.
- Vises visuelt som en boss på Project Hub der nærmer sig (HP-bar = dage tilbage)
- Når deadline nærmer sig: boss HP lav, urgency stiger
- Når sprint afsluttes: Boss defeated → ny sprint = ny boss

### ✅ Bekræftet vision (2026-03-21)

Dette er den aftalte arkitektur. Overworld er IKKE deprecated — den er hjertet af produktet.

```
World Map (WorldSelect)
  → portaler = projekter fra Supabase
  → klik på portal → Overworld for det projekt

Overworld (per projekt)
  → populeres med data fra Supabase (sprints, items, team)
  → nodes = rigtige sprint-items + aktiviteter
  → karakterer = rigtige teammedlemmer (fra session_participants)
  → boss = sprint-deadline (HP-bar tæller ned mod deadline)
  → klik på node → vælg mode → SessionLaunchModal → spil
```

### Dataflow: Supabase → Overworld

```
projects (id, name, org_id)
  └── sprints (id, project_id, end_date → boss HP)
        └── session_items (id, sprint_id, title, estimate, status → nodes på kortet)

organization_members (user_id, organization_id)
  └── profiles (id, display_name, avatar_class, xp, level → karakter-sprites + XP)
```

### Team-visning (opdateret 2026-03-21)
- **Overworld:** `buildTeam()` henter rigtige teammedlemmer fra `organization_members` + `profiles` via Supabase
- **WorldSelect:** NPC-sprites viser rigtige org-members i stedet for hardcodede Mia/Jonas/Sara/Emil
- **Fallback:** `NPC_TEAM` fra constants.js bruges KUN når ingen rigtige members findes (demo/tom org)
- **Avatar mapping:** `profiles.avatar_class` → sprite farver/klasse. Hvis null → tildeles tilfældig klasse fra `CLASSES`
- **Top bar XP:** Viser brugerens reelle `profiles.xp` fra DB (ikke hardcodet ⭐1240)

### Implementeringsstatus

| Feature | Status |
|---|---|
| World Map viser projekter fra DB | ✅ |
| Overworld nodes = rigtige sprint-items fra DB | ✅ |
| Overworld team = rigtige org-members fra DB | ✅ (2026-03-21) |
| Top bar XP = rigtig XP fra profiles | ✅ (2026-03-21) |
| Boss = sprint-deadline med HP nedtælling | ✅ |
| XP skrives til DB ved session-slut | ✅ (2026-03-21) |
| Achievements gemmes i DB | ✅ (2026-03-21) |
| Project Hub screen (sprint + backlog per projekt) | ❌ (mangler) |
| SessionLaunchModal item-selektion fra sprint | ❌ (mangler) |
| Sprint-velocity opdateres i KPI Dashboard | ❌ (mangler) |

---

## Hvad der mangler (næste sprint)

- [ ] **SessionLaunchModal: item-selektion** — vis aktiv sprint + backlog-items fra valgt projekt, bruger vælger hvilke items der skal med i sessionen
- [ ] **Session-log i PM** — ProjectWorkspace "Sessions"-tab der viser alle sessions kørt på projektet med summary
- [ ] **GM approval-flow UI** — votes → pending → GM approver → `session_items.estimate` opdateres (DB-logik eksisterer, UI mangler)
- [ ] **Risk score + antagelser** — Risk Poker og Assumption Slayer skriver til `session_items`
- [ ] **Sprint velocity** — efter session: opdatér sprint-metrics i KPI Dashboard
- [ ] **Projekt-fetch fix** — WorldSelect viser "Ingen projekter" hvis organization_id ikke matcher

## Hvad der er done (2026-03-21)

- [x] **XP persistence** — `awardXP()` skriver til `profiles.xp` ved session-slut
- [x] **Achievements persistence** — `user_achievements` tabel oprettet, `unlockAchievement()` gemmer til DB
- [x] **Leaderboard fix** — `leaderboard_org` er VIEW, kode skriver ikke længere direkte til den
- [x] **Real team members** — Overworld + WorldSelect viser rigtige org-members fra Supabase
- [x] **Real XP i top bar** — Overworld top bar viser brugerens faktiske XP
- [x] **Overworld rigtige data** — nodes = sprint-items, boss = sprint-deadline, team = org-members
