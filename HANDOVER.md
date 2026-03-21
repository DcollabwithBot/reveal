# HANDOVER — Reveal (2026-03-21)

## Status
v3.1 fuldt implementeret og deployed til reveal.blichert.net.

## Hvad der er bygget i dag (Sprint B→E + v3.1 gap)

### Sprint B–E (tidligere i dag)
- Mission Engine: user_missions, spec_submissions, perspective_votes, session_lifelines
- 8 game modes: Planning Poker, Scope Roulette, Spec Wars, Perspective Poker, Bluff Poker, Nesting Scope, Speed Scope, Sprint Draft
- Achievements (16 total): sniper_shot, oracle, risk_prophet, spec_machine, perfect_fill, retrospective_veteran m.fl.
- World Map + game_availability states
- Leaderboard + Hall of Fame (leaderboard_org tabel)
- Approval Chain (approval_chain_members, governance)
- PM Board game-knapper + Mission Shield + Game HUD
- Audit log v2 + realtime sync forbedringer

### v3.1 Gap-fix (P1–P12)
- **KPI Dashboard** — org metrics, burn-down, accuracy trends
- **Lifelines UI** — 50/50, Phone-a-Friend, Ask-Audience med Supabase sync
- **Truth Serum Screen** — anonym survey med heatmap
- **Explosion Predictor** — regelbaseret scope risk score
- **Jira Onboarding Wizard** — step-by-step integration setup
- **Budget Overview** — sprint cost estimering + time entries
- **WorldSelect verifikation** — world unlock logic bekræftet
- **Notifications Edge Function** — Supabase Edge Function
- **Webhooks UI** — konfigurer udgående webhooks per org
- **Time Tracking auto-actual** — session estimater → time entry
- **Session Type Presets** — room type templates (Planning, Retro, Scope)
- **Mobile quick wins** — touch-optimering, swipe, responsive polish

### Supabase migrationer (alle deployed)
- sprint9_projection_config.sql ✅
- sprint_b1_mission_engine.sql ✅
- sprint_c_game_modes.sql ✅
- sprint_d_achievements.sql ✅
- sprint_e_visibility.sql ✅
- sprint_e_audit_log_v2.sql ✅
- sprint_e_sync.sql ✅
- sprint_e_leaderboard.sql ✅
- sprint_e_approval_chain.sql ✅
- sprint_roles_comments_search.sql ✅ (ny — roles, comments, FTS)
- sprint_todo_features.sql ✅ (ny — smtp_configs, onboarding, jira_sync_log)

## Hvad der mangler (Fase 3)
- AI-lag (Explosion Predictor v2, AI Lifeline)
- Azure DevOps / GitLab integration
- Stripe betalinger
- Dedicated Room Types (fuld arkitektur)
- Pilot-bruger KPI-rapport
- Sidebar refactor (App.jsx → persistent app-shell)

## Deploy
- Frontend: rsync til reveal.blichert.net (kirsogda@cp05.nordicway.dk:33 ~/reveal.blichert.net/)
- SSH key: /root/.ssh/nordicway
- Backend: Supabase (project ID: swyfcathwcdpgkirwihh)
- Supabase credentials: se CONTEXT.md

## Git
- Repo: https://github.com/DcollabwithBot/reveal
- Branch: main
- Last commit: 5569968 (v3.1 gap fix complete)

## Næste session
Start med: git pull + læs denne HANDOVER.md
