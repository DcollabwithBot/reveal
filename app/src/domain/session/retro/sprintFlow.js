function parseSprintCode(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const digits = String(value).match(/\d+/g);
  if (!digits?.length) return Number.POSITIVE_INFINITY;
  return Number(digits.join(''));
}

function toTimestamp(value) {
  const ts = value ? Date.parse(value) : NaN;
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

function sprintSortKey(sprint) {
  return {
    code: parseSprintCode(sprint?.sprint_code),
    start: toTimestamp(sprint?.start_date),
    created: toTimestamp(sprint?.created_at),
    updated: toTimestamp(sprint?.updated_at),
    name: String(sprint?.name || '').toLowerCase(),
    id: String(sprint?.id || ''),
  };
}

function compareSprintSequence(a, b) {
  const ak = sprintSortKey(a);
  const bk = sprintSortKey(b);

  if (ak.code !== bk.code) return ak.code - bk.code;
  if (ak.start !== bk.start) return ak.start - bk.start;
  if (ak.created !== bk.created) return ak.created - bk.created;
  if (ak.updated !== bk.updated) return ak.updated - bk.updated;
  if (ak.name !== bk.name) return ak.name.localeCompare(bk.name, 'da');
  return ak.id.localeCompare(bk.id, 'da');
}

export function resolveNextSprint({ allSprints = [], currentSprintId }) {
  const current = allSprints.find((sprint) => sprint.id === currentSprintId);
  if (!current) return null;

  const sameProject = allSprints.filter((sprint) => sprint.project_id === current.project_id);
  const ordered = [...sameProject].sort(compareSprintSequence);
  const currentIndex = ordered.findIndex((sprint) => sprint.id === currentSprintId);

  if (currentIndex < 0) return null;

  const upcomingStatuses = new Set(['planned', 'upcoming', 'active', 'draft']);
  const viableAfterCurrent = ordered.slice(currentIndex + 1).filter((sprint) => !['archived', 'completed'].includes(sprint.status));
  const preferred = viableAfterCurrent.find((sprint) => upcomingStatuses.has(sprint.status));

  return preferred || viableAfterCurrent[0] || null;
}

function quoteCsvValue(value) {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function buildSprintExportPayload({ sprint, project, notes = [], items = [] }) {
  const now = new Date().toISOString();
  const noteByCat = {
    well: notes.filter((note) => note.cat === 'well'),
    improve: notes.filter((note) => note.cat === 'improve'),
    action: notes.filter((note) => note.cat === 'action'),
  };

  const doneItems = items.filter((item) => item.item_status === 'done');
  const openItems = items.filter((item) => item.item_status !== 'done');
  const totalHours = items.reduce((sum, item) => sum + (item.hours_fak || 0) + (item.hours_int || 0) + (item.hours_ub || 0), 0);

  return {
    exported_at: now,
    sprint: {
      id: sprint?.id || null,
      name: sprint?.name || null,
      status: sprint?.status || null,
      sprint_code: sprint?.sprint_code || null,
    },
    project: {
      id: project?.id || null,
      name: project?.name || null,
    },
    summary: {
      items_total: items.length,
      items_done: doneItems.length,
      items_open: openItems.length,
      notes_total: notes.length,
      notes_action: noteByCat.action.length,
      total_hours: Number(totalHours.toFixed(1)),
    },
    notes: notes.map((note) => ({
      id: note.id,
      category: note.cat,
      body: note.body,
      author_name: note.author_name,
      created_at: note.created_at || null,
    })),
    items: items.map((item) => ({
      id: item.id,
      code: item.item_code || null,
      title: item.title,
      status: item.item_status,
      estimated_hours: item.estimated_hours ?? null,
      hours_fak: item.hours_fak || 0,
      hours_int: item.hours_int || 0,
      hours_ub: item.hours_ub || 0,
    })),
  };
}

export function buildSprintItemsCsv(items = []) {
  const header = ['item_id', 'item_code', 'title', 'status', 'estimated_hours', 'hours_fak', 'hours_int', 'hours_ub', 'hours_total'];
  const rows = items.map((item) => {
    const total = (item.hours_fak || 0) + (item.hours_int || 0) + (item.hours_ub || 0);
    return [
      item.id,
      item.item_code || '',
      item.title || '',
      item.item_status || '',
      item.estimated_hours ?? '',
      item.hours_fak || 0,
      item.hours_int || 0,
      item.hours_ub || 0,
      total,
    ].map(quoteCsvValue).join(',');
  });

  return [header.map(quoteCsvValue).join(','), ...rows].join('\n');
}
