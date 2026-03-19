# Reveal — Sprint A: Data Audit & Refactor Prevention

Date: 2026-03-19
Status: Planned / started
Owner: James

## Formål

Sprint A skal kortlægge Reveal som det faktisk er bygget nu — ikke som vi håber det er.

Målet er at finde:
- hvad der allerede er canonical data
- hvad der stadig er gameplay/prototype-logik i frontend
- hvad der er hardcoded og bør flyttes ud
- hvad der skal ændres nu for at undgå en senere stor refactor

Det her sprint handler ikke om ny UI.
Det handler ikke om mere game polish.
Det handler om at sikre at Reveal’s datamodel og runtime-arkitektur kan bære både:
- seriøs PM/execution
- game projection layer
- fremtidige integrationer

## North star

**Skil canonical PM-model og gameplay projection tydeligt ad, før prototype-logik sætter sig som permanent arkitektur.**

---

## Scope

### In scope
- Audit af eksisterende schema/migrations
- Audit af runtime-brug i server/app/frontend
- Kortlægning af hardcoded gameplay-semantik
- Klassificering af canonical vs projection vs presentation
- Gap-liste for integration readiness
- Matrix for ownership / write-back / governance-grænser
- Forslag til hvilke typer config/tabeller/migrations der bør komme først

### Out of scope
- UI redesign
- ny game mode
- ny integration implementation
- stor refactor i denne sprint
- flytning af al hardcoded logik med det samme
- fuld migrationsimplementering

Sprint A skal ende i klarhed, ikke i halvfærdige kodeændringer.

---

## Arbejdsspørgsmål

1. Hvad er Reveal’s reelle canonical model i dag?
2. Hvilke dele af gameplay-laget er stadig hardcoded i frontend?
3. Hvor blander vi PM-data og projection/game-logik for meget?
4. Hvad vil gøre senere Jira/Topdesk/ADO integration dyr og grim, hvis vi ikke fikser det nu?
5. Hvilke små migrations/config-greb vil spare os mest smerte senere?

---

## Leverancer

## 1) Schema audit
Fil:
- `docs/working/schema-audit.md`

Indhold:
- nuværende DB-model
- runtime-brug
- hardcoded hotspots
- canonical vs projection-opdeling
- konkrete risici

Status:
- Started / first version created

## 2) Integration readiness gap list
Fil:
- `docs/working/integration-readiness-gap-list.md`

Indhold:
- P1: skal afklares/fikses nu
- P2: bør forberedes snart
- P3: kan vente
- fokus på external refs, ownership, sync semantics, idempotency, conflict model

## 3) Ownership and write-back matrix
Fil:
- `docs/working/ownership-and-writeback-matrix.md`

Indhold:
- PM owns
- game reads
- game signals
- PM approval required
- external system may own later
- what must never be written directly by game layer

## 4) Migration/config recommendation note
Fil:
- `docs/working/sprint-a-migration-recommendations.md`

Indhold:
- hvilke nye config-/projection-tabeller vi sandsynligvis får brug for
- hvilke små migrations vi bør tage tidligt
- hvad der bør blive hardcoded lidt endnu

---

## Foreløbig fund-retning

Baseret på den første audit ser de vigtigste risikoområder ud til at være:
- world/progression definitions i frontend constants
- boss/pressure semantics i komponenter
- XP/reward/loot rules inline i session-flow
- root-cause/NPC comment mappings hardcoded
- dualitet mellem DB-driven challenges/retro-events og fallback constants

Det betyder:
- PM/governance-kernen ser forholdsvis sund ud
- gameplay projection layer er det mest sandsynlige fremtidige refactor-problem

---

## Exit criteria

Sprint A er done når:

1. Vi har en skriftlig og konkret opdeling mellem:
- canonical data
- event/governance layer
- gameplay projection layer
- presentation-only layer

2. Vi har en konkret liste over hardcoded ting opdelt i:
- acceptabelt at lade stå nu
- bør flyttes snart
- kritisk at flytte før videre scale

3. Vi har en integration-readiness gap list med prioritering.

4. Vi har en ownership/write-back matrix, så vi undgår uklarhed om hvem der må hvad.

5. Vi kan pege på næste sprint (Sprint B) uden at gætte.

---

## Risici i Sprint A

- Risiko: vi overdesigner og producerer dokumenter uden beslutningsværdi
  - Modtræk: alt skal ende i konkrete P1/P2/P3 prioriteringer

- Risiko: vi prøver at refactore midt i auditten
  - Modtræk: Sprint A er analyse + plan, ikke stor kodeændring

- Risiko: vi undervurderer hvor meget frontend stadig er prototype-logik
  - Modtræk: brug faktisk kodegennemgang, ikke kun migrationsfiler

---

## Næste sprint efter A

Når Sprint A er done, bør Sprint B være:
- Ownership + write-back model hardening
- kontrakt/field ownership på plads
- og derefter Sprint C: gameplay projection decoupling

---

## Kort dom

Sprint A er anti-kaos-sprintet.
Det er ikke flashy.
Men det er sandsynligvis det sprint der bedst reducerer fremtidig teknisk gæld i Reveal.
