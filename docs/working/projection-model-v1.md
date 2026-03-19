# Reveal — Projection Model v1

Date: 2026-03-19
Status: Sprint C working output
Purpose: Beskrive hvordan Reveal’s game/projection layer bør tænkes som model, så det kan afkobles fra frontend-hardcoding og stadig respektere PM source-of-truth.

## TL;DR

Projection layer skal tage canonical PM-data + events som input og producere gameplay-/momentum-signaler som output.

Det må aldrig være source-of-truth.
Det må aldrig skrive direkte tilbage til PM-data.
Det må gerne være data-drevet.

## Model

### Input layer
Projection layer læser:
- projects
- sprints
- session_items
- sessions
- votes
- approval_requests
- audit/event streams
- challenge/retro catalogs
- templates/game profile config

### Transformation layer
Projection rules omdanner input til:
- boss state
- pressure state
- world/progression state
- XP/reward outcomes
- achievement unlocks
- commentary/challenge suggestions

### Output layer
Projection layer producerer:
- UI-friendly runtime state
- overlay signals
- session feedback
- advisory recommendations (via approval path, aldrig direkte PM write)

## Hvad projection layer må eje
- boss HP as derived signal
- pressure score
- XP score
- achievement unlock state
- challenge availability
- world map/progression rendering state
- commentary payloads

## Hvad projection layer IKKE må eje
- project status som canonical felt
- sprint status som canonical felt
- item status/priority/assignee/progress
- approval state
- risk/governance authority
- audit/event ownership

## Data/config surfaces needed
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`
- `projection_content`
- senere template/profile bindings

## First implementation rule
Flyt regler før du flytter alt UI.
Det vil sige:
- decouple semantics first
- leave presentation shells intact a bit longer

## Design rule
Hvis et gameplay-signal ikke kan forklares som:
- canonical input
- transformation rule
- projection output

...så er det sandsynligvis stadig prototype-logik og bør ikke sprede sig videre.
