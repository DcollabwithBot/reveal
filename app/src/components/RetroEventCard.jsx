import { C, PF } from "../shared/constants.js";

const CAT_COLOR = { well: "#38b764", wrong: "#e04040", improve: "#feae34", surprise: "#b55088" };
const CAT_LABEL = { well: "GODE NYHEDER", wrong: "PROBLEM", improve: "KAN FORBEDRES", surprise: "OVERRASKELSE" };

export default function RetroEventCard({ event, onVote, oracleUsed, onOracle }) {
  const cc = CAT_COLOR[event.cat] || C.acc;
  return (
    <div style={{
      width: "min(360px, 90vw)", border: `4px solid ${cc}`,
      background: C.bgC, padding: 24, textAlign: "center",
      animation: "slideUp 0.3s ease", boxShadow: `0 0 20px ${cc}33`
    }}>
      <div style={{ fontFamily: PF, fontSize: 6, color: cc, marginBottom: 8, letterSpacing: 2 }}>
        {CAT_LABEL[event.cat]}
      </div>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{event.icon}</div>
      <div style={{ fontFamily: PF, fontSize: 9, color: C.wht, marginBottom: 10, lineHeight: 1.8 }}>
        {event.title}
      </div>
      <div style={{ fontFamily: "VT323, monospace", fontSize: 18, color: C.txt, marginBottom: 20, lineHeight: 1.4 }}>
        {event.desc}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { label: "✅ GIK GODT",   value: "well",  col: "#38b764" },
          { label: "⚠️ PROBLEM",    value: "wrong", col: "#e04040" },
          { label: "⏭️ IKKE REL.", value: "skip",  col: C.dim },
        ].map(btn => (
          <button key={btn.value} onClick={() => onVote(btn.value)}
            style={{
              fontFamily: PF, fontSize: 6, color: C.wht, background: btn.col,
              border: `3px solid ${btn.col}`, borderBottom: `5px solid ${C.bg}`,
              borderRight: `5px solid ${C.bg}`, padding: "8px 12px", cursor: "pointer"
            }}>
            {btn.label}
          </button>
        ))}
      </div>
      {!oracleUsed && (
        <button onClick={onOracle}
          style={{
            marginTop: 12, fontFamily: PF, fontSize: 6, color: "#b55088",
            background: "transparent", border: `2px solid #b55088`,
            padding: "6px 12px", cursor: "pointer"
          }}>
          🔮 JEG FORUDSÅ DETTE
        </button>
      )}
    </div>
  );
}
