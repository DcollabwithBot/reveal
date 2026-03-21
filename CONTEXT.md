# Reveal — Projekt CONTEXT

Last updated: 2026-03-21 (Tech Debt Sprint + Features + Guided Tour)

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: v3.2 — tech debt ryddet, features tilføjet, guided tour klar
- Live: https://reveal.blichert.net ✅
- GitHub: https://github.com/DcollabwithBot/reveal
- Branch: `main`
- App: `app/` — Vite + React
- **Næste:** Madro subsite deploy, Reveal deploy, pilottest med rigtige teams

## Arkitektur
- `docs/ARCHITECTURE.md` — bindingsmodel, tech stack, API model (source of truth)
- `docs/TECH-DEBT.md` — tech debt backlog (P1-P5 done)
- `docs/NEXT-FEATURES.md` — feature backlog
- `docs/GUIDED-TOUR.md` — interaktiv tour spec
- `docs/API.md` — REST API dokumentation

## Tech Stack
- Frontend: Vite + React (SPA)
- Backend: Supabase (PostgreSQL + RLS + Edge Functions) — INGEN custom backend
- Deploy: Nordicway cPanel (reveal.blichert.net)
- Auth: Supabase Auth (Google OAuth)

## Tech Debt Sprint (2026-03-21) — ALL DONE ✅

### P1: Shared Helpers
- `lib/participantHelpers.js` — fetchSessionParticipants, mapParticipantToSprite, getDisplaySprites
- `lib/sessionHelpers.js` — fetchSessionWithItems, fetchRawParticipants, subscribeToGameSession, broadcastVote
- `lib/helpers/projectHelpers.js` — fetchProjectsForOrg, fetchSprintsForOrg, fetchItemsForSprint, buildAuthHeaders
- `lib/hooks/useAuth.jsx` — centraliseret auth context
- 14 screens refaktoreret til shared helpers

### P2: api.js Split
- 2456-linjers monolith → 6 domæne-moduler (session, project, game, org, integration, shared)
- api.js er nu 7-linjers facade med re-exports

### P3: Error Handling
- `lib/errorHandler.js` — handleError + handleSoftError
- 70 tomme catch blocks fikset med beskrivende context-strings

### P4: Component Extraction
- 41 nye filer fra 4 store screens
- BluffPoker (12 filer), NestingScope (12), SpeedScope (11), SprintDraft (5)

### P5: Shared Styles
- `shared/styles.js` — spectatorBar, cornerControls, fixedScanlines
- 25+ inline blocks konsolideret

## Features (2026-03-21) ✅

### Real Data (ikke hardcoded)
- XP persistence — profiles.xp + user_achievements skriver til DB
- Real team members — Overworld + WorldSelect henter fra organization_members
- Real participants — Session.jsx + 5 game screens bruger session_participants med NPC fallback
- leaderboard_org VIEW fix — kode skriver ikke direkte til VIEW

### SessionLaunchModal Item-selektion
- Henter backlog items fra aktiv sprint
- Multi-select med vælg alle / fravælg alle
- Valgte items sendes med til session creation

### GM Approval-flow UI
- "Godkendelser" tab i ProjectWorkspace med badge count
- Pending estimates med godkend/afvis knapper
- Kalder approve-mutation Edge Function

### Session-log
- "Sessions" tab i ProjectWorkspace
- Historik over alle sessions med mode, dato, deltagere, summary
- Expanderbar detaljevisning

### REST API + API Keys
- `supabase/functions/reveal-api/index.ts` — 9 read-endpoints
- `api_keys` tabel med SHA-256 hash, scopes, expiry
- Settings UI til generering/revoke af nøgler
- `docs/API.md` med PowerBI setup guide

### In-app Dokumentation
- `/docs` route med 7 sektioner (dansk)
- Alle 14 game modes dokumenteret
- PM Dashboard, World Map, API, roller, FAQ

### Interaktiv Guided Tour
- react-joyride med 9-step tour
- Demo mode (/demo med Acme Development seed data)
- Onboarding (auto-start for nye brugere, kan skippes)
- Explore (fra /docs + Settings → genstart)

## Scripts
- `scripts/ship.sh "message"` — build + verify + commit + push
- `scripts/audit.sh` — tech debt scan

## Constraints
- Ingen arkitekturændringer uden Dannys godkendelse
- Alle Supabase-kald på tværs af screens SKAL bruge shared helpers
- Ingen custom backend/Express — alt via Supabase + Edge Functions
