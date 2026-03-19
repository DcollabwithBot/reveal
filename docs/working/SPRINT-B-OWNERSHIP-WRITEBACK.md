# Reveal — Sprint B: Ownership & Write-back Hardening

Date: 2026-03-19
Status: Started
Owner: James
Depends on:
- `SPRINT-A-SUMMARY.md`
- `schema-audit.md`
- `integration-readiness-gap-list.md`
- `ownership-and-writeback-matrix.md`
- `sprint-a-migration-recommendations.md`

## Formål

Sprint B skal tage Reveal fra analyse til kontraktmæssig skarphed.

Sprint A viste os hvor gråzonerne er.
Sprint B skal fjerne de vigtigste af dem.

Målet er ikke at bygge connector-motoren endnu.
Målet er at gøre det tydeligt:
- hvem ejer hvilke felter
- hvad game må signalere vs skrive
- hvornår approval er påkrævet
- hvornår eksterne systemer senere må være authoritative
- hvordan governance locks og sync-eligibility hænger sammen

## North star

**Ingen write-back i Reveal må bero på implicit forståelse. Ejerskab, policy og approval skal være eksplicit.**

---

## Scope

### In scope
- Stramning af ownership-model på field/entitetsniveau
- Kontrakt for write-back paths
- Relation mellem approval state og sync eligibility
- Grænser mellem PM, game, backend og future external systems
- Decision docs / policy docs der kan bruges direkte i senere implementation
- Konkret backlog for hvad der skal implementeres i Sprint C/D

### Out of scope
- fuld connected mode implementation
- connector adapters
- full conflict workbench
- stor schema-refactor
- gameplay projection decoupling implementation

Sprint B handler om beslutningsklarhed og policy-hardening.

---

## Arbejdsspørgsmål

1. Hvilke felter er Reveal-authoritative, PM-authoritative, external-authoritative, shared eller projection-only?
2. Hvilke write-back paths er tilladte?
3. Hvilke write-back paths skal altid blokeres?
4. Hvornår må connected mode skrive noget som helst tilbage?
5. Hvordan hænger governance lock, approval state, sync policy og conflict state sammen?
6. Hvad skal være policy-drevet nu, før vi bygger mere kode?

---

## Leverancer

## 1) Ownership & write-back matrix refinement
Fil:
- `docs/working/ownership-and-writeback-matrix.md`

Sprint B mål:
- opstramme matrixen fra god analyse til mere implementerbar reference
- sikre field-level thinking hvor det er nødvendigt

## 2) Write-back path model
Ny fil:
- `docs/working/writeback-paths-v1.md`

Indhold:
- hvilke paths findes?
- hvilke er tilladte?
- hvilke kræver PM approval?
- hvilke må aldrig eksistere?

Eksempel:
- PM UI -> canonical write = allowed
- Game signal -> approval request = allowed
- Game signal -> direct canonical mutation = forbidden
- External shadow sync -> canonical preview/update = conditional
- External write-back -> canonical mutation = blocked until connector + ownership + policy PASS

## 3) Approval vs sync eligibility model
Ny fil:
- `docs/working/approval-sync-eligibility-v1.md`

Indhold:
- hvordan approval state påvirker sync/write-back
- hvilke locks blokerer inbound/outbound changes
- hvad der sker ved stale requests / stale sync / active conflict

## 4) Field policy shortlist for implementation
Ny fil:
- `docs/working/field-policy-shortlist-v1.md`

Indhold:
- de vigtigste felter vi skal tage stilling til først:
  - title
  - description
  - status
  - priority
  - assignee
  - due date
  - labels
  - sprint relation
  - approval state
  - risk score
  - reason codes
  - external refs

Output:
- owner class
- write path
- approval requirement
- sync behavior

## 5) Sprint C/D implementation handoff note
Ny fil:
- `docs/working/sprint-b-handoff.md`

Indhold:
- hvad Sprint C skal implementere
- hvad Sprint D skal implementere
- hvad der stadig kun er analyse

---

## Exit criteria

Sprint B er done når:

1. Ownership-modellen ikke længere er “principielt rigtig”, men konkret nok til implementation.
2. Write-back paths er dokumenteret som allowed / conditional / forbidden.
3. Relation mellem approval state og sync eligibility er eksplicit.
4. Vi kan pege på de første implementation tasks i Sprint C uden at gætte på policy.
5. Vi har reduceret risikoen for at runtime/connector-kode ender med egne lokale sandheder.

---

## Risici i Sprint B

- Risiko: vi laver en for abstrakt policy-model
  - Modtræk: altid bind policy til faktiske entities og felter

- Risiko: vi forveksler docs med implementation
  - Modtræk: slut altid i konkrete implementation handoff-notes

- Risiko: vi prøver at løse connected mode helt nu
  - Modtræk: hold fokus på ownership og write-back contracts, ikke fuld connector design

---

## Forventet output-kvalitet

Sprint B skal være så skarp, at følgende senere bliver lettere:
- at implementere `external_refs`
- at indføre projection config-tabeller
- at lave `sync_conflicts`
- at beslutte hvor shared fields reelt må leve

---

## Kort dom

Sprint B er sprintet hvor Reveal stopper med at være “god intuition” og begynder at få rigtige, håndhævelige grænser mellem:
- PM sandhed
- game fortolkning
- backend enforcement
- fremtidig external ownership
