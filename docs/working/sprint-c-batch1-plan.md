# Reveal — Sprint C Batch 1 Plan

Date: 2026-03-19
Status: Sprint C working output
Purpose: Gøre første implementation-batch i Sprint C konkret og begrænset.

## Batch 1 mål
Flyt de mest risikable gameplay-semantikker ud af frontend uden at forsøge at bygge hele systemet om.

## Batch 1 scope

### 1. Define and store first config surfaces
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`

### 2. Make runtime able to read them
- backend or client-side config access path
- fallback tydeligt markeret som transitional

### 3. Replace highest-risk semantics first
- Session reward rules
- Session boss/pressure semantics
- first achievement conditions

## Explicitly not in Batch 1
- full world/progression rewrite
- root cause content migration
- connector/sync work
- UI redesign

## Recommended order
1. migration/config surfaces
2. seed/default profile data
3. runtime read path
4. replace session inline reward logic
5. replace session inline boss/pressure logic
6. document remaining frontend hotspots for Batch 2

## Success condition
Efter Batch 1 skal nye reward/boss/achievement-regler naturligt gå ind via config/data fremfor flere hardcoded branches i `Session.jsx`.
