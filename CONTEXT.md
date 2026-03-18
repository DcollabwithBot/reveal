# Reveal — Projekt CONTEXT

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: Aktiv udvikling — v0.3
- Live: https://reveal.blichert.net
- GitHub: https://github.com/DcollabwithBot/reveal
- App: `app/` — Vite + React, bygget og deployet på Nordicway

## Hvad er bygget
- Alle 4 skærme koblet: Avatar Creator → World Select → Overworld → Session
- Shared infrastruktur: constants.js, useSound.js, utils.js, animations.css
- Bug fixes (8 stk.): double-onComplete, bossName, weather thrashing, equipment propagering, node completion, NPC bubbles, dk() dedup
- **Scope Roulette**: Mekanisk distinkt game mode — slot animation, 18 challenge-cards (human/tech/extern), boss HP modifier, re-vote + delta-visning
- **Planning Poker**: Fuldt fungerende med confidence vote, achievements, loot

## Næste sprint
- Sprint 4: Supabase + Auth + Multiplayer arkitektur

## Roadmap
| Sprint | Indhold |
|--------|---------|
| 1-3 | MVP modes (Poker, Roulette, Boss Battle) ✅ |
| 4 | Supabase schema + Auth (Google OAuth) + Realtime multiplayer + avatar persistence |
| 5 | Bluff Poker |
| 6 | Perspektiv-Poker |
| 7 | Spec Wars |
| 8 | Russian Nesting Scope |
| 9 | Speed Scope |
| 10 | Jira/Azure DevOps integration |
| 11 | AI Lifelines + mønstergenkendelse |

## Game modes status
| Mode | Node type | Status |
|------|-----------|--------|
| Planning Poker | p | ✅ Komplet |
| Scope Roulette | r | ✅ Komplet |
| Sprint Boss Battle | b | ✅ Komplet |
| Bluff Poker | bf | 🔜 Sprint 5 |
| Perspektiv-Poker | pp | 🔜 Sprint 6 |
| Spec Wars | sw | 🔜 Sprint 7 |
| Russian Nesting Scope | rn | 🔜 Sprint 8 |
| Speed Scope | ss | 🔜 Sprint 9 |

## Teknisk beslutning (Sprint 4)
- Backend: Supabase (ny projekt — ikke madro.ai's)
- Auth: Supabase Auth + Google OAuth
- Realtime: Supabase Realtime channels (multiplayer)
- Hosting: Nordicway (frontend statiske filer)
- Nuværende Vite-setup + supabase-js client — ingen framework-skift nødvendig

## Supabase schema (Sprint 4 target)
- `profiles` — avatar (klasse, skin, equipment), XP, level
- `teams` — workspace/organisation
- `rooms` — persistente rum knyttet til team + projekt
- `sessions` — enkelt game session (mode, start/slut, resultat)
- `votes` — individuelle stemmer per session
- `achievements` — unlocked achievements per bruger
- `worlds` + `nodes` — overworld progression

## Flow
```
Avatar Creator → World Select → Overworld Map → Game Session → (tilbage til Overworld)
```

## Filer
- `reveal-1-avatar.jsx` — Avatar Creator (klasse + equipment)
- `reveal-2-worlds.jsx` — World Select / Tavern Hub
- `reveal-3-overworld.jsx` — Overworld Map (SVG-baseret)
- `reveal-session.jsx` — Game Session (boss battle, Planning Poker)
- `REVEAL-HANDOFF.md` — Fuld teknisk brief til udvikler
- `Reveal-Koncept-v3.1.docx` — Original konceptdokument

## Hvad mangler
1. Shared infrastruktur (farver, klasser, NPC team, equipment, sound engine, animations) → egne filer
2. Props-interface på alle 4 komponenter (se HANDOFF.md)
3. App Router (simpel state machine: screen + avatar + world + node)
4. Avatar → Session flow (avatarens klasse/farver/equipment bruges i session)
5. Session → Map flow (markér node completed)

## Tech stack
- React (hooks only)
- Web Audio API (lyd — ingen filer)
- SVG (overworld)
- CSS animations inline
- Press Start 2P + VT323 (Google Fonts)
- Ingen externe deps udover React

## Design-principper (rør ikke)
- Pixel art æstetik
- Alt lever — ingen statiske elementer
- Lyd på alt
- Boss battle = opgaven der skal estimeres
- Tavern hub = world select

## Lokation
`/root/.openclaw/workspace/projects/reveal/`
