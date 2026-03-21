# Reveal — Tech Debt Backlog

**Oprettet:** 2026-03-21
**Status:** Aktiv — skal ryddes før nye features

---

## Prioritet 1: Shared Session Helpers (NÆSTE)

**Problem:** 8+ game screens laver hver sin copy-paste Supabase query for de samme ting.
**50 filer** importerer supabase direkte. Kun 15 bruger api.js.

### Duplikerede patterns der skal samles:

| Pattern | Antal steder | Filer |
|---|---|---|
| `session_participants` fetch | 8 | BluffPoker, Perspective, Speed, Nesting, SprintDraft, Dependency, Refinement, Flow |
| `sessions` fetch | 6 | Perspective, Nesting, Assumption, Risk, KPI, Bluff |
| `session_items` fetch | 5+ | Speed, Nesting, Bluff, Timelog, KPI |
| `organization_members` fetch | 6 | ProjectWorkspace, WorldSelect, Onboarding, Overworld, IntegrationsSettings |
| Realtime channel setup | 8+ | Alle game screens med broadcast |

### Løsning: `lib/sessionHelpers.js`

Nye shared helpers:
- `fetchSessionParticipants(sessionId)` → henter + mapper til sprite-format
- `fetchSessionWithItems(sessionId)` → session + tilhørende items
- `subscribeToSession(sessionId, handlers)` → standard realtime channel
- `submitVote(sessionId, itemId, userId, value)` → gem + broadcast
- `mapProfileToSprite(profile)` → DB-profil til sprite-objekt
- `fetchOrgMembers(orgId)` → organization_members + profiles

Alle game screens refaktoreres til at bruge disse i stedet for direkte supabase-kald.

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
- Tilføj `console.error` som minimum
- Overvej en shared `handleError(err, context)` helper
- Kritiske fejl (session_participants, votes) skal vise bruger-feedback

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
