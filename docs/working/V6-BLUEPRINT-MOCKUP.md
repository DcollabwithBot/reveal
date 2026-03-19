# Reveal V6 Blueprint (Mockup-Only)

Formål: Definere en **holistisk, professionel PM-oplevelse** hvor gamification er en integreret motivations- og prioriteringsmekanik — ikke et separat produkt.

Status: Design blueprint + klikbar mockup. Ingen production-implementering.

---

## 1) End-to-end user journey

### Stage 1 — Portfolio (multi-project PM view)
1. PM lander i Portfolio overview.
2. Ser alle aktive projekter med health, sprint confidence, risiko og delivery pressure.
3. Filtrerer (team, status, risk, date) og vælger et projekt.
4. Enter project workspace med bevaret kontekst (selected project + sprint).

### Stage 2 — Project Workspace (context + planning)
1. PM skifter mellem tabs: Overview, Backlog, Sprint Board, Timeline, People, Reports.
2. Overview bruges til hurtig status og alignment.
3. Backlog bruges til prioritering + sprint commitment.
4. Sprint Board bruges til execution og blocker management.

### Stage 3 — Sprint Execution (operational flow)
1. Team arbejder i board.
2. PM åbner task detail drawer for beslutninger (assignee, deadline, estimate, labels, blocked reason).
3. Blockers registreres med SLA/owner.
4. WIP, burndown og throughput monitoreres.

### Stage 4 — Gamified Progress (integreret lag)
1. PM toggler gamification overlay ved behov.
2. Overlay viser XP progression, achievement signaler og delivery pressure (boss pressure) i enterprise tone.
3. Indsigter bruges til at påvirke adfærd (focus, flow, blocker response) uden at overdøve PM-kernen.

### Stage 5 — Sprint Close
1. PM går til Sprint Close/Reports.
2. Ser sprint outcome: committed vs done, carry-over, quality, blocker MTTR, team momentum.
3. Logger retro actions + lukker sprint.
4. Næste sprint seedes med læring + progression continuity.

---

## 2) IA map + route map

## IA map (information architecture)
- App Shell
  - Portfolio
    - Multi-project grid
    - Global filters
    - Health/risk summaries
  - Project Workspace
    - Overview
    - Backlog
    - Sprint Board
    - Timeline
    - People
    - Reports
  - Sprint Execution (focused board mode)
    - Kanban lanes
    - Blocker lane/state
    - Task Detail Drawer
  - Sprint Close
    - Outcome summary
    - Retro actions
    - Next sprint recommendations
  - Cross-cutting layers
    - Gamification Overlay (XP, progression, pressure)
    - Notifications (achievements, risk alerts)

## Route map
- `/mockups/index.html#portfolio`
- `/mockups/index.html#workspace` (default tab: Overview)
- `/mockups/index.html#workspace&tab=backlog`
- `/mockups/index.html#workspace&tab=board`
- `/mockups/index.html#workspace&tab=timeline`
- `/mockups/index.html#workspace&tab=people`
- `/mockups/index.html#workspace&tab=reports`
- `/mockups/index.html#execution`
- `/mockups/index.html#close`
- Overlay state: `?overlay=on` (UI toggle in mockup)

Note: Mockup-routes er hash-baserede for enkel klik-navigation.

---

## 3) Unified task data model (PM + gamification i samme objekt)

## Core identity
- `id` (string)
- `projectId` (string)
- `sprintId` (string|null)
- `epicId` (string|null)
- `title` (string)
- `description` (string)

## Ownership & planning
- `assigneeId` (string|null)
- `reporterId` (string)
- `team` (string)
- `priority` (enum: Critical|High|Medium|Low)
- `status` (enum: Backlog|Ready|InProgress|Review|Done|Blocked)
- `estimatePoints` (number)
- `remainingPoints` (number)
- `deadline` (date|null)
- `startDate` (date|null)

## Flow & risk
- `blocked` (boolean)
- `blockedReason` (string|null)
- `blockedSince` (datetime|null)
- `blockerOwnerId` (string|null)
- `riskLevel` (enum: Low|Medium|High)
- `dependencies` (array<taskId>)
- `slaHours` (number|null)

## Classification
- `labels` (array<string>)
- `component` (string)
- `type` (enum: Feature|Bug|TechDebt|Ops|Research)
- `customerImpact` (enum: None|Internal|External)

## Execution telemetry
- `createdAt` (datetime)
- `updatedAt` (datetime)
- `cycleTimeHours` (number|null)
- `leadTimeHours` (number|null)
- `prs` (array<string>)
- `acceptanceCriteria` (array<string>)

## Gamification fields (same data model)
- `xpValue` (number)
- `xpAwarded` (number)
- `achievementTags` (array<string>)
- `streakContribution` (boolean)
- `pressureContribution` (number)  
  (bruges til delivery pressure meter; positiv værdi øger pressure)
- `difficultyTier` (enum: S|A|B|C)

Princip: PM-felter er primære; game-felter er afledte og bruges til feedback/motivation.

---

## 4) PM oversight + gamification coexistence model

## Designprincipper
1. **One UI, one workflow**: Samme board/backlog/workspace for alle roller.
2. **Gamification er et signal-lag**: ikke separate skærme, ingen tvungen game-loop.
3. **Professional-first hierarchy**: deadlines, blockers, risiko og delivery metrics vises før XP.
4. **Opt-in emphasis**: overlay kan toggles on/off uden at bryde PM-funktioner.
5. **Behavior shaping, not distraction**: achievements/XP bruges til at fremhæve gode leverance-mønstre.

## Practical coexistence examples
- Task card viser points + lille XP-chip (sekundær).
- Blocked tasks viser først blocker/SLA, derefter pressure effect.
- Reports viser sprint KPIs med en lille “momentum/progression” sektion.
- Delivery Pressure (“boss pressure”) vises som enterprise meter i topbar/overlay.

---

## 5) Screen-by-screen specs + interaction notes

## S1 — Portfolio Overview
Formål: Multi-project styring for PM/lead.

### Key blocks
- Portfolio KPI strip (active projects, at-risk count, avg confidence, blocked total)
- Project card grid med status, progress, owner, next milestone, pressure state
- Quick filters (team, risk, phase)

### Interactions
- Click project card → åbner Workspace (Overview tab)
- Filter chips opdaterer grid live
- “Open sprint board” shortcut fra card

---

## S2 — Project Workspace (tabs)
Formål: Central cockpit for ét projekt.

### Tabs
- Overview: health, sprint summary, risks
- Backlog: sortable table + planning panel
- Sprint Board: lanes + WIP + blocked view
- Timeline: milestones/dependencies
- People: team load, ownership
- Reports: quality, throughput, forecast

### Interactions
- Tab switch bevarer projektkontekst
- Primary actions: Create task, Plan sprint, Export report
- Topbar viser current sprint + pressure state

---

## S3 — Sprint Execution (focused mode)
Formål: Hurtig operativ styring under sprint.

### Key blocks
- Board lanes (Backlog/In Progress/Review/Done)
- Blocker watchlist
- Throughput/burndown mini widgets

### Interactions
- Click task → åbner Task Detail Drawer
- Keyboard quick filter + assignee filter
- Drag/drop (mocked visual only i denne version)

---

## S4 — Task Detail Drawer / Modal
Formål: Beslutningspunkt for task management.

### Required fields
- Assignee
- Due date (deadline)
- Estimate (points/hours)
- Status
- Priority
- Labels
- Blocked (toggle)
- Blocked reason (conditional)
- Dependencies
- XP preview (secondary)

### Interactions
- Save changes (mock state)
- Mark blocked/unblocked
- Open linked task

---

## S5 — Gamification Overlay (subtle enterprise)
Formål: Synliggøre momentum uden “game UI noise”.

### Key blocks
- Team XP progression bar
- Current level/title (delivery maturity framing)
- Active achievements (operational badges)
- Boss pressure meter (delivery pressure)

### Interactions
- Toggle overlay globalt
- Overlay følger aktiv screen (non-modal side panel)
- “Why pressure changed” tooltip/data point

---

## S6 — Sprint Close
Formål: Lukke sprint med læring + accountability.

### Key blocks
- Committed vs done
- Carry-over and root causes
- Quality + defect trend
- Team momentum snapshot
- Retro action list

### Interactions
- Confirm Sprint Close
- Generate summary/export
- Seed next sprint recommendations

---

## 6) Mockup scope boundaries
- Mockup-only (HTML/CSS/JS prototype).
- Ingen ændringer i production `src/` eller `server/`.
- Data er syntetisk/demo.

## 7) Open decisions for sign-off
1. Skal overlay default være ON eller OFF pr. rolle?
2. Hvilke achievement-typer er acceptable i enterprise-kontekst (max 3–5)?
3. Skal pressure score være team-level kun, eller også per project/squad?
4. Hvilken vægt skal XP have ift. klassiske sprint metrics i Reports?
5. Skal Sprint Close have mandatory retro action owner + due date?

---

## 8) Default exemplar template (canonical)

Fra nu af er **KOMBIT – Nyt WiFi (WiFi 7)** den primære/reference template for Reveal V6 mockup-arbejde.

Placering:
- `projects/reveal/templates/KOMBIT-WIFI7-TEMPLATE.md`
- `projects/reveal/templates/kombit-wifi7-template.project.json`
- `projects/reveal/templates/kombit-wifi7-template.backlog.json`

Formål:
- Give et realistisk enterprise PM-scenario (infrastruktur + risiko + phased rollout)
- Demonstrere hvordan PM-felter og gamification-felter sameksisterer i én datamodel
- Understøtte seed/import af demo-data i kommende implementation fase

Anvendelse i mockup/design reviews:
- Brug template-terminologi (Discovery, RF Design, Pilot, Rollout, Handover)
- Brug risk register + acceptance criteria som review-ramme
- Brug boss pressure + XP/achievements som standard gamification-eksempel i enterprise tone
