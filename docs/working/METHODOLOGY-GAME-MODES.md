# Methodology-Specific Game Modes — Reveal

> **Status:** Spec v1.0 — created 2026-03-21  
> **Implemented:** Flow Poker, Risk Poker, Assumption Slayer  
> **Planned:** All remaining modes below

---

## Overview

Reveal today covers Scrum/Agile estimation well (Planning Poker, Spec Wars, Perspective Poker, Bluff Poker, Nesting Scope, Speed Scope, Sprint Draft, Sprint Retro, Truth Serum). This document maps **all other project management methodologies** and the game modes that serve them.

---

## 1. Agile / Scrum (delvist dækket)

| Status | Mode | ID | Description |
|---|---|---|---|
| ✅ Implemented | Planning Poker | `planning_poker` | Classic Fibonacci estimation |
| ✅ Implemented | Sprint Draft | `sprint_draft` | Sprint planning gamified |
| ✅ Implemented | Sprint Retro | `retro` | Retrospective with boss battle |
| ✅ Implemented | Spec Wars | `spec_wars` | Acceptance criteria writing |
| ✅ Implemented | Perspective Poker | `perspective_poker` | Multi-angle estimation |
| ✅ Implemented | Bluff Poker | `bluff_poker` | One bluffer, team must detect |
| ✅ Implemented | Nesting Scope | `nesting_scope` | Matryoshka scope decomposition |
| ✅ Implemented | Speed Scope | `speed_scope` | 10s gut-feel estimates |
| ✅ Implemented | Truth Serum | `truth_serum` | Anonymous honest feedback |
| 📋 Planned | Refinement Roulette | `refinement_roulette` | Random backlog item, 5min grooming |
| 📋 Planned | Dependency Mapper | `dependency_mapper` | Visual dependency conflicts |

### Refinement Roulette — `refinement_roulette`
**Concept:** AI (or random selection) picks one item from the backlog. Team has exactly 5 minutes on the clock to groom it from scratch: clarify acceptance criteria, split if needed, assign rough estimate.

**Mechanics:**
- Game Master starts session with project backlog loaded
- Roulette wheel animation picks random ungroomed item
- 5-minute countdown begins (visual timer, buzzer at 0)
- Team submits: clarity score (1-5), estimate, and 1-line AC suggestion
- Reveal: mosaic of suggestions → GM picks canonical AC → item tagged `groomed`
- Achievement: **Roulette Groomer** (5 items groomed), **Speed Refiner** (groomed in <3 min)

**Write-back:** `acceptance_criteria`, `estimate`, `status = groomed` on session_items (PM approval required)

**Boss:** "The Ambiguous Item" — HP = 100, each groomed field reduces HP by 25

---

### Dependency Mapper — `dependency_mapper`
**Concept:** Each participant draws (selects) dependencies between items in a session. Reveal shows aggregate dependency graph with conflicts highlighted.

**Mechanics:**
- Items shown in grid (max 12 per session)
- Each participant draws arrows: "A blocks B"
- Timer: 4 minutes
- Reveal: consensus dependency graph + conflict detection (circular deps, explosion points)
- "Dependency Explosion" animation when circular dep found
- GM approves deps → linked on items

**Write-back:** New `item_dependencies` table, GM-approved links

**Boss:** "The Circular Dependency" — spawns when cycle detected

---

## 2. Kanban

| Status | Mode | ID | Description |
|---|---|---|---|
| ✅ **IMPLEMENTED** | Flow Poker | `flow_poker` | Cycle time estimation in days |
| 📋 Planned | WIP Limit Battle | `wip_limit_battle` | Reduce WIP without dropping items |

### Flow Poker — `flow_poker` ✅
**Concept:** Instead of story points, team estimates *cycle time* — how many days will this item spend in the system from start to done?

**Mechanics:**
- Cards: 1, 2, 3, 5, 8, 13, 21 (days)
- All participants estimate simultaneously
- Reveal: histogram of estimates + median + standard deviation
- "Flow Health Score": low spread = good flow understanding, high spread = uncertainty
- Threshold alert: items with median > 5 days flagged as "flow blockers"
- Write-back: `cycle_time_estimate` column on session_items

**Boss:** "The Flow Blocker" — spawns for items with median ≥ 8 days

**Achievements:**
- **Flow Master** — median estimates match actual cycle time within 1 day (3 times)
- **Pipeline Cleaner** — identified 5+ flow blockers in one session
- **Consensus Flow** — team achieves ≤1 day spread on all items

**Scene:** Kanban board aesthetic — dark blue/teal palette, lane arrows, smooth flow animations

---

### WIP Limit Battle — `wip_limit_battle`
**Concept:** Team has a WIP board with too many items in progress. Collective challenge: reduce WIP by X% by deciding together which items to park, without dropping critical work.

**Mechanics:**
- Show current WIP items (loaded from project)
- Team votes on each: "Keep active" / "Park" / "Block"  
- Consensus mechanic: item moves only when majority agrees
- Timer: 8 minutes
- Boss: "The Overload Monster" — HP = total WIP × 10, each parked item deals damage
- Win condition: WIP reduced by target % before timer runs out

**Write-back:** Status change on items (pending PM approval)

**Achievements:**
- **WIP Slayer** — reduce WIP by 50%+ in one battle
- **Flow Guardian** — 0 critical items accidentally parked
- **The Minimalist** — WIP ≤ 3 at end of session

---

## 3. SAFe / Large Scale Agile

| Status | Mode | ID | Description |
|---|---|---|---|
| 📋 Planned | PI Planning Poker | `pi_planning_poker` | Feature-level estimation with capacity feasibility |
| 📋 Planned | Dependency Web | `dependency_web` | Cross-team dependency network |

### PI Planning Poker — `pi_planning_poker`
**Concept:** Like Planning Poker but for Program Increment items (features, not user stories). Adds a second dimension: feasibility vote per team based on capacity.

**Mechanics:**
- Round 1: estimate effort (T-shirt sizes: S/M/L/XL/XXL)
- Round 2: each team votes feasibility (✅ Yes / ⚠️ Risk / ❌ No) based on their capacity
- Reveal: effort consensus + feasibility heatmap by team
- "PI Risk Score": % of teams voting ❌ or ⚠️ on feature
- GM approves → features tagged with `pi_estimate` and `pi_risk`

**Write-back:** `pi_estimate`, `pi_risk_score` on items

**Achievements:**
- **PI Champion** — 100% feasibility consensus on 3 features
- **The Negotiator** — changed 2+ ❌ to ✅ after discussion
- **Capacity Guardian** — team never overcommitted across PI session

---

### Dependency Web — `dependency_web`
**Concept:** Cross-team PI dependencies mapped as a network. Reveal visualizes "dependency explosions" — features that block many others.

**Mechanics:**
- Each team maps their features and marks cross-team deps
- Aggregate network graph rendered after all submissions
- "Dependency Explosion" animation for features with 5+ deps
- Prioritization: most-depended features should be scheduled earliest
- Export: dependency risk report

**Write-back:** `dependency_web_entries` table

---

## 4. Shape Up (Basecamp)

| Status | Mode | ID | Description |
|---|---|---|---|
| 📋 Planned | Appetite Auction | `appetite_auction` | Teams bid appetites not estimates |
| 📋 Planned | Bet Table | `bet_table` | Team bets on cycle-realistic pitches |

### Appetite Auction — `appetite_auction`
**Concept:** In Shape Up, the question isn't "how long will this take?" but "how much time are we willing to spend?" Teams bid appetites: XS (1 week), S (2 weeks), M (4 weeks), L (6 weeks).

**Mechanics:**
- Pitches shown one at a time
- Team simultaneously selects appetite (XS/S/M/L)
- Reveal: appetite distribution + "team appetite" = mode
- Large spread = needs more discussion on scope constraints
- Write-back: `appetite` field on items

**Key difference from Planning Poker:** There's no "correct" answer — the appetite IS the constraint. Wide spread means the team disagrees on scope.

**Boss:** "The Scope Creep" — spawns when >60% vote L or XL. Team must collectively downscope.

**Achievements:**
- **Appetite Aligned** — consensus (all within 1 tier) on 5 pitches
- **Scope Constrainer** — successfully negotiated pitch from L to S
- **The Appetizer** — completed full cycle of 6-week pitches

---

### Bet Table — `bet_table`
**Concept:** PM presents 5-8 pitches for the next cycle. Team bets on which ones are actually deliverable within the appetite stated.

**Mechanics:**
- 5-8 pitches shown with proposed appetite
- Each participant has 3 bet tokens to place on pitches they believe are realistic
- Reveal: bet distribution → pitches with <50% team confidence flagged as "risky bets"
- PM makes final selection informed by team confidence
- Optional: "contra-bet" — bet this pitch will fail despite PM selection

**Write-back:** `bet_confidence_score` on items / session

---

## 5. OKR-Driven

| Status | Mode | ID | Description |
|---|---|---|---|
| 📋 Planned | Key Result Poker | `kr_poker` | Confidence % on hitting a KR |
| 📋 Planned | Stretch vs. Committed | `stretch_vs_committed` | Sort KRs into two buckets |

### Key Result Poker — `kr_poker`
**Concept:** For each Key Result, team estimates probability of achieving it (0-100%). Consensus = team's "confidence score" for that KR.

**Mechanics:**
- Card deck: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%
- Team votes simultaneously on each KR
- Reveal: distribution + median confidence
- Alert: KRs with median <40% = "at risk", median >90% = "set too low" (stretch challenge!)
- Calibration advice: Google's OKR framework suggests 70% as healthy confidence

**Write-back:** `confidence_score` on OKR items

**Achievements:**
- **Reality Checker** — flagged 3 over-confident KRs (>90%)
- **OKR Optimist** — team confidence improved after discussion
- **The Calibrator** — personal estimates within 10% of consensus across session

---

### Stretch vs. Committed — `stretch_vs_committed`
**Concept:** Team collectively sorts KRs into "committed" (will definitely happen) vs. "stretch" (aspirational). Reveals expectation misalignment.

**Mechanics:**
- KRs shown one at a time
- Vote: COMMITTED 🔒 or STRETCH 🚀
- Reveal: consensus bucket + dissenting votes highlighted
- "Commitment Grid" at end: 2×2 matrix showing all KRs classified
- Discussion trigger: KRs where team is split 50/50

**Write-back:** `kr_type: committed | stretch` on items

---

## 6. Waterfall / PRINCE2

| Status | Mode | ID | Description |
|---|---|---|---|
| 📋 Planned | Phase Gate Poker | `phase_gate_poker` | Risk rating for phase transition |
| 📋 Planned | Milestone Confidence | `milestone_confidence` | % chance of hitting milestone date |

### Phase Gate Poker — `phase_gate_poker`
**Concept:** At phase gate reviews, team estimates risk of proceeding to next phase on a 1-5 scale. Aggregate = go/no-go signal.

**Mechanics:**
- Risk dimensions shown: technical, resource, schedule, scope, stakeholder
- Each dimension rated 1 (🟢 green/low risk) to 5 (🔴 red/high risk)
- Reveal: risk radar chart per dimension + overall risk score
- Go/No-Go decision: overall <2.5 = ✅ Go, 2.5-3.5 = ⚠️ Conditional, >3.5 = ❌ No-Go
- GM documents decision with rationale

**Write-back:** `phase_gate_risk_score`, `phase_gate_decision` on session

**Achievements:**
- **Gate Keeper** — accurately predicted 3 risky gates
- **Risk Spotter** — flagged dimension nobody else rated high
- **The Gatemaster** — ran 10 phase gate sessions

---

### Milestone Confidence — `milestone_confidence`
**Concept:** Team estimates probability (%) that a specific milestone will be hit on its planned date.

**Mechanics:**
- Milestone shown with current date, planned date, key risks
- Team votes: 0-10-20-...-100% confidence
- Reveal: distribution + median + "The Deadline" boss if median <50%
- Boss: "The Deadline" — HP = 100 - median confidence%. Appears as a calendar with a skull
- Historical: track milestone confidence over time → trend chart

**Write-back:** `milestone_confidence_score` on milestones

**Boss:** The Deadline (skull calendar, HP = 100 - confidence%)

**Achievements:**
- **The Prophet** — estimated within 10% of actual outcome (3 times)
- **Deadline Slayer** — boss defeated (milestone met despite <50% confidence)
- **Milestone Master** — completed 10 milestone confidence sessions

---

## 7. Generic (Methodology-Independent)

| Status | Mode | ID | Description |
|---|---|---|---|
| ✅ **IMPLEMENTED** | Risk Poker | `risk_poker` | Probability × impact risk matrix |
| ✅ **IMPLEMENTED** | Assumption Slayer | `assumption_slayer` | Anonymous assumption danger voting |

### Risk Poker — `risk_poker` ✅
**Concept:** Classic risk assessment gamified. Team estimates probability (1-5) AND impact (1-5) for each known risk. Consensus forms a risk matrix.

**Mechanics:**
- Two-card voting: probability (1-5) + impact (1-5) per risk item
- Reveal: 5×5 risk matrix with all risks plotted
- "Hot spots": upper-right quadrant (high prob + high impact) highlighted in red
- Priority order generated automatically
- GM approves → risks saved with scores

**Write-back:** New `risks` table: `risk_id`, `session_id`, `title`, `probability`, `impact`, `priority_rank`

**Boss:** "The Risk Hydra" — spawns for hot-spot risks. HP = probability × impact × 4

**Achievements:**
- **Risk Realist** — identified top-3 risks that team overlooked
- **The Risk Manager** — completed 5 risk poker sessions
- **Hot Spotter** — correctly predicted 3 risks that materialized

**Scene:** Dark red/crimson palette, matrix grid aesthetic, risk radar background

---

### Assumption Slayer — `assumption_slayer` ✅
**Concept:** Everyone submits assumptions about the project/feature anonymously. Team votes on danger level (1-5). Reveal ranks from most to least dangerous. Slays false assumptions.

**Mechanics:**
- Phase 1 — Write (3 min timer): each participant writes 1-3 assumptions anonymously
- Phase 2 — Vote: all assumptions shown (anonymized), team rates danger 1-5
- Reveal: ranked list from most dangerous to least
- "The False Assumption" boss: HP = sum of top-3 danger scores × 5
- Each dangerous assumption "slain" = HP chunk removed
- GM can mark assumption as: "Valid concern" / "Already addressed" / "Unknown — investigate"

**Write-back:** Top-3 assumptions saved as project comments (PM approval)

**Boss:** "The False Assumption" — purple dragon with glasses, HP based on danger scores

**Achievements:**
- **Assumption Buster** — your assumption voted most dangerous (3 times)
- **The Skeptic** — rated 10+ assumptions as danger 4-5 across sessions
- **Slayer** — team slayed all top-3 assumptions in one session
- **Devil's Advocate** — unique assumption nobody else wrote (5 times)

**Scene:** Dark purple/crimson palette, dragon boss, assumption scrolls as pixel art items

---

## Implementation Priority Matrix

| Mode | Methodology Coverage | Team Size | Implementation Complexity | Priority |
|---|---|---|---|---|
| Flow Poker | Kanban (universal) | All | Medium | 🔴 HIGH |
| Risk Poker | All methodologies | All | Medium | 🔴 HIGH |
| Assumption Slayer | All methodologies | All | Medium-High | 🔴 HIGH |
| WIP Limit Battle | Kanban | 3-10 | High | 🟡 MEDIUM |
| Refinement Roulette | Scrum | 3-12 | Medium | 🟡 MEDIUM |
| Key Result Poker | OKR | 3-20 | Low | 🟡 MEDIUM |
| Appetite Auction | Shape Up | 2-8 | Medium | 🟡 MEDIUM |
| Phase Gate Poker | Waterfall/PRINCE2 | 5-20 | Medium | 🟡 MEDIUM |
| Milestone Confidence | Waterfall/OKR | 3-15 | Medium | 🟡 MEDIUM |
| PI Planning Poker | SAFe | 5-50 | High | 🟠 LOW |
| Dependency Mapper | Scrum/SAFe | 5-20 | Very High | 🟠 LOW |
| Dependency Web | SAFe | 10-50 | Very High | 🟠 LOW |
| Bet Table | Shape Up | 3-12 | High | 🟠 LOW |
| Stretch vs. Committed | OKR | 3-20 | Low | 🟠 LOW |

---

## DB Schema — New Modes

### Flow Poker
```sql
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS cycle_time_estimate INTEGER;

CREATE TABLE IF NOT EXISTS flow_poker_estimates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  days       INTEGER NOT NULL, -- 1,2,3,5,8,13,21
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, item_id, user_id)
);
```

### Risk Poker
```sql
CREATE TABLE IF NOT EXISTS risks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  probability    INTEGER, -- 1-5 consensus
  impact         INTEGER, -- 1-5 consensus
  priority_rank  INTEGER,
  status         TEXT NOT NULL DEFAULT 'open', -- open | mitigated | accepted | closed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_estimates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  risk_id     UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  probability INTEGER NOT NULL, -- 1-5
  impact      INTEGER NOT NULL, -- 1-5
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, risk_id, user_id)
);
```

### Assumption Slayer
```sql
CREATE TABLE IF NOT EXISTS assumptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text           TEXT NOT NULL,
  danger_score   NUMERIC(3,1), -- consensus 1-5
  gm_verdict     TEXT, -- valid | addressed | investigate
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assumption_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id UUID NOT NULL REFERENCES assumptions(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  danger        INTEGER NOT NULL, -- 1-5
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assumption_id, user_id)
);
```

---

## Routes

```
/sessions/:id/flow-poker        → FlowPokerScreen
/sessions/:id/risk-poker        → RiskPokerScreen
/sessions/:id/assumption-slayer → AssumptionSlayerScreen
```

---

*Last updated: 2026-03-21 by Reveal methodology-modes sprint*
