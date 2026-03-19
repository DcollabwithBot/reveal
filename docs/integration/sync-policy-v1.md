# Reveal Sync Policy v1

Status: Draft v1  
Scope: Rules for connected mode sync behavior.

## 1) Sync model
Hybrid ingestion + dispatch:
- Webhooks first where available (near-real-time updates).
- Polling fallback for missed events, unsupported webhook endpoints, and reconciliation.
- Periodic reconciliation job compares checkpoints/cursors with canonical state.

## 2) Direction rules
- Inbound (external -> Reveal): accepted through adapter -> mapping -> policy checks -> canonical update/event.
- Outbound (Reveal -> external): only for fields allowed by ownership matrix and mode flags.
- Governance fields are never externally authoritative.

## 3) Field ownership policy
Each mapped field has one owner mode:
- `reveal_authoritative`
- `external_authoritative`
- `shared_with_precedence` (explicit tie-break rule required)

No ownership = no sync for that field.

## 4) Conflict resolution rules (v1)
Order of precedence:
1. Governance lock (if record pending approval/locked, block external overwrite).
2. Field ownership rule.
3. If shared: latest change wins only within configurable drift window.
4. Outside drift window: route to manual review queue.

Manual review output must be auditable (who resolved, why, chosen value).

## 5) Idempotency + dedupe
- Every inbound/outbound sync action must carry idempotency key:
  - `connector + externalEventId` when available
  - fallback hash: `connector + externalId + changedAt + changedFieldsHash`
- Sync ledger stores processed keys with TTL/retention.
- Duplicate keys are ACKed with no re-apply.

## 6) Retry policy
- Retry for transient failures (network, 429, 5xx).
- Exponential backoff with jitter.
- Max attempts configurable per connector (default: 5).
- Respect `Retry-After` headers when provided.

## 7) Dead-letter policy
Route event/message to dead-letter queue when:
- Mapping fails (unknown required field/invalid transform)
- Permanent auth/permission error
- Max retries exceeded
- Policy violation unresolved automatically

Dead-letter entry must include payload snapshot, error class, connector, attempt count, next action owner.

## 8) Observability and audit
Track minimum metrics:
- sync success rate
- median/95p sync latency
- conflict rate
- dead-letter rate
- replay/duplicate count

Audit fields on each applied sync:
- source system
- external record ID
- idempotency key
- actor (`system`)
- timestamp
- changed fields

## 9) Safe rollout controls
- Connector-level feature flags (ingest/writeback/reconcile independent).
- Per-project scope flags.
- Kill switch per connector.
- Start read-only, then narrow write-back allowlist.

## 10) v1 defaults
- Connected mode OFF by default.
- Read-only shadow sync required before write-back.
- Manual review required for shared-field conflicts in initial rollout.