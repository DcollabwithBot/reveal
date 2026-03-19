# Reveal — Sprint B Handoff

Date: 2026-03-19
Status: Sprint B handoff draft
Purpose: Gøre næste sprint (Sprint C) konkret ved at opsummere hvad Sprint B nu har afklaret, og hvad der bør implementeres først.

## Hvad Sprint B nu har gjort

Sprint B har gjort én ting tydelig:

Reveal må ikke fortsætte med implicit policy.

Det er nu eksplicit dokumenteret:
- hvilke write-back paths der er allowed / conditional / forbidden
- hvordan approval state påvirker sync eligibility
- hvilke felter der bør behandles som PM-authoritative, shared, external-authoritative eller projection-only
- at game-layer aldrig må gå direkte på canonical PM-data

## Centrale artefakter fra Sprint B

- `SPRINT-B-OWNERSHIP-WRITEBACK.md`
- `writeback-paths-v1.md`
- `approval-sync-eligibility-v1.md`
- `field-policy-shortlist-v1.md`
- `ownership-and-writeback-matrix.md`

## Hvad Sprint C bør implementere først

### P1 — Projection decoupling batch 1
Disse bør tages først, fordi de reducerer frontend-hardcoded produktlogik:
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`
- begyndende model for world/progression mapping

### P2 — Runtime cleanup targets
Flyt logik ud af frontend-komponenter især omkring:
- boss/pressure semantics
- XP/reward logic
- achievement triggers
- challenge/root-cause commentary
- fallback duality mellem DB content og constants

### P3 — Keep out of Sprint C
Sprint C skal ikke:
- bygge connected mode connector engine
- lave stor UI overhaul
- bygge enterprise conflict workbench
- omskrive hele session runtime på én gang

## Designregler Sprint C skal holde fast i

1. PM data er source-of-truth
2. Game-layer er projection/advisory, ikke canonical
3. Reward/boss/world semantics skal være data/config-drevne hvor det giver mening
4. Projection-lag må aldrig mutere PM data direkte
5. Små migrations > stor ombygning

## Hvad Sprint D bør tage bagefter

Når Sprint C har reduceret hardcoded projection-logik, kan Sprint D fokusere på:
- `external_refs`
- `sync_conflicts`
- `sync_ledger`
- connector adapter contract
- mere moden conflict taxonomy

## Kort dom

Sprint B har gjort Reveal meget mindre farlig arkitektonisk, fordi gråzonerne nu er synlige.

Sprint C bør ikke opfinde ny filosofi.
Sprint C bør implementere det, Sprint A+B allerede har gjort tydeligt.
