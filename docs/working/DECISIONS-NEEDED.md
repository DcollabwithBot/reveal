# Reveal v3.1 — Decisions Needed Before Sprint 1

Owner for confirmations: Danny (PM authority)
Deadline: Before Sprint 1 kickoff

1) Approval authority model
- Confirm who can approve game->PM write-back recommendations:
  - Option A: PM Lead only
  - Option B: PM Lead + Delegate (with thresholds)
- Needed to finalize approval workflow and governance enforcement.

2) Risk scoring policy baseline
- Confirm initial severity bands + action thresholds (e.g., warn/review/block).
- Needed to avoid ad-hoc risk behavior during Sprint 2 build.

3) Anti-gaming enforcement posture
- Confirm consequence policy for detected gaming patterns:
  - soft flag only / temporary penalty / hard block + mandatory review
- Needed for deterministic rule implementation.

4) Audit retention & sensitivity
- Confirm retention period and audit visibility by role.
- Needed to lock audit trail storage and access controls.

5) Success metric targets (v1)
- Confirm target ranges for first release:
  - approval latency
  - audit completeness
  - false-positive rate (anti-gaming)
  - PM/Game divergence incidents
- Needed for Sprint 3 readiness gate.

6) Scope freeze for Sprint 0–1
- Confirm that no broad UX/refactor work starts before P0 governance+contract gates pass.
- Needed to prevent technical debt and contract drift.

7) Default operating mode (now) — LOCKED (2026-03-19)
- Decision: Default is **Standalone mode (Reveal-only)** until first connector shadow-sync passes.
- Rationale: avoid premature coupling and integration debt before external systems are stable.

8) First integration pilot target — LOCKED (2026-03-19)
- Decision: First connector pilot is **Jira** in **read-only shadow sync**.
- Rationale: lowest rollout risk and clear mapping validation path.

9) Field ownership baseline for shared fields — LOCKED (2026-03-19)
- Decision baseline in connected mode:
  - External system owner (default): `status`, `priority`, `assignee`, `dueDate`, `labels`
  - Reveal owner: game signals, XP, achievements, advisory recommendations
- Conflict handling: no silent overwrite; mark `needs_review` when policy mismatch is detected.

10) Dual-mode release gate policy — LOCKED (2026-03-19)
- Decision: Connected-mode write-back is blocked until **INT-G1/INT-G2/INT-G3 = PASS**.
- Enforcement: write-back path remains hard-disabled before gates pass.
