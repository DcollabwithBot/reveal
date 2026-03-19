# Reveal — Integration Readiness Gap List

Date: 2026-03-19
Status: Sprint A working output
Purpose: Gøre det konkret hvad Reveal stadig mangler for at være reelt integration-ready uden senere grim migration eller stor refactor.

## TL;DR

Reveal er **strategisk** integration-ready, men ikke endnu **operationally integration-ready**.

Det vil sige:
- retningen er rigtig
- canonical model + governance + sync-policy er tænkt rigtigt
- men der mangler stadig nogle afgørende lag, før eksterne systemer kan kobles pænt på uden skjult teknisk gæld

Den største risiko er ikke mangel på connector-kode.
Den største risiko er uklarhed mellem:
- canonical data
- gameplay projection
- ownership pr. felt
- sync semantics ved konflikter og shared fields

---

## Hvordan denne gap-list læses

- **P1 = skal afklares/fikses tidligt** for at undgå senere stor refactor
- **P2 = bør forberedes snart** fordi det ellers låser videre implementation forkert
- **P3 = kan vente** til efter de vigtigste datamæssige skillelinjer er på plads

---

## P1 — Skal håndteres tidligt

## 1. Canonical vs projection er ikke skilt skarpt nok i runtime

### Problem
Canonical PM-data og gameplay-fortolkning er stadig ikke adskilt rent nok i implementationen.
Meget game-semantik lever stadig i frontend-komponenter og constants.

### Hvorfor det er et integrationsproblem
Når eksterne systemer kommer på, skal Reveal kunne sige:
- dette er rigtig canonical state
- dette er bare Reveal’s fortolkning/game projection

Hvis ikke det er tydeligt, bliver integrationer tvunget til at forholde sig til game-logik som om det var core data.

### Behov
- eksplicit separation mellem:
  - PM canonical model
  - event layer
  - game projection layer

### Konsekvens hvis ikke vi gør det
- grim connector-logik
- uklar field ownership
- senere refactor af både frontend og backend contracts

---

## 2. Ownership pr. felt er stadig for teoretisk og ikke runtime-konsekvent nok

### Problem
Field ownership matrix findes som koncept og docs, men ikke endnu som et skarpt, gennemgående operationelt princip i hele runtime.

### Hvorfor det er et integrationsproblem
Connected mode kræver at vi præcist kan sige:
- Reveal owns this field
- external system owns this field
- this field is shared with precedence rule

Hvis det kun lever i docs, men ikke er tydeligt i model/runtime contracts, bliver write-back farligt.

### Behov
- ownership-and-writeback matrix som konkret reference
- samme model skal kunne bruges i:
  - approval flow
  - sync policy
  - connector adapters
  - conflict resolution

### Konsekvens hvis ikke vi gør det
- “det afhænger af endpointet” arkitektur
- policy drift mellem backend og connector layer
- manuelle edge cases overalt

---

## 3. External identity mapping er for svagt modelleret endnu

### Problem
Vi har `external_id` / `external_source` på flere kerneobjekter, og docs nævner `externalRefs[]`, men modellen er endnu ikke tydelig eller ensartet implementeret.

### Hvorfor det er et integrationsproblem
Et objekt kan senere have:
- flere eksterne relationer
- forskellige eksterne keys
- shadow sync fra én kilde og outbound relation til en anden

Ét `external_id` felt per tabel er sandsynligvis for fattigt i længden.

### Behov
- tydelig strategi for `externalRefs`
- muligvis sidecar-model frem for bare simple felter i primærtabeller

### Konsekvens hvis ikke vi gør det
- hurtig schema-gæld når vi går fra 1 connector til 2+
- vanskeligt at bevare canonical identitet over tid

---

## 4. Conflict semantics er endnu ikke modne nok

### Problem
Sync policy er defineret godt i docs, men der mangler stadig en mere konkret operationel model for konflikter.

### Hvorfor det er et integrationsproblem
Når connected mode starter, er conflict resolution ikke et edge case — det er en normal tilstand.

Vi mangler stadig tydelighed omkring:
- conflict classes
- stale vs active conflict
- field-level vs entity-level conflict
- hvordan manual review queue ser ud i datamodellen

### Behov
- mere konkret conflict taxonomy
- tydeligere relationship mellem governance lock, approval state og sync conflict state

### Konsekvens hvis ikke vi gør det
- konflikter bliver en audit-log-tekststreng i stedet for et systematisk domæne

---

## 5. Idempotency og sync-ledger er designet, men ikke domænemodnet endnu

### Problem
Idempotency er tænkt godt i docs og governance-sporet, men der mangler stadig en mere samlet model for connector/sync-ledger side.

### Hvorfor det er et integrationsproblem
Det er ikke nok at have event ledger generelt.
Connected mode kræver ofte:
- connector-specific checkpoints
- replay semantics
- processed-key retention strategy
- dead-letter ownership og recovery flow

### Behov
- konkret sync-ledger schema/contract før real connector rollout

### Konsekvens hvis ikke vi gør det
- de første integrationer bliver “special cases” i stedet for generel platform-logik

---

## P2 — Bør forberedes snart

## 6. Template-driven game mappings mangler

### Problem
Use-cases som KOMBIT peger på, at gameplay/projection ikke bliver ens for alle domæner.

### Hvorfor det er et integrationsproblem
Når data kommer fra forskellige eksterne systemer og forskellige projekt-typer, skal Reveal kunne mappe dem til forskellige game-profiler uden kode-branching i frontend.

### Behov
- template-driven mapping/config
- game profile pr. use-case eller project type

### Konsekvens hvis ikke vi gør det
- hardcoded per-customer logic i UI/backend

---

## 7. Achievement / reward / boss profiles er stadig ikke data-modelleret

### Problem
Projection-laget er stadig for meget kodet som runtime-opførsel, ikke som data.

### Hvorfor det er et integrationsproblem
Hvis eksterne systemer skal kunne trigge eller påvirke Reveal-signaler, skal reglerne ikke ligge skjult i UI.

### Behov
- reward rules config
- pressure profile config
- boss profile config
- achievement definitions

### Konsekvens hvis ikke vi gør det
- integrationsdata kan ikke fortolkes konsistent på tværs af use-cases

---

## 8. Outbound webhook layer er MVP, men ikke endnu egentlig integrationsrygrad

### Problem
Webhook-tabellerne er gode som første skridt, men de udgør ikke endnu en fuld integration platform.

### Hvorfor det er et integrationsproblem
Der mangler stadig klarhed omkring:
- event taxonomy stabilitet
- retry/poison/dead-letter ops behavior
- hvilke events der er canonical vs derived

### Behov
- tydeligere kontrakt mellem event model og outbound deliveries

### Konsekvens hvis ikke vi gør det
- webhooks bliver ad hoc feature-output i stedet for platform-surface

---

## P3 — Kan vente lidt

## 9. Full multi-connector abstraction
Det er for tidligt at bygge alt abstraktionslaget fuldt nu.
Det vigtigste er at undgå at låse modellen forkert først.

## 10. Full client UX for conflict/manual review
Vi har ikke brug for fuldt enterprise conflict workbench endnu.
Men vi skal have datamodellen klar til det.

## 11. Advanced write-back orchestration
Connected write-back er stadig bevidst blokeret.
Det er okay.
Vi skal ikke forcere dette før ownership, conflict semantics og sync-ledger er mere modne.

---

## Konkrete anbefalinger til Sprint B/C/D

## Sprint B — Ownership & write-back
Fokuser på:
- ownership matrix
- write-back matrix
- explicit “never direct from game” surfaces
- relation mellem approval state og sync eligibility

## Sprint C — Projection decoupling
Fokuser på:
- game profiles
- boss/pressure/reward rules
- world/progression mapping
- achievement definitions
- reducering af hardcoded frontend semantics

## Sprint D — Integration hardening
Fokuser på:
- externalRefs strategy
- sync ledger schema
- conflict taxonomy
- connector adapter contract
- manual review semantics

---

## Min brutale vurdering

Reveal er ikke “kun en UI-idé” længere.
Det er godt.

Men integration-ready er stadig mest sandt på powerpoint/dokumentniveau, ikke endnu på runtime-modenniveau.

Det er ikke en katastrofe.
Det er normalt på det stadie vi er.

Men det betyder også:
- vi skal ikke begynde at bilde os ind, at connected mode er tæt på bare fordi docs findes
- først skal vi gøre den interne model hårdere og tydeligere

Det vigtigste lige nu er:
- få styr på ownership
- få styr på external identity model
- få skilt game projection ud som et bevidst lag

Hvis vi gør det, undgår vi den store grimme migration senere.
Hvis vi ikke gør det, kommer den næsten helt sikkert.
