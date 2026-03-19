# Approval Flow v1 (Game Advisory -> PM Controlled Write-back)

Purpose:
- Operationalize holdesnor v3.1: PM source-of-truth, game advisory only.

## Roles
- PM Lead: final approver for write-back
- PM Delegate: optional approver within configured thresholds
- Engineering: executes approved technical changes
- Governance/Security: audits and monitors policy compliance

## State machine
1) `recommended`
- Trigger: `game.writeback.recommended`
- Action: create approval request

2) `pending_approval`
- Request visible with context (impact, reason codes, related events)

3) `approved` OR `rejected`
- PM decision required, including rationale

4) `applied` (approved path only)
- Controlled write-back performed by PM-authorized pathway

5) `audited`
- Audit record completed and immutable

## Mandatory checks before apply
- Request references valid `requestId` and `correlationId`
- Request not expired
- Approver has permission by governance matrix
- Proposed change still relevant (not stale/conflicting)
- Audit log write succeeds

## SLA (initial)
- Standard approvals: <= 1 business day
- Critical-path approvals: <= 4 hours

## Deny conditions
- Missing reason codes
- High-risk score without mitigation
- Scope conflict with active sprint commitments
- Potential PM/Game divergence or policy violation

## Audit fields (minimum)
- `requestId`, `projectId`, `targetEntity`
- `recommendedBy` (source), `approvedBy/rejectedBy`
- `decisionReason`, `decisionAt`
- `appliedAt` (if approved), `policyVersion`

## Governance matrix (summary)
- Game engine: can emit recommendation only
- PM Lead: can approve/reject and trigger controlled apply
- PM Delegate: optional limited approvals
- Backend service: applies only approved changes
- QA/Security: read all logs, cannot mutate approval decisions

## Failure handling
- If apply fails: mark `apply_failed`, retain full audit context, auto-notify PM owner.
- If stale request detected: auto-reject with reason `stale_context`.
