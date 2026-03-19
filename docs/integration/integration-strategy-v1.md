# Reveal Integration Strategy v1 (Dual-Mode)

Status: Draft v1  
Owner: PM + Backend  
Scope: Planning/architecture only (no runtime refactor yet)

## 1) Goal
Build Reveal so it runs fully standalone now, but can later sync with external work systems (Topdesk, Jira, Azure DevOps, Teams Planner) without painful migration.

## 2) Operating modes

### Mode A — Standalone (default now)
- Reveal is system-of-record for all entities and workflow.
- No external connector required.
- Internal IDs, states, audit trail, and approvals are complete and production-usable.

### Mode B — Connected (later)
- Reveal remains canonical for internal logic/governance.
- Selected entities/fields synchronize to/from external systems via adapters.
- External updates are treated as events and pass through sync policy + conflict rules.

## 3) Core design principle (prevents migration pain)
Use one canonical Reveal domain model from day 1, even in standalone mode.

That means:
- Canonical IDs exist now (not tool-specific IDs).
- External references are optional sidecar links per record (`externalRefs[]`).
- Field ownership rules exist now (even when all owned by Reveal).
- Change log/audit format is identical in both modes.

Result: mode switch is config + connector rollout, not data remodel.

## 4) Logical architecture
- `Canonical Domain Layer` (Reveal entities + validation + state machine)
- `Integration Adapter Layer` (Topdesk/Jira/DevOps/Planner connectors, initially disabled)
- `Sync Orchestrator` (pull/webhook ingest, transform, dedupe, conflict handling)
- `Mapping Registry` (canonical <-> external field mapping, versioned)
- `Sync Ledger` (idempotency keys, cursor/checkpoint, retry state, dead-letter refs)

## 5) Mode switch strategy

### Phase 0 (now): Standalone-first
- Enable canonical model and internal workflows only.
- Persist empty/optional `externalRefs` structure on entities.
- Keep integration adapters behind feature flags set to OFF.

### Phase 1: Shadow-connect (no write-back)
- Turn on read-only ingestion for one connector.
- Map external records into canonical previews/sandbox.
- Validate mapping quality, idempotency, and conflict logs.

### Phase 2: Controlled bi-directional sync
- Enable scoped write-back on approved fields only.
- Keep owner-of-truth per field explicit.
- Start with one system + one project scope.

### Phase 3: Multi-connector scale
- Add additional tools with same policy primitives.
- Reuse mapping/sync engine; only adapter-specific deltas change.

## 6) Non-negotiable guardrails
- No direct connector write to core entities without sync policy enforcement.
- All external updates are traceable (source, timestamp, event ID, connector).
- Idempotency required for every inbound/outbound sync action.
- Field ownership must be declared before enabling write-back.

## 7) v1 decisions
- Recommended default mode now: **Mode A (Standalone)**.
- First connected target later: choose one of Jira/Topdesk for pilot (single-tool first).
- Planner/Azure DevOps added only after pilot stability KPIs are met.

## 8) Exit criteria for moving A -> B
- Field mapping matrix v1 approved.
- Sync policy v1 approved and test scenarios defined.
- Conflict resolution + dead-letter runbook approved.
- Dual-mode gate in sprint plan marked PASS.