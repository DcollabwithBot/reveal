import { useState, useEffect } from "react";
import { C, PF, BF, WORLDS } from "../shared/constants.js";
import { dk } from "../shared/utils.js";
import { getGameAvailability } from "../lib/api.js";
import Leaderboard from "../components/leaderboard/Leaderboard.jsx";
import SituationalRecommender, { ALL_MODES, ZONE_META } from "../components/discovery/SituationalRecommender.jsx";

const WL = "#2a1f3d", WD = "#1a1230", FL = "#3a2820", FD = "#281a14", WO = "#5a3a20", ST = "#4a4460", SD = "#3a3450";

const NPC_DEFS = [
  { name: "Mia",   cls: { icon: "🧙", color: "#b55088" }, hat: "#b55088", body: "#b55088", skin: "#fed", px: 18, py: 62 },
  { name: "Jonas", cls: { icon: "🗡️", color: "#38b764" }, hat: "#38b764", body: "#257953", skin: "#edc", px: 75, py: 65 },
  { name: "Sara",  cls: { icon: "🛡️", color: "#5fcde4" }, hat: "#5fcde4", body: "#3b7dd8", skin: "#ffe", px: 55, py: 70 },
  { name: "Emil",  cls: { icon: "🏹", color: "#feae34" }, hat: "#feae34", body: "#d77643", skin: "#fec", px: 88, py: 63 },
];

function Spr({ hat, body, skin = "#fdd", cls, size = 1, anim, dir = 1, idle = true, label }) {
  const [t, setT] = useState(Math.floor(Math.random() * 100));
  useEffect(() => { if (!idle) return; const i = setInterval(() => setT(v => v + 1), 90); return () => clearInterval(i); }, [idle]);
  const s = size, w = Math.round(14 * s), cl = cls || { icon: "⚔️", color: "#f04f78" }, blink = idle && t % 30 < 2, leg = idle ? Math.sin(t * 0.2) * s * 0.3 : 0;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", transform: `scaleX(${dir})`, position: "relative" }}>
      <div style={{ position: "relative", width: `${w * 1.3}px`, animation: anim || "none" }}>
        <div style={{ position: "absolute", bottom: `${-2 * s}px`, left: "50%", transform: "translateX(-50%)", width: `${w * 1.2}px`, height: `${2 * s}px`, background: "rgba(0,0,0,0.15)", borderRadius: "50%" }} />
        <div style={{ width: `${w}px`, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: `${3.5 * s}px`, marginBottom: `${-0.5 * s}px`, opacity: 0.5 }}>{cl.icon}</div>
          <div style={{ width: `${w}px`, height: `${3 * s}px`, background: hat || cl.color, margin: "0 auto" }} />
          <div style={{ width: `${w * 0.85}px`, height: `${2.5 * s}px`, background: dk(hat || cl.color), margin: "-1px auto 0" }} />
          <div style={{ width: `${w * 0.75}px`, height: `${7 * s}px`, background: skin, margin: "0 auto", position: "relative" }}>
            {!blink && <><div style={{ position: "absolute", top: `${2.5 * s}px`, left: `${1.5 * s}px`, width: `${1.5 * s}px`, height: `${1.5 * s}px`, background: C.bg }} /><div style={{ position: "absolute", top: `${2.5 * s}px`, right: `${1.5 * s}px`, width: `${1.5 * s}px`, height: `${1.5 * s}px`, background: C.bg }} /></>}
            {blink && <div style={{ position: "absolute", top: `${3 * s}px`, left: `${1 * s}px`, right: `${1 * s}px`, height: `${0.8 * s}px`, background: C.bg }} />}
          </div>
          <div style={{ width: `${w * 0.9}px`, height: `${8 * s}px`, background: body || hat || cl.color, margin: "0 auto", position: "relative" }}>
            <div style={{ position: "absolute", right: `${-3 * s}px`, top: `${1.5 * s}px`, fontSize: `${3.5 * s}px`, transform: `rotate(${-25 + Math.sin((t || 0) * 0.1) * 5}deg)`, opacity: 0.7 }}>{cl.icon}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: `${1.5 * s}px` }}>
            <div style={{ width: `${4 * s}px`, height: `${4 * s + leg}px`, background: dk(body || hat || cl.color, 60) }} />
            <div style={{ width: `${4 * s}px`, height: `${4 * s - leg}px`, background: dk(body || hat || cl.color, 60) }} />
          </div>
        </div>
      </div>
      {label && <div style={{ fontFamily: PF, fontSize: `${Math.max(4, 2.2 * s)}px`, color: C.wht, marginTop: `${1.5 * s}px`, background: C.bg + "bb", padding: "1px 3px", transform: `scaleX(${dir})` }}>{label}</div>}
    </div>
  );
}

function Torch({ x, y, size = 1 }) {
  const [t, setT] = useState(Math.floor(Math.random() * 100));
  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 60); return () => clearInterval(i); }, []);
  const s = size;
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%` }}>
      <div style={{ width: `${6 * s}px`, height: `${18 * s}px`, background: WO, margin: "0 auto" }} />
      <div style={{ position: "absolute", top: `${-10 * s}px`, left: "50%", transform: "translateX(-50%)" }}>
        <div style={{ width: `${5 + Math.sin(t * 0.3) * 2}px`, height: `${9 + Math.sin(t * 0.25) * 3}px`, background: "#ff6030", borderRadius: `${3 * s}px ${3 * s}px 0 0`, margin: "0 auto", opacity: 0.9 }} />
        <div style={{ width: `${3 + Math.sin(t * 0.35) * 1.5}px`, height: `${6 + Math.sin(t * 0.3) * 2}px`, background: "#ffaa30", borderRadius: `${2 * s}px ${2 * s}px 0 0`, margin: `${-5 * s}px auto 0` }} />
        <div style={{ width: `${2 + Math.sin(t * 0.4) * 1}px`, height: `${3 + Math.sin(t * 0.35) * 1}px`, background: "#ffe477", borderRadius: `${s}px ${s}px 0 0`, margin: `${-2 * s}px auto 0` }} />
      </div>
      <div style={{ position: "absolute", top: `${-16 * s}px`, left: "50%", transform: "translateX(-50%)", width: `${35 + Math.sin(t * 0.2) * 8}px`, height: `${35 + Math.sin(t * 0.2) * 8}px`, borderRadius: "50%", background: "radial-gradient(circle,#ff603015,#ffaa3008,transparent)", pointerEvents: "none" }} />
    </div>
  );
}

// Availability state colors/icons
const AVAIL_CONFIG = {
  available:    { color: "#38b764", dot: "#38b764",  icon: null,  label: null },
  recommended:  { color: "#feae34", dot: "#feae34",  icon: "⭐",  label: "Anbefalet" },
  locked:       { color: "#555",    dot: "#555",      icon: "🔒",  label: "Låst" },
  completed:    { color: "#5fcde4", dot: "#5fcde4",  icon: "✓",   label: null },
};

// Game-mode portal card for zones view
function ModePortal({ mode, hovered, t, onClick, isRecommended, missions = [], hasRandomEvent }) {
  const zoneMeta = ZONE_META[mode.zone] || { color: "#feae34", icon: "⭐" };
  const activeMissions = missions.filter(m => m.required_mode === mode.id || m.mode === mode.id);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => {}}
      style={{
        position: "relative",
        width: 140, cursor: "pointer",
        transition: "all 0.2s",
        transform: hovered ? "scale(1.06) translateY(-4px)" : "scale(1)",
        opacity: mode.state === "locked" ? 0.4 : 1,
      }}
    >
      {/* Mission overlay marker */}
      {activeMissions.length > 0 && (
        <div style={{
          position: "absolute", top: -8, right: -6, zIndex: 10,
          fontSize: 14, animation: "float 2s ease-in-out infinite",
          filter: "drop-shadow(0 0 4px #feae34)",
        }}>📜</div>
      )}
      {/* Random event marker */}
      {hasRandomEvent && (
        <div style={{
          position: "absolute", top: -8, left: -6, zIndex: 10,
          fontSize: 14, animation: "availPulse 1s ease-in-out infinite",
          filter: "drop-shadow(0 0 6px #feae34)",
        }}>⚡</div>
      )}

      {/* Portal frame */}
      <div style={{
        width: 140, height: 90, position: "relative", overflow: "hidden",
        border: `2px solid ${hovered || isRecommended ? zoneMeta.color : "#2a2040"}`,
        borderRadius: 8,
        background: `radial-gradient(ellipse at center, ${zoneMeta.color}18 0%, #0e1019 70%)`,
        boxShadow: isRecommended
          ? `0 0 18px ${zoneMeta.color}55, inset 0 0 10px ${zoneMeta.color}22`
          : hovered ? `0 0 12px ${zoneMeta.color}33` : "none",
        transition: "all 0.25s",
      }}>
        {/* Recommended pulse ring */}
        {isRecommended && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 6,
            border: `2px solid ${zoneMeta.color}`,
            animation: "availPulse 1.4s ease-in-out infinite",
          }} />
        )}
        {/* Icon */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -55%)",
          fontSize: hovered ? 32 : 28,
          transition: "font-size 0.2s",
          filter: hovered ? "none" : "brightness(0.85)",
          animation: hovered ? "bounce 0.5s ease-in-out infinite" : "none",
        }}>
          {mode.icon}
        </div>
        {/* Zone indicator */}
        <div style={{
          position: "absolute", top: 5, right: 6,
          fontSize: 9, color: zoneMeta.color, opacity: 0.7,
        }}>
          {zoneMeta.icon}
        </div>
        {/* Recommended label */}
        {isRecommended && (
          <div style={{
            position: "absolute", top: 4, left: 5,
            fontFamily: PF, fontSize: 4, color: zoneMeta.color,
            background: zoneMeta.color + "22", padding: "2px 4px", borderRadius: 3,
            animation: "pulse 1.5s infinite",
          }}>
            ★ TOP
          </div>
        )}
        {/* Particle effects on hover */}
        {hovered && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${20 + i * 20}%`, top: `${10 + Math.sin(t * 0.05 + i) * 30}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: zoneMeta.color, opacity: 0.3 + Math.sin(t * 0.06 + i) * 0.3,
            animation: `float ${1 + i % 2 * 0.5}s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
        {/* Completion checkmark */}
        {mode.state === "completed" && (
          <div style={{
            position: "absolute", bottom: 5, right: 6,
            fontFamily: PF, fontSize: 5, color: "#5fcde4",
          }}>✓</div>
        )}
      </div>

      {/* Label */}
      <div style={{ textAlign: "center", marginTop: 5 }}>
        <div style={{
          fontFamily: PF, fontSize: 5,
          color: hovered ? zoneMeta.color : C.txt,
          textShadow: hovered ? `0 0 6px ${zoneMeta.color}66` : "none",
          marginBottom: 2,
        }}>
          {mode.name}
        </div>
        <div style={{ fontFamily: BF, fontSize: 9, color: C.dim, lineHeight: 1.3 }}>{mode.desc}</div>
        {hovered && (
          <div style={{ fontFamily: PF, fontSize: 4, color: zoneMeta.color, marginTop: 3, animation: "pulse 0.6s infinite" }}>
            ▶ START
          </div>
        )}
      </div>
    </div>
  );
}

// Legacy world portal (kept for "Verdener" tab)
function Portal({ w, hovered: isH, t, onClick, availability }) {
  const hasReco = availability && Object.values(availability).some(a => a?.state === 'recommended');
  return (
    <div onClick={onClick} style={{ cursor: "pointer", transition: "all 0.25s", transform: isH ? "scale(1.06) translateY(-4px)" : "scale(1)", width: "170px" }}>
      <div style={{ width: "170px", position: "relative" }}>
        <div style={{ width: "170px", height: "22px", background: ST, borderRadius: "6px 6px 0 0", border: `3px solid ${SD}`, borderBottom: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: PF, fontSize: "5px", color: w.color, letterSpacing: "1px" }}>{w.lv}</span>
          {hasReco && (
            <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#feae34", animation: "availPulse 1.4s ease-in-out infinite", boxShadow: "0 0 5px #feae34" }} />
          )}
        </div>
        <div style={{ width: "164px", height: "95px", margin: "0 3px", overflow: "hidden", position: "relative", border: `3px solid ${isH ? w.color : SD}`, borderTop: "none", boxShadow: isH ? `0 0 20px ${w.color}44, inset 0 0 15px ${w.color}22` : hasReco ? `0 0 10px #feae3422` : "none", transition: "all 0.3s" }}>
          <div style={{ width: "100%", height: "40%", background: w.sky || "#6a98e0" }} />
          <div style={{ width: "100%", height: "60%", background: w.grs || "#38b764" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "15%", background: w.drt || "#d77643" }} />
          {[15, 45, 80].map((x, i) => (
            <div key={i} style={{ position: "absolute", bottom: "18%", left: `${x}%` }}>
              <div style={{ width: "3px", height: "7px", background: dk(w.drt || "#d77643"), margin: "0 auto" }} />
              <div style={{ width: "9px", height: "7px", background: dk(w.grs || "#38b764"), marginTop: "-2px", marginLeft: "-3px" }} />
            </div>
          ))}
          {[20, 65].map((x, i) => (
            <div key={i} style={{ position: "absolute", top: `${8 + i * 5}%`, left: `${(x + t * 0.3) % 100}%`, width: "16px", height: "5px", background: "#fff", opacity: 0.35 }} />
          ))}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse,${w.color}${isH ? "30" : "10"},transparent 70%)`, animation: isH ? "portalPulse 1.5s ease-in-out infinite" : "none" }} />
          {isH && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: `${15 + i * 16}%`, top: `${20 + Math.sin(t * 0.05 + i) * 25}%`, width: "3px", height: "3px", borderRadius: "50%", background: w.color, opacity: 0.4 + Math.sin(t * 0.06 + i) * 0.3, animation: `float ${1 + i % 3 * 0.3}s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "26px", filter: isH ? "none" : "brightness(0.7)", animation: isH ? "bounce 0.6s ease-in-out infinite" : "none" }}>{w.icon}</div>
          <div style={{ position: "absolute", bottom: "18%", right: "8%", fontSize: "13px", opacity: isH ? 0.6 : 0.2, transition: "opacity 0.3s" }}>{w.boss}</div>
        </div>
        <div style={{ position: "absolute", top: "22px", left: 0, width: "10px", height: "95px", background: `linear-gradient(90deg,${SD},${ST})` }} />
        <div style={{ position: "absolute", top: "22px", right: 0, width: "10px", height: "95px", background: `linear-gradient(90deg,${ST},${SD})` }} />
      </div>
      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <div style={{ fontFamily: PF, fontSize: "7px", color: isH ? w.color : C.txt, textShadow: isH ? `0 0 6px ${w.color}66` : "none" }}>{w.name}</div>
        <div style={{ fontFamily: BF, fontSize: "12px", color: C.dim }}>{w.sprint}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "3px", justifyContent: "center", marginTop: "3px" }}>
          <div style={{ width: "70px", height: "5px", background: C.bg, border: `1px solid ${dk(w.color)}`, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(w.prog / w.tot) * 100}%`, background: w.color, boxShadow: `0 0 3px ${w.color}44` }} />
          </div>
          <span style={{ fontFamily: PF, fontSize: "4px", color: w.color }}>{w.prog}/{w.tot}</span>
        </div>
        {isH && <div style={{ fontFamily: PF, fontSize: "4px", color: w.color, marginTop: "3px", animation: "pulse 0.6s infinite" }}>▶ ENTER</div>}
      </div>
    </div>
  );
}

export default function WorldSelect({ avatar, onSelect, onSelectMode, sound, activeSprint, organizationId, activeMissions = [], activeRandomEvent = null }) {
  const [t, setT] = useState(0);
  const [hov, setHov] = useState(null);
  const [flash, setFlash] = useState(null);
  const [availability, setAvailability] = useState({});
  const [tab, setTab] = useState("modes"); // "modes" | "worlds"
  const [recommendedTop, setRecommendedTop] = useState(null);
  const [showRecommender, setShowRecommender] = useState(false);
  const [activeSideQuest, setActiveSideQuest] = useState(null);

  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);

  useEffect(() => {
    const sprintId = activeSprint?.id;
    if (!sprintId) return;
    getGameAvailability(sprintId).then(avail => {
      if (avail) {
        const map = {};
        WORLDS.forEach(w => { map[w.id] = avail; });
        setAvailability(map);
      }
    }).catch(() => {});
  }, [activeSprint]);

  // Check for active side quest in missions
  useEffect(() => {
    if (activeMissions?.length) {
      const sq = activeMissions.find(m => m.mission_type === "side_quest" && m.status === "active");
      setActiveSideQuest(sq || null);
    }
  }, [activeMissions]);

  const playerHat = avatar?.helmet?.pv || avatar?.cls?.color || "#f04f78";
  const playerBody = avatar?.armor?.pv || avatar?.cls?.color || "#f04f78";
  const playerSkin = avatar?.skin || "#fdd";
  const playerCls = avatar?.cls || { icon: "⚔️", color: "#f04f78" };

  function handleSelect(w) {
    sound("door");
    setFlash(w.color);
    setTimeout(() => { setFlash(null); onSelect(w); }, 500);
  }

  function handleModeSelect(mode) {
    sound("door");
    const zoneMeta = ZONE_META[mode.zone] || {};
    setFlash(zoneMeta.color || "#feae34");
    setTimeout(() => {
      setFlash(null);
      if (onSelectMode) onSelectMode(mode);
      else onSelect({ ...mode, id: mode.id, name: mode.name });
    }, 400);
  }

  function handleRecommenderSelect(mode) {
    setRecommendedTop(mode.id);
    setShowRecommender(false);
  }

  // Group modes by zone
  const zoneOrder = ["scrum", "scope", "speed", "strategy"];
  const modesByZone = zoneOrder.reduce((acc, z) => {
    acc[z] = ALL_MODES.filter(m => m.zone === z);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.4, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.5s ease-out forwards" }} />}

      {/* Background */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(180deg,${WD},${WL})` }} />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={`wb${i}`} style={{ position: "absolute", top: `${3 + Math.floor(i / 4) * 10}%`, left: `${(i % 4) * 26 + 2}%`, width: "22%", height: "8%", border: `1px solid ${WD}`, opacity: 0.12 }} />
      ))}
      <div style={{ position: "absolute", top: "33%", left: 0, right: 0, height: "3%", background: `linear-gradient(180deg,${WO},${dk(WO)})` }} />
      <div style={{ position: "absolute", top: "36%", left: 0, right: 0, bottom: 0, background: `linear-gradient(180deg,${FL},${FD})` }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`fp${i}`} style={{ position: "absolute", top: `${36 + i * 8}%`, left: 0, right: 0, height: "1px", background: FD, opacity: 0.25 }} />
      ))}

      <Torch x={8} y={10} size={1.2} />
      <Torch x={88} y={10} size={1.2} />
      <Torch x={35} y={8} size={1} />
      <Torch x={62} y={8} size={1} />

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "radial-gradient(ellipse at 50% 80%,#ff603008,transparent 60%)", pointerEvents: "none" }} />

      {/* NPCs */}
      {NPC_DEFS.map((m, i) => (
        <div key={m.name} style={{ position: "absolute", left: `${m.px + Math.sin(t * 0.008 + i * 2) * 4}%`, top: `${m.py}%`, animation: `charWalk ${3 + i}s ease-in-out infinite`, zIndex: 3 }}>
          <Spr hat={m.hat} body={m.body} skin={m.skin} cls={m.cls} size={1.5} dir={Math.sin(t * 0.008 + i * 2) > 0 ? 1 : -1} label={m.name} />
        </div>
      ))}

      {/* Player */}
      <div style={{ position: "absolute", left: "46%", top: "55%", zIndex: 4 }}>
        <Spr hat={playerHat} body={playerBody} skin={playerSkin} cls={playerCls} size={2.3} anim="float 2s ease-in-out infinite" label="Du" />
        <div style={{ fontFamily: PF, fontSize: "4px", color: C.acc, textAlign: "center", marginTop: "2px", animation: "pulse 1.5s infinite" }}>▼</div>
      </div>

      {/* Main UI */}
      <div style={{ position: "relative", zIndex: 5, padding: "8px 10px", paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <h1 style={{ fontFamily: PF, fontSize: "16px", color: C.acc, letterSpacing: "4px", margin: 0, animation: "victoryPulse 3s ease-in-out infinite" }}>REVEAL</h1>
          <div style={{ fontFamily: BF, fontSize: "13px", color: C.dim }}>◈ TAVERN HUB ◈</div>
        </div>

        {/* Avatar badge */}
        {avatar && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
            <div style={{ fontFamily: PF, fontSize: "5px", color: avatar.cls.color, padding: "3px 10px", background: avatar.cls.color + "22", border: `2px solid ${avatar.cls.color}`, display: "flex", alignItems: "center", gap: "4px" }}>
              <span>{avatar.cls.icon}</span>
              <span>{avatar.cls.name}</span>
              {avatar.helmet?.pv && <span>{avatar.helmet.icon}</span>}
              {avatar.weapon?.pv && <span>{avatar.weapon.icon}</span>}
            </div>
          </div>
        )}

        {/* Random Event Banner */}
        {activeRandomEvent && (
          <div style={{
            maxWidth: 700, margin: "0 auto 10px",
            padding: "10px 16px",
            background: "rgba(254,174,52,0.12)",
            border: "2px solid rgba(254,174,52,0.5)",
            borderRadius: 8, textAlign: "center",
            animation: "availPulse 1.5s ease-in-out infinite",
          }}>
            <span style={{ fontFamily: PF, fontSize: 6, color: C.acc }}>
              ⚡ RANDOM EVENT: {activeRandomEvent.title || activeRandomEvent.event_type?.toUpperCase()}!
            </span>
            {activeRandomEvent.description && (
              <div style={{ fontFamily: BF, fontSize: 10, color: C.dim, marginTop: 3 }}>
                {activeRandomEvent.description}
              </div>
            )}
          </div>
        )}

        {/* Side Quest Banner */}
        {activeSideQuest && (
          <div style={{
            maxWidth: 700, margin: "0 auto 10px",
            padding: "8px 16px",
            background: "rgba(181,80,136,0.1)",
            border: "1px solid rgba(181,80,136,0.4)",
            borderRadius: 8, textAlign: "center",
          }}>
            <span style={{ fontFamily: PF, fontSize: 6, color: "#b55088" }}>
              🏆 SIDE QUEST AKTIV: {activeSideQuest.title}
            </span>
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          {[
            { id: "modes", label: "🎮 Spilmodes", desc: "14 modes" },
            { id: "worlds", label: "🗺️ Verdener", desc: "Sprints" },
          ].map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              fontFamily: PF, fontSize: 6,
              padding: "6px 14px",
              background: tab === tb.id ? C.acc + "22" : "rgba(255,255,255,0.04)",
              border: `2px solid ${tab === tb.id ? C.acc : "rgba(255,255,255,0.1)"}`,
              borderRadius: 6, color: tab === tb.id ? C.acc : C.dim,
              cursor: "pointer", transition: "all 0.15s",
            }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* MODES TAB */}
        {tab === "modes" && (
          <div style={{ maxWidth: 820, margin: "0 auto" }}>

            {/* Recommender toggle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <button
                onClick={() => setShowRecommender(v => !v)}
                style={{
                  fontFamily: BF, fontSize: 12,
                  padding: "8px 18px",
                  background: showRecommender ? "rgba(254,174,52,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${showRecommender ? C.acc + "88" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 8, color: showRecommender ? C.acc : C.txt,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                🧭 {showRecommender ? "Skjul anbefaler" : "Hjælp mig vælge →"}
                {recommendedTop && !showRecommender && (
                  <span style={{ fontSize: 10, color: C.dim }}>
                    (anbefaler: {ALL_MODES.find(m => m.id === recommendedTop)?.name})
                  </span>
                )}
              </button>
            </div>

            {/* Situational Recommender */}
            {showRecommender && (
              <div style={{ marginBottom: 16, animation: "slideUp 0.2s both" }}>
                <SituationalRecommender onSelect={handleRecommenderSelect} />
              </div>
            )}

            {/* Zone sections */}
            {zoneOrder.map(zone => {
              const meta = ZONE_META[zone];
              const modes = modesByZone[zone];
              return (
                <div key={zone} style={{ marginBottom: 20 }}>
                  {/* Zone header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 10, padding: "6px 0",
                    borderBottom: `1px solid ${meta.color}33`,
                  }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <span style={{ fontFamily: PF, fontSize: 7, color: meta.color, letterSpacing: 2 }}>
                      {meta.label.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: BF, fontSize: 11, color: C.dim }}>
                      {modes.length} modes
                    </span>
                  </div>

                  {/* Mode portals */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "flex-start" }}>
                    {modes.map((mode, i) => {
                      const modeActiveMissions = activeMissions.filter(m =>
                        m.required_mode === mode.id || m.mode === mode.id
                      );
                      const modeHasRandomEvent = activeRandomEvent &&
                        (activeRandomEvent.mode_id === mode.id || activeRandomEvent.event_type === "mystery_mode");
                      return (
                        <div
                          key={mode.id}
                          style={{ animation: `slideUp 0.2s ${i * 0.04}s both` }}
                          onMouseEnter={() => { setHov(mode.id); sound("click"); }}
                          onMouseLeave={() => setHov(null)}
                        >
                          <ModePortal
                            mode={mode}
                            hovered={hov === mode.id}
                            t={t}
                            onClick={() => handleModeSelect(mode)}
                            isRecommended={recommendedTop === mode.id}
                            missions={modeActiveMissions}
                            hasRandomEvent={modeHasRandomEvent}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WORLDS TAB */}
        {tab === "worlds" && (
          <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", animation: "slideUp 0.3s" }}>
            {WORLDS.map((w, i) => (
              <div key={w.id} style={{ animation: `slideUp 0.3s ${i * 0.1}s both` }}
                onMouseEnter={() => { setHov(w.id); sound("click"); }}
                onMouseLeave={() => setHov(null)}>
                <Portal w={w} hovered={hov === w.id} t={t} onClick={() => handleSelect(w)} availability={availability[w.id]} />
              </div>
            ))}
          </div>
        )}

        {/* Hall of Fame */}
        {organizationId && (
          <div style={{
            marginTop: 24, padding: "10px 16px",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(200,168,75,0.2)",
            borderRadius: 10, maxWidth: 700, margin: "24px auto 0",
          }}>
            <div style={{ fontFamily: PF, fontSize: "6px", color: C.gld, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
              🏆 HALL OF FAME
            </div>
            <Leaderboard orgId={organizationId} mode="mini" category="xp" showCategoryTabs={false} maxRows={3} />
          </div>
        )}
      </div>
    </div>
  );
}
