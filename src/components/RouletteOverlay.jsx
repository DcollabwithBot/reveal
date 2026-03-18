import { useState, useEffect, useRef } from "react";
import { C, PF, ROULETTE_CHALLENGES } from "../shared/constants.js";

const CAT_LABEL = { human: "🧑 MENNESKELIG", tech: "⚙️ TEKNISK", extern: "🌍 EKSTERN" };

export default function RouletteOverlay({ onComplete }) {
  const [phase, setPhase] = useState("spinning"); // spinning | revealed
  const [frame, setFrame] = useState(0);
  const [selected, setSelected] = useState(null);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());
  const DURATION = 2800; // ms

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease out — hurtig start, langsom slut
      const eased = 1 - Math.pow(1 - progress, 3);
      const frameIdx = Math.floor(eased * ROULETTE_CHALLENGES.length * 8) % ROULETTE_CHALLENGES.length;
      setFrame(frameIdx);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Land på tilfældig challenge
        const finalIdx = Math.floor(Math.random() * ROULETTE_CHALLENGES.length);
        setSelected(ROULETTE_CHALLENGES[finalIdx]);
        setPhase("revealed");
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spinning = ROULETTE_CHALLENGES[frame];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      zIndex: 100, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
      animation: "fadeIn 0.2s ease"
    }}>
      <div style={{ fontFamily: PF, fontSize: 10, color: C.yel, letterSpacing: 2 }}>
        {phase === "spinning" ? "🎰 TRÆKKER CHALLENGE..." : "⚠️ CHALLENGE AFSLØRET!"}
      </div>

      {phase === "spinning" && (
        <div style={{
          width: 280, height: 160, overflow: "hidden", border: `4px solid ${C.yel}`,
          borderRadius: 4, background: C.bgC, position: "relative"
        }}>
          <div style={{
            padding: "20px 24px", textAlign: "center",
            transform: `translateY(${(frame % 3) * -2}px)`,
            transition: "transform 0.05s"
          }}>
            <div style={{ fontSize: 40 }}>{spinning?.icon}</div>
            <div style={{ fontFamily: PF, fontSize: 7, color: C.wht, marginTop: 8 }}>{spinning?.title}</div>
          </div>
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(180deg, ${C.bgC} 0%, transparent 30%, transparent 70%, ${C.bgC} 100%)`,
            pointerEvents: "none"
          }} />
        </div>
      )}

      {phase === "revealed" && selected && (
        <div style={{
          width: 300, border: `4px solid ${selected.color}`,
          borderRadius: 4, background: C.bgC, padding: 24,
          textAlign: "center", animation: "pop 0.4s ease",
          boxShadow: `0 0 30px ${selected.color}44`
        }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: selected.color, marginBottom: 8 }}>
            {CAT_LABEL[selected.cat]}
          </div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{selected.icon}</div>
          <div style={{ fontFamily: PF, fontSize: 9, color: C.wht, marginBottom: 12, lineHeight: 1.8 }}>
            {selected.title}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.txt, marginBottom: 16, lineHeight: 1.4 }}>
            {selected.desc}
          </div>
          <div style={{
            fontFamily: PF, fontSize: 8, color: C.red, padding: "6px 12px",
            border: `2px solid ${C.red}`, display: "inline-block", marginBottom: 20,
            animation: "pulse 1s ease-in-out infinite"
          }}>
            MODIFIER: ×{selected.modifier.toFixed(1)}
          </div>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginBottom: 16 }}>
            BOSS HP STIGER! RE-ESTIMER MED DENNE VIDEN.
          </div>
          <button onClick={() => onComplete(selected)}
            style={{
              fontFamily: PF, fontSize: 8, color: C.bg, background: C.yel,
              border: `3px solid ${C.yel}`, borderBottom: `5px solid ${C.bg}`,
              borderRight: `5px solid ${C.bg}`, padding: "10px 20px",
              cursor: "pointer", letterSpacing: 1
            }}>
            🎯 RE-ESTIMER!
          </button>
        </div>
      )}
    </div>
  );
}
