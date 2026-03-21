let bpStylesInjected = false;
export function injectBPStyles() {
  if (bpStylesInjected) return;
  bpStylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes bp-screenShake {
      0%,100%{transform:translate(0,0) rotate(0deg)}
      10%{transform:translate(-4px,-2px) rotate(-1deg)}
      20%{transform:translate(4px,2px) rotate(1deg)}
      30%{transform:translate(-4px,2px) rotate(-1deg)}
      40%{transform:translate(4px,-2px) rotate(1deg)}
      50%{transform:translate(-2px,-4px) rotate(-0.5deg)}
      60%{transform:translate(2px,4px) rotate(0.5deg)}
      70%{transform:translate(-4px,2px) rotate(-1deg)}
      80%{transform:translate(4px,-2px) rotate(1deg)}
      90%{transform:translate(-2px,2px) rotate(-0.5deg)}
    }
    @keyframes bp-spotlight {
      0%{background:radial-gradient(circle 0px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
      60%{background:radial-gradient(circle 160px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
      100%{background:radial-gradient(circle 160px at 50% 50%, rgba(255,220,50,0.25) 0%, rgba(0,0,0,0.92) 100%)}
    }
    @keyframes bp-confetti-fall {
      0%{transform:translateY(-20px) rotate(0deg);opacity:1}
      100%{transform:translateY(120px) rotate(720deg);opacity:0}
    }
    @keyframes bp-cardFlip {
      0%{transform:rotateY(0deg)}
      50%{transform:rotateY(90deg)}
      100%{transform:rotateY(0deg)}
    }
    @keyframes bp-pop {
      0%{transform:scale(0.5);opacity:0}
      70%{transform:scale(1.1);opacity:1}
      100%{transform:scale(1);opacity:1}
    }
    @keyframes bp-reveal {
      0%{opacity:0;transform:translateY(20px) scale(0.8)}
      100%{opacity:1;transform:translateY(0) scale(1)}
    }
    @keyframes bp-glow {
      0%,100%{box-shadow:0 0 8px var(--epic), 0 0 16px var(--epic)}
      50%{box-shadow:0 0 24px var(--epic), 0 0 48px var(--epic), 0 0 72px var(--epic)}
    }
    @keyframes bp-suspense-bg {
      0%,100%{background-color:var(--bg)}
      50%{background-color:#0a0018}
    }
    @keyframes bp-timer-pulse {
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.25)}
    }
    @keyframes bp-winner-burst {
      0%{transform:scale(0);opacity:1}
      80%{transform:scale(2.5);opacity:0.8}
      100%{transform:scale(3);opacity:0}
    }
    @keyframes bp-float {
      0%,100%{transform:translateY(0)}
      50%{transform:translateY(-6px)}
    }
    @keyframes bp-shimmer {
      0%{background-position:-200% center}
      100%{background-position:200% center}
    }
    @keyframes bp-buzz {
      0%,100%{transform:rotate(0deg)}
      25%{transform:rotate(-8deg) scale(1.1)}
      75%{transform:rotate(8deg) scale(1.1)}
    }
    .bp-shake { animation: bp-screenShake 0.5s ease-in-out; }
    .bp-card-flip { animation: bp-cardFlip 0.6s ease-in-out; }
    .bp-pop-in { animation: bp-pop 0.4s ease-out forwards; }
    .bp-reveal-in { animation: bp-reveal 0.5s ease-out forwards; }
    .bp-floating { animation: bp-float 2s ease-in-out infinite; }
    .bp-buzz { animation: bp-buzz 0.15s ease-in-out infinite; }
    .scanlines {
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px, transparent 3px,
        rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
      );
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}
