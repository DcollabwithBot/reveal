# Reveal — Tech Debt Backlog

**Oprettet:** 2026-03-21
**Status:** Aktiv — skal ryddes før nye features

---

## Prioritet 1: Shared Helpers — Game + PM (NÆSTE)

**Problem:** 50 filer importerer supabase direkte. Kun 15 bruger api.js.
Samme queries copy-pastes på tværs af game screens OG PM dashboard.

### Duplikerede patterns — GAME-SIDE:

| Pattern | Antal steder | Filer |
|---|---|---|
| `session_participants` fetch | 8 | BluffPoker, Perspective, Speed, Nesting, SprintDraft, Dependency, Refinement, Flow |
| `sessions` fetch | 6 | Perspective, Nesting, Assumption, Risk, KPI, Bluff |
| `session_items` fetch (game) | 5+ | Speed, Nesting, Bluff, Timelog, KPI |
| Realtime channel setup | 8+ | Alle game screens med broadcast |

### Duplikerede patterns — PM-SIDE:

| Pattern | Antal steder | Filer |
|---|---|---|
| `projects` fetch | 9 | Dashboard, ProjectWorkspace, WorldSelect, Onboarding, RetroScreen, TeamKanban, AppShell, Timelog, KPI |
| `sprints` fetch | 5 | Dashboard, Overworld, RetroScreen, AppShell, SprintCloseModal |
| `session_items` fetch (PM) | 6 | Dashboard, KPI, Timelog x2, RetroScreen x2 |
| `organization_members` fetch | 6 | ProjectWorkspace, WorldSelect, Onboarding, Overworld, IntegrationsSettings x2 |
| `auth.getUser/getSession` | 29 | Næsten alle screens |
| `integration_connections` | 4 | AdminPanel |
| `smtp_configs` | 2 | AdminPanel |

### Løsning: Shared helper-struktur

```
lib/
  helpers/
    sessionHelpers.js    → fetchSessionParticipants, subscribeToSession,
                           submitVote, mapProfileToSprite (game)
    projectHelpers.js    → fetchProjectsForOrg, fetchSprintsForProject,
                           fetchItemsForSprint (PM)
    orgHelpers.js        → fetchOrgMembers, getMembership (begge)
  hooks/
    useAuth.jsx          → centraliseret auth context (erstatter 29 getUser/getSession kald)
```

### Hvad der SKAL være fælles:
- Auth/session (useAuth hook) — ét sted for token, user, membership
- Organization members — bruges i game OG PM
- Projects/sprints/items — bruges i PM dashboard, Overworld, RetroScreen
- Session participants — bruges i alle game modes
- Realtime channel opsætning — fælles pattern med cleanup

### Hvad der IKKE skal være fælles:
- Game-mode-specifik logik (bluff_assignments, scope_submissions etc.) — forbliver i den enkelte screen
- Edge Function kald via edgeFn() — allerede centraliseret i api.js ✅
- Visuel/UI logik (sprites, animationer) — screen-specifik

### Sikkerhed & fleksibilitet:
- Centraliseret auth context = ét sted at håndtere session expiry, token refresh, fejl
- Shared error handler = ét sted at logge og vise fejl til bruger
- RLS forbliver sikkerhedsmodel — helpers ændrer ikke på det

---

## Prioritet 2: Split api.js

**Problem:** `lib/api.js` er 2456 linjer — én monolitisk fil.

### Løsning: Domæne-opdeling

```
lib/
  api.js           → kun edgeFn() + re-exports (facade)
  api/
    sessionApi.js   → session CRUD, votes, estimation
    projectApi.js   → projects, sprints, items
    gameApi.js      → XP, achievements, leaderboard, missions
    orgApi.js       → organizations, members, onboarding
    integrationApi.js → Jira, webhooks, sync
```

---

## Prioritet 3: Fejlhåndtering

**Problem:** 13+ tomme `catch {}` blocks. Fejl sluges lydløst.

### Filer med tomme catch:
- PerspectivePokerScreen.jsx (3 steder)
- SpeedScopeScreen.jsx (5 steder)
- WorkspaceSettings.jsx (3 steder)
- NestingScopeScreen.jsx (1 sted)
- Landing.jsx (1 sted)

### Løsning:
- Shared `handleError(err, context)` helper med console.error + optional toast
- Kritiske fejl (session_participants, votes) viser bruger-feedback
- Aldrig tomme catch blocks

---

## Prioritet 4: Store screen-filer

**Problem:** Flere screens over 1000 linjer.

| Fil | Linjer |
|---|---|
| NestingScopeScreen.jsx | 1245 |
| BluffPokerScreen.jsx | 1241 |
| SprintDraftScreen.jsx | 1143 |
| Dashboard.jsx | 1107 |
| SpeedScopeScreen.jsx | 1089 |
| ProjectWorkspace.jsx | 1031 |

### Løsning:
- Extract sub-components (lobby, voting, results → separate filer)
- Extract step-logik til hooks (useBluffPokerFlow, useNestingScopeFlow)
- Mønster: `screens/BluffPoker/index.jsx` + `StepLobby.jsx` + `StepEstimate.jsx` etc.

---

## Prioritet 5: Inline styles

**Problem:** 114+ `style={{}}` bare i Session + BluffPoker. Ingen fælles patterns.

### Løsning:
- Shared style-konstanter i `shared/styles.js` for genbrugbare patterns
- Game screens: pixel-art theme tokens allerede i `constants.js` (C.bg, C.acc etc.) — brug dem konsistent
- PM screens: CSS-variabler fra index.css (--bg, --text, --jade etc.)

---

## Krav fremadrettet

> **Alle nye Supabase-kald der bruges på tværs af screens SKAL ligge i shared helpers.**
> Ingen copy-paste af queries i individuelle screen-filer.
> — Danny, 2026-03-21

---

## Done ✅

- [x] NPC_TEAM → rigtige members i Overworld + WorldSelect (2026-03-21)
- [x] XP persistence — profiles.xp + user_achievements (2026-03-21)
- [x] leaderboard_org VIEW fix — kode skriver ikke til VIEW (2026-03-21)
- [x] ARCHITECTURE.md opdateret med tech stack + API model (2026-03-21)
- [x] NPC_TEAM → rigtige participants i Session.jsx + alle game screens (i gang)
