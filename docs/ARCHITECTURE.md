# REVEAL — Arkitektur & Bindingsmodel

**Source of truth for alle agenter og udviklere.**
Opdateret: 2026-03-21

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
| `game_profiles` | Karakter, XP, level, achievements per bruger |
| `missions` / `user_missions` | Daglige missioner + side quests |
| `leaderboard_org` | XP-rangliste per org |
| `random_events` | Random events per session |
| `game_mode_config` | Hvilke modes er aktive per projekt |
| `project_templates` | Session-skabeloner |

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

## Hvad der mangler (næste sprint)

- [ ] SessionLaunchModal: vis backlog-items fra det valgte projekt
- [ ] GM approval-flow: votes → session_items.estimate (UI mangler)
- [ ] Projekt-fetch i WorldSelect: viser "Ingen projekter" hvis organization_id ikke matcher — skal debugges
- [ ] Overworld: depreceres som mellemstation, erstattes af direkte projekt-workspace
