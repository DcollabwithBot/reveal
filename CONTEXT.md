# Reveal — Projekt CONTEXT

Last updated: 2026-03-20 (sprints 7-11 dokumenteret, V8+ mockup live, sidebar refactor næste)

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: Aktiv udvikling — v0.11+ (Sprint 11 game_mode + time tracking landed ✅)
- Live: https://reveal.blichert.net
- Salgs-demo mockup: https://reveal.blichert.net/reveal-v8plus.html (V8+ — bruges mens sidebar refactores)
- GitHub: https://github.com/DcollabwithBot/reveal
- Branch: `main` (sprint 11 merged 2026-03-20)
- App: `app/` — Vite + React
- **Næste:** Sidebar refactor — App.jsx → persistent app-shell (sidebar 232px + main)

## Hvad er bygget

### Sprint 1-3 ✅
- Alle 4 skærme koblet: Avatar Creator → World Select → Overworld → Session
- Shared infrastruktur: constants.js, useSound.js, utils.js, animations.css
- Scope Roulette: 18 challenge-cards, boss HP modifier, re-vote
- Planning Poker: confidence vote, achievements, loot
- Sprint Boss Battle: retrospective game mode

### Sprint 4 ✅ (Supabase + Auth)
- Supabase projekt: `swyfcathwcdpgkirwihh`
- Komplet DB schema (organizations, teams, sessions, session_items, votes, profiles)
- Google OAuth + login screen

### Sprint 4b ✅ (Multiplayer Realtime)
- SessionLobby + ActiveSession med Supabase Realtime
- Presence tracking, GM controls, join_code flow

### Sprint 5 ✅ (Admin UI + DB-driven content + Voting Modes)

**Arkitektur-beslutning (Danny, 2026-03-19):**
DB er single source of truth. Admin UI seeder DB. Spillet loader fra DB.

**Hvad er lavet:**

1. **DB Migrations ✅ kørt 2026-03-19**
   - `supabase/migrations/sprint5.sql` — ✅ eksekveret via Supabase Management API
   - `supabase/seed/sprint5-defaults.sql` — ✅ eksekveret (12 retro_events, 18 challenges seeded)
   - Tilføjet: `sessions.voting_mode`, `retro_events` tabel, `challenges` tabel

2. **SessionSetup.jsx** (ny fil)
   - Route: `/setup`
   - GM opretter session med: navn, backlog items (titel + beskrivelse), voting mode
   - Voting mode: Fibonacci (1,2,3,5,8,13,21) eller T-shirt (XS,S,M,L,XL,XXL)
   - INSERT til sessions + session_items via API
   - Viser join link + kode efter oprettelse

3. **ActiveSession.jsx — voting_mode**
   - Læser `session.voting_mode` fra DB
   - Fibonacci: viser [1,2,3,5,8,13,21,?] kort
   - T-shirt: viser [XS,S,M,L,XL,XXL,?] kort
   - T-shirt reveal viser MODE (hyppigst), ikke gennemsnit
   - Skriver `final_estimate` + `status='completed'` til `session_items` ved reveal

4. **ActiveSession.jsx — DB-driven content**
   - Challenges: hentes fra `challenges` tabel (global defaults). Fallback til constants.js
   - Retro events: hentes fra `retro_events` tabel (global defaults). Fallback til constants.js

5. **Session.jsx — DB writes**
   - Skriver node completion til `node_completions` (silently skips hvis ingen dbId)
   - Skriver final estimate til `session_items` (silently skips hvis ingen sessionItemId)

6. **App.jsx — routing**
   - `/setup` route → SessionSetup
   - SessionLobby har "Advanced Session Setup →" knap

7. **server/app.js**
   - POST /api/sessions accepterer nu `voting_mode` parameter

### Sprint 6 ✅ (Dashboard foundation + project hierarchy)

**Bygget i sprint 6:**
- `/dashboard`: aktive/kommende/afsluttede sessions, quick actions, kanban (active/on_hold/completed), drag-drop status update
- `/projects` + `/projects/:id`: projekt → sprint → items med CRUD og inline felter (`assigned_to`, `estimated_hours`, `actual_hours`, `progress`, `item_status`)
- `/sessions/:id/results`: per-item votes, consensus/median/confidence, outlier flag (>2x median), CSV export og share-link
- Excel onboarding via paste (tab-separeret): paste → kolonnemapping → preview → confirm
- Session templates: save/load i setup flow
- Migration `supabase/migrations/sprint6.sql` kørt via Supabase Management API
- Integration readiness: `external_id` + `external_source` tilføjet på `projects`, `sprints`, `session_items`
- Oprydning: `reveal-session.jsx` fjernet, duplikat challenge-array ryddet, `avatar_class` render i ActiveSession

## Governance sprint status (2026-03-19) ✅ MERGED

**Landet og merget til `main`:**
- Approval request lifecycle: create / approve / reject / apply
- PM mutation guard på runtime endpoints
- Event ledger + audit log v1
- Sync health + conflict feed endpoints
- Advisory overlay i game/session UI
- Apply pipeline med target-specifik whitelist + normalisering/validering
- Lobby/dashboard viser nu governance-sektioner for PM actions, conflicts, active projects og recent activity

**Åbne items (næste fase):**
- Conflict Center er feed/overblik — ikke fuld resolution workflow endnu
- PM actions lever i lobby/dashboard, ikke dedikeret dashboard-rute
- Apply pipeline ikke fuldt domænespecifik pr. target/business rule

## Integration-arkitektur beslutninger (2026-03-19)

**Dual-mode arkitektur vedtaget:**
- Mode A = Standalone Reveal (default, kør nu)
- Mode B = Connected sync (Jira/Azure DevOps/TopDesk/Planner, aktiveres via gates)
- Shared work-fields ejes default af eksternt system i connected mode
- Write-back blokeret indtil INT-G1 + INT-G2 + INT-G3 er PASS
- Første pilot = Jira read-only shadow sync

**Integration docs:**
- `docs/integration/integration-strategy-v1.md`
- `docs/integration/field-mapping-matrix-v1.md`
- `docs/integration/sync-policy-v1.md`
- `docs/integration/standalone-bootstrap-v1.md`

## UX retning (2026-03-19)

**V7: "Serious execution platform with a game soul"**
- Professionel PM-flade er default; game-layer er advisory/overlay
- 3 hero screens: `dashboard-v7`, `workspace-v7`, `session-v7`
- V7 approval-preview live: `https://reveal.blichert.net/approval/v7/`

## Projection hardening (2026-03-19)

- Migration `sprint9_projection_config.sql`: `game_profiles`, `boss_profiles`, `reward_rules`, `achievement_definitions` med default seed
- Ny read-path `/api/projection/config` + helper `app/src/shared/projection.js`
- `Session.jsx` delvist decouplet fra inline reward/boss-logik
- Sprint A (audit) / Sprint B (ownership/writeback) / Sprint C (projection decoupling) defineret

## Hvad er bygget (Sprints 7-10)

### Sprint 7 (Fase 1) ✅ — Foundation
- Roller & Permissions: role på organization_members + team_members, requirePermission() middleware
- Comments: comments tabel, threading, GET/POST/PATCH/DELETE /api/items/:id/comments
- Global Søgning: Cmd+K spotlight modal, pg_trgm + GIN indexes, /api/search endpoint

### Sprint 8 (Fase 2) ✅ — Insight
- Burndown/Velocity: sprint_daily_snapshots, SprintCharts.jsx (Recharts), /api/sprints/:id/burndown
- Dependencies: item_dependencies tabel, BFS circular detection, blocker-badge på kanban
- In-app Notifikationer: notifications tabel, NotificationBell.jsx med unread badge i topbar

### Sprint 9 (Fase 3) ✅ — Game-PM Bridge
- Planning Poker fra Dashboard: "⚔ Estimer sprint" knap, bulk-select items, float action bar
- Retro → PM Tasks: retro_actions tabel, BossRetroStage action items step, promote via approval
- GameStatsBar: 5 micro-signals i Dashboard (streak, accuracy, velocity, sessions, coverage)

### Sprint 10 (Fase 4) ✅ — Sprint Draft "The Draft"
- Ny session_type='sprint_draft'
- SprintDraftScreen.jsx: 4-step flow (Lobby → Priority Vote → The Draft → Confidence Vote)
- Priority tokens (5 per person), Capacity Gauge (grøn→gul→rød), Consensus Flash animation
- sprint_draft_picks + sprint_draft_priority_votes tabeller
- PM approval write-back via finalize-draft endpoint

## TODO: Bidirektionel sync (Fase 5)
Blokeret bag INT-G1/G2/G3 gates. Se docs/architecture/next-phase-architecture-v1.md.
Bygges EFTER vi har pilotkunder og validated use case.

## Roadmap
| Sprint | Indhold | Status |
|--------|---------|--------|
| 1-3 | MVP modes (Poker, Roulette, Boss Battle) | ✅ |
| 4 | Supabase schema + Auth (Google OAuth) | ✅ |
| 4b | Realtime multiplayer + Lobby + Session UI | ✅ |
| 5 | Admin UI, DB-driven content, voting modes | ✅ |
| 6 | Dashboard foundation + projects/sprints/items + results + templates + velocity | ✅ |
| 7 (Fase 1) | Roller & Permissions, Comments, Global Søgning | ✅ |
| 8 (Fase 2) | Burndown/Velocity, Dependencies, In-app Notifikationer | ✅ |
| 9 (Fase 3) | Game-PM Bridge, Planning Poker fra Dashboard, GameStatsBar | ✅ |
| 10 (Fase 4) | Sprint Draft "The Draft" — 4-step flow, priority tokens, capacity gauge | ✅ |
| 10 (Fase 4) | Sprint Draft "The Draft" — 4-step flow, priority tokens, capacity gauge | ✅ |
| 10b | Time tracking + Excel import (FAK/INT/UB/Kørsel) · game_mode feature (focus/engaged/full) | ✅ |
| 11 | Sidebar refactor (persistent app-shell) + V8+ React port | 🎯 næste |
| 12 | Slack/Teams webhooks + Jira Shadow Sync | |
| 12 | AI Lifelines + mønstergenkendelse | |

## Supabase
- Projekt ID: `swyfcathwcdpgkirwihh`
- Eksisterende tabeller: organizations, organization_members, profiles, teams, team_members, sessions, session_participants, session_items, votes
- Sprint 5 tilføjede: `sessions.voting_mode`, `retro_events` (12 rows), `challenges` (18 rows)
- Sprint 6 tilføjede: `projects`, `sprints`, `session_templates`, `node_completions`, nye felter på `sessions` og `session_items`
- Migration kørt: 2026-03-19 via Supabase Management API (`sprint5.sql` + `sprint6.sql`)

## Tech stack
- React (hooks only) + Vite
- Supabase (Auth + DB + Realtime + Edge Functions)
- Web Audio API (lyd — ingen filer)
- CSS animations inline
- Press Start 2P + VT323 (Google Fonts)
- Hosting: Nordicway (static frontend)
- Backend: **Supabase Edge Functions** (Deno) — INGEN Express server
- Old Express server arkiveret i `server_deprecated/`

## Supabase Edge Functions (deployed)
- `supabase/functions/provision/` — Auto-provision org/team ved login
- `supabase/functions/approve-mutation/` — PM approval lifecycle (approve/reject/apply)
- `supabase/functions/start-estimation/` — Start estimation session (sprint/project/bulk/item)
- `supabase/functions/finalize-draft/` — Sprint Draft finalization
- `supabase/functions/promote-retro-action/` — Retro action → PM task promotion
- `supabase/functions/create-session/` — Session creation med auto-provision

## Edge Functions (supabase/functions/)
- `approve-mutation/` — PM approval lifecycle (approve/reject/apply) + PM mutation guard
- `start-estimation/` — Start estimation session fra sprint/projekt/bulk/items
- `finalize-draft/` — Sprint Draft finalization → approval request
- `promote-retro-action/` — Retro action item → PM task via approval
- `create-session/` — Session oprettelse med auto-provisioning
- `send-webhook/` — Slack/Teams webhook notifikationer ved events
- `send-email/` — Email notifikationer via Resend API (templates + custom)
- `jira-sync/` — Jira shadow sync (polling, opdaterer Jira-owned fields)

## Vigtige filer (frontend)
- `app/src/lib/api.js` — AL API-kommunikation. Supabase direkte + edgeFn() helper til Edge Functions
- `app/src/lib/supabase.js` — Supabase client (auth + DB + realtime)
- `app/src/screens/` — Alle skærme (Session, Dashboard, ProjectWorkspace, SprintDraftScreen, etc.)
- `app/src/components/` — Delte komponenter (CommentsPanel, NotificationBell, SprintCharts, SearchModal, GameStatsBar, etc.)
- `supabase/migrations/` — Alle DB-migrationer i kronologisk rækkefølge
- `supabase/functions/` — Edge Functions (Deno, hosted på Supabase)
- `server_deprecated/` — Gammel Express-server (arkiveret, BRUGES IKKE)

## ⚠️ Arkitektur-beslutning: Supabase-native (INGEN Express)

**Besluttet: 2026-03-20 af Danny**

Reveal bruger **Supabase direkte** — ingen Express-backend.

- Al data-adgang: Supabase JS client fra frontend
- Auth: Supabase Auth (Google OAuth)
- Realtid: Supabase Realtime
- Business logic / server-side: **Supabase Edge Functions** (Deno)
- Row-level security: **RLS policies** på alle tabeller
- Ingen PM2, ingen Node-server, ingen cPanel-friktion

**Deploy-model:**
- Frontend: Nordicway static hosting (rsync dist/ → ~/reveal.blichert.net/)
- Backend: Supabase Edge Functions (auto-hosted, ingen server at starte)
- DB: Supabase Postgres + RLS

**⛔ Fejl der ikke må gentages:**
Agents må ALDRIG oprette en Express-server til Reveal.
Hvis noget kræver server-side logik → brug Supabase Edge Function.
Ny function → opret i `supabase/functions/<navn>/index.ts` (Deno).

## Design-principper (rør ikke)
- Pixel art æstetik i game-modes
- Alt lever — ingen statiske elementer i spillet
- Lyd på alt (game-lag)
- Boss battle = opgaven der skal estimeres
- Tavern hub = world select
- PM-fladen er professionel og rolig — game er overlay/advisory

## Lokation
`/root/.openclaw/workspace/projects/reveal/`

## ⚠️ Game Mode Design-Regel: Pixel Art Game Feel (ALLE modes)

**Besluttet: 2026-03-20 af Danny**

ALLE game modes skal have samme æstetik og feel som Planning Poker. Det er ikke forhandleligt.

### Krav per game mode:
- **Avatarer** — alle deltagere repræsenteres med deres pixel art avatar (klasse, level badge)
- **Animationer** — alle actions har animation: kortflip, vote reveal, boss appear, XP burst, confetti
- **Lyd** — Web Audio API på alle key moments (ding, dramatic reveal, boss roar, success chime)
- **Game-feel micro-moments** — hvert mode har mindst 3 "yes!"-øjeblikke med visuelt feedback

### Eksempler per mode:
- **Spec Wars** — avatarer sidder om et bord, skriver på "scrolls", kaster dem ind, voting = battle
- **Perspektiv-Poker** — role cards flippes dramatisk, crown-animation på vinderens spec
- **Bluff Poker** — avatarer med "poker face", afsløring = spotlight + camera shake
- **Russian Nesting Scope** — doll der åbner sig med animation, del-estimater popper ud
- **Speed Scope** — timer nedtælling med pixel art, "BUZZER" animation ved reveal

### Tech:
- CSS keyframe animations (ingen Framer Motion / biblioteker)
- Web Audio API (ingen .mp3 filer — genererede toner)
- Press Start 2P + VT323 fonte
- Eksisterende CSS-variabler (--jade, --gold, --danger, --epic, --bg2 etc.)

**⛔ Aldrig:** Bland corporate/flat design ind i game modes. Spillet ser ud som spil.
