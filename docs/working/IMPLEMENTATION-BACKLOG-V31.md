# Reveal v3.1 — Implementation Backlog (Prioritized)

Legend:
- Priority: P0 (must before scale), P1 (should), P2 (nice/optimize)
- Estimate: S (≤1 day), M (1–3 days), L (3–5 days)
- Owner role: PM, Backend, Frontend, Data/Analytics, QA, Security/GRC

## P0 — Mandatory before broader build

1) Event contract v1 finalized
- Owner: PM + Backend
- Estimate: M
- Dependencies: Canonical template review, adversarial findings
- Notes: Versioned schema, required fields, idempotency/eventId policy

2) Event publisher/subscriber contract tests
- Owner: Backend + QA
- Estimate: M
- Dependencies: #1
- Notes: Include duplicate/replay negative cases

3) Approval workflow state machine
- Owner: Backend + PM
- Estimate: L
- Dependencies: #1
- Notes: advisory -> pending_approval -> approved/rejected -> applied

4) Governance matrix v1 (roles × actions)
- Owner: PM + Security/GRC
- Estimate: S
- Dependencies: #3
- Notes: Must explicitly enforce “no direct game write-back”

5) Write-back guardrail middleware/policy checks
- Owner: Backend
- Estimate: M
- Dependencies: #3, #4
- Notes: Hard block unauthorized mutations

6) Audit trail core model + immutable logging path
- Owner: Backend + Security/GRC
- Estimate: L
- Dependencies: #3
- Notes: capture actor, source, decision, reason, timestamp, correlationId

7) Anti-gaming ruleset v1 (detectors + consequence mapping)
- Owner: PM + Backend + QA
- Estimate: M
- Dependencies: #1
- Notes: initial deterministic rules only, no opaque heuristics

8) Risk scoring model v1 (spec + compute contract)
- Owner: PM + Data/Analytics + Backend
- Estimate: M
- Dependencies: #1, #7
- Notes: reason codes mandatory

9) Success metrics instrumentation plan
- Owner: Data/Analytics + PM
- Estimate: S
- Dependencies: #1
- Notes: event coverage, approval latency, audit completeness, quality signals

10) Blocking decisions confirmed (DECISIONS-NEEDED)
- Owner: Danny/PM
- Estimate: S
- Dependencies: none
- Notes: Must be closed before Sprint 1 commit

## P1 — Stabilization and scale-readiness

11) Governance matrix runtime enforcement tests
- Owner: QA + Security/GRC
- Estimate: M
- Dependencies: P0 #4, #5

12) Appeal/override flow for anti-gaming/risk outcomes
- Owner: PM + Backend
- Estimate: M
- Dependencies: P0 #7, #8, #6

13) Risk scoring calibration loop (threshold tuning)
- Owner: Data/Analytics + PM
- Estimate: M
- Dependencies: P0 #8, #9

14) Approval SLA monitoring + alerting
- Owner: Data/Analytics + Backend
- Estimate: M
- Dependencies: P0 #3, #9

15) Audit trail verification report template
- Owner: QA + Security/GRC
- Estimate: S
- Dependencies: P0 #6

16) PM/Game divergence detector (consistency checks)
- Owner: Backend + QA
- Estimate: M
- Dependencies: P0 #1, #6

## P2 — Optimization / UX refinement

17) Explainability UI for risk + anti-gaming reason codes
- Owner: Frontend + PM
- Estimate: M
- Dependencies: P0 #7, #8

18) Scenario simulator (preflight what-if for PM approval)
- Owner: Backend + Frontend
- Estimate: L
- Dependencies: P0 #3, #8

19) Metric dashboard polish (drill-downs, trends)
- Owner: Frontend + Data/Analytics
- Estimate: M
- Dependencies: P0 #9

20) Rule-pack version management tooling
- Owner: Backend + Security/GRC
- Estimate: M
- Dependencies: P0 #7, #6

## Integration track backlog (dual-mode)

### P0-INT — Must-have before connector rollout

21) Integration strategy v1 approved (dual-mode architecture) — LOCKED
- Owner: PM + Backend
- Estimate: S
- Dependencies: none
- Notes: Standalone-first + connected-ready design locked. Default mode = Standalone.

22) Canonical field mapping matrix v1 approved — LOCKED
- Owner: PM + Backend
- Estimate: S
- Dependencies: #21
- Notes: Includes ownership per field + connector placeholders. Shared work-fields default owner = external system in connected mode.

23) Sync policy v1 approved — LOCKED
- Owner: Backend + Security/GRC + PM
- Estimate: S
- Dependencies: #21, #22
- Notes: webhook/polling hybrid, conflict rules, idempotency, retry, dead-letter. Connected write-back remains blocked until INT-G1/2/3 PASS.

24) Standalone bootstrap checklist validated
- Owner: PM + QA
- Estimate: S
- Dependencies: #21
- Notes: Confirm all flows run without external dependencies.

25) Dual-mode gate tests/spec drafted
- Owner: QA + Backend
- Estimate: M
- Dependencies: #22, #23, #24
- Notes: INT-G1/INT-G2/INT-G3 pass criteria formalized.

### P1-INT — Pilot connector readiness

26) Connector adapter interface contract (tool-agnostic)
- Owner: Backend
- Estimate: M
- Dependencies: #22, #23
- Notes: read/write capability flags + error taxonomy.

27) Sync ledger schema + idempotency key policy
- Owner: Backend
- Estimate: M
- Dependencies: #23
- Notes: processed-key retention, replay behavior, correlation IDs.

28) Shadow-sync pilot plan (single connector)
- Owner: PM + Backend + QA
- Estimate: M
- Dependencies: #25, #26, #27
- Notes: start read-only for Jira (locked pilot target).

## Dependency chain (critical path)
- #1 Event contract -> #2 tests, #3 approval flow, #7 anti-gaming, #8 risk, #9 metrics
- #3 + #4 -> #5 write-back guardrails
- #3 -> #6 audit trail
- #6 + #7 + #8 -> #12 appeal/override
- #10 decisions confirmed gates Sprint 1 start
- #21 -> #22 -> #23 -> #25 -> #28 for integration pilot readiness
- #23 -> #27 for idempotent sync groundwork

## Practical sequencing for “start now”
- Day 1–2: #1, #4, #9, #10, #21
- Day 3–4: #2, #3, #22, #23
- Day 5: #5, #6 bootstrap, #24
- Week 2 start: #7, #8, #25
- Week 2 end: #26, #27, draft #28 (shadow pilot scope)
