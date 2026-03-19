# Reveal — Field Policy Shortlist v1

Date: 2026-03-19
Status: Sprint B working draft

## Purpose
Definere de vigtigste felter vi skal tage stilling til først, så implementation ikke fortsætter på implicit policy.

## Work item / session item fields

### `title`
- Owner class: `pm_authoritative` / later possibly `shared_with_precedence`
- Game: read + recommend only
- Approval required for game-origin change: yes
- External sync: conditional in connected mode

### `description`
- Owner class: `pm_authoritative` / later possibly `shared_with_precedence`
- Game: read + recommend only
- External sync: conditional

### `status` / `item_status`
- Owner class: `pm_authoritative` now, potentially `shared_with_precedence` later
- Game: may signal pressure/risk, not write directly
- Approval required for game-origin status recommendation: yes
- External sync: highly conflict-prone; must obey ownership matrix

### `priority`
- Owner class: `pm_authoritative`
- Game: may recommend, not write directly
- External sync: conditional

### `assigned_to`
- Owner class: likely `shared_with_precedence` in connected mode
- Game: read only
- Approval required for game-origin write: yes
- External sync: conditional

### `estimated_hours`
- Owner class: `pm_authoritative`
- Game: may interpret, not mutate directly
- External sync: conditional, likely not first-wave

### `actual_hours`
- Owner class: `pm_authoritative` or external if time system becomes authoritative later
- Game: read only
- External sync: conditional

### `progress`
- Owner class: `pm_authoritative`
- Game: projection input only
- External sync: conditional

## Sprint/project fields

### `project.status`
- Owner class: `pm_authoritative`
- Game: recommendation only
- External sync: conditional, not default external-owned in standalone-first model

### `sprint.status`
- Owner class: `pm_authoritative`
- Game: recommendation only
- External sync: conditional

### `goal`
- Owner class: `pm_authoritative`
- Game: read only
- External sync: conditional but not P1

## Governance fields

### `approval_state`
- Owner class: `reveal_authoritative`
- Game: create recommendation only
- External sync: forbidden

### `risk_score`
- Owner class: `reveal_authoritative`
- Game: may display, not authoritatively set
- External sync: mirror only, never source-of-truth

### `reason_codes`
- Owner class: `reveal_authoritative`
- External sync: forbidden as source

### audit/event metadata
- Owner class: `reveal_authoritative`
- External sync: forbidden as source

## Integration identity fields

### `external_refs`
- Owner class: `reveal_authoritative` structure with external-origin values inside entries
- Game: no role
- External sync: populated by integration layer, not by game/UI

## Projection-only fields

### boss HP / pressure / XP / achievements / loot / NPC commentary
- Owner class: `projection_only`
- Must never be treated as canonical PM state
- Can be recalculated or reprojected from canonical inputs/events
