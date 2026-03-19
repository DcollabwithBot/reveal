# SPRINT 7 SPEC — Reveal (v3.1)

Dato: 2026-03-19
Status: Draft klar til eksekvering
Owner: James (PM)

## Mål (Sprint 7)
Lever Perspektiv-Poker + baseline notifikationer, ovenpå Sprint 6 foundation, uden at skabe ny arkitekturgæld.

## Scope (IN)

### 1) Perspektiv-Poker game mode (core)
- Nyt voting mode: `perspective_poker`
- Spillere vælger perspektiv-kort (fx Dev, QA, PM, Security) + estimat
- Reveal viser:
  - consensus pr. perspektiv
  - samlet anbefalet estimat
  - outliers markeret
- Gemmes i DB som del af session resultater

### 2) Webhook MVP (Slack/Teams-ready)
- Webhook events:
  - `session.started`
  - `session.ended`
  - `session.results_ready`
- Retry-policy (simpel): max 3 forsøg med backoff
- Fejl må ikke blokere session flow

### 3) Result polish (non-numeric support)
- Konsensus-regler for ikke-numeriske modes (T-shirt + perspective)
- Mere tydelig summary i `/sessions/:id/results`

### 4) Assigned-to UX fix
- Erstat rå UUID input med simpel profilvælger i projects/items

## Scope (OUT)
- Avanceret bi-directional Jira/DevOps sync
- Teams adaptive cards
- Kompleks analytics dashboard
- Nyt deploy-framework

## Data/model ændringer
- Udvid `sessions.voting_mode` med `perspective_poker`
- Ny tabel til perspective votes (hvis ikke eksisterende struktur kan rumme det)
- Webhook deliveries tabel (status + attempts + last_error)

## API ændringer
- POST/GET endpoints til perspective-votes
- POST endpoint til webhook config (team/projekt niveau)
- Worker/queue endpoint til delivery retries (eller cron-triggeret job)

## UI/Routes
- `SessionSetup`: vælg Perspective Poker
- `ActiveSession`: perspective cards + estimat flow
- `SessionResultsScreen`: grouped consensus + samlet anbefaling
- `ProjectsScreen`: assigned_to picker

## Acceptance criteria
1. GM kan oprette session med `perspective_poker` mode.
2. Deltagere kan afgive perspektiv + estimat uden errors.
3. Resultatside viser consensus pr. perspektiv + samlet estimat.
4. Webhook events sendes på start/slut/results_ready.
5. Webhook fejl påvirker ikke session UX.
6. Assigned_to vælges via profil-dropdown (ikke UUID felt).
7. Build passer (`npm run build`).

## Task split (max 3 dev tasks)

### Task A — Perspektiv-Poker engine + UI
- Filer (forventet):
  - `src/screens/SessionSetup.jsx`
  - `src/screens/ActiveSession.jsx`
  - `src/screens/SessionResultsScreen.jsx`
  - `server/app.js`
  - `supabase/migrations/sprint7.sql`

### Task B — Webhook MVP
- Filer (forventet):
  - `server/app.js`
  - `server/*` (delivery helper/queue)
  - `supabase/migrations/sprint7.sql`

### Task C — Assigned-to picker + polish
- Filer (forventet):
  - `src/screens/ProjectsScreen.jsx`
  - `src/lib/api.js`
  - evt. mindre server endpoint til profil-liste

## Reviewer gate (før deploy)
- Security review script
- Lint/build sanity
- Quick smoke: opret session -> vote -> reveal -> results -> webhook log

## Risici
- Webhook retries kan skabe støj hvis endpoint er nede
- Perspective consensus kan blive utydelig uden stram UX

## Done definition
- AC 1-7 opfyldt
- Migration kørt på target miljø
- Commit(s) på feature branch
- Sprint 7 summary opdateret i CONTEXT/HANDOFF
