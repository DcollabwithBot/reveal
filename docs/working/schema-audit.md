# Reveal — Schema + Runtime Audit

Date: 2026-03-19
Status: Working audit
Purpose: Gennemgå hvad Reveal har i dag, hvordan det faktisk bruges i spil/runtime, og hvad der bør flyttes ud af hardcoded frontend-logik for at undgå senere stor refactor.

## TL;DR

Reveal har allerede et ret godt fundament på den seriøse side:
- canonical PM-objekter findes
- governance/approval/event/audit findes
- integration-sporet er tænkt ind

Men gameplay-laget er stadig delvist prototype-organiseret:
- mange regler, verdener, XP/logik, boss-navne og reward-mekanikker lever i frontend constants og inline kode
- noget domæne-data er DB-drevet, men meget game-semantik er stadig hardcoded

Det betyder:
- PM/core-model er på vej mod noget rigtigt
- game/runtime-laget er endnu ikke modeldrevet nok
- hvis vi ikke tager det nu, risikerer vi senere en grim refactor mellem “prototype game logic” og “real product logic”

---

## 1) Hvad findes i databasen i dag

## Core PM / org model
Fra tidligere foundation + sprint 6/7/8 migrations kan vi se:

- `organizations`
- `organization_members`
- `teams`
- `team_members`
- `profiles`
- `sessions`
- `session_items`
- `votes`
- `projects`
- `sprints`
- `session_templates`
- `node_completions`

Det er godt. Det giver allerede et rigtigt canonical domæne for PM/execution.

## Game-/session-relaterede kataloger i DB
Der er allerede taget et vigtigt skridt her:
- `retro_events`
- `challenges`

Det betyder at noget af game-indholdet er flyttet væk fra rene constants og over i data.
Det er helt klart den rigtige retning.

## Governance / sync persistence
Sprint 8 giver:
- `approval_requests`
- `event_ledger`
- `audit_log`

Det er vigtigt, fordi det gør game→PM koblingen sporbar og kontrolleret i stedet for implicit.

## Integration readiness / outbound
Sprint 7 giver:
- `webhook_configs`
- `webhook_deliveries`

Det er godt, fordi Reveal dermed ikke kun tænkes som lukket UI, men som system der kan emitte og senere indgå i større flows.

---

## 2) Hvad vi kan se bruges i runtime/frontenden i dag

## Seriøs PM/runtime bruger DB ret direkte
I server/app og nyere app-flow bliver der arbejdet mod:
- `projects`
- `sprints`
- `session_items`
- `sessions`
- `votes`
- `approval_requests`
- `event_ledger`
- `audit_log`
- `retro_events`
- `challenges`

Det er et godt tegn.
Det betyder at den professionelle del allerede i høj grad er ved at blive data-drevet.

## Men gameplay flow bruger stadig mange frontend-konstanter
Vi kan se hardcoded brug især i:
- `app/src/screens/Session.jsx`
- `app/src/screens/Overworld.jsx`
- `app/src/screens/WorldSelect.jsx`
- `app/src/components/RootCauseSelector.jsx`
- `app/src/components/RouletteOverlay.jsx`
- `app/src/shared/constants.js`

Det gælder bl.a.:
- class definitions
- NPC team
- roulette challenge flow/fallbacks
- world definitions
- boss navn/visuel semantik
- XP reward logic
- loot logic
- achievement-ish outputs
- root-cause comments
- flere inline “if combo then reward X” regler

Kort sagt:
- data findes delvist i DB
- men meget af “hvad betyder ting i spillet?” ligger stadig i komponenterne

---

## 3) Hvad er stadig hardcoded i dag

## 3A — Acceptabelt at være hardcoded lidt endnu
Disse ting er ikke akutte at flytte:
- animation definitions
- sound effect definitions i `useSound`
- base visual sprite definitions
- rent præsentationsmæssige farver/ikoner til klassetyper
- små UI copy-detaljer som ikke er domæne-kritiske

Det er frontend-asset-lag, ikke canonical produktlogik.

## 3B — Bør flyttes væk fra hardcoded frontend først
Disse er de vigtigste kandidater til at flytte ud:

### 1. World definitions / map progression
I dag ligger world/progression-struktur i `shared/constants.js`.
Det er farligt, fordi “verdenen” i Reveal i praksis er en projektion af rigtigt arbejde.

Det bør på sigt udspringe af:
- project / sprint / item data
- eller et særskilt game_projection/config-lag

### 2. Boss definitions og pressure semantics
I dag findes der meget implicit boss-logik i Session/Overworld.
Det bør ikke leve som ren UI-fortolkning.

Det bør i stedet beskrives via data/config:
- boss profile
- pressure profile
- reward profile
- mapping mellem PM events og boss/pressure effekter

### 3. XP/reward/loot rules
Når rewards genereres inline i komponenterne, bliver produktlogikken låst i UI.

Det bør flyttes til:
- reward rules config
- eller event→reward rule set

Ellers får vi senere flere steder med usynlig forretningslogik.

### 4. Root cause / NPC comment mappings
`RootCauseSelector` og lignende mappings er stadig direkte hardcoded.
Det er ok til prototype, men ikke hvis de skal udvikle sig per use-case/team/template.

De bør flyttes til:
- config/content table
- template-specific rules/content

### 5. Challenge/event fallback content
Der er allerede DB for `challenges` og `retro_events`, men runtime har stadig tydelige fallback patterns.

Fallbacks er fine i en overgang.
Men hvis de bliver permanente, får vi to sandheder:
- DB-versionen
- fallback-constant-versionen

Det er en klassisk fremtidig driftssmerte.

---

## 4) Hvad er canonical vs. hvad er projection?

Det her er den vigtigste arkitektur-skillelinje.

## Canonical (source-of-truth)
Dette bør defineres som Reveal’s reelle kerne-data:
- organizations / members / teams
- projects
- sprints
- session_items
- sessions
- votes
- approval_requests
- audit_log
- event_ledger
- webhook configs/deliveries
- external refs / ownership metadata

Disse skal være stabile, integrationsklare og styret af governance.

## Projection / interpretation layer
Dette er ikke source-of-truth, men et fortolkningslag ovenpå canonical data:
- boss HP
- delivery pressure
- XP
- loot
- streaks
- achievements
- world/map progression
- challenge visuals
- NPC commentary

Det må gerne være data-drevet — men det er stadig projection, ikke canonical.

Det er vigtigt, fordi vi ellers får game-logik blandet ind i PM-kernen.

## Konsekvens
Reveal bør eksplicit designes med:
- canonical PM model
- event layer
- game projection layer

Ikke bare én stor bunke runtime-logik.

---

## 5) Hvilke tabeller/config-lag mangler sandsynligvis?

Jeg ville ikke starte med at opfinde 20 nye tabeller.
Men disse typer mangler sandsynligvis snart:

## A. Game profiles / projection config
En tabel eller config-model for fx:
- `game_profiles`
- `boss_profiles`
- `pressure_profiles`
- `reward_rules`

Formål:
- så gameplay-semantik ikke lever inline i React-komponenter

## B. Achievement definitions
Hvis achievements bliver mere end bare kosmetik, skal de ikke ligge spredt i UI.

Formål:
- definere rules/data separat
- kunne versionsstyre dem
- kunne knytte dem til templates/use-cases

## C. Template-driven mappings
KOMBIT-template og fremtidige use-cases antyder at Reveal skal kunne variere sit game-lag per domæne.

Det peger på et behov for:
- template-level mapping/config
- ikke kun generelle globale constants

## D. Ownership / field policy matrix
Ikke nødvendigvis som fysisk tabel først, men mindst som eksplicit model.

Vi mangler stadig et skarpt, centraliseret sted for:
- hvem ejer hvilket felt?
- hvad må external systems opdatere?
- hvad må game kun signalere?
- hvad kræver PM approval?

---

## 6) Hvad bør flyttes først?

Hvis vi vil undgå stor refactor, er dette min prioriterede rækkefølge:

## P1 — Flyt gameplay-regler ud af komponenter
Først:
- XP rules
- reward rules
- boss/pressure profiles
- challenge/event interpretation rules

Hvorfor:
- det er dér den skjulte produktlogik lever lige nu
- og det bliver grimt senere hvis flere skærme gentager den logik

## P2 — Gør world/progression til projection af canonical data
Verdener, map og progression skal ikke være et helt separat frontend-univers for evigt.

De bør i stigende grad kunne afledes af:
- projekt
- sprint
- items
- templates
- event streams

## P3 — Fjern permanent fallback-dualitet for challenge/retro content
Når DB-udgaven er moden nok, skal fallback constants enten:
- fjernes
- eller reduceres til tydelig bootstrapping/dev-only fallback

## P4 — Definér game projection layer eksplicit
Ikke nødvendigvis som fuld runtime engine endnu.
Men som dokumenteret lag:
- input events
- transformation rules
- output signals

Det vil gøre integration/game/governance langt mere stabilt.

---

## 7) Konkrete risici hvis vi ikke gør det nu

## Risiko 1 — UI bliver skjult forretningslogik
Hvis rewards, XP, pressure og challenge-effekter bor i komponenterne, så ender frontend med at være sandhedsmaskinen.
Det er præcis det vi ikke vil.

## Risiko 2 — Parallelle sandheder
Hvis nogle game-data ligger i DB og andre i constants, bliver det uklart hvad der er “rigtigt”.

## Risiko 3 — Integration bliver dyrere senere
Hvis canonical og projection ikke skilles rent nu, bliver senere Jira/Topdesk/ADO integration til et oversættelseshelvede.

## Risiko 4 — Template/use-case variation bliver grim
KOMBIT og andre use-cases peger på at Reveal skal kunne forme game-semantik forskelligt per domæne.
Det kan man ikke gøre pænt, hvis det hele er hardcoded i shared constants.

---

## 8) Anbefalet næste leverancer

Jeg ville tage disse 3 dokumenter nu:

### 1. `schema-audit.md`
Denne fil — samlet audit af nuværende model og runtime brug.

### 2. `integration-readiness-gap-list.md`
- hvad mangler for at være reelt integration-ready?
- hvad er P1/P2/P3?

### 3. `ownership-and-writeback-matrix.md`
- canonical owner
- game read/signal rights
- PM approval requirements
- future external owner rules

Og derefter:

### 4. migrations/backlog-forslag
Små migrations eller config-tabeller for:
- projection profiles
- reward rules
- achievement definitions
- template-driven game mappings

---

## 9) Min vurdering lige nu

Reveal er ikke i fare på PM/governance-kernen.
Den del ser faktisk lovende ud.

Det der kan bide os senere er gameplay-laget — ikke fordi idéen er forkert, men fordi for meget af det stadig lever som prototype-frontendlogik.

Så den rigtige vej er:
- ikke mere UI først
- ikke mere game polish først
- men få skilt canonical data og gameplay projection tydeligt ad

Det er dér vi undgår den store refactor senere.
