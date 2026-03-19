# Reveal — Template Authoring Guide

Date: 2026-03-19
Status: Sprint C working output
Purpose: Dokumentere hvordan man bruger templates til at binde PM-domæne, game profile og projection semantics sammen.

## Hvad en template er i Reveal

En template er ikke bare en backlog-skabelon.
I Reveal bør en template på sigt binde sammen:
- canonical PM-struktur
- acceptance criteria / risk model
- challenge/retro semantics
- game profile / boss profile / world semantics

KOMBIT-WIFI7 er det bedste nuværende eksempel på denne tanke.

---

## Hvad en template bør kunne definere

### PM side
- project structure
- phases / sprint ideas
- risk register baseline
- acceptance criteria / DoD
- task categories

### Projection side
- game profile
- boss profile
- reward model
- challenge profile
- retro profile
- world/progression flavor

---

## Minimum for en ny template

Når du opretter en ny template, bør du minimum tage stilling til:
- Hvad er canonical PM-kernen i denne use-case?
- Hvilken boss/pressure-semantik passer til den?
- Hvilke achievements giver mening uden at blive gimmick?
- Hvilke challenge/event prompts passer til domænet?
- Hvilke ting må aldrig blive gamefikseret for hårdt?

---

## Binding-regel

En template bør ikke duplikere al game-logik selv.
Den bør så vidt muligt binde til eksisterende profiler via keys.

Eksempel:
- template: `kombit-wifi7`
- uses game profile: `enterprise-rollout-default`
- uses boss profile: `delivery-pressure-rollout`
- uses reward ruleset: `enterprise-rollout-rewards-v1`

Kun hvis use-casen reelt kræver det, bør vi oprette helt nye profiler.

---

## Hvornår skal man lave en ny template vs. genbruge eksisterende profiler?

### Lav ny template når
- PM-strukturen er markant anderledes
- risici / acceptance / work breakdown er domænespecifik
- challenge/retro semantik skal være væsentligt anderledes

### Genbrug profiler når
- pressure-model grundlæggende er den samme
- reward-model grundlæggende er den samme
- forskellen mest er copy/flavor og ikke systemlogik

---

## Anti-pattern

Lav ikke template = hardcoded one-off mode.
Hvis en use-case føles unik, så skal den stadig beskrives via template/profile-binding, ikke via nye special cases i frontend.

---

## Kort dom

Templates er broen mellem:
- det seriøse PM-domæne
- og Reveal’s game/projection-lag

Hvis vi bruger dem rigtigt, undgår vi kundespecifik frontend-kaos senere.
