# Reveal V5 Mockups (Design Validation)

Formål: Validere UI-retning for et professionelt, dark SaaS work-area med Reveal-identitet (gamification i subtil enterprise-stil) **før** implementering i app-koden.

---

## 1) Scrum Dashboard (KPI + Charts + Sprint Health)

### Layout (wireframe)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Topbar: Project ▸ Sprint 24 | Date range | Team filter | Search | Avatar  │
├─────────────────────────────────────────────────────────────────────────────┤
│ KPI Cards: [Velocity] [Burndown Delta] [Cycle Time] [Blocked Issues]      │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Burndown Chart               │ Sprint Health Panel                         │
│ (ideal vs actual lines)      │ - Scope change %                            │
│                              │ - Risks (3)                                 │
│                              │ - Team load heat                            │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Throughput by day            │ Blocker Feed                                 │
│ (stacked bars)               │ - Card links                                 │
│                              │ - SLA timers                                 │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Components
- Sticky topbar (project/sprint context + quick filters)
- 4 KPI cards with delta indicators
- Burndown line chart (ideal vs actual)
- Throughput chart (completed vs added)
- Sprint health side panel (risk + workload)
- Blocker feed with severity tags and owners

### Key interactions
- Filter by sprint, squad, assignee, and tag
- Hover KPI for trend tooltip (last 4 sprints)
- Click chart point → drill down to issue list
- “Focus mode” for one chart in full width
- Health panel alerts sorted by urgency

### Gamification overlay (subtle)
- XP ribbon in topbar: “+120 XP this sprint” (small badge)
- Achievement chips under KPI: “No carry-over 3 sprints”
- Boss State meter in health panel (Green/Amber/Red) replacing loud game art
- Weekly streak icon near velocity (minimal line icon)

---

## 2) Sprint Kanban Board (columns/cards/filters)

### Layout (wireframe)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Toolbar: Sprint 24 | Filters | WIP toggle | Swimlane: Assignee/Epic | +   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Backlog (12)   │ In Progress (6) │ Review (4)       │ Done (18)          │
│ ┌────────────┐ │ ┌────────────┐  │ ┌────────────┐   │ ┌────────────┐     │
│ │ Card A     │ │ │ Card D     │  │ │ Card G     │   │ │ Card J     │     │
│ │ points,tag │ │ │ avatar,SLA │  │ │ PR status  │   │ │ deployed ✅ │     │
│ └────────────┘ │ └────────────┘  │ └────────────┘   │ └────────────┘     │
│ ...             ...               ...                ...                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components
- Board toolbar (saved views + filters + quick add)
- Configurable columns with WIP limits
- Rich story cards (priority, points, owner, blockers)
- Swimlanes by assignee/epic
- Right drawer for card details + activity

### Key interactions
- Drag & drop cards across columns
- Inline edit: points, labels, due date
- Multi-select and bulk move/tag
- Toggle blocked-only view
- Keyboard shortcuts (e.g., `F` filter, `N` new card)

### Gamification overlay (subtle)
- Card XP value (small token, not dominant)
- “Combo” micro-animation only when finishing >1 card in short window
- Achievement toast: “Zero-blocker lane for 2 days”
- Boss pressure indicator in column headers when WIP breaches limit

---

## 3) Backlog Table + Planning Panel

### Layout (wireframe)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: Product Backlog | Search | Saved Filter | Import | Plan Sprint ▶  │
├──────────────────────────────────────────────┬──────────────────────────────┤
│ Backlog Table                                │ Planning Side Panel          │
│ [ ] Story | Priority | Effort | Value | Risk │ Sprint Capacity              │
│ [ ] API retry logic | High | 5 | 8 | Low     │ - Team days                  │
│ [ ] OAuth error states | High | 3 | 9 | Med  │ - Committed points           │
│ [ ] Audit trail export | Med | 8 | 6 | Med   │                              │
│ ...                                          │ What-if slider               │
│                                              │ Candidate stories (drag in)  │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

### Components
- Backlog data table with sticky header
- Column sort + multi-filter + saved views
- Bulk action bar (prioritize, assign, split)
- Planning side panel (capacity, commit, confidence)
- What-if estimator (scope vs confidence)

### Key interactions
- Drag rows into planning panel candidate list
- Score sorting by Value/Effort ratio
- Split story modal with child links
- Estimate override with reason audit note
- Export selected items to sprint draft

### Gamification overlay (subtle)
- XP recommendation: “High value + low effort = bonus XP path”
- Achievement card for planning quality: “>85% estimate accuracy streak”
- Boss state forecast: risk indicator if planned scope exceeds safe threshold
- Team mastery levels shown as tiny tags by skill domain

---

## 4) Project Overview + Gamification Layer

### Layout (wireframe)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Hero: Reveal V5 | Health Score 82 | Release target | Team avatars │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Milestone Timeline            │ Progress Rings                              │
│ M1 ████░  M2 ██░░  M3 ░░░░    │ Scope 68% | Quality 74% | Delivery 61%     │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Dependency / Risk Matrix      │ Gamification Layer                          │
│ Teams, blockers, deadlines    │ XP ladder, achievements, boss phase        │
├───────────────────────────────┴─────────────────────────────────────────────┤
│ Recent Wins / Incidents feed                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components
- Hero strip with project metadata and confidence score
- Milestone timeline with phase gates
- Multi-metric progress rings
- Dependency/risk matrix
- Gamification panel (XP ladder + achievements + boss phase)
- Activity feed (wins/incidents)

### Key interactions
- Click milestone → open related epic list
- Adjust target date → instant confidence recalculation
- Risk matrix cell click → mitigation checklist
- Toggle “Exec summary” vs “Team detail” view
- Share snapshot link (read-only)

### Gamification overlay (subtle)
- XP ladder mapped to delivery maturity (not fantasy UI)
- Achievements framed as operational excellence badges
- Boss phase renamed as “Delivery Pressure State” with calm visual meter
- Victory moments logged in feed (“Sprint goal hit on-time”)

---

## Shared UI Direction (All 4 screens)
- Dark SaaS canvas, neutral contrast, saturated accents only for signals
- Cards with soft borders, low blur shadows, consistent 8px spacing scale
- Typography: modern sans with strong hierarchy, minimal decorative elements
- Motion: short and purposeful (150–220ms)
- Accessibility: color + icon redundancy for all states

## Assumptions
- Single workspace shell with top nav + tabs between modules
- Mock data representative of mid-size software team (6–10 members)
- Gamification must motivate without feeling like consumer-game UI
- No backend integration at this stage (design validation only)
