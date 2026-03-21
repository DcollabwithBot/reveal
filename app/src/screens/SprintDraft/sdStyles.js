let sdStylesInjected = false;
export function injectDraftStyles() {
  if (sdStylesInjected) return;
  sdStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes sd-screenShake {
      0%, 100% { transform: translate(0, 0); }
      20%       { transform: translate(-5px, 0); }
      40%       { transform: translate(5px, 0); }
      60%       { transform: translate(-3px, 0); }
      80%       { transform: translate(3px, 0); }
    }
    @keyframes sd-flash-red { 0%,100%{background:transparent} 50%{background:rgba(255,68,68,0.25)} }
    @keyframes sd-flash-green { 0%,100%{background:transparent} 50%{background:rgba(0,200,150,0.25)} }
    .sd-shake { animation: sd-screenShake 0.5s ease-in-out; }
    .sd-flash-red { animation: sd-flash-red 0.5s ease; }
    .sd-flash-green { animation: sd-flash-green 1s ease; }
  `;
  document.head.appendChild(s);
}
