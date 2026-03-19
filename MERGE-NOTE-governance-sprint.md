# Merge Note — Governance Sprint Branch

Branch: `feature/reveal-sprint1-contract-approval-guards`
Prepared: 2026-03-19

## Summary
This branch completes the governance/advisory approval flow for Reveal and brings the frontend, backend, tests, migration, and docs into alignment.

## Included
- Approval request lifecycle: create / approve / reject / apply
- PM mutation guard on write-back sensitive endpoints
- Event contract + event ledger + audit trail v1
- Apply pipeline with target-specific whitelist and normalization rules
- Advisory overlay in session/game flow
- Sync health + conflict center endpoints
- Queue-based conflict resolution flow
- Dedicated frontend dashboard route (`/dashboard`)
- Governance UI extracted into reusable components
- Lazy-loaded heavy screens / bundle splitting
- Sprint docs and working docs organized under `docs/`

## Validation
- Server tests: 19/19 passing
- App production build: passing
- Bundle split improved: main bundle reduced, heavy screens chunked

## Important notes
- Conflict resolution is now usable, but still v1 UX.
- Routing is acceptable and cleaned up; still a lightweight custom approach, not a full router library.
- Working notes/specs now live in `docs/working/` rather than repo root.

## Recommended merge strategy
- Squash merge is fine if you want a clean main history.
- Regular merge is also fine if you want the implementation trail preserved.

## Key commits in final stretch
- `30aa6b3` feat(governance): tighten apply normalization and advisory UX
- `e1fc6d3` feat(dashboard): add governance workspace and refresh sprint docs
- `4264143` refactor(governance): split dashboard workspace into components
- `131125b` feat(conflicts): add queue-based resolution flow from conflict center
- `f4ac5e3` feat(routing): add dedicated dashboard route and simplify lobby
- `c4084a3` refactor(routing): sync auth screen from path without render-time state
- `5bf320d` chore(premerge): organize working docs and split app bundle
