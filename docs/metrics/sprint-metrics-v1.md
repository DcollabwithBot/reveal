# Sprint Metrics v1

Purpose:
- Define minimal metric set to track delivery quality, governance adherence, and data integrity in v3.1.

## North-star outcomes
- Reliable PM/Game alignment without unauthorized mutation
- Faster, auditable decisions
- Reduced debt from contract/governance drift

## Core metrics (v1)
1) Event coverage ratio
- Definition: % of critical workflows emitting required events
- Target: >= 95% by Sprint 3

2) Approval latency
- Definition: median time from `approval.requested` to decision
- Target: <= 1 business day (standard), <= 4h (critical)

3) Write-back compliance
- Definition: % write-backs with approved request and valid audit chain
- Target: 100%

4) Audit completeness
- Definition: % approval/write-back records with all mandatory fields
- Target: 100%

5) PM/Game divergence incidents
- Definition: count of state mismatches per sprint
- Target: 0 critical, downward trend total

6) Anti-gaming false-positive rate
- Definition: % flags overturned as false positive
- Target: < 10% after calibration period

7) Risk score explainability coverage
- Definition: % risk scores with reason codes
- Target: 100%

## Reporting cadence
- Sprint review: full metric pack
- Mid-sprint: quick health pulse (latency, divergence, policy violations)

## Data sources
- Event stream (contract v1)
- Approval workflow logs
- Audit trail store
- Risk scoring outputs

## Metric governance
- PM owns target acceptance.
- Data/Analytics owns definitions and instrumentation.
- QA/Security validates integrity for compliance metrics.

## Exit criteria linkage
- Sprint 1 gate: write-back compliance + approval latency available
- Sprint 2 gate: anti-gaming and risk explainability metrics active
- Sprint 3 gate: full dashboard/reporting stable
