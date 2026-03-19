# REVEAL — Handoff

Last updated: 2026-03-19
Branch: `feature/reveal-sprint1-contract-approval-guards`
Status: Merge-prep complete

## Kort status
Governance-sporet er nu implementeret ende-til-ende og er klar til merge.

## Leveret i denne branch
- Approval request lifecycle: create / approve / reject / apply
- PM mutation guard på write-back følsomme endpoints
- Event contract + event ledger + audit trail v1
- Target-specific apply pipeline med whitelist + normalisering/validering
- Advisory overlay i game/session flow
- Sync health + conflict feed endpoints
- Queue-baseret conflict resolution flow fra Conflict Center
- Dedikeret frontend dashboard route (`/dashboard`)
- Governance UI splittet ud i komponenter
- Working docs/specs ryddet ind under `docs/`
- Lazy loading på tunge screens / bundle-splitting

## Validering
- Server tests: 19/19 grøn
- App build: grøn
- Frontend chunking forbedret; tunge screens er splittet ud

## Vigtige filer
- `server/app.js`
- `server/domain/approvalApplyPipeline.js`
- `server/domain/approvalStateMachine.js`
- `server/domain/eventContract.js`
- `server/domain/eventLedger.js`
- `server/domain/pmMutationPolicy.js`
- `server/domain/writeBackGuard.js`
- `app/src/App.jsx`
- `app/src/screens/Dashboard.jsx`
- `app/src/screens/Lobby.jsx`
- `app/src/screens/Session.jsx`
- `app/src/components/governance/*`
- `docs/contracts/sprint1-approval-api.md`
- `docs/sprint8-governance-sync.md`
- `docs/working/*`
- `supabase/migrations/sprint8_governance_sync.sql`

## Ikke-blocking restpunkter
- Conflict Center UX er v1 og kan raffineres yderligere
- Routing er clean nok, men stadig custom/lightweight
- Apply pipeline kan senere få mere domænespecifik business logic

## Merge note
Se også: `MERGE-NOTE-governance-sprint.md`
