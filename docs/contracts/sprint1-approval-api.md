# Sprint 1 Approval + Apply API Contract (v0.2)

## Endpoints

### `POST /api/approval-requests`
Create advisory write request from game layer.

Request body:
```json
{
  "target_type": "project|sprint|item|session_item",
  "target_id": "<entity-id>",
  "requested_patch": {"status":"at_risk"},
  "idempotency_key": "game:<target>:<nonce>"
}
```

Rules:
- actor header `x-reveal-actor: game`
- no direct PM mutation occurs
- state starts as `pending_approval`

### `POST /api/approval-requests/:id/approve`
PM transition: `pending_approval -> approved`.

### `POST /api/approval-requests/:id/reject`
PM transition: `pending_approval -> rejected`.

### `POST /api/approval-requests/:id/apply`
System transition + target-specific apply pipeline.

Response:
```json
{
  "approval_request": {"id":"...","state":"applied"},
  "applied_target": {
    "type": "project|sprint|item",
    "id": "<target-id>",
    "entity": {"...": "updated row snapshot"}
  }
}
```

Guarantees:
- transition validation via approval state machine
- target-specific applier selection
- ledger events: `approval.request.apply.started` + `approval.request.applied`
- audit log persisted for state transition

### Dashboard support
- `GET /api/approval-requests`
- `GET /api/sync/health`
- `GET /api/sync/conflicts` (blocked writes from audit_log)
