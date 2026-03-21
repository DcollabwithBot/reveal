let ssStylesInjected = false;
export function injectSSStyles() {
  if (ssStylesInjected) return;
  ssStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
    @keyframes ss-timerPulse { 0%, 100% { color: var(--danger); opacity: 1; transform: scale(1); } 50% { color: #ff0000; opacity: 0.7; transform: scale(1.05); } }
    @keyframes ss-buzzerFlash { 0% { background: rgba(232,84,84,0.7); } 100% { background: transparent; } }
    @keyframes ss-edgePulse { 0%, 100% { box-shadow: inset 0 0 0px transparent; } 50% { box-shadow: inset 0 0 40px rgba(232,84,84,0.4); } }
    @keyframes ss-cardSelect { 0% { transform: scale(1); } 40% { transform: scale(1.15); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }
    @keyframes ss-barGrow { from { width: 0; } }
    @keyframes ss-screenShake { 0%,100% { transform: translate(0); } 10% { transform: translate(-6px, 4px); } 30% { transform: translate(6px, -4px); } 50% { transform: translate(-5px, 5px); } 70% { transform: translate(5px, -3px); } 90% { transform: translate(-3px, 2px); } }
    @keyframes ss-pop { 0% { opacity: 0; transform: scale(0.6); } 70% { transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes ss-reveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ss-delta-badge { 0%, 100% { box-shadow: 0 0 6px var(--danger); } 50% { box-shadow: 0 0 18px var(--danger), 0 0 30px var(--danger); } }
    @keyframes ss-speed-glow { 0%, 100% { text-shadow: 0 0 10px #00aaff; } 50% { text-shadow: 0 0 25px #00aaff, 0 0 50px #00aaff; } }
    @keyframes ss-countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ss-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    .ss-card-selected { animation: ss-cardSelect 0.3s ease; }
    .ss-timer-urgent { animation: ss-timerPulse 0.5s ease-in-out infinite; }
    .ss-buzzer-flash { animation: ss-buzzerFlash 0.6s ease forwards; }
    .ss-edge-danger { animation: ss-edgePulse 0.8s ease-in-out infinite; }
    .ss-pop { animation: ss-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .ss-reveal { animation: ss-reveal 0.4s ease forwards; }
    .ss-speed-title { animation: ss-speed-glow 2s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}
