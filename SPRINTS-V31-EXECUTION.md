# Reveal v3.1 — Sprint Execution Plan (Sprint 0–3)

Reference baseline:
- Canonical: `templates/KOMBIT-WIFI7-TEMPLATE.md` v2.1 (templateVersion 1.2.0)
- Holdesnor v3.1: PM is source-of-truth, game layer is advisory, write-back only via PM approval
- Must-haves from adversarial review: event contract, approval workflow, anti-gaming rules, risk scoring, governance matrix, audit trail, success metrics

## Timeline (proposed)
- Sprint 0 (Week 1): Foundation + guardrails
- Sprint 1 (Week 2): PM/Game contract implementation + approvals in flow
- Sprint 2 (Week 3): Risk engine + anti-gaming enforcement + auditability
- Sprint 3 (Week 4): Hardening + UAT + rollout readiness

---

## Sprint 0 — Foundation & Debt Prevention (Now)
Goal:
- Lock contracts and governance before feature expansion.

Deliverables:
- `docs/contracts/event-schema-v1.md`
- `docs/governance/approval-flow-v1.md`
- `docs/rules/anti-gaming-v1.md`
- `docs/metrics/sprint-metrics-v1.md`
- `DECISIONS-NEEDED.md` signed by PM owner
- Initial implementation backlog prioritized (P0/P1/P2)

Exit criteria:
- Event taxonomy and required payload fields approved.
- Approval workflow mapped (states, actors, SLA, fallback).
- Anti-gaming rules baseline accepted (detection + consequence model).
- Metrics definitions frozen for Sprint 1 instrumentation.
- No unresolved P0 decision blockers.

Debt-prevention gate (mandatory):
- Gate S0-G1: “No-code-before-contract” — no broad feature refactor/implementation until schema + approval-flow + anti-gaming docs are accepted.
- Gate S0-G2: “Traceability setup” — all future feature stories must reference event IDs and approval states.

Risks:
- Over-design delays delivery.
- Ambiguous ownership between PM, eng, and governance.
- Hidden divergence between existing app behavior and new contract.

Mitigation:
- Keep docs v1 pragmatic; iterate in Sprint 1 with change log.
- Assign single DRI per document.
- Add gap-list between current behavior and v1 contract.

---

## Sprint 1 — Contract Wiring + Approval-Oriented Flow
Goal:
- Wire PM events to game signals in strict advisory mode; enforce PM-controlled write-back requests.

Deliverables:
- Event emission/consumption for P0 lifecycle events.
- Approval request object + queue (game suggestion → PM approval required).
- Governance matrix v1 in runtime config/docs.
- Audit trail v1 (who/what/when/why on approvals and rejected write-backs).

Sprint 1 kickoff status (2026-03-19):
- ✅ Baseline contract tests scaffolded (schema validation + replay/idempotency negative tests).
- ✅ Approval state machine skeleton added (`advisory -> pending_approval -> approved/rejected -> applied`).
- ✅ Write-back guard tests added (explicit unauthorized game->PM mutation block).
- ⏭️ Next: wire state machine + guard into runtime endpoints and event flow.

Exit criteria:
- P0 events fire consistently and are consumed idempotently.
- Game-origin changes cannot mutate PM data directly.
- PM can approve/deny write-back recommendations with full context.
- Audit log captures all approval decisions and write-back attempts.

Debt-prevention gate (mandatory):
- Gate S1-G1: “No direct write path” tests pass (negative test included).
- Gate S1-G2: “Approval-first” — all write-back paths go through approval service/state machine.

Risks:
- Coupling event model too tightly to current UI.
- Edge-case replays/duplicates causing inconsistent states.

Mitigation:
- Versioned event schema + idempotency key enforcement.
- Contract tests before UI expansion.

---

## Sprint 2 — Risk Scoring + Anti-Gaming Enforcement
Goal:
- Operationalize risk scoring and anti-gaming controls without harming legitimate team flow.

Deliverables:
- Risk scoring model v1 (inputs, weights, thresholds, severity bands).
- Anti-gaming detectors (minimum ruleset) + manual review path.
- Governance matrix v2 (role permissions incl. override policy).
- Expanded audit trail (decision rationale + score snapshots).

Exit criteria:
- Risk scores computed for all scoped entities/events.
- At least top anti-gaming scenarios detected with deterministic outcomes.
- False-positive handling path documented and test-covered.
- Governance roles can be validated against permissions matrix.

Debt-prevention gate (mandatory):
- Gate S2-G1: “Explainability required” — every score/change has reason codes.
- Gate S2-G2: “Override accountability” — all overrides require owner + reason + timestamp.

Risks:
- Score opacity creates trust issues.
- Anti-gaming too strict, reducing adoption.

Mitigation:
- Use reason codes and appeal process.
- Start conservative thresholds and tune with data.

---

## Sprint 3 — Hardening, Metrics Validation, and Launch Readiness
Goal:
- Validate reliability, governance compliance, and measurable outcomes before broad rollout.

Deliverables:
- Success metrics dashboard/reporting baseline (from metrics v1).
- End-to-end audit trail verification report.
- Governance + approval SLA compliance checks.
- Go-live readiness review package (risks, controls, rollback plan).

Exit criteria:
- Core success metrics trackable and stable.
- Audit trail completeness ≥ agreed threshold (target: 100% for approval actions).
- Governance violations are detectable and alertable.
- Final PM sign-off for controlled rollout.

Debt-prevention gate (mandatory):
- Gate S3-G1: “No blind spots” — every critical workflow emits required events/metrics.
- Gate S3-G2: “Operational handoff” — runbook/checklist exists for approval incidents and scoring disputes.

Risks:
- Last-minute scope creep on dashboard/UI polish.
- Performance overhead from logging/scoring.

Mitigation:
- Freeze scope at Sprint 3 start.
- Performance budget and log sampling strategy where safe.

---

## Cross-sprint guardrails (always on)
- PM data integrity is non-negotiable: game layer never overwrites PM directly.
- Any advisory→write-back action requires explicit PM approval and audit record.
- Every new feature story must map to: event(s), governance rule(s), metric(s), and risk impact.
- “Done” requires test evidence + audit evidence where approval/write-back is involved.

## Integration track (dual-mode: standalone-first, sync-ready)
Goal:
- Keep Reveal fully usable without external systems now, while preventing future migration pain.

Sprint 0 additions:
- Create and approve integration docs v1:
  - `docs/integration/integration-strategy-v1.md`
  - `docs/integration/field-mapping-matrix-v1.md`
  - `docs/integration/sync-policy-v1.md`
  - `docs/integration/standalone-bootstrap-v1.md`
- Define connector feature-flag model (all OFF by default).
- Confirm canonical `externalRefs[]` + sync metadata approach in design.

Sprint 1 additions:
- Implement connector-agnostic sync ledger contract (design + backlog itemization only if not coding yet).
- Prepare webhook/polling hybrid design stubs and failure handling plan.
- First pilot connector locked: Jira (read-only shadow scope).

Decision lock snapshot (2026-03-19):
- Mode A (Standalone) is default.
- Shared work-field ownership defaults to external system in connected mode.
- Connected write-back stays blocked until INT-G1/INT-G2/INT-G3 are PASS.

Dual-mode gate (mandatory):
- Gate INT-G1: “Standalone complete” — all core workflows operate without external dependencies.
- Gate INT-G2: “No migration debt” — canonical model + externalRefs pattern approved before connector work.
- Gate INT-G3: “Shadow-first” — first connector runs read-only shadow sync before any write-back.

Exit criteria for enabling connected mode:
- Mapping matrix approved for pilot connector.
- Sync conflict/idempotency/dead-letter rules validated in test scenarios.
- Kill switch and rollback playbook documented.
