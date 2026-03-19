# Reveal — Write-back Paths v1

Date: 2026-03-19
Status: Sprint B working draft

## Purpose
Definere hvilke write-back paths der må eksistere i Reveal, hvilke der kræver approval, og hvilke der er forbudte.

## Allowed paths

### 1. PM UI -> canonical PM data
- Status: Allowed
- Approval required: No
- Notes: Normal PM-owned mutation path

### 2. Game layer -> approval request
- Status: Allowed
- Approval required: N/A (this is the request-creation path)
- Notes: Game må anbefale, aldrig direkte skrive

### 3. Approved request -> backend apply -> canonical PM data
- Status: Allowed
- Approval required: Yes (already approved)
- Notes: Controlled apply path only

### 4. External shadow sync -> canonical ingest (read-only mirror semantics)
- Status: Conditional
- Approval required: No, if read-only shadow and ownership permits ingest
- Notes: Must still obey governance lock and idempotency policy

### 5. External authoritative field update -> canonical field
- Status: Conditional
- Approval required: Depends on field ownership + conflict + governance lock
- Notes: Only valid in connected mode when field explicitly allowed

## Forbidden paths

### 6. Game layer -> direct project/sprint/item mutation
- Status: Forbidden
- Reason: Breaks PM source-of-truth model

### 7. Game layer -> direct governance mutation
- Status: Forbidden
- Reason: Game may not approve/reject/apply

### 8. External system -> governance field overwrite
- Status: Forbidden
- Reason: Approval state, risk score, reason codes, audit references are Reveal-owned

### 9. External system -> write-through on shared field without policy
- Status: Forbidden
- Reason: No implicit ownership by “last writer wins”

### 10. Frontend-only projection logic -> canonical mutation
- Status: Forbidden
- Reason: Prevent hidden business logic in UI

## Conditional blockers

A write path that is otherwise allowed becomes blocked when:
- active governance lock exists
- approval request is stale or conflicting
- field ownership disallows mutation
- sync policy routes event to manual review
- idempotency/replay checks fail

## Design rule

If a write path cannot be described as:
- who initiated it
- what entity/field it touches
- who owns the field
- whether approval is required
- what audit record is written

...then that path should not exist.
