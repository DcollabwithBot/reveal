import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNextSprint,
  buildSprintExportPayload,
  buildSprintItemsCsv,
  buildSprintExportFileBase,
} from './sprintFlow.js';

test('resolveNextSprint is deterministic across mixed ordering signals', () => {
  const allSprints = [
    { id: 's3', project_id: 'p1', name: 'Sprint 3', sprint_code: '2003', status: 'planned', created_at: '2026-03-03T10:00:00Z' },
    { id: 's1', project_id: 'p1', name: 'Sprint 1', sprint_code: '2001', status: 'completed', created_at: '2026-03-01T10:00:00Z' },
    { id: 's2', project_id: 'p1', name: 'Sprint 2', sprint_code: '2002', status: 'active', created_at: '2026-03-02T10:00:00Z' },
    { id: 'other', project_id: 'p2', name: 'Other', sprint_code: '9999', status: 'planned' },
  ];

  const next = resolveNextSprint({ allSprints, currentSprintId: 's1' });
  assert.equal(next?.id, 's2');
});

test('resolveNextSprint ignores completed/archived after current', () => {
  const allSprints = [
    { id: 's1', project_id: 'p1', name: 'Sprint 1', sprint_code: '1', status: 'active' },
    { id: 's2', project_id: 'p1', name: 'Sprint 2', sprint_code: '2', status: 'completed' },
    { id: 's3', project_id: 'p1', name: 'Sprint 3', sprint_code: '3', status: 'archived' },
    { id: 's4', project_id: 'p1', name: 'Sprint 4', sprint_code: '4', status: 'draft' },
  ];

  const next = resolveNextSprint({ allSprints, currentSprintId: 's1' });
  assert.equal(next?.id, 's4');
});

test('buildSprintExportPayload + CSV keep summary and escaping stable', () => {
  const payload = buildSprintExportPayload({
    sprint: { id: 's1', name: 'Sprint Æ', status: 'active', sprint_code: '2001' },
    project: { id: 'p1', name: 'Reveal' },
    notes: [
      { id: 'n1', cat: 'well', body: 'God flow', author_name: 'A' },
      { id: 'n2', cat: 'action', body: 'Fix CSV', author_name: 'B' },
    ],
    items: [
      { id: 'i1', item_code: 'IT-1', title: 'One', item_status: 'done', estimated_hours: 3, hours_fak: 1, hours_int: 1, hours_ub: 0 },
      { id: 'i2', item_code: 'IT-2', title: 'Two "quoted"', item_status: 'backlog', estimated_hours: 5, hours_fak: 0, hours_int: 2, hours_ub: 1 },
    ],
  });

  assert.equal(payload.summary.items_total, 2);
  assert.equal(payload.summary.items_done, 1);
  assert.equal(payload.summary.items_open, 1);
  assert.equal(payload.summary.total_hours, 5);

  const csv = buildSprintItemsCsv(payload.items.map((item) => ({
    id: item.id,
    item_code: item.code,
    title: item.title,
    item_status: item.status,
    estimated_hours: item.estimated_hours,
    hours_fak: item.hours_fak,
    hours_int: item.hours_int,
    hours_ub: item.hours_ub,
  })));
  assert.match(csv, /"item_id","item_code","title"/);
  assert.match(csv, /"Two ""quoted"""/);
});

test('buildSprintExportFileBase sanitizes markdown filename path input', () => {
  const fileBase = buildSprintExportFileBase({ name: '../../Q1 Sprint: Alpha/Beta' });
  assert.equal(fileBase, 'sprint-rapport-q1-sprint-alpha-beta');
  assert.ok(!fileBase.includes('/'));
  assert.ok(!fileBase.includes('..'));
});
