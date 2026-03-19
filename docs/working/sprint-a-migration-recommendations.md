# Reveal — Sprint A Migration & Config Recommendations

Date: 2026-03-19
Status: Sprint A working output
Purpose: Oversætte audit-fund til konkrete næste schema-/config-greb, så Reveal undgår senere stor refactor.

## TL;DR

Vi skal ikke lave et kæmpe redesign af databasen nu.
Det vil være en fejl.

Det rigtige er at tage få, målrettede greb tidligt:
- gør external identity mere robust
- gør gameplay projection mere data-/config-drevet
- gør reward/boss/pressure semantics mindre frontend-hardcoded
- gør shared-field ownership klarere før connected mode bliver virkelig

Målet er:
- små migrations nu
- stor smerte undgås senere

---

## Princip for anbefalingerne

Hver anbefaling er vurderet ud fra:
- hvor meget fremtidig refactor den kan spare
- hvor stor risikoen er ved at lade være
- hvor meget kompleksitet vi introducerer nu

Vi går derfor efter:
- høj leverage
- lav til mellem kompleksitet
- ingen overengineering

---

## P1 — Bør tages tidligt

## 1. Indfør eksplicit `external_refs` sidecar-model

### Problem i dag
Flere tabeller har `external_id` + `external_source`, men det bliver sandsynligvis for fattigt når vi får flere connectors eller flere relationer per entity.

### Anbefaling
Lav en sidecar-tabel i stedet for at stole på ét felt per hovedtabel.

### Foreslået tabel
`external_refs`
- `id`
- `organization_id`
- `entity_type` (`project`, `sprint`, `session_item`, osv.)
- `entity_id`
- `system` (`jira`, `topdesk`, `ado`, `planner`, ...)
- `external_id`
- `external_key`
- `direction_mode` (`shadow`, `inbound`, `outbound`, `bidirectional`)
- `last_sync_at`
- `metadata jsonb`
- unique på (`entity_type`, `entity_id`, `system`, `external_id`)

### Hvorfor nu
Det er billigere at introducere tidligt end at migrere væk fra spredte `external_id` felter senere.

### Bemærkning
Vi behøver ikke fjerne eksisterende `external_id` felter med det samme.
De kan blive som overgangsbro, mens ny model indføres.

---

## 2. Indfør projection/config tabeller for gameplay-semantik

### Problem i dag
Boss/pressure/reward/world-lag lever stadig for meget i frontend-konstanter og komponentlogik.

### Anbefaling
Start med et lille config-lag, ikke en stor game-engine.

### Foreslåede tabeller
#### `game_profiles`
- org-level eller template-level profil
- styrer high-level mode for game projection

Felter:
- `id`
- `organization_id` nullable
- `template_key` nullable
- `name`
- `is_default`
- `config jsonb`

#### `boss_profiles`
- beskriver boss/pressure semantik

Felter:
- `id`
- `game_profile_id`
- `key`
- `name`
- `icon`
- `theme`
- `rules jsonb`

#### `reward_rules`
- beskriver XP/reward mapping

Felter:
- `id`
- `game_profile_id`
- `key`
- `trigger_type`
- `rule jsonb`
- `is_active`

### Hvorfor nu
Ikke fordi vi skal fuldt produktificere hele game-layeret i dag.
Men fordi den skjulte forretningslogik ellers fortsætter med at vokse i React-komponenter.

---

## 3. Indfør achievement definitions som data, ikke inline logik

### Problem i dag
Rewards/achievements ligner stadig UI/runtime-beslutninger mere end et eksplicit system.

### Anbefaling
Lav en enkel definitionsmodel.

### Foreslået tabel
`achievement_definitions`
- `id`
- `game_profile_id`
- `key`
- `name`
- `description`
- `icon`
- `rule jsonb`
- `is_active`

### Hvorfor nu
Hvis achievements bliver en reel del af oplevelsen, skal de kunne versioneres og mappes til use-cases/templates.

---

## 4. Flyt root-cause / NPC commentary til content/config

### Problem i dag
Kommentarer og mappings i root cause flow ligger stadig hårdkodet.

### Anbefaling
Flyt dem til config/content-lag, evt. meget simpelt først.

### Foreslået tabel
`projection_content`
- `id`
- `game_profile_id`
- `content_type` (`npc_comment`, `root_cause_copy`, `boss_copy`, `challenge_copy`)
- `key`
- `locale`
- `payload jsonb`
- `is_active`

### Hvorfor nu
Det gør variation pr. template og use-case mulig uden kodebranching.

---

## 5. Gør conflict state mere eksplicit senere end audit-log tekst

### Problem i dag
Konflikter spores, men vi er stadig tæt på at repræsentere dem som audit-output fremfor et egentligt domæne.

### Anbefaling
Ikke nødvendigvis i denne uge, men design klar ret hurtigt en tabel som fx:

`sync_conflicts`
- `id`
- `organization_id`
- `entity_type`
- `entity_id`
- `field_name`
- `source_system`
- `detected_at`
- `status` (`open`, `resolved`, `ignored`, `stale`)
- `proposed_value jsonb`
- `current_value jsonb`
- `resolution jsonb`

### Hvorfor nu-ish
Ikke P0 for migration denne uge.
Men vigtigt at have som næste datamodellag, før connected mode bliver rigtig.

---

## P2 — Bør forberedes snart

## 6. Gør sessions/votes metadata mere bevidst versioneret

### Problem
Perspective poker har allerede `metadata jsonb` på votes, hvilket er fint.
Men når game/session mode vokser, kan session/runtime semantics sprede sig usynligt i JSON blobs.

### Anbefaling
Behold JSON hvor det giver mening, men indfør conventions:
- versionsfelt i metadata
- navngivne payload-sektioner
- dokumentér hvilke metadata der er canonical vs ephemeral

### Hvorfor
Så sessions ikke bliver et “misc blob” domæne senere.

---

## 7. Gør template mapping til første klasses config

### Problem
Templates er vigtige, men vi har ikke endnu en tydelig database-/config-model for hvordan template påvirker game projection, field semantics og workflow.

### Anbefaling
Enten:
- `template_profiles` tabel
eller
- udvid `session_templates`/config-lag tydeligt

### Minimumsbehov
- template key
- canonical field mapping preset
- game profile binding
- challenge/retro profile binding

---

## 8. Definér sync-ledger særskilt fra generisk event ledger

### Problem
`event_ledger` er godt, men connected mode får sandsynligvis brug for mere connector-nær lagring.

### Anbefaling
På sigt særskil:
- generisk governance/event ledger
- connector sync ledger

Mulig tabel:
`sync_ledger`
- connector
- cursor/checkpoint
- idempotency key
- direction
- payload hash
- processed_at
- status
- retry metadata

### Hvorfor
Det holder event governance og connector drift adskilt.

---

## P3 — Kan vente lidt

## 9. Fuld normalisering af projection runtime state
Vi skal ikke modellere hver eneste animation/state machine i DB.
Det vil være overkill nu.

## 10. Fuld enterprise-grade conflict workbench schema
Vi skal have retning nu, ikke alt schema på én gang.

## 11. Fuld connector plugin model i DB
Unødvendigt tidligt.
Først: ejerskab, refs, projection config.

---

## Anbefalet rækkefølge for faktiske ændringer

## Batch 1 — Højeste leverage
1. `external_refs`
2. `game_profiles`
3. `boss_profiles`
4. `reward_rules`
5. `achievement_definitions`

## Batch 2 — Næste lag
6. `projection_content`
7. template/profile binding
8. conventions for session/vote metadata

## Batch 3 — Når connected mode nærmer sig
9. `sync_conflicts`
10. `sync_ledger`

---

## Hvad bør IKKE migreres endnu

Vi bør ikke nu:
- rive eksisterende PM-tabeller op
- lave kæmpe polymorfisk meta-schema over alt
- modellere alle animationer/sprites i DB
- lave fuld multi-connector generalisering
- overkomplicere approvals med 10 ekstra states

Målet er ikke elegance på whiteboard.
Målet er at undgå fremtidig smerte med små, præcise greb.

---

## Konkret anbefaling til Sprint B/C efter denne note

## Sprint B
- brug ownership matrix til at låse contracts
- beslut hvilke felter der skal migreres først til stærkere ownership/refs model

## Sprint C
- implementér Batch 1 for projection decoupling
- især flyt reward/boss/world semantik ud af frontend constants

## Sprint D
- design og implementér `sync_conflicts` + `sync_ledger`
- kun når connected mode faktisk skal tættere på real rollout

---

## Min ærlige dom

Det største vi kan gøre rigtigt nu er ikke at blive forelskede i den nuværende prototype-frontendstruktur.

Hvis vi tidligt flytter:
- external refs
- projection config
- reward/boss/profile logic

...så slipper vi sandsynligvis for den store smerte senere.

Hvis vi ikke gør det, kommer refactoren næsten helt sikkert, og den bliver dyr, fordi den vil ramme:
- frontend
- backend
- governance model
- integration model
på samme tid.
