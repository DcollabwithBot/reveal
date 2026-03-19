# Reveal — Projection Config Backlog

Date: 2026-03-19
Status: Sprint C working output
Purpose: Prioriteret backlog over hvilke gameplay/projection-semantikker der bør flyttes ud af frontend først.

## P1
- boss profiles
- pressure rules
- XP/reward rules
- achievement definitions
- world/progression definitions

## P2
- root cause / NPC commentary content
- challenge catalog source cleanup
- retro event semantic cleanup
- template-to-game-profile binding

## P3
- richer session metadata conventions
- cross-project progression tuning
- cosmetic/game flavor parameters that currently live in constants

## Acceptance rule
Et backlog-item er ikke done bare fordi det er flyttet til en tabel.
Det er først done når:
- ownership er tydelig
- data shape er dokumenteret
- UI læser fra nyt source-of-truth/config source
- fallback story er tydelig

## Anti-patterns we must avoid
- flytte hårdkodet kaos fra JS til ustruktureret JSON og kalde det en sejr
- parallelle sandheder mellem constants og DB
- projection rules der stadig implicit muterer PM logic
