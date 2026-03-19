# SPRINT 5 — Reveal: Admin UI + DB-Driven Content + Voting Modes

> **Rewritten:** 2026-03-19 (architectural decision by Danny)
> **Previous plan:** task-centric, started with game engine
> **This plan:** DB-first, admin UI first

---

## Core Principle

**DB is the single source of truth.**

The game loads from DB and writes back to DB.
The admin UI seeds the DB.
The game is just how you fill it in.

---

## Corrected Build Order

```
1. Admin UI FIRST
   → PM/GM creates org, team, project, session, items, selects voting mode

2. DB gets seeded correctly from admin UI
   → sessions table gets voting_mode, session_items get populated

3. Game loads everything from DB (not constants.js)
   → challenges, retro_events fetched from DB with fallback

4. Game writes outcomes back to DB
   → votes, estimates, node completions

5. Summary/results pull from DB back into admin UI
   → session_items.final_estimate readable from admin
```

---

## What We Are NOT Doing

- No XP/achievements logic
- No org management UI
- No overworld world_nodes DB migration (too complex — keep constants for now)
- No Jira integration
- No billing/Stripe
- No pretty design on admin UI — functional is enough
- No character classes / equipment from DB (Sprint 6+)

---

## DB Changes

### Files to create for Danny to run manually

`supabase/migrations/sprint5.sql` — schema changes
`supabase/seed/sprint5-defaults.sql` — seed data from constants.js

### Schema changes
- `sessions.voting_mode` column (fibonacci | tshirt)
- `retro_events` table (replaces SPRINT_EVENTS constant)
- `challenges` table (replaces ROULETTE_CHALLENGES constant)

---

## Tasks

### Task 1: DB Migration file (supabase/migrations/sprint5.sql)
Create migration SQL for Danny to run manually in Supabase SQL editor.

### Task 2: DB Seed file (supabase/seed/sprint5-defaults.sql)
Seed all 12 SPRINT_EVENTS and 18 ROULETTE_CHALLENGES from constants.js as global defaults (organization_id = NULL).

### Task 3: Admin UI — SessionSetup.jsx (NEW FILE: src/screens/SessionSetup.jsx)
Functional form for GM:
- Session name
- Add/remove backlog items (title + description)
- Choose voting mode (Fibonacci or T-shirt)
- Submit → INSERT into sessions + session_items → show join link
- Route: /setup (GM role only)

### Task 4: voting_mode in ActiveSession.jsx
- Read session.voting_mode from DB
- Show Fibonacci [1,2,3,5,8,13,21,?] or T-shirt [XS,S,M,L,XL,XXL,?] cards
- T-shirt reveal shows MODE (most common), not average

### Task 5: Load challenges from DB
- Replace ROULETTE_CHALLENGES import with Supabase query
- Fallback to constants.js if DB returns empty

### Task 6: Load retro events from DB
- Replace SPRINT_EVENTS import with Supabase query
- Fallback to constants.js if DB returns empty

### Task 7: Session.jsx writes node completion to DB
- On safeComplete(), write to node_completions
- If no dbId available, skip silently

### Task 8: Session.jsx writes final estimate to DB
- On GM confirm, UPDATE session_items SET final_estimate, status='completed'

### Task 9: App.jsx routing
- Add /setup route → SessionSetup
- After creation, navigate to /lobby/:joinCode (or lobby with session active)

### Task 10: Update CONTEXT.md

---

## Acceptance Criteria

- [ ] GM can create a session with items and voting mode via /setup
- [ ] Players see Fibonacci OR T-shirt cards based on session.voting_mode from DB
- [ ] T-shirt reveal shows mode (most common value), not average
- [ ] Challenges load from DB (with fallback to constants.js)
- [ ] Retro events load from DB (with fallback to constants.js)
- [ ] Final estimates write back to session_items in DB
- [ ] /setup → lobby flow works end to end

---

## Branch

`james/sprint-5-db-driven`

Final commit: `feat: sprint 5 - admin UI, DB-driven content, voting modes`

---

*Rewritten: 2026-03-19*
*Architectural decision: DB-first, admin UI first*
