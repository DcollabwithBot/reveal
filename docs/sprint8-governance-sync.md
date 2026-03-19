# Sprint 8 — Governance + Sync runtime wiring

## Included
- PM mutation guard wiring in project/sprint/item mutation endpoints.
- `approval_requests` persistence with API lifecycle endpoints:
  - `POST /api/approval-requests`
  - `POST /api/approval-requests/:id/approve`
  - `POST /api/approval-requests/:id/reject`
  - `POST /api/approval-requests/:id/apply`
  - `GET /api/approval-requests`
- Persistent idempotency/event ledger via `event_ledger`.
- Immutable-ish audit trail via append-only `audit_log`.
- Sync health endpoint: `GET /api/sync/health`.

## Migration
Apply:
- `supabase/migrations/sprint8_governance_sync.sql`

## Notes
- Game-origin writes to PM endpoints are blocked unless an approved request is provided.
- Approval apply endpoint now enforces target-specific patch normalization/validation for supported target types (project/sprint/item/session_item), including allowed status/priority values and progress↔item_state derivation.
- Event idempotency is enforced by unique keys in `event_ledger`.
