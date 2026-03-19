# Reveal — Projection Authoring Guide

Date: 2026-03-19
Status: Sprint C working output
Purpose: Dokumentere hvordan man fremover tilføjer nye bosses, achievements, rewards, world-definitions og projection content uden at grave rundt i React-komponenter.

## TL;DR

Hvis du vil udvide Reveal’s game/projection layer, skal du som udgangspunkt gøre det gennem data/config — ikke ved at lægge nye regler direkte i `Session.jsx` eller `shared/constants.js`.

Denne guide beskriver:
- hvad man opretter
- hvornår man opretter det
- hvad der hører til i config
- hvad der stadig hører til i presentation/UI

---

## Grundregel

Når du vil tilføje ny game-semantik, så spørg først:

1. Er det canonical PM-data?
2. Er det projection/output ovenpå PM-data?
3. Er det bare visual/presentation?

### Hvis svaret er:
- canonical PM-data -> hører ikke til her
- projection/output -> hører til i projection config/content
- visual/presentation -> kan ofte blive i frontend

---

## 1) Sådan tilføjer du en ny boss

## Hvornår giver det mening?
Når et projekt/sprint/use-case skal have sin egen pressure/arena-semantik.

Eksempler:
- standard delivery pressure boss
- enterprise rollout boss
- security/compliance boss
- customer onboarding boss

## Det du opretter
- et `boss_profile`
- evt. et `game_profile` der peger på boss profile
- evt. tilhørende `projection_content` for boss copy

## Minimum du skal definere
- `key`
- `name`
- `theme`
- `icon`
- pressure sources
- hp/pressure scaling logic
- state thresholds

## Skal IKKE lægges i boss profile
- canonical project status
- PM approval logic
- audit semantics
- direkte mutationsregler på work items

## Husk
En boss er en fortolkning af PM-data, ikke en erstatning for PM-data.

---

## 2) Sådan tilføjer du en ny achievement

## Hvornår giver det mening?
Når du vil belønne et mønster eller outcome der er stabilt nok til at være en genbrugelig regel.

Eksempler:
- perfekt sprint
- zero reopen shield
- no blocker carry-over
- rollout without rollback

## Det du opretter
- en `achievement_definition`
- evt. copy/content i `projection_content`

## Minimum du skal definere
- `key`
- `name`
- `description`
- `icon`
- trigger type
- conditions

## Regel
Achievements er altid projection-only.
De må aldrig blive til skjulte governance-felter eller approval-state.

---

## 3) Sådan tilføjer du nye reward rules

## Hvornår giver det mening?
Når et bestemt event/outcome skal mappes til XP, badges eller belønningssignal.

Eksempler:
- session complete
- combo/streak hit
- blocker retired
- perfect handover

## Det du opretter
- en `reward_rule`
- evt. badge/content mapping i `projection_content`

## Minimum du skal definere
- `key`
- `triggerType`
- XP base
- modifiers
- badge output rules

## Regel
Reward rules må producere signaler og UI-output.
De må ikke skrive direkte til projects/sprints/items.

---

## 4) Sådan tilføjer du en ny world

## Hvornår giver det mening?
Når et project domain eller template skal have sin egen world/progression-fortolkning.

Eksempler:
- platform engineering world
- customer delivery world
- compliance world
- KOMBIT WiFi rollout world

## Det du opretter
- en `world_definition`
- evt. binding til `boss_profile`
- evt. binding til `game_profile`

## Minimum du skal definere
- `key`
- `name`
- `theme`
- boss profile reference
- node types
- reward mapping per node type
- mapping source/template relation

## Regel
Worlds bør på sigt være delvist afledt af canonical project/template data.
De må ikke være vilkårlige separate virkeligheder uden relation til PM-domænet.

---

## 5) Sådan tilføjer du ny commentary / content

## Hvornår giver det mening?
Når tekst/copy i projection layer ikke bare er styling, men semantisk indhold.

Eksempler:
- NPC commentary
- boss taunts
- root-cause prompts
- challenge copy
- achievement flavor text

## Det du opretter
- `projection_content`

## Minimum du skal definere
- `contentType`
- `key`
- `locale`
- `payload.text`
- `isActive`

## Regel
Kommentarer og prompts skal ikke vokse som spredte inline strings i komponenterne.

---

## 6) Hvad må godt stadig blive i frontend?

Det her må ofte blive i UI-laget lidt endnu:
- animation names
- icon rendering
- layout decisions
- colors/themes
- sound effects
- ren præsentations-copy uden domænebetydning

Hvis det ændrer gameplay-semantik, progression eller rewards, bør det ikke blive i frontend alene.

---

## 7) Authoring workflow

Når du tilføjer nyt i projection-laget, brug denne rækkefølge:

1. Beslut om det er boss / reward / achievement / world / content
2. Opret eller opdater relevant config shape
3. Dokumentér hvorfor det findes
4. Bind det til game profile eller template hvis nødvendigt
5. Sørg for at runtime læser derfra
6. Reducér eksisterende frontend fallback/hardcoded logik

---

## 8) Anti-patterns

Undgå dette:

### Anti-pattern 1
“Jeg smider bare en ekstra if-sætning i `Session.jsx`.”

### Anti-pattern 2
“Jeg lægger det i `shared/constants.js` indtil videre.”

### Anti-pattern 3
“Vi kan altid rydde op senere.”

### Anti-pattern 4
“Det er bare copy, men copyen ændrer faktisk spillets semantik.”

---

## 9) Kvalitetsbar for nyt projection content

Et nyt boss/achievement/reward/world er først godt nok når:
- det har en tydelig rolle
- det kan forklares som projection af canonical data
- det ikke kræver skjult UI-logik for at give mening
- det kan dokumenteres og genbruges
- det ikke bryder PM source-of-truth modellen

---

## Kort dom

Målet er ikke at gøre Reveal kedeligt.
Målet er at gøre Reveal udvideligt uden at grave sin egen grav i frontend-logik.
