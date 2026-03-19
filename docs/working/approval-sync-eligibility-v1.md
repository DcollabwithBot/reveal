# Reveal — Approval vs Sync Eligibility v1

Date: 2026-03-19
Status: Sprint B working draft

## Purpose
Koble approval state, governance locks og sync eligibility sammen, så connected mode ikke senere ender som separate særregler.

## Core principle
Approval state og sync eligibility er ikke det samme.
Men de påvirker hinanden.

## Approval states
- `advisory`
- `pending_approval`
- `approved`
- `rejected`
- `applied`

## Eligibility rules

### advisory
- External sync ingest: allowed if field ownership permits
- External write-back: blocked
- Game direct mutation: blocked

### pending_approval
- External ingest on unrelated fields: conditional
- External ingest on target field/entity: blocked or routed to conflict/manual review
- External write-back: blocked
- PM direct override: allowed with audit

### approved
- Controlled apply path: allowed
- External write-back on same target field/entity: blocked until apply or explicit resolution
- External ingest on unrelated fields: conditional

### rejected
- Original recommendation path closed
- External sync behavior returns to normal ownership policy
- Audit trail remains immutable

### applied
- Canonical state updated
- External sync may resume according to ownership policy
- If external system disagrees, create sync conflict — do not silently revert

## Governance locks that block sync

Sync/write-back should be blocked or escalated when:
- approval request is pending for same field/entity
- entity has active governance lock
- stale context detected
- shared field conflict exists outside drift window

## Manual review triggers
- same field touched by external source while PM approval pending
- external authoritative update conflicts with recent approved apply
- shared field updated on both sides within drift window but with differing values
- replayed or ambiguous idempotency event on mutable target

## Design rule
Connected mode must never bypass approval semantics by accident.
If approval state says “hold”, sync layer must respect that.
