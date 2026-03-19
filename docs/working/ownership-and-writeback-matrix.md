# Reveal — Ownership and Write-back Matrix

Date: 2026-03-19
Status: Sprint A working output
Purpose: Gøre det utvetydigt hvem der ejer hvilke felter og handlinger i Reveal, hvad game-layer må gøre, hvad der kræver PM approval, og hvad eksterne systemer senere må få lov til i connected mode.

## TL;DR

Hvis Reveal skal undgå fremtidig kaos, skal vi tænke i 4 roller:
- PM / canonical owner
- Game layer / advisory layer
- Backend service / enforcement layer
- External system / conditional owner in connected mode

Den vigtigste regel er stadig:

**Game må fortolke, signalere og anbefale — men aldrig direkte eje eller overskrive canonical PM-data.**

Det samme gælder eksterne systemer:
- de må kun skrive til felter, hvor ownership og sync policy er eksplicit defineret
- governance-felter er aldrig eksternt authoritative

---

## 1) Ejerskabsniveauer

Reveal bør operere med disse ownership-klasser:

### A. `reveal_authoritative`
- Reveal er eneste source-of-truth
- hverken game-layer eller eksternt system må overskrive direkte

### B. `pm_authoritative`
- PM-fladen / PM-domænet ejer feltet funktionelt
- game må læse og anbefale
- write-back kræver PM approval hvis det kommer fra game eller external flow

### C. `external_authoritative`
- et eksternt system ejer feltet i connected mode
- Reveal spejler og fortolker, men er ikke sandhedskilden

### D. `shared_with_precedence`
- delt felt, men med eksplicit precedence-regel
- kræver konfliktpolitik og auditbar resolution

### E. `projection_only`
- ikke canonical data
- afledes fra events/canonical state
- må gerne ændres frit af projection/game-regler uden at påvirke PM-kernen direkte

---

## 2) Entitetsniveau — hvem ejer hvad?

## Organizations / teams / members

### Canonical owner
- Reveal / PM / auth-domain

### Game layer
- read only

### External system
- read only i udgangspunktet
- kan senere være source for mapping/identity links, men ikke ejer af Reveal org-struktur

### Write-back rule
- ingen game write-back
- ingen connector write-back uden særskilt design

---

## Projects

### Canonical owner
- Reveal PM-domain

### PM owns
- `name`
- `description`
- `status`
- `icon`
- `color`
- relation til sprint/portfolio

### Game may
- læse projektstate
- udlede pressure/momentum/world semantics
- anbefale statusændringer eller prioriteringssignaler via approval path

### External system may later
- eje eller påvirke enkelte shared work-fields i connected mode, hvis policy siger det
- men ikke governance-felter

### Write-back rule
- game: advisory only
- external: kun via ownership matrix + sync policy
- PM approval required ved game-origin anbefalinger

---

## Sprints

### Canonical owner
- Reveal PM-domain

### PM owns
- `name`
- `goal`
- `status`
- `start_date`
- `end_date`

### Game may
- fortolke sprinten som boss/pressure arena
- udlede sprint-health og momentum
- generere anbefalinger, ikke direkte statusmutation

### External system may later
- i connected mode muligvis eje iteration metadata hvis ekstern planning engine er authoritative
- dette skal være eksplicit pr. connector/setup

### Write-back rule
- game aldrig direkte
- external kun hvis sprint-field ownership er eksplicit sat

---

## Session items / work items

### Canonical owner
- Reveal PM-domain

### PM owns
- `title`
- `description`
- `priority`
- `assigned_to`
- `estimated_hours`
- `actual_hours`
- `progress`
- `item_status`
- labels/tags når de findes

### Game may
- læse alle ovenstående
- generere:
  - pressure signal
  - XP/reward signal
  - challenge suggestion
  - recommended write-back via approval request

### External system may later
- eje nogle shared fields i connected mode:
  - typisk `status`, `assignee`, `priority`, `labels`, `dueDate`
- men kun hvis ownership er sat per field

### Write-back rule
- game-origin ændringer må aldrig skrive direkte til item-felter
- external-origin ændringer skal igennem ownership + conflict policy
- PM approval required når game ønsker at ændre canonical item-state

---

## Sessions / votes

### Canonical owner
- Reveal runtime/session domain

### PM owns
- session setup og relation til project/sprint

### Game owns / may drive
- session-specific oplevelse
- voting mode
- reveal flow
- local presentation state

### External system
- normalt ingen ejerrolle
- kan senere modtage summaries/outcomes, men ikke eje session-runtime

### Write-back rule
- session/vote data er Reveal-native og bør ikke være eksternt authoritative

---

## Challenges / retro events

### Current state
- delvist DB-drevet, delvist fallback/hardcoded i frontend

### Target owner
- Reveal projection/config layer

### PM owns
- aktivering/deaktivering, template-tilpasning, org-level variation

### Game owns
- runtime-fortolkning og præsentation

### External system
- ingen direkte ejerrolle

### Write-back rule
- ikke canonical PM-data
- bør behandles som projection/config content, ikke work-state

---

## Approval requests

### Canonical owner
- Reveal governance layer

### PM owns
- approve / reject / apply beslutning
- rationale

### Game may
- create recommendation only
- aldrig approve/reject/apply

### External system
- ingen direkte approval-authority
- kan højst senere skabe input-events, ikke governance-beslutning

### Write-back rule
- approval flow er PM-kontrolleret og audit-pligtigt

---

## Audit log / event ledger

### Canonical owner
- Reveal backend/governance layer

### PM
- må læse og bruge som beslutningsgrundlag

### Game
- må emitte events/signaler via godkendte paths
- må ikke omskrive audit/event historik

### External system
- kan være kilde til events
- men ejer ikke audit-loggen

### Write-back rule
- immutable / append-only logik

---

## Webhook configs / deliveries

### Canonical owner
- Reveal integration layer

### PM/admin owns
- konfiguration og enable/disable

### Game may
- trigge events indirekte via canonical event model

### External system
- er modtager, ikke owner

---

## 3) Feltkategorier — konkret ejerskab

## Felter der bør være Reveal-/PM-authoritative
- approval state
- governance flags
- risk score
- reason codes
- audit references
- event IDs / correlation IDs
- policy metadata
- internal canonical IDs

## Felter der kan være shared senere
- title
- description
- status
- priority
- assignee
- due date
- labels/tags
- sprint/iteration references (afhænger af connected mode)

## Felter der bør være external-authoritative i connected mode som default
- system-specifik metadata
- tool-native bookkeeping fields
- ekstern nøgle/reference-data
- fields hvor ekstern platform er valgt som ejer i shared-work mode

## Felter der bør være projection-only
- boss HP
- delivery pressure
- XP
- streaks
- loot
- achievements
- challenge visuals
- NPC commentary
- world/progression rendering

Det er helt centralt at projection-only felter ikke ender som “skjulte PM-felter”.

---

## 4) Hvad game-layer må og ikke må

## Game-layer må
- læse canonical PM-data
- læse governance-status når relevant
- udlede pressure/momentum/XP/boss-state
- foreslå ændringer via advisory/approval request
- skabe ikke-canonical projection state
- præsentere work som play

## Game-layer må ikke
- direkte mutate `projects`, `sprints`, `session_items` eller governance state
- eje field ownership-beslutninger
- skrive direkte til audit-log som autoritativ beslutningstager
- overskrive external-authoritative fields
- skabe skjult forretningslogik kun i frontend

---

## 5) Hvad eksterne systemer må og ikke må

## Eksterne systemer må
- levere inbound data via adapter/sync policy
- være authoritative på eksplicit godkendte felter i connected mode
- skabe konflikter som Reveal skal håndtere eksplicit
- have refs/metadata knyttet til canonical entities

## Eksterne systemer må ikke
- overskrive governance-felter
- skrive direkte uden sync policy / idempotency / audit
- blive implicit owner bare fordi de sendte seneste update
- omgå approval locks eller governance locks

---

## 6) PM approval required — hvornår?

PM approval kræves når:
- game-layer vil påvirke canonical PM state
- shared field er i konflikt og governance lock er aktiv
- ekstern ændring rammer felt med manual review policy
- projected recommendation skal blive til rigtig task/state mutation
- write-back har strategisk/operativ konsekvens

PM approval er ikke nødvendigt når:
- game kun opdaterer projection-only data
- visual/game feedback genereres lokalt uden canonical mutation
- ekstern read-only shadow sync kun spejler data til preview/sandbox

---

## 7) Det vigtigste vi skal undgå

### Fælde 1 — “frontend knows best”
Hvis React-komponenter reelt bestemmer rewards, pressure og anbefalet state uden klart projection-lag, bliver UI en skjult forretningsmotor.

### Fælde 2 — “shared means unclear”
Shared fields uden eksplicit precedence-regel er bare fremtidige konflikter med forsinket erkendelse.

### Fælde 3 — “external wrote last, so external wins”
Det er en dårlig default. Ownership skal afgøres af policy, ikke af hvem der sidst sendte payload.

### Fælde 4 — “game recommendations that quietly behave like writes”
Hvis advisory flow opleves som næsten-direkte-write, så er PM-first modellen allerede brudt kulturelt, selv hvis den ikke er brudt teknisk.

---

## 8) Konkrete anbefalinger efter denne matrix

## P1
- gør denne matrix til reference for Sprint B implementation
- map de vigtigste tabeller/felter til ownership-klasser i runtime docs/backlog
- få external identity strategy og conflict taxonomy koblet direkte til matrixen

## P2
- opdel gameplay-lag eksplicit i projection/config frem for UI-only rules
- bind reward/boss/profile logic til config/data frem for komponenter

## P3
- når connected mode nærmer sig: lav connector-specific overlay på denne matrix
- ikke en ny matrix per connector fra nul

---

## Kort dom

Hvis Reveal skal lykkes som både seriøst PM-system og game-soul platform, så er dette skel afgørende:

- PM ejer virkeligheden
- game ejer fortolkningen
- backend håndhæver grænsen
- eksterne systemer får kun adgang via eksplicit policy

Hvis vi holder fast i det, undgår vi meget af den fremtidige rod.
Hvis vi slækker på det, får vi nøjagtig den store refactor vi prøver at undgå.
