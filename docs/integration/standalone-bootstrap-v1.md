# Reveal Standalone Bootstrap v1

Status: Practical runbook (no external integrations required)

## Objective
Run Reveal end-to-end in production-like operation without Topdesk/Jira/Azure DevOps/Planner, while staying integration-ready.

## 1) Enable now (standalone)
- Canonical WorkItem model with stable IDs.
- Internal workflow states + approval flow.
- Governance fields (`approvalState`, `riskScore`, reason codes) in core model.
- Audit trail for key state transitions.
- `externalRefs[]` field present but optional/empty.
- Integration feature flags present and set OFF.

## 2) Keep disabled now
- External adapters (Topdesk/Jira/DevOps/Planner).
- Outbound write-back workers.
- Webhook endpoints for external callbacks.
- Reconciliation polling jobs.

## 3) Data model readiness checklist
- Canonical fields exist independent of any tool-specific naming.
- External IDs stored in separate reference object, never replacing canonical IDs.
- Sync metadata isolated (`lastSyncAt`, `syncStatus`, `connectorName`, etc.).
- Audit schema already includes `sourceType` (`internal`/`external`) for future use.

## 4) Operational checklist (standalone)
- Confirm all workflows complete without connector dependency.
- Confirm approvals and audit logs function with internal actors only.
- Confirm no UI flow assumes external ticket URL/key.
- Confirm export/report views work with canonical fields only.

## 5) What to enable later (connected mode)
Order:
1. Enable one connector in read-only shadow mode.
2. Validate field mapping + dedupe + conflict logs.
3. Enable outbound for allowlisted fields only.
4. Expand connector/project scope gradually.

## 6) Go/no-go gate for first connector
Must pass before connected mode write-back:
- Mapping quality accepted by PM + Backend.
- Sync policy behavior validated on replay/conflict scenarios.
- Dead-letter workflow owner assigned and tested.
- Kill switch verified.

## 7) Recommended default now
Use **Standalone mode** until at least one connector completes shadow-sync validation with stable metrics.