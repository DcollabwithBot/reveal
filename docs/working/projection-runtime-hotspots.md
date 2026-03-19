# Reveal — Projection Runtime Hotspots

Date: 2026-03-19
Status: Sprint C working output
Purpose: Kortlægge hvor gameplay/projection-semantik lever i frontend/runtime i dag, og hvilke steder der bør decouples først.

## TL;DR

De vigtigste hotspots er ikke spredt jævnt ud.
De er koncentreret i få filer, og det er godt nyt.

De største hotspots er:
- `app/src/screens/Session.jsx`
- `app/src/shared/constants.js`
- `app/src/screens/Overworld.jsx`
- `app/src/screens/WorldSelect.jsx`
- `app/src/components/RouletteOverlay.jsx`
- `app/src/components/RootCauseSelector.jsx`

Det betyder:
- vi kan sandsynligvis få høj effekt med relativt få målrettede greb
- men Session.jsx er klart den farligste fil, fordi både runtime-beslutninger, rewards, boss-state og root-cause flow mødes dér

---

## Hotspot 1 — `Session.jsx`

### Hvorfor den er farlig
Denne fil blander flere lag samtidig:
- session UI
- boss semantics
- challenge handling
- retro/problem flow
- root-cause flow
- XP/reward/loot logic
- NPC assist logic
- advisory/writeback recommendations

### Konkrete tegn
Vi kan se bl.a.:
- `bossName` fallback inline
- `bossHp`, `bossBattleHp`, rage/idle/death semantics
- challenge modifier -> HP bonus logic
- loot array built inline
- XP values inline (`+45`, `combo * 5`, osv.)
- root cause progression logic
- NPC team estimation helper logic

### Klassificering
- UI/state: ok at blive her lidt endnu
- gameplay semantics: bør flyttes ud først

### Hvad bør flyttes ud først
- reward rules
- boss/pressure rules
- challenge effect rules
- root cause commentary mapping
- session outcome projection rules

---

## Hotspot 2 — `shared/constants.js`

### Hvorfor den er farlig
Denne fil er blevet en blanding af:
- presentation constants
- gameplay catalogs
- prototype content
- world definitions

### Konkrete sektioner der er problematiske
- `SPRINT_EVENTS`
- `ROULETTE_CHALLENGES`
- `WORLDS`
- dele af `NPC_TEAM`
- potentielt class semantics hvis de går ud over ren visual flavor

### Hvad der er okay at blive
- farver
- fonts
- simple presentational constants
- base cosmetic classes hvis de ikke påvirker domænelogik

### Hvad der bør væk først
- world/progression data
- challenge catalogs
- retro/problem event semantics
- NPC commentary/role semantics hvis de påvirker play logic

---

## Hotspot 3 — `Overworld.jsx`

### Hvorfor den er vigtig
Overworld er stedet hvor PM/work bliver oversat til map/progression-opfattelse.
Hvis det lag forbliver hårdkodet, bliver “game projection” for tæt bundet til én visual implementation.

### Konkrete tegn
- boss node semantics
- XP reward display per node type
- lock/can-enter logic tæt på UI
- node-type mapping (`b`, `q`, `c`, `r` osv.)

### Hvad bør flyttes ud
- node type semantics
- reward mapping per node type
- progression/lock rules
- project -> world projection model

---

## Hotspot 4 — `WorldSelect.jsx`

### Hvorfor den er vigtig
Verdenerne i Reveal ligner i dag en mere hardcoded produkt- og domænefortolkning.
Det er farligt, fordi worlds på sigt bør være afledt af canonical data eller template/game profile config.

### Hvad bør flyttes ud
- world definitions
- boss labels
- progress totals
- metadata der i dag er konstant, men senere bør være projekt-/template-afledt

---

## Hotspot 5 — `RouletteOverlay.jsx`

### Problem
`ROULETTE_CHALLENGES` bruges som hardcoded challenge catalog.

### Konsekvens
Når DB allerede har `challenges`, risikerer vi parallel sandhed.

### Hvad bør ske
- overlay-komponenten bør være render/runtime shell
- challenge catalog bør komme fra DB eller config layer
- fallback må være tydelig bootstrapping/dev-only, ikke normal drift

---

## Hotspot 6 — `RootCauseSelector.jsx`

### Problem
Root cause semantik og copy er stadig tæt bundet til komponenten.

### Hvad bør ske
- flyt root cause content og mappings til projection/content layer
- behold komponenten som UI-shell

---

## Mindre hotspots / lavere prioritet

### `AvatarCreator.jsx`
- class visuals og cosmetic gear er mindre farlige
- kun problem hvis class semantics påvirker gameplay/projection substantielt

### `useSound.js`
- ikke vigtigt nu
- presentation layer

### `animations.css`
- ikke vigtigt nu
- presentation layer

---

## Prioriteret decoupling-rækkefølge

## Batch 1 — Højeste risiko / højest gevinst
1. `Session.jsx` gameplay semantics
2. `shared/constants.js` world/challenge/event content
3. `Overworld.jsx` progression + reward mapping

## Batch 2 — Næste lag
4. `WorldSelect.jsx` world metadata
5. `RouletteOverlay.jsx` challenge source
6. `RootCauseSelector.jsx` content source

## Batch 3 — Senere refinement
7. class/party semantics hvis de viser sig at være mere end visuel flavor
8. session/vote metadata structure cleanup

---

## Konkrete recommendations

### Keep in UI for now
- animationer
- sounds
- pure visual constants
- sprite/cosmetic presentation

### Move to config/data next
- worlds
- challenge catalog
- retro/problem catalog semantics
- boss profiles
- pressure rules
- XP/reward rules
- achievement definitions
- commentary mappings

---

## Kort dom

Sprint C bør ikke starte med database-tabeller i blinde.
Det bør starte med disse hotspots som reference, så vi ved præcist hvilke hårdkodede ting vi forsøger at tage ud af frontend først.
