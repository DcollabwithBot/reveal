# Reveal — Projekt CONTEXT

Last updated: 2026-03-19

## Hvad er det?
Gamificeret team-estimeringsplatform. Planning Poker + Scope Roulette + Sprint Retrospectives pakket ind i RPG-mekanik med klasser, spells, boss battles, achievements og loot.

## Status
- Fase: Aktiv udvikling — v0.4 (Sprint 4b komplet)
- Live: https://reveal.blichert.net
- GitHub: https://github.com/DcollabwithBot/reveal
- App: `app/` — Vite + React, bygget og deployet på Nordicway

## Hvad er bygget

### Sprint 1-3 ✅
- Alle 4 skærme koblet: Avatar Creator → World Select → Overworld → Session
- Shared infrastruktur: constants.js, useSound.js, utils.js, animations.css
- Bug fixes (8 stk.)
- Scope Roulette: slot animation, 18 challenge-cards (human/tech/extern), boss HP modifier, re-vote + delta
- Planning Poker: fuldt fungerende med confidence vote, achievements, loot
- Sprint Boss Battle: retrospective game mode med event voting, root cause, oracle mechanic
- RPG Landing page

### Sprint 4 ✅ (Supabase + Auth)
- Supabase projekt oprettet: `swyfcathwcdpgkirwihh` (reveal.ai)
- Komplet DB schema (organizations, organization_members, profiles, teams, team_members, sessions, session_participants, session_items, votes) — RLS aktiveret
- Google OAuth + login screen (Login.jsx)
- Supabase client: `app/src/lib/supabase.js`

### Sprint 4b ✅ (Multiplayer Realtime)
- Lobby screen (Lobby.jsx) — spiller joiner via join_code, presence tracking
- Active session screen (Session.jsx) — realtime stemmer, GM view
- Supabase Realtime channel: `session:{session_id}`
- Screens: Landing, Login, AvatarCreator, WorldSelect, Overworld, Lobby, Session

## Næste sprint
- Sprint 5: XP/achievements logik, overworld node-completion, team velocity, custom challenges UI, co-GM/observer roller

## Roadmap
| Sprint | Indhold | Status |
|--------|---------|--------|
| 1-3 | MVP modes (Poker, Roulette, Boss Battle) | ✅ |
| 4 | Supabase schema + Auth (Google OAuth) | ✅ |
| 4b | Realtime multiplayer + Lobby + Session UI | ✅ |
| 5 | XP/achievements, velocity, observer rolle, co-GM | 🔜 |
| 6 | Perspektiv-Poker + session templates + Slack/Teams webhooks | |
| 7 | Spec Wars | |
| 8 | Russian Nesting Scope | |
| 9 | Speed Scope | |
| 10 | Jira/Azure DevOps integration | |
| 11 | AI Lifelines + mønstergenkendelse | |

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

## Supabase
- Projekt ID: `swyfcathwcdpgkirwihh`
- Migrerede tabeller: organizations, organization_members, profiles, teams, team_members, sessions, session_participants, session_items, votes
- Ikke migreret (sprint 5+): achievements, user_achievements, worlds, world_nodes, node_completions, custom_challenges, custom_events, session_templates, audit_log, rooms

## Tech stack
- React (hooks only) + Vite
- Supabase (Auth + DB + Realtime)
- Web Audio API (lyd — ingen filer)
- SVG (overworld)
- CSS animations inline
- Press Start 2P + VT323 (Google Fonts)
- Hosting: Nordicway (statiske filer)
- Backend: Express skeleton i `server/`

## Filer
- `app/src/screens/` — Landing, Login, AvatarCreator, WorldSelect, Overworld, Lobby, Session
- `app/src/components/` — RetroEventCard, RootCauseSelector, RouletteOverlay
- `app/src/lib/supabase.js` — Supabase client
- `SPRINT4-PLAN.md` — Komplet teknisk blueprint Sprint 4
- `SPRINT4-SUMMARY.md` — Arkitekturbeslutninger + MVP scope
- `REVEAL-HANDOFF.md` — Fuld teknisk brief til udvikler
- `Reveal-Koncept-v3.1.docx` — Original konceptdokument

## Design-principper (rør ikke)
- Pixel art æstetik
- Alt lever — ingen statiske elementer
- Lyd på alt
- Boss battle = opgaven der skal estimeres
- Tavern hub = world select

## Lokation
`/root/.openclaw/workspace/projects/reveal/`
