# Reveal — Sprint C Default Profile Seed

Date: 2026-03-19
Status: Sprint C working output
Purpose: Definere første baseline seed for projection layer, så runtime ikke skal starte på tomt config-lag.

## Default game profile
- key: `default-standalone`
- mode: `standalone`
- pressureModel: `delivery-pressure-default`
- rewardModel: `session-complete-default`
- worldModel: `default-world-v1`

## Default boss profile
- key: `delivery-pressure-default`
- icon: `👾`
- pressure sources:
  - blocked_items
  - scope_spread
  - low_confidence
- state thresholds:
  - healthy: 0-29
  - warning: 30-69
  - critical: 70-100

## Default reward rule
- key: `session-complete-default`
- xpBase: 45
- comboMultiplier: 5
- badges:
  - risk-badge
  - streak-bonus
  - power-badge
  - session-star

## Default achievement examples
- `perfect-sprint`
- `streak-master`
- `risk-hunter`

## Rule
Dette seed er ikke endelig game-balance.
Det er et bootstrap-sæt, så vi kan bevise at semantics kan læses fra config i stedet for fra inline React-kode.
