# Reveal — Projection Config Shapes v1

Date: 2026-03-19
Status: Sprint C working output
Purpose: Gøre Batch 1 i projection decoupling konkret ved at definere de første data/config-shapes, så migrations og runtime-kode kan bygges uden at improvisere.

## TL;DR

Vi skal ikke bare sige “flyt det til config”.
Vi skal vide hvilken form configen skal have.

Denne fil definerer første version af shapes for:
- game profile
- boss profile
- reward rule
- achievement definition
- world/progression definition
- projection content

Disse shapes er ikke endelige enterprise-kontrakter.
De er bevidst små og implementerbare.

---

## 1) `game_profile`

### Formål
Top-level konfiguration for hvordan et org/template/use-case fortolker PM-data til game/projection-signaler.

### Shape
```json
{
  "key": "default-standalone",
  "name": "Default Standalone",
  "templateKey": null,
  "isDefault": true,
  "config": {
    "mode": "standalone",
    "pressureModel": "default-v1",
    "rewardModel": "default-v1",
    "worldModel": "default-v1"
  }
}
```

### Bemærkning
Game profile skal ikke indeholde al logik direkte.
Den skal primært referere til de underliggende profiler/rule-sets.

---

## 2) `boss_profile`

### Formål
Definere hvordan boss-state og pressure semantics ser ud for et use-case/template/profil.

### Shape
```json
{
  "key": "delivery-pressure-default",
  "name": "Delivery Pressure",
  "theme": "execution",
  "icon": "👾",
  "rules": {
    "hpBase": 100,
    "pressureSources": ["blocked_items", "scope_spread", "low_confidence"],
    "hpScale": {
      "blocked_items": 12,
      "scope_spread": 8,
      "low_confidence": 10
    },
    "states": {
      "healthy": [0, 29],
      "warning": [30, 69],
      "critical": [70, 100]
    }
  }
}
```

### Regel
Boss profile beskriver kun projection-regler, ikke canonical sprint/project status.

---

## 3) `reward_rule`

### Formål
Definere hvordan XP/rewards udløses af events eller outcomes.

### Shape
```json
{
  "key": "session-complete-default",
  "triggerType": "session_complete",
  "rule": {
    "xpBase": 45,
    "comboMultiplier": 5,
    "rewardBadges": [
      { "when": "root_causes_detected", "badge": "risk-badge" },
      { "when": "combo_gte_3", "badge": "streak-bonus" },
      { "when": "lifeline_used", "badge": "power-badge" }
    ]
  },
  "isActive": true
}
```

### Regel
Reward rules må producere projection output, aldrig direkte canonical PM writes.

---

## 4) `achievement_definition`

### Formål
Definere achievements som data i stedet for UI-logic.

### Shape
```json
{
  "key": "perfect-sprint",
  "name": "Perfect Sprint",
  "description": "No critical problems detected in retrospective flow.",
  "icon": "🏆",
  "rule": {
    "triggerType": "retrospective_complete",
    "conditions": [
      { "field": "bossBattleHp", "operator": "eq", "value": 0 }
    ]
  },
  "isActive": true
}
```

### Regel
Achievement definitions er projection-only.
De må ikke blive skjulte canonical business fields.

---

## 5) `world_definition`

### Formål
Definere hvordan projekter/sprints/worlds præsenteres i map/progression layer.

### Shape
```json
{
  "key": "platform-team-world",
  "name": "Platform Team",
  "theme": "execution-world",
  "bossProfileKey": "delivery-pressure-default",
  "progression": {
    "nodeTypes": ["route", "quest", "challenge", "boss"],
    "rewardByNodeType": {
      "route": 30,
      "quest": 50,
      "boss": 80
    }
  },
  "mapping": {
    "source": "project_or_template",
    "templateKey": null
  }
}
```

### Regel
World definitions bør på sigt afledes delvist af canonical data + template binding, ikke leve som rene globale constants.

---

## 6) `projection_content`

### Formål
Definere commentary/copy/content som i dag er hardcoded i UI.

### Shape
```json
{
  "contentType": "npc_comment",
  "key": "expert-similar-last-time",
  "locale": "da-DK",
  "payload": {
    "text": "Denne type tog 8 pts sidst."
  },
  "isActive": true
}
```

Andre content types:
- `root_cause_copy`
- `boss_copy`
- `challenge_copy`
- `achievement_copy`

---

## 7) Shape-principper

### Keep small
Shapes skal være små nok til at kunne bruges hurtigt.

### Use JSON only where it buys flexibility
Ikke alt skal normaliseres fra dag 1.
Men vi må heller ikke bare dumpe al logik i én stor blob.

### Separate refs from rules
Profiles bør referere til andre profiler/rules ved key, ikke duplikere alt.

### Canonical input, projection output
Shapes må aldrig begynde at beskrive canonical PM-state som om de ejede den.

---

## 8) Hvad der kan blive i frontend lidt endnu

Følgende behøver ikke migrations først:
- visuelle ikoner
- simple animation names
- pure styling themes
- lyd/effekt wiring

Det vi flytter først er semantics, ikke pynt.

---

## Kort dom

Hvis vi får disse shapes på plads, så kan Sprint C begynde at bygge rigtigt.
Hvis vi ikke gør det, så ender “flyt det til config” bare som ny uklarhed i stedet for mindre kaos.
