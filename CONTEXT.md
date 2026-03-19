# Reveal — Projekt CONTEXT

Last updated: 2026-03-19

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: Aktiv udvikling — v0.5 (Sprint 5 implementeret, afventer DB migration)
- Live: https://reveal.blichert.net
- GitHub: https://github.com/DcollabwithBot/reveal
- Branch: `james/sprint-5-db-driven`
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

1. **DB Migrations (afventer manuelt run)**
   - `supabase/migrations/sprint5.sql` — kør i Supabase SQL editor
   - `supabase/seed/sprint5-defaults.sql` — kør efter migration
   - Tilføjer: `sessions.voting_mode`, `retro_events` tabel, `challenges` tabel

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

## Hvad mangler (næste sprint)

- Danny skal køre `supabase/migrations/sprint5.sql` + `supabase/seed/sprint5-defaults.sql` manuelt
- Verifikation: `session_items.description` kolonne skal eksistere i schema
- Verifikation: `node_completions` tabel skal eksistere for den del at virke
- `/setup` → `/lobby` flow: Regler om hvem der er GM (team_members.role check er best-effort)
- Ingen design polish (intentionelt — functional er nok)

## Roadmap
| Sprint | Indhold | Status |
|--------|---------|--------|
| 1-3 | MVP modes (Poker, Roulette, Boss Battle) | ✅ |
| 4 | Supabase schema + Auth (Google OAuth) | ✅ |
| 4b | Realtime multiplayer + Lobby + Session UI | ✅ |
| 5 | Admin UI, DB-driven content, voting modes | ✅ (kræver DB migration) |
| 6 | Perspektiv-Poker + session templates + Slack/Teams webhooks | |
| 7 | Spec Wars | |
| 8 | Russian Nesting Scope | |
| 9 | Speed Scope | |
| 10 | Jira/Azure DevOps integration | |
| 11 | AI Lifelines + mønstergenkendelse | |

## Supabase
- Projekt ID: `swyfcathwcdpgkirwihh`
- Eksisterende tabeller: organizations, organization_members, profiles, teams, team_members, sessions, session_participants, session_items, votes
- Sprint 5 tilføjer: `sessions.voting_mode`, `retro_events`, `challenges`
- **Kræver manuelt run:** `supabase/migrations/sprint5.sql` + `supabase/seed/sprint5-defaults.sql`

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
