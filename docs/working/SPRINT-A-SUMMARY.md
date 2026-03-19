# Reveal — Sprint A Summary

Date: 2026-03-19
Status: Completed

## Kort dom

Sprint A gjorde det vigtigste rigtige:
- stoppede feature/reflexet
- kortlagde Reveal som det faktisk er
- gjorde refactor-risiko konkret
- skilte PM/canonical data og gameplay/projection tydeligere ad på dokumentniveau

Det vigtigste fund:
- PM/governance-kernen ser sund ud
- det farlige lag er gameplay/projection-laget, fordi for meget stadig lever som frontend- og runtime-logik
- integration-ready er rigtigt som retning, men ikke endnu som moden implementation

## Hvad Sprint A leverede

- `SPRINT-A-DATA-AUDIT.md`
- `schema-audit.md`
- `integration-readiness-gap-list.md`
- `ownership-and-writeback-matrix.md`
- `sprint-a-migration-recommendations.md`

## Vigtigste konklusioner

### 1. Canonical model er ved at være reel
Reveal har allerede et relativt stærkt PM/governance-fundament:
- projects
- sprints
- session_items
- sessions
- votes
- approval_requests
- event_ledger
- audit_log

### 2. Gameplay-laget er stadig det største fremtidige refactor-risk
Hardcoded hotspots findes især omkring:
- world/progression definitions
- boss/pressure semantics
- XP/reward rules
- root-cause / NPC commentary
- fallback challenge/event content

### 3. Den vigtigste arkitektur-skillelinje er nu tydelig
Reveal skal behandles som:
- canonical PM model
- governance/event layer
- gameplay projection layer
- presentation layer

### 4. Connected mode kræver mere end connector-kode
De vigtigste mangler er:
- tydelig ownership pr. felt
- stærkere external identity model
- mere moden conflict semantics
- sync-ledger som egentlig connector-domæne, ikke bare generisk event-logik

## Mest værdifulde anbefalinger fra Sprint A

### Batch 1 (højeste leverage)
- `external_refs`
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`

### Batch 2
- `projection_content`
- template/profile binding
- conventions for session/vote metadata

### Batch 3
- `sync_conflicts`
- `sync_ledger`

## Hvad vi bevidst ikke gjorde i Sprint A

- ingen stor refactor
- ingen ny UI
- ingen connected mode implementation
- ingen overengineering af alle tabeller på én gang

Det var rigtigt.

## Hvad Sprint B skal gøre

Sprint B skal omsætte Sprint A fra analyse til kontraktmæssig skarphed:
- ownership model
- write-back model
- approval/sync relationer
- field-level policy thinking
- runtime-nære beslutninger om hvad der må hvad

## Kort anbefaling

Hvis Reveal skal undgå den store grimme migration senere, så var Sprint A nødvendig.
Hvis Reveal skal begynde at blive robust, så er Sprint B næste naturlige og rigtige skridt.
