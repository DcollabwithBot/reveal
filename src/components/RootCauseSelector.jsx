import { useState } from "react";
import { C, PF } from "../shared/constants.js";

const CAUSES = [
  { id: "folk",   icon: "👥", label: "FOLK" },
  { id: "proces", icon: "🔧", label: "PROCES" },
  { id: "teknik", icon: "💻", label: "TEKNIK" },
  { id: "krav",   icon: "📋", label: "KRAV" },
];

const NPC_COMMENTS = {
  folk:   ["Mia: Det handler om kommunikation!", "Jonas: Vi manglede den rette person"],
  proces: ["Sara: Processen slog os i knæet", "Emil: Vi burde have haft en bedre workflow"],
  teknik: ["Jonas: Teknisk gæld er skyldige!", "Mia: Vi ignorerede warning signs"],
  krav:   ["Emil: Kravene var aldrig klare", "Sara: Ingen vidste hvad vi byggede mod"],
};

export default function RootCauseSelector({ event, onSelect }) {
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState(null);

  function pick(cause) {
    setSelected(cause);
    const comments = NPC_COMMENTS[cause] || [];
    setComment(comments[Math.floor(Math.random() * comments.length)]);
  }

  return (
    <div style={{ width: "min(360px, 90vw)", textAlign: "center" }}>
      <div style={{ fontFamily: PF, fontSize: 7, color: C.yel, marginBottom: 8 }}>
        ROOT CAUSE: {event.title}
      </div>
      <div style={{ fontFamily: "VT323, monospace", fontSize: 16, color: C.txt, marginBottom: 16 }}>
        Hvad var den primære årsag?
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {CAUSES.map(c => (
          <button key={c.id} onClick={() => pick(c.id)}
            style={{
              fontFamily: PF, fontSize: 7, color: selected === c.id ? C.bg : C.wht,
              background: selected === c.id ? C.yel : C.bgL,
              border: `3px solid ${selected === c.id ? C.yel : C.brd}`,
              borderBottom: `5px solid ${C.bg}`, borderRight: `5px solid ${C.bg}`,
              padding: "10px 14px", cursor: "pointer"
            }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {comment && (
        <div style={{
          fontFamily: "VT323, monospace", fontSize: 16, color: C.xp,
          marginBottom: 12, padding: "8px 12px", border: `1px solid ${C.brd}`,
          background: C.bgL, animation: "slideUp 0.3s ease"
        }}>
          💬 {comment}
        </div>
      )}
      {selected && (
        <button onClick={() => onSelect(selected)}
          style={{
            fontFamily: PF, fontSize: 8, color: C.bg, background: C.grn,
            border: `3px solid ${C.grn}`, borderBottom: `5px solid ${C.bg}`,
            borderRight: `5px solid ${C.bg}`, padding: "10px 20px",
            cursor: "pointer", animation: "pop 0.3s ease"
          }}>
          ✅ BEKRÆFT ÅRSAG
        </button>
      )}
    </div>
  );
}
