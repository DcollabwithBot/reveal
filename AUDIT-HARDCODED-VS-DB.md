# AUDIT: Hardcoded vs. DB-driven — Reveal Codebase

> Generated: 2026-03-19  
> Scope: Sprint 1-3 screens + Sprint 4b (SessionLobby, ActiveSession), server/app.js, src/shared/constants.js, src/hooks/useSession.js

---

## 1. Hardcoded Things That Should Come from DB

### `src/shared/constants.js` — The Mother Lode

Everything game-content-related lives here. None of it comes from the database.

#### Character Classes (`CLASSES`, line 8–16)
7 classes (warrior, mage, archer, healer, rogue, berserker, necro) with `id`, `name`, `icon`, `color`, `proj`, `trail`, `spellName`.  
→ Should be a `character_classes` table. Customers can't change available classes without code change.

#### NPC Team (`NPC_TEAM`, line 18–23)
Hardcoded 4 fake NPCs (Mia, Jonas, Sara, Emil) with fixed names, classes, colors, skins.  
→ Should come from `team_members` + `profiles`. Currently a demo fixture.

#### Equipment (`HELMETS`, `ARMORS`, `BOOTS`, `WEAPONS`, `AMULETS`, lines 25–73)
Five full equipment arrays. Each item has `id`, `name`, `icon`, `color`, `pv` (preview value).  
→ Should be an `equipment` or `items` table. Customers cannot customize avatar gear options.

#### Skin Colors (`SKINS`, line 75)
10 hardcoded hex values. Minor, but should be DB-configurable.

#### Sprint Retrospective Events (`SPRINT_EVENTS`, lines 78–91)
12 hardcoded events (well/wrong/improve/surprise categories) with `id`, `cat`, `icon`, `title`, `desc`, `dmg`/`hp`.  
→ Should be a `retro_events` or `session_events` table. Customers cannot customize what events appear in retrospectives.

#### Roulette Challenges (`ROULETTE_CHALLENGES`, lines 93–112)
18 hardcoded challenges (human/tech/extern categories) with `id`, `cat`, `icon`, `title`, `desc`, `modifier`, `color`.  
→ Should be a `challenges` table. Customers cannot add domain-specific challenges.

#### Worlds / World Map (`WORLDS`, lines 114–157)
3 hardcoded worlds (Platform Team, Kunde X, Infra Team) each with full node arrays and path arrays.  
Each node: `{id, x, y, c, i, l, dn, tp, cur}` — hardcoded x/y positions, labels, done-status, types.  
→ Should come from `worlds` and `world_nodes` tables (which apparently exist in schema — see §3).

---

### `src/screens/Session.jsx` — Sprint 1-3 Game Engine

#### `PV = [1, 2, 3, 5, 8, 13, 21]` (line 1)
Planning Poker card values. Hardcoded Fibonacci sequence.  
→ Should come from session config or a `card_sequences` table. Teams using T-shirt sizes (XS/S/M/L/XL) can't use this.

#### `CHAL` (line 3–9, local copy)
Simplified 5-item challenge list, a subset of `ROULETTE_CHALLENGES` in constants. Duplicated.  
→ Dead code or should merge with constants → DB.

#### `ACHIEVEMENTS` (lines 11–23)
12 hardcoded achievements with `id`, `name`, `icon`, `desc`.  
→ Should be `achievements` table. Org-specific achievements not possible.

#### Boss name fallback (line 35)
```js
const bossName = node?.l || project?.name || "PROJ-142: OAuth2 Login Flow";
```
Hardcoded fallback story content.

#### `maxHp = 100` (line 36)
Hardcoded game balance constant. Should come from session/game config.

#### `retroEvents` initialization (lines ~85-88)
```js
const [retroEvents] = useState(() => {
  const shuffled = [...SPRINT_EVENTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
});
```
Picks 6 random events from the hardcoded constant. No DB involved.

#### Risk cards (Session.jsx, step 2 discussion, line ~280)
```js
{["🔥 Dependency", "🧱 Legacy", "🕳️ Unknown", "🧑💻 Single PoK"].map(...)}
```
4 hardcoded risk card labels inlined in JSX.

#### Power-ups (Session.jsx, step 2, line ~290)
```js
[{id:"expert",i:"📞",n:"Expert"},{id:"audience",i:"📊",n:"Audience"},{id:"5050",i:"✂️",n:"Cut"},{id:"oracle",i:"🔮",n:"Oracle"}]
```
4 hardcoded lifeline types.

---

### `src/screens/WorldSelect.jsx`

#### `WORLDS` import (line 3)
The entire world list is from the constant. `WorldSelect` renders world "portals" purely from the hardcoded `WORLDS` array. No Supabase call.

#### `NPC_DEFS` (lines 6–11)
```js
const NPC_DEFS = [
  { name: "Mia", cls: {...}, hat: "#b55088", px: 18, py: 62 },
  ...
]
```
Duplicate of NPC_TEAM, with hardcoded pixel positions.

---

### `src/screens/Overworld.jsx`

#### `NODES` and `PATHS` (lines ~25-26)
```js
const NODES = project?.nodes || [];
const PATHS = project?.paths || [];
```
These come from `project` prop, which is a world object from the hardcoded `WORLDS` constant. No DB.

#### XP display (line ~175)
```js
<span>⭐1240</span>
```
Hardcoded XP number. No player progression from DB.

---

### `reveal-session.jsx` (prototype file in repo root)

Legacy standalone file. Contains:
- Hardcoded `TEAM` with 5 members
- `isR = false` hardcoded flag for roulette mode
- `bossName = "PROJ-142: OAuth2 Login Flow"` (hardcoded)
- All same patterns as `src/screens/Session.jsx` but without node prop

This file appears to be an archived Sprint 1 prototype. Can probably be deleted.

---

## 2. Current Supabase Integration Status

### ✅ What Actually Reads/Writes Supabase

**`server/app.js` (backend)**
| Endpoint | Operation | Tables |
|----------|-----------|--------|
| `GET /api/health` | SELECT | `organizations` |
| `GET /api/sessions/join/:code` | SELECT | `sessions` |
| `POST /api/auth/provision` | SELECT + INSERT | `team_members`, `organizations`, `teams` |
| `POST /api/sessions` | SELECT + INSERT | `team_members`, `organizations`, `teams`, `sessions`, `session_items` |
| `PATCH /api/sessions/:id` | UPDATE | `sessions` |
| `GET /api/sessions` | SELECT | `sessions`, `session_items` (count) |

**`src/hooks/useSession.js`**
- Reads: `sessions`, `session_items`, `votes` (with profiles join) on mount
- Realtime: subscribes to `sessions` changes + `votes` INSERT/UPDATE via Supabase channels
- Presence: tracks online users per session via Supabase presence
- Writes: `votes.upsert()` with `castVote()`

**`src/screens/ActiveSession.jsx`**
- Uses `useSession` hook for all reads/realtime
- GM controls write via `apiFetch` (PATCH sessions, next item index)
- Shows real vote values from DB, revealed on GM trigger
- Auth: uses `supabase.auth.getUser()`

**`src/screens/SessionLobby.jsx`**
- Reads sessions via API (server → Supabase)
- Creates sessions via API (server → Supabase)
- Join by code via API

**`src/screens/AuthScreen.jsx`** (not fully read but referenced)
- Presumably handles Supabase auth flows

---

### ❌ What Does NOT Use Supabase (Pure Local State)

**`src/screens/Session.jsx`** — the main game engine for Poker/Roulette/Retro
- **Zero Supabase calls**
- All votes are `useState` — not persisted
- SPRINT_EVENTS picked randomly on mount — not from DB
- ROULETTE_CHALLENGES imported from constants — not from DB
- NPC votes are `Math.random()` — not real participants
- All game outcomes (HP damage, achievements, loot) are local state
- `onComplete(node.id)` is called when done — but there's no write back to DB to mark the node as completed

**`src/screens/WorldSelect.jsx`** — renders worlds from hardcoded constant
**`src/screens/Overworld.jsx`** — renders map nodes from hardcoded constant
**`src/screens/AvatarCreator.jsx`** — renders classes/equipment from hardcoded constant

---

### Critical Gap: Session.jsx is a Disconnected Island

The architecture has two separate flows that don't connect:

```
Flow A (Sprint 4b / multiplayer):
  AuthScreen → SessionLobby → ActiveSession
  (full Supabase integration, real votes, realtime)

Flow B (Sprint 1-3 / solo game):
  AvatarCreator → WorldSelect → Overworld → Session
  (no Supabase, all local state, NPC mocks)
```

`App.jsx` (line ~35-55) routes users to `SessionLobby` (Flow A) after auth, so **Flow B is currently unreachable from the main app** unless you modify `App.jsx` to navigate there. Flow B is essentially a demo/prototype that's been superseded.

---

## 3. Gap Analysis: Schema vs. Frontend

Based on tables referenced in `server/app.js`, `useSession.js`, and the task description:

| Table | Exists in Schema | Used in Frontend | Notes |
|-------|-----------------|------------------|-------|
| `organizations` | ✅ | Provision only | Never read in UI |
| `teams` | ✅ | Provision only | Never read in UI |
| `team_members` | ✅ | Yes (team_id lookup) | Role not used in UI |
| `sessions` | ✅ | ✅ Full CRUD | Core table |
| `session_items` | ✅ | ✅ Read + Insert | Core table |
| `votes` | ✅ | ✅ Full CRUD + realtime | Core table |
| `profiles` | ✅ | Partial (display_name in votes join) | `avatar_class` field queried but not rendered |
| `worlds` | ✅ (mentioned in task) | ❌ Never queried | Frontend uses hardcoded `WORLDS` constant |
| `world_nodes` | ✅ (mentioned in task) | ❌ Never queried | Frontend uses `project.nodes` from constant |
| `challenges` | ❌ (inferred) | ❌ | `ROULETTE_CHALLENGES` is all hardcoded |
| `retro_events` / `events` | ❌ (inferred) | ❌ | `SPRINT_EVENTS` is all hardcoded |
| `character_classes` | ❌ (inferred) | ❌ | `CLASSES` is hardcoded |
| `equipment` | ❌ (inferred) | ❌ | All gear arrays hardcoded |
| `achievements` | ❌ (inferred) | ❌ | `ACHIEVEMENTS` hardcoded |
| `card_sequences` | ❌ (inferred) | ❌ | `PV = [1,2,3,5,8,13,21]` hardcoded |

### What `worlds` / `world_nodes` tables likely contain but frontend ignores:
The DB schema likely has `worlds` with name, icon, color, sprint reference, progress tracking — but `WorldSelect.jsx` never fetches them. Same for `world_nodes` — node positions, types, done-status are hardcoded in the `WORLDS` constant.

### What's missing from `profiles`:
`useSession.js` does `votes.select('*, profiles(display_name, avatar_class)')` but `avatar_class` is never rendered — only `display_name` is shown, and even that falls back to `user_id.slice(0, 6)`. Avatar data from DB not used in UI.

---

## 4. Recommended Next Steps (Prioritized)

### Priority 1 — Bridge the two flows (high business impact)

**Connect `Session.jsx` to Supabase.**  
Right now the game engine is a disconnected island. At minimum, when a session node is completed, write back to DB:
```js
// After safeComplete():
await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId)
// Or mark a world_node as done:
await supabase.from('world_nodes').update({ done: true }).eq('id', node.dbId)
```

Also: persist voting results. When `doReveal()` fires, write the final estimate to `session_items`:
```js
await supabase.from('session_items').update({
  final_estimate: clamp(Math.round(avg)),
  status: 'completed'
}).eq('id', currentItem.id)
```

---

### Priority 2 — Load worlds and nodes from DB

Replace the `WORLDS` constant with a Supabase fetch in `WorldSelect.jsx`:
```js
const { data: worlds } = await supabase
  .from('worlds')
  .select('*, world_nodes(*)')
  .eq('team_id', teamId)
```

This makes each customer's world map their own. Without this, all teams share the same 3 hardcoded worlds.

---

### Priority 3 — Make SPRINT_EVENTS and ROULETTE_CHALLENGES DB-driven

Create `retro_events` and `challenges` tables. Seed defaults. Then load them per organization:
```js
const { data: events } = await supabase
  .from('retro_events')
  .select('*')
  .eq('organization_id', orgId)
```

This is the core customization ask — customers need to add their own retrospective events and challenges.

---

### Priority 4 — DB-driven session config (card values, game mode)

Create a `session_config` JSONB column on `sessions` (or separate table) that stores:
```json
{
  "card_values": [1, 2, 3, 5, 8, 13, 21],
  "game_mode": "poker",
  "max_retro_events": 6,
  "challenge_categories": ["human", "tech", "extern"]
}
```

In `ActiveSession.jsx`, read `session.config` and pass card values to `VoteCard` instead of hardcoded `FIBONACCI`.

---

### Priority 5 — Load character classes and equipment from DB

Low urgency (purely cosmetic), but needed for true multi-tenant customization. For now, the hardcoded `CLASSES` and equipment arrays in `constants.js` are the biggest consistency risk — if one changes, all instances change.

Create `character_classes` and `equipment_items` tables, seed them with current data, then fetch on `AvatarCreator` load.

---

### Priority 6 — Wire `profiles.avatar_class` to actual avatar rendering

`useSession.js` already joins `profiles(avatar_class)` in votes query, but `ActiveSession.jsx` ignores this field. Wire it up so participant avatars render with their chosen class icon instead of a generic `🧙`.

---

## Summary Table

| What | Where | Priority | Effort |
|------|-------|----------|--------|
| Session.jsx writes outcomes to DB | Session.jsx | 🔴 P1 | Medium |
| Load worlds/nodes from DB | WorldSelect.jsx, Overworld.jsx | 🔴 P1 | Medium |
| SPRINT_EVENTS from DB | constants.js → new table | 🟠 P2 | Medium |
| ROULETTE_CHALLENGES from DB | constants.js → new table | 🟠 P2 | Medium |
| Card values from session config | Session.jsx, ActiveSession.jsx | 🟡 P3 | Low |
| Game mode config in DB | sessions table | 🟡 P3 | Low |
| CLASSES from DB | constants.js → character_classes table | 🟢 P4 | High |
| Equipment from DB | constants.js → equipment_items table | 🟢 P4 | High |
| profiles.avatar_class rendering | ActiveSession.jsx | 🟢 P5 | Low |
| Delete reveal-session.jsx prototype | repo root | 🟢 cleanup | None |
