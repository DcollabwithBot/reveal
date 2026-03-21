import { useState, useEffect } from "react";
import { C, PF, BF, NPC_TEAM, CLASSES, WORLDS } from "../shared/constants.js";
import { dk } from "../shared/utils.js";

// ─── Fake data ───────────────────────────────────────────────────────────────
const DEMO_WORLDS = WORLDS.slice(0, 3);
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];
const DEMO_TEAM = [
  { id: 1, name: "Du", isP: true, lv: 3, cls: CLASSES[0], hat: "#f04f78", body: "#f04f78", skin: "#fdd" },
  ...NPC_TEAM,
];
const DEMO_STORY = { title: "Checkout flow redesign", desc: "Redesign af hele checkout-flowet med ny betalingsgateway" };

// ─── Pixel Sprite (from WorldSelect) ─────────────────────────────────────────
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

// ─── Torch (from WorldSelect) ────────────────────────────────────────────────
function Torch({ x, y, size = 1 }) {
  const [t, setT] = useState(Math.floor(Math.random() * 100));
  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 60); return () => clearInterval(i); }, []);
  const s = size;
  const WO = "#5a3a20";
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%` }}>
      <div style={{ width: `${6 * s}px`, height: `${18 * s}px`, background: WO, margin: "0 auto" }} />
      <div style={{ position: "absolute", top: `${-10 * s}px`, left: "50%", transform: "translateX(-50%)" }}>
        <div style={{ width: `${5 + Math.sin(t * 0.3) * 2}px`, height: `${9 + Math.sin(t * 0.25) * 3}px`, background: "#ff6030", borderRadius: `${3 * s}px ${3 * s}px 0 0`, margin: "0 auto", opacity: 0.9 }} />
        <div style={{ width: `${3 + Math.sin(t * 0.35) * 1.5}px`, height: `${6 + Math.sin(t * 0.3) * 2}px`, background: "#ffaa30", borderRadius: `${2 * s}px ${2 * s}px 0 0`, margin: `${-5 * s}px auto 0` }} />
        <div style={{ width: `${2 + Math.sin(t * 0.4) * 1}px`, height: `${3 + Math.sin(t * 0.35) * 1}px`, background: "#ffe477", borderRadius: `${s}px ${s}px 0 0`, margin: `${-2 * s}px auto 0` }} />
      </div>
    </div>
  );
}

// ─── World Portal (from WorldSelect) ─────────────────────────────────────────
const ST = "#4a4460", SD = "#3a3450";
function Portal({ w, hovered: isH, t, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer", transition: "all 0.25s", transform: isH ? "scale(1.06) translateY(-4px)" : "scale(1)", width: "170px" }}>
      <div style={{ width: "170px", position: "relative" }}>
        <div style={{ width: "170px", height: "22px", background: ST, borderRadius: "6px 6px 0 0", border: `3px solid ${SD}`, borderBottom: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: PF, fontSize: "5px", color: w.color, letterSpacing: "1px" }}>{w.lv}</span>
        </div>
        <div style={{ width: "164px", height: "95px", margin: "0 3px", overflow: "hidden", position: "relative", border: `3px solid ${isH ? w.color : SD}`, borderTop: "none", boxShadow: isH ? `0 0 20px ${w.color}44, inset 0 0 15px ${w.color}22` : "none", transition: "all 0.3s" }}>
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

// ─── Dungeon Background ──────────────────────────────────────────────────────
const WL = "#2a1f3d", WD = "#1a1230", FL = "#3a2820", FD = "#281a14", WO = "#5a3a20";

function DungeonBg() {
  return (
    <>
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
    </>
  );
}

// ─── Scanlines overlay ───────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)",
    }} />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: WORLD MAP
// ═════════════════════════════════════════════════════════════════════════════
function WorldMapPhase({ onNext }) {
  const [t, setT] = useState(0);
  const [hov, setHov] = useState(null);
  const [selectedWorld, setSelectedWorld] = useState(null);

  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);

  const NPC_DEFS = [
    { name: "Mia", cls: CLASSES[1], hat: "#b55088", body: "#b55088", skin: "#fed", px: 18, py: 62 },
    { name: "Jonas", cls: CLASSES[4], hat: "#38b764", body: "#257953", skin: "#edc", px: 75, py: 65 },
  ];

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <DungeonBg />

      {/* NPCs wandering */}
      {NPC_DEFS.map((m, i) => (
        <div key={m.name} style={{ position: "absolute", left: `${m.px + Math.sin(t * 0.008 + i * 2) * 4}%`, top: `${m.py}%`, animation: `charWalk ${3 + i}s ease-in-out infinite`, zIndex: 3 }}>
          <Spr hat={m.hat} body={m.body} skin={m.skin} cls={m.cls} size={1.5} dir={Math.sin(t * 0.008 + i * 2) > 0 ? 1 : -1} label={m.name} />
        </div>
      ))}

      {/* Player character */}
      <div style={{ position: "absolute", left: "46%", top: "55%", zIndex: 4 }}>
        <Spr hat="#f04f78" body="#f04f78" skin="#fdd" cls={CLASSES[0]} size={2.3} anim="float 2s ease-in-out infinite" label="Du" />
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
          <div style={{ fontFamily: PF, fontSize: "5px", color: CLASSES[0].color, padding: "3px 10px", background: CLASSES[0].color + "22", border: `2px solid ${CLASSES[0].color}`, display: "flex", alignItems: "center", gap: "4px" }}>
            <span>{CLASSES[0].icon}</span>
            <span>{CLASSES[0].name}</span>
            <span>👑</span>
            <span>⚔️</span>
          </div>
        </div>

        {/* World portals */}
        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap", animation: "slideUp 0.3s" }}>
          {DEMO_WORLDS.map((w, i) => {
            const isSelected = selectedWorld === w.id;
            return (
              <div key={w.id} style={{
                animation: `slideUp 0.3s ${i * 0.1}s both`,
                position: "relative",
                border: isSelected ? `2px solid var(--jade, ${C.grn})` : "2px solid transparent",
                borderRadius: 8,
                padding: 2,
                transition: "border-color 0.2s",
              }}
                onMouseEnter={() => setHov(w.id)}
                onMouseLeave={() => setHov(null)}>
                <Portal w={w} hovered={hov === w.id || isSelected} t={t} onClick={() => setSelectedWorld(w.id)} />
                {isSelected && (
                  <div style={{
                    position: "absolute", top: 4, right: 4,
                    fontFamily: PF, fontSize: "5px", color: C.grn,
                    background: C.bg + "dd", padding: "2px 5px",
                    border: `1px solid ${C.grn}`, zIndex: 6,
                  }}>
                    VALGT ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "22px" }}>
          <button
            onClick={selectedWorld ? onNext : undefined}
            disabled={!selectedWorld}
            style={{
              fontFamily: PF, fontSize: "7px",
              color: selectedWorld ? C.bg : C.dim,
              background: selectedWorld ? C.grn : C.bgL,
              border: `2px solid ${selectedWorld ? C.grnD : C.brd}`,
              padding: "10px 24px",
              cursor: selectedWorld ? "pointer" : "not-allowed",
              letterSpacing: "1px",
              boxShadow: selectedWorld ? `0 0 20px ${C.grn}44` : "none",
              animation: selectedWorld ? "pulse 2s infinite" : "none",
              transition: "all 0.3s",
            }}
          >
            {selectedWorld
              ? `▶ START ${(DEMO_WORLDS.find(w => w.id === selectedWorld)?.name || "").toUpperCase()} →`
              : "▶ VÆLG ET WORLD"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: PLANNING POKER SESSION
// ═════════════════════════════════════════════════════════════════════════════
function PokerPhase({ onNext }) {
  const [t, setT] = useState(0);
  const [userVote, setUserVote] = useState(null);
  const [teamVotes, setTeamVotes] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [xpFloat, setXpFloat] = useState(false);
  const [bossHp, setBossHp] = useState(100);
  const [bossHit, setBossHit] = useState(false);
  const [combo, setCombo] = useState(0);
  const [dmgNums, setDmgNums] = useState([]);

  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);

  const mc = C.blu; // poker node color

  function handleCardClick(val) {
    if (userVote !== null) return;
    setUserVote(val);

    const others = DEMO_TEAM.filter(m => !m.isP);
    others.forEach((member, i) => {
      const delay = 600 + Math.random() * 1000;
      setTimeout(() => {
        // Jonas always votes low for outlier drama
        const vote = member.name === "Jonas" ? 2 : [3, 5, 5, 8][Math.floor(Math.random() * 4)];
        setTeamVotes(prev => ({ ...prev, [member.id]: vote }));

        if (i === others.length - 1) {
          setTimeout(() => {
            setRevealed(true);
            setCombo(3);
            setXpFloat(true);
            // Boss damage animation
            setBossHit(true);
            setBossHp(62);
            setDmgNums([{ id: Date.now(), val: 38, x: 50 }]);
            setTimeout(() => { setBossHit(false); setXpFloat(false); }, 800);
            setTimeout(() => setDmgNums([]), 1500);
          }, 400);
        }
      }, delay);
    });
  }

  const allVoted = Object.keys(teamVotes).length === DEMO_TEAM.filter(m => !m.isP).length;

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: C.bg }}>
      {/* Scene background */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 50% 30%, ${mc}08, transparent 70%)` }} />

      <div style={{ position: "relative", zIndex: 5, padding: "12px 16px", maxWidth: 820, margin: "0 auto" }}>
        {/* Session header */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: PF, fontSize: "5px", color: C.dim, letterSpacing: "2px", marginBottom: 4 }}>WORLD 1 — PLATFORM TEAM</div>
          <div style={{ fontFamily: PF, fontSize: "8px", color: mc, letterSpacing: "1px" }}>🃏 PLANNING POKER</div>
        </div>

        {/* Boss HP bar */}
        <div style={{ maxWidth: 500, margin: "0 auto 16px", padding: "8px 14px", background: C.bg + "cc", border: `1px solid ${C.brd}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: PF, fontSize: "5px", color: C.red }}>👾 DELIVERY PRESSURE</span>
            <span style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>{bossHp}/100 HP</span>
          </div>
          <div style={{ height: 6, background: C.bgL, borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{
              height: "100%", width: `${bossHp}%`,
              background: bossHp > 50 ? C.red : C.yel,
              transition: "width 0.8s ease-out",
              boxShadow: `0 0 8px ${C.red}66`,
            }} />
          </div>
          {/* Boss sprite */}
          <div style={{
            textAlign: "center", fontSize: 32, marginTop: 8,
            animation: bossHit ? "bossHit 0.3s" : "bossIdle 2s ease-in-out infinite",
          }}>
            👾
          </div>
          {/* Damage numbers */}
          {dmgNums.map(d => (
            <div key={d.id} style={{
              position: "absolute", left: `${d.x}%`, top: 60,
              fontFamily: PF, fontSize: "10px", color: C.acc,
              animation: "dmgFloat 1.2s ease-out forwards",
              pointerEvents: "none",
            }}>
              -{d.val}
            </div>
          ))}
        </div>

        {/* Combo display */}
        {combo > 0 && revealed && (
          <div style={{ textAlign: "center", marginBottom: 8, animation: "comboPop 0.4s" }}>
            <span style={{ fontFamily: PF, fontSize: "6px", color: C.gld, animation: "comboPulse 1s infinite" }}>
              🔥 COMBO x{combo}
            </span>
          </div>
        )}

        {/* Story card */}
        <div style={{
          maxWidth: 500, margin: "0 auto 14px", padding: "10px 16px",
          background: C.bgC, border: `2px solid ${mc}44`,
          borderRadius: 8,
        }}>
          <div style={{ fontFamily: BF, fontSize: 11, color: C.dim, marginBottom: 2 }}>CURRENT STORY</div>
          <div style={{ fontFamily: PF, fontSize: "6px", color: C.txt }}>{DEMO_STORY.title}</div>
          <div style={{ fontFamily: BF, fontSize: 12, color: C.dim, marginTop: 2 }}>{DEMO_STORY.desc}</div>
        </div>

        {/* Team sprites row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          {DEMO_TEAM.map(m => {
            const voted = m.isP ? userVote !== null : teamVotes[m.id] !== undefined;
            const voteVal = m.isP ? userVote : teamVotes[m.id];
            return (
              <div key={m.id} style={{ textAlign: "center", position: "relative" }}>
                <Spr hat={m.hat} body={m.body} skin={m.skin} cls={m.cls} size={1.8} label={m.name} />
                {/* Vote indicator */}
                <div style={{
                  marginTop: 4, width: 32, height: 40, margin: "4px auto 0",
                  background: voted ? (revealed ? mc + "22" : C.grn + "22") : C.bgC,
                  border: `2px solid ${voted ? (revealed ? mc : C.grn) : C.brd}`,
                  borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: PF, fontSize: voted && revealed ? "8px" : "5px",
                  color: voted ? (revealed ? mc : C.grn) : C.dim,
                  transition: "all 0.3s",
                  animation: voted && !revealed ? "cardFloat 1.5s ease-in-out infinite" : revealed ? "cardFlip 0.6s" : "none",
                }}>
                  {voted ? (revealed ? voteVal : "✓") : "?"}
                </div>
                {/* XP floater on user */}
                {m.isP && xpFloat && (
                  <div style={{
                    position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
                    fontFamily: PF, fontSize: "5px", color: C.xp,
                    animation: "dmgFloat 2s ease-out forwards",
                    pointerEvents: "none", whiteSpace: "nowrap",
                  }}>
                    +50 XP ⭐
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Fibonacci cards */}
        {!revealed && (
          <div style={{ maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontFamily: BF, fontSize: 13, color: C.dim, textAlign: "center", marginBottom: 8 }}>
              {userVote === null ? "Vælg dit estimat:" : `Du valgte ${userVote} — venter på teamet…`}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {FIBONACCI.map((n, i) => (
                <button
                  key={n}
                  onClick={() => handleCardClick(n)}
                  disabled={userVote !== null}
                  style={{
                    width: 48, height: 64,
                    background: userVote === n ? mc : C.bgC,
                    color: userVote === n ? C.bg : C.txt,
                    border: `2px solid ${userVote === n ? mc : C.brd}`,
                    borderRadius: 6, fontFamily: PF, fontSize: "8px",
                    cursor: userVote !== null ? "default" : "pointer",
                    transition: "all 0.2s",
                    boxShadow: userVote === n ? `0 0 12px ${mc}66` : "none",
                    animation: `cardDrop 0.3s ${i * 0.05}s both`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Revealed results */}
        {revealed && (
          <div style={{ maxWidth: 500, margin: "0 auto", animation: "slideUp 0.3s" }}>
            {/* Outlier warning */}
            <div style={{
              padding: "8px 14px", marginBottom: 12,
              background: C.yel + "15", border: `2px solid ${C.yel}55`,
              borderRadius: 8, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: PF, fontSize: "5px", color: C.yel }}>OUTLIER DETECTED</div>
                <div style={{ fontFamily: BF, fontSize: 12, color: C.dim }}>Jonas estimerer markant lavere end resten — drøft!</div>
              </div>
            </div>

            {/* Loot drops */}
            <div style={{
              display: "flex", justifyContent: "center", gap: 10, marginBottom: 14,
              animation: "lootDrop 0.5s 0.3s both",
            }}>
              {[
                { icon: "⚔️", label: "Iron Sword", rarity: "Common", color: C.grn },
                { icon: "✨", label: "+50 XP", rarity: "Bonus", color: C.xp },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: "6px 12px", background: item.color + "12",
                  border: `1px solid ${item.color}44`, borderRadius: 6,
                  textAlign: "center", animation: `lootBounce 0.6s ${0.5 + i * 0.15}s both`,
                }}>
                  <div style={{ fontSize: 18 }}>{item.icon}</div>
                  <div style={{ fontFamily: PF, fontSize: "4px", color: item.color }}>{item.label}</div>
                  <div style={{ fontFamily: BF, fontSize: 9, color: C.dim }}>{item.rarity}</div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                onClick={onNext}
                style={{
                  fontFamily: PF, fontSize: "6px", color: C.bg,
                  background: C.grn, border: `2px solid ${C.grnD}`,
                  padding: "8px 20px", cursor: "pointer",
                  boxShadow: `0 0 16px ${C.grn}44`,
                }}
              >
                SE LEADERBOARD →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3: LEADERBOARD + CTA
// ═════════════════════════════════════════════════════════════════════════════
const LEADERBOARD = [
  { ...NPC_TEAM[3], xp: 3200 }, // Emil
  { ...NPC_TEAM[0], xp: 2840 }, // Mia
  { ...NPC_TEAM[2], xp: 1920 }, // Sara
  { ...DEMO_TEAM[0], xp: 1450 }, // Du
  { ...NPC_TEAM[1], xp: 980 },  // Jonas
];

function LeaderboardPhase() {
  const [showAch, setShowAch] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowAch(true), 800); return () => clearTimeout(t); }, []);

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: C.bg }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 50% 20%, ${C.gld}06, transparent 60%)` }} />

      <div style={{ position: "relative", zIndex: 5, padding: "16px", maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: PF, fontSize: "12px", color: C.gld, letterSpacing: "3px", animation: "victoryPulse 3s ease-in-out infinite" }}>
            🏆 HALL OF FAME
          </div>
          <div style={{ fontFamily: BF, fontSize: 14, color: C.dim, marginTop: 4 }}>Session Complete — Team XP</div>
        </div>

        {/* Leaderboard rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {LEADERBOARD.map((m, i) => {
            const isUser = m.isP;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                background: isUser ? C.acc + "12" : C.bgC,
                border: `2px solid ${isUser ? C.acc + "55" : C.brd}`,
                borderRadius: 8,
                animation: `slideUp 0.3s ${i * 0.1}s both`,
              }}>
                {/* Rank */}
                <div style={{ fontFamily: PF, fontSize: medal ? "10px" : "6px", width: 28, textAlign: "center", color: medal ? C.gld : C.dim }}>
                  {medal || `${i + 1}.`}
                </div>
                {/* Character sprite (small) */}
                <Spr hat={m.hat} body={m.body} skin={m.skin} cls={m.cls} size={1.2} idle={false} />
                {/* Name + class */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: PF, fontSize: "5px", color: isUser ? C.acc : C.txt }}>{m.name}</div>
                  <div style={{ fontFamily: BF, fontSize: 10, color: C.dim }}>{m.cls.icon} {m.cls.name} — Lv.{m.lv}</div>
                </div>
                {/* XP */}
                <div style={{ fontFamily: PF, fontSize: "5px", color: C.xp }}>
                  {m.xp.toLocaleString()} XP
                </div>
              </div>
            );
          })}
        </div>

        {/* Achievement popup */}
        {showAch && (
          <div style={{
            padding: "10px 16px", marginBottom: 16,
            background: C.gld + "12", border: `2px solid ${C.gld}44`,
            borderRadius: 8, textAlign: "center",
            animation: "achieveIn 0.5s both",
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🏆</div>
            <div style={{ fontFamily: PF, fontSize: "6px", color: C.gld, letterSpacing: "1px" }}>ACHIEVEMENT UNLOCKED</div>
            <div style={{ fontFamily: BF, fontSize: 14, color: C.txt, marginTop: 2 }}>Første session gennemført!</div>
            <div style={{ fontFamily: BF, fontSize: 11, color: C.dim }}>+100 bonus XP</div>
          </div>
        )}

        {/* CTA */}
        <div style={{
          padding: "20px", background: C.bgC,
          border: `2px solid ${C.grn}33`, borderRadius: 10,
          textAlign: "center",
          animation: "slideUp 0.4s 0.6s both",
        }}>
          <div style={{ fontFamily: PF, fontSize: "7px", color: C.txt, marginBottom: 6 }}>
            DETTE VAR EN DEMO
          </div>
          <div style={{ fontFamily: BF, fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 14, maxWidth: 420, margin: "0 auto 14px" }}>
            I den rigtige app gemmer sessionen estimater til dit PM-board, tracker nøjagtighed over tid, og dit team optjener XP og loot. Klar til at prøve med dit team?
          </div>
          <button
            onClick={() => { window.location.href = "/login"; }}
            style={{
              fontFamily: PF, fontSize: "7px", color: C.bg,
              background: C.grn, border: `2px solid ${C.grnD}`,
              padding: "12px 28px", cursor: "pointer",
              letterSpacing: "1px",
              boxShadow: `0 0 24px ${C.grn}44`,
              animation: "pulse 2s infinite",
            }}
          >
            ⚔️ START GRATIS
          </button>
          <div style={{ fontFamily: BF, fontSize: 11, color: C.dim, marginTop: 8 }}>
            Gratis for op til 5 teammedlemmer
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DEMO SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function DemoScreen() {
  const [phase, setPhase] = useState("worldMap"); // worldMap | poker | leaderboard
  const [flash, setFlash] = useState(null);

  function transition(next) {
    const colors = { poker: C.grn, leaderboard: C.gld };
    setFlash(colors[next] || C.acc);
    setTimeout(() => { setFlash(null); setPhase(next); }, 400);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, position: "relative" }}>
      {/* Flash transition */}
      {flash && <div style={{ position: "fixed", inset: 0, background: flash, opacity: 0.4, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.5s ease-out forwards" }} />}

      {/* Scanlines */}
      <Scanlines />

      {/* Fixed topbar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "8px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.bg + "ee", backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${C.brd}`,
      }}>
        <a href="/" style={{
          fontFamily: PF, fontSize: "8px", color: C.acc,
          textDecoration: "none", letterSpacing: "2px",
        }}>
          ⚔️ REVEAL
        </a>
        <div style={{
          fontFamily: PF, fontSize: "4px", color: C.gld,
          background: C.gld + "18", border: `1px solid ${C.gld}44`,
          padding: "3px 10px", letterSpacing: "2px",
        }}>
          DEMO MODE
        </div>
        <a href="/login" style={{
          fontFamily: PF, fontSize: "5px", color: C.grn,
          textDecoration: "none",
          border: `1px solid ${C.grn}`, padding: "4px 12px",
        }}>
          LOG IND →
        </a>
      </div>

      {/* Phase stepper */}
      <div style={{
        position: "fixed", top: 42, left: 0, right: 0, zIndex: 99,
        display: "flex", justifyContent: "center", gap: 6, padding: "6px 0",
        background: C.bg + "cc",
      }}>
        {[
          { id: "worldMap", label: "🗺️ WORLD MAP", color: C.acc },
          { id: "poker", label: "🃏 POKER", color: C.blu },
          { id: "leaderboard", label: "🏆 RESULTAT", color: C.gld },
        ].map((p, i) => (
          <div key={p.id} style={{
            fontFamily: PF, fontSize: "4px",
            color: phase === p.id ? p.color : C.dim,
            padding: "2px 8px",
            borderBottom: phase === p.id ? `2px solid ${p.color}` : "2px solid transparent",
            transition: "all 0.3s",
          }}>
            {p.label}
          </div>
        ))}
      </div>

      {/* Content with top padding for fixed bars */}
      <div style={{ paddingTop: 70 }}>
        {phase === "worldMap" && <WorldMapPhase onNext={() => transition("poker")} />}
        {phase === "poker" && <PokerPhase onNext={() => transition("leaderboard")} />}
        {phase === "leaderboard" && <LeaderboardPhase />}
      </div>
    </div>
  );
}
