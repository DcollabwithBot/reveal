# Anti-Gaming Rules v1

Purpose:
- Protect metric integrity while preserving healthy team behavior.

Principles:
- Deterministic first (no black-box penalties in v1)
- Explainable outcomes (reason codes required)
- Human override with accountability

## Detection rules (v1 baseline)
1) Rapid status churn
- Pattern: repeated status flips on same task within short window
- Action: flag `status_churn`

2) XP farming via micro-task fragmentation
- Pattern: unusual spike in low-effort task creation/completion
- Action: flag `micro_task_farming`

3) Deadline gaming
- Pattern: repeated deadline shifts near due date without scope reason
- Action: flag `deadline_slip_pattern`

4) Blocker misuse
- Pattern: blocker opened/closed repeatedly without dependency change
- Action: flag `blocker_toggle`

5) Approval bypass attempt
- Pattern: mutation attempt from game source without approval token
- Action: hard block + `approval_bypass_attempt`

## Consequence model (proposed)
- Severity Low: warning + PM review queue
- Severity Medium: temporary scoring dampener + mandatory rationale
- Severity High: write-back block + governance review

## False-positive handling
- PM can mark `resolved_false_positive` with reason.
- All overrides require actor, timestamp, and rationale.

## Required evidence for each flag
- `ruleId`
- `entityId`
- `triggerEvents[]`
- `detectedAt`
- `severity`
- `reasonCodes[]`

## Guardrail
- Anti-gaming system cannot auto-edit PM core fields.
- It can only produce flags/recommendations for PM-controlled decisions.

## Open calibration items
- Thresholds per team size
- Cooldown windows
- Severity mapping for repeated offenses
