# Reveal — Sprint C Task Breakdown

Date: 2026-03-19
Status: Sprint C working output
Purpose: Gøre Sprint C eksekverbar som konkrete implementation tasks i stedet for kun arkitektur- og authoring-noter.

## Batch 1 — P1 tasks

### C1.1 — Introduce config storage surfaces
Formål:
- oprette de første data/config-tabeller for projection layer

Scope:
- `game_profiles`
- `boss_profiles`
- `reward_rules`
- `achievement_definitions`

Definition of done:
- migrationspec er klar
- felter matcher `projection-config-shapes-v1.md`
- seed/default records er defineret

---

### C1.2 — Define default standalone profile set
Formål:
- skabe første sammenhængende default profile stack

Scope:
- default game profile
- default boss profile
- default reward rules
- default achievements

Definition of done:
- der findes ét baseline sæt som runtime kan læse
- dokumenteret i authoring guide / config docs

---

### C1.3 — Add runtime read path for projection config
Formål:
- gøre config læsbar uden at omskrive hele UI’en

Scope:
- vælg første læsevej (server fetch / client fetch / shared loading helper)
- tydelig transitional fallback story

Definition of done:
- runtime kan læse config fra nyt source
- fallback er markeret som midlertidig

---

### C1.4 — Replace inline reward logic in `Session.jsx`
Formål:
- flytte XP/reward/badge-semantik ud af inline komponentlogik

Scope:
- session complete reward mapping
- combo/streak logic
- reward badge mapping

Definition of done:
- reglerne læses fra config eller central rule helper
- `Session.jsx` indeholder ikke længere den primære reward forretningslogik

---

### C1.5 — Replace inline boss/pressure semantics in `Session.jsx`
Formål:
- flytte boss HP / pressure rules væk fra inline-logik

Scope:
- pressure sources
- hp scaling
- state thresholds

Definition of done:
- `Session.jsx` renderer boss state, men ejer ikke længere hovedreglerne

---

### C1.6 — First achievement projection path
Formål:
- bevise at achievements kan være data-drevne og ikke UI-hardcoded

Scope:
- mindst 1-2 achievements fra default profile
- vises stadig i nuværende UI uden stor redesign

Definition of done:
- achievement triggers er defineret uden inline branch-suppe

---

## Batch 2 — næste efter Batch 1

### C2.1 — Move world definitions out of `shared/constants.js`
### C2.2 — Move challenge catalog source out of constants
### C2.3 — Move root-cause / NPC commentary to projection content
### C2.4 — Bind template -> game profile explicitly

---

## What NOT to do in Sprint C
- ikke omskriv hele `Session.jsx` visuelt
- ikke lav full engine
- ikke forbind connected mode endnu
- ikke byg ny UI ovenpå gammel tech-gæld før semantics er flyttet

---

## Recommended execution order
1. C1.1
2. C1.2
3. C1.3
4. C1.4
5. C1.5
6. C1.6
7. Batch 2 bagefter

---

## Kort dom

Sprint C er nu brudt ned til rigtige opgaver. Næste naturlige skridt er at implementere C1.1–C1.3 som første kode-/migrationsbatch.
