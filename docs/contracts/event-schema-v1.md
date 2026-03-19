# Event Schema v1 (Draft)

Purpose:
- Define canonical PM->Game and system governance events for Reveal v3.1.
- Enforce PM as source-of-truth and advisory-only game behavior.

## Core principles
- Every event has a stable `eventId` and `correlationId`.
- Event payload includes `source` (`pm`, `game`, `system`, `user`).
- Game-origin events can recommend actions but cannot mutate PM state directly.
- Contract versioning via `schemaVersion`.

## Envelope (required)
```json
{
  "eventId": "uuid",
  "eventType": "task.updated",
  "schemaVersion": "v1",
  "occurredAt": "2026-03-19T10:00:00Z",
  "source": "pm",
  "actorId": "user_123",
  "actorRole": "pm_lead",
  "projectId": "proj_abc",
  "entityId": "task_456",
  "correlationId": "corr_789",
  "idempotencyKey": "task_456:status:done:2026-03-19T10:00:00Z",
  "payload": {}
}
```

## Event types (v1 minimum)
PM lifecycle events:
- `task.created`
- `task.updated`
- `task.completed`
- `task.blocked`
- `risk.opened`
- `risk.closed`
- `deadline.missed`

Advisory/game events:
- `game.signal.generated` (XP/HP/pressure updates)
- `game.writeback.recommended` (requires PM approval)

Governance/approval events:
- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `writeback.applied`
- `writeback.denied`

Audit/security events:
- `policy.violation.detected`
- `anti_gaming.flagged`
- `risk.score.calculated`

## Payload minima by category
1) `task.*`
- `status`, `priority`, `riskLevel`, `assignee`, `deadline`, `estimatePoints`, `blocked`

2) `game.writeback.recommended`
- `proposalType`, `targetEntity`, `proposedChange`, `reasonCodes[]`, `impactEstimate`

3) `approval.*`
- `requestId`, `decision`, `decisionBy`, `decisionReason`, `decisionAt`

4) `risk.score.calculated`
- `score`, `severityBand`, `reasonCodes[]`, `inputFactors[]`

## Validation rules
- Reject events missing envelope required fields.
- Enforce unique `idempotencyKey` within replay window.
- Reject any direct PM mutation where source=`game` unless linked to approved request.

## Open items for Sprint 1
- Replay window duration.
- Correlation strategy for batch operations.
- Final JSON Schema encoding and codegen path.
