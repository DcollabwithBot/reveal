# Reveal v3.1 → Nuværende Stand (2026-03-21)

**Reference:** Reveal-Koncept-v3.1.docx (Marts 2026)  
**Analysedato:** 2026-03-21 efter Sprint A–E deploy  
**Baseline:** v3.1 vision vs. hvad der faktisk er bygget og deployed

---

## Implementeret ✅

### Kerne-arkitektur
- **Tre lag (Workspace / Rooms / Game Modes)** — fuldt implementeret
  - Workspace: organizations, teams, projekter, historik
  - Rooms/Sessions: persistent Sessions med join_code, GM controls, realtime presence
  - Game Modes: valgbare inden for en session

### Game Modes (alle 6 er live)
- **Planning Poker** ✅ — silent vote, reveal, Fibonacci + T-shirt, confidence vote
- **Scope Roulette** ✅ — 18 challenge-cards, boss HP modifier, re-vote
- **Sprint Boss Battle (Retro)** ✅ — retrospective game mode med retro_events, boss battle
- **Bluff Poker** ✅ — BluffPokerScreen.jsx + achievements
- **Perspektiv-Poker** ✅ — PerspectivePokerScreen.jsx, perspective_votes
- **Spec Wars** ✅ — SpecWarsScreen.jsx, acceptance criteria, spec_submissions
- **Russian Nesting Scope** ✅ — NestingScopeScreen.jsx
- **Speed Scope** ✅ — SpeedScopeScreen.jsx

*v3.1 planlagde kun 3 i MVP (Poker, Roulette, Boss Battle) og 5 mere "kommende". Vi har 8.*

### Spilmekanikker
- **Silent vote + simultaneous reveal** ✅
- **Confidence Vote** ✅ — optaget per deltager
- **Hidden Risk Cards** ✅ — via challenges-systemet og Scope Roulette
- **Lifelines** 🟡 (se nedenunder — UI finnes, AI-lifeline ikke implementeret)
- **XP-system** ✅ — xp_awarded, achievement_unlocks
- **Badges/Achievements** ✅ — 16+ achievements på tværs af alle modes
- **Team Accuracy Score** ✅ — team_accuracy_scores tabel
- **Sprint Velocity** ✅ — sprint_velocity tabel + SprintCharts.jsx

### PM-integration (v3.1 kaldte det "Lag A Workspace")
- **Projekter → Sprints → Items** ✅ — fuld CRUD med kanban, drag-drop
- **Estimate vs. Actual** ✅ — estimated_hours + actual_hours på session_items
- **Session Results** ✅ — per-item votes, median, outlier-flag, CSV export
- **Sprint Burndown/Velocity** ✅ — SprintCharts.jsx + Recharts
- **Dependencies** ✅ — BFS circular detection, blocker-badge
- **Comments** ✅ — threading på items
- **Global Søgning** ✅ — Cmd+K spotlight + pg_trgm indexes

### Feedback Loop (v3.1's kernemetrik)
- **Estimat → virkelighed → læring** ✅ — data samles, sprint snapshots, accuracy scores
- **Sprint Report Card** ✅ — samler sprint-data
- **Leaderboard** ✅ — leaderboard_org, Hall of Fame

### Integrationer
- **Jira Shadow Sync** ✅ — jira-sync Edge Function (read-only shadow)
- **Dual-mode arkitektur** ✅ — Mode A (Standalone) fuldt funktionel, Mode B (Connected) gated

### Auth + Multi-tenant
- **Google OAuth** ✅ — Supabase Auth
- **Organizations + Teams** ✅ — multi-tenant med RLS på alle tabeller
- **Roller & Permissions** ✅ — Host/Facilitator/Player/Observer (role på organization_members)

### Governance (ikke i v3.1, men nødvendig for PM-integration)
- **Approval Workflow** ✅ — game suggestion → PM approval lifecycle
- **Audit Log** ✅ — audit_log v2
- **Write-back Guard** ✅ — PM data kan ikke overskrives direkte fra game layer

### Tech
- **Realtime multiplayer** ✅ — Supabase Realtime, presence tracking
- **Pixel art æstetik** ✅ — Press Start 2P, VT323, CSS animations, Web Audio API
- **PWA-ready** ✅ — Vite + static deploy
- **Excel import** ✅ — paste tab-separeret data med kolonnemapping

---

## Delvist implementeret 🟡

### Lifelines
- **Call an Expert** ❌ ikke bygget
- **Scope Reduction (50/50)** ❌ ikke bygget
- **Audience Vote** 🟡 — delvist via confidence vote + voting modes
- **Facilitator Insight** ❌ ikke bygget
- **AI Lifeline** ❌ udskudt til Fase 3 (korrekt per v3.1)

### Explosion Predictor (AI)
- 🟡 Data samles nu. Regler + AI-lag er ikke bygget.
- Korrekt per v3.1 roadmap: "Fase 2 regelbaseret, Fase 3 AI"
- Mangler: faktisk regelbaseret mønstergenkendelse ("denne opgave type → typisk 2x estimate")

### Room Specialisering
- v3.1 definerer 4 rumtyper: Estimation Room, Scope Room, Breakdown Room, Retro Room
- Nuværende: ét Session Room med mode-valg — **dette er korrekt for MVP**
- Specialiseringen er Fase 2–3 per v3.1

### Truth Serum
- 🟡 Tabellen `truth_serum_responses` eksisterer i DB
- UI er ikke bygget — ingen TruthSerumScreen.jsx

### World Map Availability States
- 🟡 `game_availability` tabel deployed (sprint_e_visibility.sql)
- UI for availability states (locked/recommended/completed badges) på World Map — status ukendt

### In-app Notifikationer
- 🟡 `notifications` tabel + NotificationBell.jsx built
- Mangler: push notifikationer, email via Resend

### Webhooks (Slack/Teams)
- 🟡 `send-webhook` Edge Function eksisterer
- UI til at konfigurere webhooks: WorkspaceSettings har felt, men fuld integration er uklar

### Time Tracking
- 🟡 `time_entries` tabel + TimelogScreen.jsx deployed
- Integration med "estimate vs actual" er delvist — `actual_hours` udfyldes manuelt

---

## Mangler stadig ❌

### Explosion Predictor
- Regelbaseret version (Fase 2) ikke bygget
- AI-version (Fase 3) ikke relevant endnu — korrekt at udskyde

### Lifelines UI
- Ingen af de 5 lifelines har et dedikeret UI
- Backend-hooks mangler (Edge Functions)

### Truth Serum Screen
- Tabel eksisterer, UI ikke bygget
- Simpel at bygge — 1 sprint

### Azure DevOps / GitLab integration
- Kun Jira shadow sync p.t.
- Per v3.1: Fase 3

### Budget-integration
- `estimated_hours` + `actual_hours` eksisterer, men ingen direkte budgetkalkulator
- SprintDraft capacity gauge er nærmeste

### Dedicated Room Types (Fase 2)
- Estimation Room / Scope Room / Breakdown Room / Retro Room
- Nuværende single-room model er korrekt for MVP, men roadmap kræver specialisering

### AI-lag (Fase 3–4)
- Mønstertgenkendelse, AI Lifeline, Explosion Predictor v2
- Korrekt at de ikke er her endnu

### Mobile-optimeret UI
- v3.1 nævner det ikke eksplicit, men realtime-teamssessioner fra telefon er en use case
- Nuværende frontend er desktop-first

### Onboarding Flow
- v3.1: "Jira-import af backlog (read-only)" som del af MVP
- Excel import eksisterer. Jira shadow sync eksisterer. Men guided onboarding til "hent din Jira-backlog" er ikke bygget.

### KPI Dashboard (Pilot-metrics)
- v3.1 definerer 5 KPIs: estimatafvigelse, confidence alignment, risiko-identifikation, beslutningshastighed, deltagerengagement
- Data samles, men der er ingen dedikeret KPI-rapport til pilot-kunder

---

## Konklusion

**Reveal er langt foran v3.1's MVP-scope.** v3.1 planlagde 3 game modes i MVP — vi har 8. v3.1 planlagde basic workspace — vi har fuld PM-integration med projekter, sprints, burndown, velocity, dependencies og realtime.

**Hvad der stadig mangler for at matche v3.1's fulde vision:**
1. **Explosion Predictor** (regelbaseret mønstergenkendelse) — "det der gør Reveal til en platform, ikke bare et spil"
2. **Lifelines UI** — strategisk, begrænset ressource der tvinger fokus
3. **KPI-rapport til pilotbrugere** — v3.1's go/no-go kriterium kræver dette
4. **Dedikerede rumtyper** (Fase 2) — Estimation/Scope/Breakdown/Retro Room
5. **Truth Serum Screen** — simpel at bygge, høj v3.1 prioritet

**Primær blindspot:** Reveal mangler stadig det feedback loop-præsentation der er v3.1's kerneargument: "Teams bliver bedre over tid, og de kan se det." Dataindsaming er på plads — men rapporten der viser "din estimation accuracy er steget 15% de seneste 6 sprints" eksisterer ikke. **Det er det næste naturlige trin.**

**Status samlet:** ~65% af v3.1's fulde vision implementeret. MVP-fasen er overstået — vi er midt i Fase 2.
