# Reveal — Projekt CONTEXT

Last updated: 2026-03-20 (sprints 7-10 dokumenteret, fase 1-4 komplet)

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: Aktiv udvikling — v0.6 (Sprint 6 foundation komplet ✅)
- Live: https://reveal.blichert.net
- GitHub: https://github.com/DcollabwithBot/reveal
- Branch: `main` (sprint 6 merged 2026-03-19)
- App: `app/` — Vite + React

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
| 11 | Slack/Teams webhooks + Eksterne integrationer (Jira/Azure DevOps) | 🎯 næste |
| 12 | AI Lifelines + mønstergenkendelse | |

## Supabase
- Projekt ID: `swyfcathwcdpgkirwihh`
- Eksisterende tabeller: organizations, organization_members, profiles, teams, team_members, sessions, session_participants, session_items, votes
- Sprint 5 tilføjede: `sessions.voting_mode`, `retro_events` (12 rows), `challenges` (18 rows)
- Sprint 6 tilføjede: `projects`, `sprints`, `session_templates`, `node_completions`, nye felter på `sessions` og `session_items`
- Migration kørt: 2026-03-19 via Supabase Management API (`sprint5.sql` + `sprint6.sql`)

## Tech stack
- React (hooks only) + Vite
- Supabase (Auth + DB + Realtime)
- Web Audio API (lyd — ingen filer)
- CSS animations inline
- Press Start 2P + VT323 (Google Fonts)
- Hosting: Nordicway
- Backend: Express i `server/`

## Filer
- `src/screens/SessionSetup.jsx` — NY: Admin UI til session oprettelse
- `src/screens/ActiveSession.jsx` — Opdateret: voting_mode, DB challenges/retro
- `src/screens/Session.jsx` — Opdateret: DB writes på completion
- `src/screens/SessionLobby.jsx` — Opdateret: Setup button
- `src/App.jsx` — Opdateret: /setup route
- `server/app.js` — Opdateret: voting_mode i session INSERT
- `supabase/migrations/sprint5.sql` — NY: Schema changes
- `supabase/seed/sprint5-defaults.sql` — NY: Default data

## Design-principper (rør ikke)
- Pixel art æstetik
- Alt lever — ingen statiske elementer
- Lyd på alt
- Boss battle = opgaven der skal estimeres
- Tavern hub = world select

## Lokation
`/root/.openclaw/workspace/projects/reveal/`
er — ingen statiske elementer
- Lyd på alt
- Boss battle = opgaven der skal estimeres
- Tavern hub = world select

## Lokation
`/root/.openclaw/workspace/projects/reveal/`
