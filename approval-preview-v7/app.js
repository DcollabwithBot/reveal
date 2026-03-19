const screens = {
  dashboard: {
    id: 'screen-dashboard',
    eyebrow: 'What needs action now',
    title: 'Dashboard',
    subtitle: 'Ledelsesblik først. Momentum som sekundært signal.'
  },
  workspace: {
    id: 'screen-workspace',
    eyebrow: 'Drive the project',
    title: 'Project Workspace',
    subtitle: 'Professionel execution-flade med momentum som sekundært lag.'
  },
  session: {
    id: 'screen-session',
    eyebrow: 'Decision moment',
    title: 'Session / Play Mode',
    subtitle: 'Her må Reveal føles levende — men stadig bundet til rigtigt arbejde.'
  }
};

const navButtons = document.querySelectorAll('.nav-btn');
const title = document.getElementById('screen-title');
const subtitle = document.getElementById('screen-subtitle');
const eyebrow = document.getElementById('screen-eyebrow');
const overlayToggle = document.getElementById('overlay-toggle');
let overlayOn = false;

function activateScreen(screenKey) {
  const next = screens[screenKey] || screens.dashboard;
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.screen === screenKey));
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  document.getElementById(next.id).classList.add('active');
  title.textContent = next.title;
  subtitle.textContent = next.subtitle;
  eyebrow.textContent = next.eyebrow;
}

function setOverlay(next) {
  overlayOn = next;
  overlayToggle.textContent = `Overlay: ${overlayOn ? 'On' : 'Off'}`;
  document.querySelectorAll('.overlay-aware').forEach((el) => {
    el.classList.toggle('overlay-on', overlayOn);
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateScreen(btn.dataset.screen));
});

overlayToggle.addEventListener('click', () => setOverlay(!overlayOn));

activateScreen('dashboard');
setOverlay(false);
