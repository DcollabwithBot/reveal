const screens = {
  portfolio: {
    id: 'screen-portfolio',
    title: 'Portfolio Overview',
    subtitle: 'Cross-project status and risk control'
  },
  workspace: {
    id: 'screen-workspace',
    title: 'Project Workspace',
    subtitle: 'Overview, planning, execution, people, reports'
  },
  execution: {
    id: 'screen-execution',
    title: 'Sprint Execution',
    subtitle: 'Focused board operations and blocker handling'
  },
  close: {
    id: 'screen-close',
    title: 'Sprint Close',
    subtitle: 'Outcome review, retro actions, and close decision'
  }
};

const taskData = {
  task1: {
    title: 'OAuth edge states',
    assignee: 'Mia',
    deadline: '2026-03-22',
    estimate: '5 points',
    status: 'Backlog',
    priority: 'High',
    labels: 'Auth, UX, Reliability',
    blocked: 'No',
    blockedReason: '—'
  },
  task2: {
    title: 'Metrics sync timeout',
    assignee: 'Jonas',
    deadline: '2026-03-20',
    estimate: '3 points',
    status: 'In Progress (Blocked)',
    priority: 'Critical',
    labels: 'Backend, API, Risk',
    blocked: 'Yes',
    blockedReason: 'Vendor API rate-limit instability'
  },
  task3: {
    title: 'Timeline dependency links',
    assignee: 'Noah',
    deadline: '2026-03-21',
    estimate: '2 points',
    status: 'Review',
    priority: 'Medium',
    labels: 'Timeline, PM UX',
    blocked: 'No',
    blockedReason: '—'
  },
  task4: {
    title: 'People load balancing',
    assignee: 'Jonas',
    deadline: '2026-03-19',
    estimate: '2 points',
    status: 'Done',
    priority: 'Medium',
    labels: 'Capacity, Planning',
    blocked: 'No',
    blockedReason: '—'
  }
};

const navButtons = document.querySelectorAll('.nav-btn');
const title = document.getElementById('screen-title');
const subtitle = document.getElementById('screen-subtitle');

function activateScreen(screenKey) {
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.screen === screenKey));
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));

  const next = screens[screenKey] || screens.portfolio;
  document.getElementById(next.id).classList.add('active');
  title.textContent = next.title;
  subtitle.textContent = next.subtitle;

  const url = new URL(window.location.href);
  url.hash = screenKey;
  history.replaceState({}, '', url);
}

navButtons.forEach((btn) => btn.addEventListener('click', () => activateScreen(btn.dataset.screen)));

document.querySelectorAll('[data-screen-target]').forEach((btn) => {
  btn.addEventListener('click', () => activateScreen(btn.dataset.screenTarget));
});

const tabButtons = document.querySelectorAll('.tab-btn');
function activateTab(tabKey) {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabKey));
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  const target = document.getElementById(`tab-${tabKey}`);
  if (target) target.classList.add('active');
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

const drawer = document.getElementById('task-drawer');
const closeDrawerBtn = document.getElementById('close-drawer');

function openDrawer(taskId) {
  const task = taskData[taskId];
  if (!task) return;

  document.getElementById('drawer-title').textContent = task.title;
  document.getElementById('drawer-assignee').textContent = task.assignee;
  document.getElementById('drawer-deadline').textContent = task.deadline;
  document.getElementById('drawer-estimate').textContent = task.estimate;
  document.getElementById('drawer-status').textContent = task.status;
  document.getElementById('drawer-priority').textContent = task.priority;
  document.getElementById('drawer-labels').textContent = task.labels;
  document.getElementById('drawer-blocked').textContent = task.blocked;
  document.getElementById('drawer-blocked-reason').textContent = task.blockedReason;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-task]').forEach((ticket) => {
  ticket.addEventListener('click', () => openDrawer(ticket.dataset.task));
});

closeDrawerBtn.addEventListener('click', closeDrawer);

const overlayPanel = document.getElementById('overlay-panel');
const overlayToggle = document.getElementById('toggle-overlay');
let overlayOn = false;

function setOverlay(nextState) {
  overlayOn = nextState;
  overlayPanel.classList.toggle('open', overlayOn);
  overlayPanel.setAttribute('aria-hidden', String(!overlayOn));
  overlayToggle.textContent = `Gamification Overlay: ${overlayOn ? 'On' : 'Off'}`;
}

overlayToggle.addEventListener('click', () => setOverlay(!overlayOn));

const initial = window.location.hash.replace('#', '');
activateScreen(screens[initial] ? initial : 'portfolio');
activateTab('overview');
setOverlay(false);
