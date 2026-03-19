# Reveal — Sprint C Implementation Sequence

Date: 2026-03-19
Status: Sprint C working output
Purpose: Gøre Sprint C handlingsbart i rigtig rækkefølge.

## Sequence

### Step 1 — Define config/data shapes
- boss profile shape
- reward rule shape
- achievement definition shape
- world/progression shape
- commentary content shape

### Step 2 — Introduce config storage surfaces
- migrations or config tables for first batch
- keep existing frontend logic as temporary consumer/fallback only while migrating

### Step 3 — Replace highest-risk frontend semantics
- Session.jsx reward/boss logic
- shared/constants world/challenge content
- Overworld progression/reward mapping

### Step 4 — Reduce fallback duality
- challenge and retro sources should stop competing between constants and DB/config

### Step 5 — Prepare Sprint D handoff
- document what remains for external refs/sync_conflicts/sync_ledger

## Do not do first
- do not rewrite all UI first
- do not try to perfect connected mode now
- do not build giant generalized engine before moving first 20% of risky semantics out of frontend

## Success condition
After Sprint C, new gameplay semantics should naturally want to live in config/data — not in React components.
