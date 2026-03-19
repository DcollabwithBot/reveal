# Reveal Field Mapping Matrix v1

Status: Draft v1  
Purpose: Canonical field contract + placeholders for Topdesk/Jira/Azure DevOps/Teams Planner mappings.

## Canonical entity: WorkItem (Reveal)

1) `canonicalId`
- Reveal: `work_item.id` (UUID)
- Topdesk: `external_number` (placeholder)
- Jira: `issue.id` / `issue.key`
- Azure DevOps: `workItem.id`
- Teams Planner: `task.id`

2) `title`
- Reveal: `work_item.title`
- Topdesk: `briefDescription`
- Jira: `summary`
- Azure DevOps: `System.Title`
- Teams Planner: `title`

3) `description`
- Reveal: `work_item.description`
- Topdesk: `request`
- Jira: `description`
- Azure DevOps: `System.Description`
- Teams Planner: `notes`

4) `status`
- Reveal: `work_item.status` (canonical enum)
- Topdesk: `processingStatus.name`
- Jira: `status.name`
- Azure DevOps: `System.State`
- Teams Planner: `percentComplete`/bucket-derived state

5) `priority`
- Reveal: `work_item.priority` (P0/P1/P2/P3)
- Topdesk: `priority.name`
- Jira: `priority.name`
- Azure DevOps: `Microsoft.VSTS.Common.Priority`
- Teams Planner: `priority` (if unavailable: label map)

6) `assignee`
- Reveal: `work_item.assignee_user_id`
- Topdesk: `operator.id`
- Jira: `assignee.accountId`
- Azure DevOps: `System.AssignedTo`
- Teams Planner: `assignments[userId]`

7) `reporter`
- Reveal: `work_item.reporter_user_id`
- Topdesk: `caller.id`
- Jira: `reporter.accountId`
- Azure DevOps: `System.CreatedBy`
- Teams Planner: `createdBy.user.id` (if available)

8) `dueDate`
- Reveal: `work_item.due_at`
- Topdesk: `targetDate`
- Jira: `duedate`
- Azure DevOps: `Microsoft.VSTS.Scheduling.TargetDate`
- Teams Planner: `dueDateTime`

9) `createdAt`
- Reveal: `work_item.created_at`
- Topdesk: `creationDate`
- Jira: `created`
- Azure DevOps: `System.CreatedDate`
- Teams Planner: `createdDateTime`

10) `updatedAt`
- Reveal: `work_item.updated_at`
- Topdesk: `modificationDate`
- Jira: `updated`
- Azure DevOps: `System.ChangedDate`
- Teams Planner: `lastModifiedDateTime`

11) `labels`
- Reveal: `work_item.labels[]`
- Topdesk: `category/subcategory` (mapped)
- Jira: `labels[]`
- Azure DevOps: `System.Tags`
- Teams Planner: `appliedCategories`

12) `sprintOrIteration`
- Reveal: `work_item.iteration_ref`
- Topdesk: custom field (placeholder)
- Jira: `sprint` (custom field, board-dependent)
- Azure DevOps: `System.IterationPath`
- Teams Planner: `bucketId` (mapped)

13) `externalRefs[]`
- Reveal: array of `{system, externalId, externalKey, lastSyncAt}`
- Topdesk/Jira/Azure DevOps/Planner: not mapped back directly; maintained by Reveal sync ledger.

14) `approvalState`
- Reveal: `approval_state` (pending/approved/rejected/applied)
- Topdesk/Jira/Azure DevOps/Planner: optional custom field or comment marker only.

15) `riskScore` + `reasonCodes[]`
- Reveal: internal governance fields
- External systems: optional mirror (read-only text/number), never source-of-truth in v1.

## Ownership defaults (v1)
- Reveal-owned: `approvalState`, `riskScore`, `reasonCodes`, governance/audit fields.
- Shared (configurable): `title`, `description`, `status`, `priority`, `assignee`, `dueDate`, `labels`.
- External-owned (import-preferred): external metadata unique to each connector.

## Notes
- This is a placeholder matrix for implementation planning; exact API field paths confirmed per connector onboarding.
- Any field added later must define: mapping, owner, conflict rule, and audit behavior before go-live.