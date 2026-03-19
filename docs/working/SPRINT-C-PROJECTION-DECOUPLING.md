# Reveal — Sprint C: Projection Decoupling

Date: 2026-03-19
Status: Started
Owner: James
Depends on:
- `SPRINT-A-SUMMARY.md`
- `sprint-b-handoff.md`
- `schema-audit.md`
- `ownership-and-writeback-matrix.md`
- `sprint-a-migration-recommendations.md`

## Formål

Sprint C skal begynde at flytte Reveal væk fra prototype-game-logik i frontend og over mod et egentligt projection layer.

Det betyder ikke, at vi bygger hele game engine om.
Det betyder, at vi tager de vigtigste regler og semantikker ud af React-komponenter og constants, så de kan styres af data/config og ikke bliver skjult forretningslogik.

## North star

**Game-laget skal være et projection layer ovenpå canonical PM-data — ikke et sæt hårdkodede frontend-beslutninger.**

---

## Scope

### In scope
- Kortlægge runtime hotspots for gameplay/projection
- Prioritere hvilke hardcoded områder der skal flyttes først
- Definere første batch af projection data/config surfaces
- Forberede konkrete implementation tasks for migration/config tabeller og runtime binding

### Out of scope
- fuld connector implementation
- stor UI-redesign
- fuld game-engine arkitektur
- omskrivning af hele session-flowet på én gang

---

## Primære fokusområder

### P1
- boss/pressure semantics
- XP/reward rules
- achievements/reward outputs
- world/progression mapping

### P2
- root-cause / NPC commentary
- challenge and retro fallback duality
- template-driven projection binding

### P3
- senere sync-aware projection semantics
- lavere prioriterede presentation-driven constants

---

## Leverancer

1. `projection-runtime-hotspots.md`
2. `projection-model-v1.md`
3. `projection-config-backlog.md`
4. `sprint-c-implementation-sequence.md`

---

## Exit criteria

Sprint C er done når:
- de vigtigste gameplay-hotspots er kortlagt og prioriteret
- vi har en tydelig model for hvad der skal blive data/config først
- vi har en implementerbar sekvens for at flytte de første ting ud af frontend
- vi ikke længere er i tvivl om hvor Reveal’s projection lag starter og slutter

---

## Kort dom

Sprint C handler om at tage Reveal fra “fed prototype-logik” til “robust produktlogik”.
