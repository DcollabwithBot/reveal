# Reveal — Sprint C Batch 1 Status

Date: 2026-03-19
Status: Implemented checkpoint

## Hvad der faktisk er landet i kode

Batch 1 har nu flyttet de første centrale projection-flader ud af ren frontend-hardcoding.

### 1. Nye projection config surfaces i DB
Ny migration:
- `supabase/migrations/sprint9_projection_config.sql`

Tabeller:
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`

Derudover seedes et første default standalone-sæt.

### 2. Ny runtime read-path
Backend endpoint:
- `GET /api/projection/config`

Frontend helper:
- `getProjectionConfig()` i `app/src/lib/api.js`

Det giver session/runtime adgang til projection config uden at alt fortsat skal leve som constants.

### 3. Central projection helper oprettet
Ny fil:
- `app/src/shared/projection.js`

Ansvar i første version:
- bygge reward loot ud fra rule/config
- resolve achievements via config/fallback
- resolve boss profile
- læse boss HP base
- læse damage multiplier
- udregne challenge bonus HP

### 4. Session.jsx er delvist decouplet
`Session.jsx` bruger nu projection config + helper til:
- reward loot logic
- boss base HP
- boss damage multiplier
- challenge bonus HP
- achievement resolution via key/config-baseret opslag

Det betyder:
- filen er stadig ikke helt fri for gameplay-semantik
- men den ejer ikke længere hoveddelen af reward/boss-fortolkningen alene

## Hvad der stadig står tilbage i Session.jsx

Følgende er stadig delvist inline og bør tages i senere hug:
- mere af boss-state flowet
- root-cause / challenge semantics
- nogle achievement trigger-regler
- mere af session outcome fortolkningen

## Validering
- server tests: grøn
- app build: grøn

## Kort dom

Batch 1 er ikke “hele Sprint C”.
Men den er en reel første implementation, ikke bare dokumentation.

Det vigtigste er, at projection layer nu har:
- database surfaces
- seed data
- read path
- første runtime consumption

Det er nok til at sige, at Reveal er begyndt at flytte gameplay-semantik væk fra ren prototype-frontendlogik.
