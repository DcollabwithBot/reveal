import { useState, useEffect, useRef } from "react";
import { C, PF, BF, CLASSES, NPC_TEAM, ROULETTE_CHALLENGES } from "../shared/constants.js";
import { dk, pick } from "../shared/utils.js";
import RouletteOverlay from "../components/RouletteOverlay.jsx";
const PV = [1, 2, 3, 5, 8, 13, 21];
function clamp(v) { let b = PV[0]; for (const p of PV) if (Math.abs(p - v) < Math.abs(b - v)) b = p; return b; }
function gv(pv, sp = 2) { return NPC_TEAM.map(m => ({ mid: m.id, val: clamp(Math.max(1, pv + Math.round((Math.random() - 0.5) * sp * 2))) })); }

const CHAL = [
  { i: "🏖️", t: "IT HAR FERIE!", d: "Nøglepersonen er væk i 2 uger!" },
  { i: "🔄", t: "KRAV ÆNDRET!", d: "Kunden vil noget helt andet!" },
  { i: "📉", t: "USTABILT!", d: "API'et crasher under load!" },
  { i: "📄", t: "DOCS MANGLER!", d: "Ingen spec overhovedet!" },
  { i: "🧑‍💻", t: "SINGLE POK!", d: "Kun én forstår den kode!" },
];
const ACHIEVEMENTS = [
  { id: "first", name: "FIRST BLOOD", icon: "🩸", desc: "Første vote i sessionen" },
  { id: "risk", name: "RISK HUNTER", icon: "🔍", desc: "Spillede et risk card" },
  { id: "power", name: "POWER PLAYER", icon: "⚡", desc: "Brugte en power-up" },
  { id: "sniper", name: "ESTIMATION SNIPER", icon: "🎯", desc: "Ramte tæt på gennemsnittet" },
  { id: "team", name: "TEAM PLAYER", icon: "🤝", desc: "Alle havde lav spredning" },
  { id: "brave", name: "BRAVE SOUL", icon: "💪", desc: "Confidence 5/5" },
  { id: "roulette", name: "SCOPE SURVIVOR", icon: "🎰", desc: "Overlevede en Roulette-udfordring" },
];

function Scene({ children, mc = C.acc }) {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);
  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: `linear-gradient(${180 + Math.sin(t * 0.003) * 2}deg,${C.skyL},${C.sky})` }} />
      <div style={{ position: "absolute", top: `${7 + Math.sin(t * 0.005) * 2}%`, right: "10%", width: "36px", height: "36px", borderRadius: "50%", background: "#ffe477", boxShadow: `0 0 ${25 + Math.sin(t * 0.02) * 10}px #ffe47744, 0 0 ${50 + Math.sin(t * 0.02) * 20}px #ffe47722` }} />
      {[{ l: 3, tp: 8, w: 100, sp: 0.015 }, { l: 28, tp: 4, w: 70, sp: 0.01 }, { l: 58, tp: 13, w: 85, sp: 0.013 }, { l: 83, tp: 6, w: 60, sp: 0.018 }].map((c, i) =>
        <div key={i} style={{ position: "absolute", left: `${(c.l + t * c.sp) % 115}%`, top: `${c.tp}%`, opacity: 0.45 + Math.sin(t * 0.008 + i) * 0.1 }}>
          <div style={{ width: `${c.w}px`, height: `${c.w * 0.32}px`, background: "#fff" }} />
          <div style={{ width: `${c.w * 0.5}px`, height: `${c.w * 0.2}px`, background: "#fff", marginTop: `${-c.w * 0.12}px`, marginLeft: `${c.w * 0.18}px` }} />
        </div>)}
      {[{ x: 15, y: 10, s: 0.04 }, { x: 55, y: 7, s: 0.03 }, { x: 85, y: 14, s: 0.025 }].map((bd, i) =>
        <div key={`bd${i}`} style={{ position: "absolute", left: `${(bd.x + t * bd.s) % 110}%`, top: `${bd.y + Math.sin(t * 0.06 + i * 3) * 1.5}%`, fontSize: "9px", transform: `scaleX(${Math.sin(t * 0.12 + i) > 0 ? 1 : -1})` }}>🐦</div>)}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "58%", background: `linear-gradient(180deg,${C.grs},${C.grsD})` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8%", background: `linear-gradient(180deg,${C.drt},${C.drtD})` }} />
      {Array.from({ length: 40 }).map((_, i) =>
        <div key={`gr${i}`} style={{ position: "absolute", bottom: `${44 + Math.sin(i * 1.1) * 4}%`, left: `${1 + i * 2.5}%`, width: "3px", height: `${5 + Math.sin(t * 0.05 + i * 0.7) * 2}px`, background: C.grsL, opacity: 0.35, transform: `rotate(${Math.sin(t * 0.04 + i) * 10}deg)`, transformOrigin: "bottom" }} />)}
      {[{ l: "8%", b: "47%" }, { l: "22%", b: "50%" }, { l: "45%", b: "48%" }, { l: "72%", b: "51%" }, { l: "90%", b: "46%" }].map((f, i) =>
        <div key={`fl${i}`} style={{ position: "absolute", left: f.l, bottom: f.b, fontSize: `${7 + Math.sin(t * 0.03 + i) * 1}px`, animation: `float ${2 + i % 3}s ease-in-out ${i * 0.4}s infinite` }}>{["🌸", "🌼", "🌺", "💮", "🌻"][i % 5]}</div>)}
      {[{ l: "2%", b: "48%" }, { l: "94%", b: "46%" }, { l: "12%", b: "53%" }, { l: "84%", b: "51%" }].map((tr, i) =>
        <div key={`tr${i}`} style={{ position: "absolute", left: tr.l, bottom: tr.b, transform: `rotate(${Math.sin(t * 0.015 + i * 2) * 1.5}deg)`, transformOrigin: "bottom" }}>
          <div style={{ width: "7px", height: "18px", background: C.drtD, margin: "0 auto" }} />
          <div style={{ width: "26px", height: "20px", background: C.grsD, marginTop: "-3px", marginLeft: "-9px" }} />
          <div style={{ width: "16px", height: "12px", background: C.grs, marginTop: "-4px", marginLeft: "-4px" }} />
        </div>)}
      {Array.from({ length: 15 }).map((_, i) =>
        <div key={`pt${i}`} style={{ position: "absolute", left: `${(i * 7 + t * 0.025 * ((i % 3) + 1)) % 105}%`, top: `${18 + Math.sin(t * 0.018 + i * 1.5) * 28}%`, width: `${3 + i % 3 * 2}px`, height: `${3 + i % 3 * 2}px`, borderRadius: "50%", background: [C.gld, C.acc, C.xp, C.grnL][i % 4], opacity: 0.12 + Math.sin(t * 0.025 + i) * 0.08 }} />)}
      {[{ x: 30, y: 35 }, { x: 65, y: 28 }].map((bf, i) =>
        <div key={`bf${i}`} style={{ position: "absolute", left: `${bf.x + Math.sin(t * 0.02 + i * 5) * 8}%`, top: `${bf.y + Math.cos(t * 0.025 + i * 3) * 5}%`, fontSize: "10px", transform: `scaleX(${Math.sin(t * 0.2 + i) > 0 ? 1 : -1})` }}>🦋</div>)}
      <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: "50%", height: "30%", background: `radial-gradient(ellipse,${mc}${(10 + Math.round(Math.sin(t * 0.02) * 5)).toString(16).padStart(2, "0")} 0%,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

function Sprite({ m, size = 1, anim, attacking, hit, idle = true }) {
  const [t, setT] = useState(0);
  useEffect(() => { if (!idle) return; const i = setInterval(() => setT(v => v + 1), 80); return () => clearInterval(i); }, [idle]);
  const s = size, w = Math.round(16 * s), cl = m.cls || CLASSES[0];
  const br = idle ? Math.sin(t * 0.25) * s * 0.4 : 0, blink = idle && t % 35 < 2;
  const look = idle ? Math.sin(t * 0.08) > 0.7 ? "r" : Math.sin(t * 0.08) < -0.7 ? "l" : "c" : "c";
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {attacking && <div style={{ position: "absolute", top: `${-15 * s}px`, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
        <div style={{ fontSize: `${8 * s}px`, animation: "spellFly 0.7s ease-out forwards", filter: `drop-shadow(0 0 ${4 * s}px ${cl.trail})` }}>{cl.proj}</div>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: `${12 * s}px`, height: `${12 * s}px`, borderRadius: "50%", background: `radial-gradient(circle,${cl.trail}66,transparent)`, animation: "spellGlow 0.5s ease-out forwards" }} />
        {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ position: "absolute", left: `${50 + Math.cos(i * 1.05) * 15}%`, top: `${50 + Math.sin(i * 1.05) * 15 + i * 5}%`, width: `${(5 - i) * s}px`, height: `${(5 - i) * s}px`, background: cl.trail, borderRadius: "50%", opacity: 0.6 - i * 0.08, animation: `trailFade 0.3s ease-out ${i * 0.04}s forwards` }} />)}
      </div>}
      {hit && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: C.red, opacity: 0.4, animation: "flashOut 0.2s ease-out forwards", zIndex: 5 }} />}
      <div style={{ position: "relative", width: `${w * 1.4}px`, animation: anim || "none" }}>
        <div style={{ position: "absolute", bottom: `${-2 * s}px`, left: "50%", transform: "translateX(-50%)", width: `${w * 1.4}px`, height: `${3 * s}px`, background: "rgba(0,0,0,0.2)", borderRadius: "50%" }} />
        <div style={{ width: `${w}px`, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: `${4 * s}px`, marginBottom: `${-0.5 * s}px`, opacity: 0.6, animation: idle ? "float 2s ease-in-out infinite" : "none" }}>{cl.icon}</div>
          <div style={{ width: `${w * 1.1}px`, height: `${4 * s}px`, background: m.hat || cl.color, margin: "0 auto" }} />
          <div style={{ width: `${w * 0.9}px`, height: `${3 * s}px`, background: dk(m.hat || cl.color), margin: "-1px auto 0" }} />
          <div style={{ width: `${w * 0.8}px`, height: `${(8 + br * 0.15) * s}px`, background: m.skin || "#fdd", margin: "0 auto", position: "relative", transition: "height 0.2s" }}>
            {!blink && <><div style={{ position: "absolute", top: `${3 * s}px`, left: `${(look === "l" ? 1 : look === "r" ? 3 : 2) * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg, transition: "left 0.2s" }} /><div style={{ position: "absolute", top: `${3 * s}px`, right: `${(look === "r" ? 1 : look === "l" ? 3 : 2) * s}px`, width: `${2 * s}px`, height: `${2 * s}px`, background: C.bg, transition: "right 0.2s" }} /></>}
            {blink && <div style={{ position: "absolute", top: `${4 * s}px`, left: `${1.5 * s}px`, right: `${1.5 * s}px`, height: `${s}px`, background: C.bg }} />}
          </div>
          <div style={{ width: `${w}px`, height: `${(10 + br * 0.2) * s}px`, background: m.body || m.hat || cl.color, margin: "0 auto", position: "relative", transition: "height 0.2s" }}>
            <div style={{ position: "absolute", right: `${-4 * s}px`, top: `${2 * s}px`, fontSize: `${4 * s}px`, transform: `rotate(${-30 + Math.sin((t || 0) * 0.12) * 6}deg)`, opacity: 0.8, transition: "transform 0.2s" }}>{cl.icon}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: `${2 * s}px` }}>
            <div style={{ width: `${5 * s}px`, height: `${5 * s + (idle ? Math.sin(t * 0.18) * s * 0.3 : 0)}px`, background: dk(m.body || m.hat || cl.color, 60), transition: "height 0.2s" }} />
            <div style={{ width: `${5 * s}px`, height: `${5 * s - (idle ? Math.sin(t * 0.18) * s * 0.3 : 0)}px`, background: dk(m.body || m.hat || cl.color, 60), transition: "height 0.2s" }} />
          </div>
        </div>
      </div>
      <div style={{ fontFamily: PF, fontSize: `${Math.max(5, 2.8 * s)}px`, color: C.wht, marginTop: `${2 * s}px`, textShadow: `0 0 3px ${C.bg}`, background: C.bg + "cc", padding: "1px 4px" }}>{m.name}</div>
      <div style={{ fontFamily: PF, fontSize: `${Math.max(4, 2 * s)}px`, color: C.gld, background: C.bg + "88", padding: "0 3px" }}>{cl.icon} LV{m.lv || 3}</div>
      {m.isP && <div style={{ fontFamily: PF, fontSize: `${Math.max(3, 1.8 * s)}px`, color: C.acc, marginTop: "1px", animation: "pulse 1.5s infinite" }}>▼ DIG</div>}
    </div>
  );
}

function Boss({ hp, maxHp, name, hit, defeated }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const hpColor = pct > 60 ? C.grn : pct > 30 ? C.yel : C.red;
  return (
    <div style={{ textAlign: "center", animation: hit ? "bossHit 0.3s" : "none" }}>
      <div style={{ fontFamily: PF, fontSize: "8px", color: C.acc, letterSpacing: "2px", marginBottom: "4px", textShadow: `0 0 8px ${C.acc}44` }}>{name}</div>
      <div style={{ width: "220px", margin: "0 auto", position: "relative" }}>
        <div style={{ height: "14px", background: C.bg, border: `3px solid ${C.brd}`, position: "relative", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${hpColor},${dk(hpColor, -30)})`, transition: "width 0.5s ease-out", boxShadow: `0 0 8px ${hpColor}44` }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "rgba(255,255,255,0.15)" }} />
        </div>
        <div style={{ fontFamily: PF, fontSize: "6px", color: hpColor, marginTop: "2px" }}>{Math.round(hp)}/{maxHp} HP</div>
      </div>
      <div style={{ fontSize: defeated ? "40px" : "50px", marginTop: "8px", filter: hit ? "brightness(2)" : "none", transition: "all 0.2s", animation: defeated ? "bossDeath 1s ease-out forwards" : pct < 30 ? "bossRage 0.5s ease-in-out infinite" : "bossIdle 2s ease-in-out infinite" }}>👾</div>
      {defeated && <div style={{ fontFamily: PF, fontSize: "10px", color: C.acc, marginTop: "4px", animation: "pop 0.5s" }}>DEFEATED!</div>}
    </div>
  );
}

function DmgNum({ value, color = C.acc, x = 50, critical }) {
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: "30%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 20, animation: "dmgFloat 1s ease-out forwards" }}>
      <div style={{ fontFamily: PF, fontSize: critical ? "18px" : "13px", color, textShadow: `0 0 8px ${color}, 2px 2px 0 ${C.bg}`, fontWeight: "bold" }}>
        {critical && "💥 "}{value}{critical && " !"}
      </div>
    </div>
  );
}

function AchievePopup({ achieve, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", top: "12%", left: "50%", transform: "translateX(-50%)", zIndex: 120, animation: "achieveIn 0.5s ease-out" }}>
      <div style={{ background: `linear-gradient(135deg,${C.bgC},${C.bgL})`, border: `3px solid ${C.gld}`, boxShadow: `0 0 25px ${C.gld}44, 0 0 50px ${C.gld}22`, padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "28px", animation: "pop 0.4s" }}>{achieve.icon}</span>
        <div>
          <div style={{ fontFamily: PF, fontSize: "7px", color: C.gld, letterSpacing: "2px" }}>ACHIEVEMENT!</div>
          <div style={{ fontFamily: PF, fontSize: "9px", color: C.wht, marginTop: "2px" }}>{achieve.name}</div>
          <div style={{ fontFamily: BF, fontSize: "14px", color: C.dim }}>{achieve.desc}</div>
        </div>
      </div>
    </div>
  );
}

function ComboDisplay({ count }) {
  if (count < 2) return null;
  return (
    <div style={{ position: "fixed", top: "20%", right: "8%", zIndex: 100, animation: "comboPop 0.4s ease-out" }}>
      <div style={{ fontFamily: PF, fontSize: "14px", color: C.gld, textShadow: `0 0 15px ${C.gld}`, letterSpacing: "2px", animation: "comboPulse 0.8s ease-in-out infinite" }}>{count}x</div>
      <div style={{ fontFamily: PF, fontSize: "7px", color: C.org, textAlign: "center" }}>COMBO!</div>
    </div>
  );
}

function LootDrops({ items, active }) {
  if (!active || !items.length) return null;
  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", margin: "10px 0" }}>
      {items.map((item, i) => (
        <div key={i} style={{ animation: `lootDrop 0.5s ease-out ${i * 0.15}s both` }}>
          <div style={{ width: "48px", height: "48px", background: `linear-gradient(135deg,${C.bgL},${C.bgC})`, border: `3px solid ${item.color || C.gld}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", boxShadow: `0 0 10px ${(item.color || C.gld)}44`, animation: `lootBounce 0.6s ease-out ${0.5 + i * 0.15}s both` }}>{item.icon}</div>
          <div style={{ fontFamily: PF, fontSize: "5px", color: item.color || C.gld, textAlign: "center", marginTop: "3px" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function FlipCard({ value, member, revealed, delay = 0, mc = C.acc }) {
  return (
    <div style={{ perspective: "400px", width: "44px", height: "62px" }}>
      <div style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transition: `transform 0.6s ease ${delay}s`, transform: revealed ? "rotateY(180deg)" : "rotateY(0)" }}>
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", background: `repeating-linear-gradient(45deg,${mc}22,${mc}22 3px,${C.bgC} 3px,${C.bgC} 6px)`, border: `3px solid ${mc}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 6px ${mc}33` }}><span style={{ fontFamily: PF, fontSize: "11px", color: mc, animation: "pulse 1s infinite" }}>?</span></div>
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: `linear-gradient(145deg,${C.bgL},${C.bgC})`, border: `3px solid ${member?.hat || C.acc}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 3px 10px ${(member?.hat || C.acc)}44` }}><span style={{ fontFamily: PF, fontSize: "12px", color: member?.hat || C.txt }}>{value}</span><span style={{ fontFamily: PF, fontSize: "3px", color: C.dim }}>PTS</span></div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, color = C.acc, disabled, large, style: s }) {
  const [p, setP] = useState(false);
  return <button onClick={onClick} disabled={disabled} onMouseDown={() => setP(true)} onMouseUp={() => setP(false)} onMouseLeave={() => setP(false)} style={{ fontFamily: PF, fontSize: large ? "10px" : "8px", color: C.wht, background: disabled ? C.dim : color, border: `3px solid ${disabled ? C.dim : color}`, borderBottom: p ? `3px solid ${color}` : `5px solid ${C.bg}`, borderRight: p ? `3px solid ${color}` : `5px solid ${C.bg}`, padding: large ? "12px 20px" : "8px 14px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transform: p ? "translate(2px,2px)" : "none", transition: "transform 0.05s", letterSpacing: "1px", display: "inline-flex", alignItems: "center", gap: "8px", ...s }}>{children}</button>;
}
function Box({ children, color = C.brd, glow, style: s }) { return <div style={{ border: `3px solid ${color}`, boxShadow: glow ? `0 0 12px ${glow}` : `3px 3px 0 ${C.bg}`, background: C.bgC + "e8", ...s }}>{children}</div>; }

export default function Session({ avatar, node, project, onBack, onComplete, sound }) {
  // Determine mode from node type
  const isR = node?.tp === "r";
  const mc = isR ? C.yel : C.blu;
  const bossName = node?.l || project?.name || "PROJ-142: OAuth2 Login Flow";
  const maxHp = 100;

  // Build team from avatar + NPCs
  const TEAM = [
    {
      id: 1, name: "Du", isP: true, lv: 3,
      cls: avatar?.cls || CLASSES[0],
      hat: avatar?.helmet?.pv || avatar?.cls?.color || "#f04f78",
      body: avatar?.armor?.pv || avatar?.cls?.color || "#f04f78",
      btc: avatar?.boots?.pv || dk(avatar?.cls?.color || "#f04f78", 60),
      skin: avatar?.skin || "#fdd",
    },
    ...NPC_TEAM,
  ];

  const [step, setStep] = useState(0);
  const [pv, setPv] = useState(null);
  const [votes, setVotes] = useState([]);
  const [rdy, setRdy] = useState(false);
  const [rev, setRev] = useState(false);
  const [cd, setCd] = useState(-1);
  const [cv, setCv] = useState(null);
  const [ac, setAc] = useState([]);
  const [bossHp, setBossHp] = useState(maxHp);
  const [bossHit, setBossHit] = useState(false);
  const [bossDead, setBossDead] = useState(false);
  const [atk, setAtk] = useState(false);
  const [npcAtk, setNpcAtk] = useState([]);
  const [npcHits, setNpcHits] = useState([]);
  const [dmgNums, setDmgNums] = useState([]);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [combo, setCombo] = useState(0);
  const [achieves, setAchieves] = useState([]);
  const [showAchieve, setShowAchieve] = useState(null);
  const [loot, setLoot] = useState([]);
  const [showLoot, setShowLoot] = useState(false);
  const [rc, setRc] = useState([]);
  const [ll, setLl] = useState(null);
  const [llr, setLlr] = useState(null);
  const [spellName, setSpellName] = useState(null);
  const finCalled = useRef(false);

  // Roulette states
  const [showRoulette, setShowRoulette] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [initialVote, setInitialVote] = useState(null);
  const [revoting, setRevoting] = useState(false);

  function safeComplete() {
    if (finCalled.current) return;
    finCalled.current = true;
    if (onComplete) onComplete(node?.id);
  }

  function addDmg(val, x, critical = false) { setDmgNums(p => [...p, { id: Date.now() + Math.random(), val, x, critical }]); setTimeout(() => setDmgNums(p => p.slice(1)), 1200); }
  function addAchieve(a) { if (achieves.includes(a.id)) return; setAchieves(p => [...p, a.id]); setShowAchieve(a); sound("achieve"); }
  function doFlash(col) { setFlash(col); setTimeout(() => setFlash(null), 300); }
  function doShake() { setShake(true); setTimeout(() => setShake(false), 400); }
  function doBossHit(dmg) { setBossHit(true); setBossHp(h => Math.max(0, h - dmg)); setTimeout(() => setBossHit(false), 200); sound("hit"); }

  useEffect(() => {
    if (pv === null || rdy) return;
    const timer = setTimeout(() => {
      const v = gv(pv, 2); setVotes(v); setRdy(true);
      v.forEach((vote, i) => {
        setTimeout(() => {
          setNpcAtk(p => [...p, vote.mid]);
          sound("spell");
          setSpellName(TEAM.find(m => m.id === vote.mid)?.cls?.spellName || "ATTACK");
          setTimeout(() => { setSpellName(null); }, 600);
          doBossHit(vote.val * 1.5);
          addDmg(vote.val, 35 + i * 10);
          setTimeout(() => setNpcAtk(p => p.filter(x => x !== vote.mid)), 500);
        }, 400 + i * 500);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [pv, rdy]);

  function handleChallengeComplete(challenge) {
    setActiveChallenge(challenge);
    setShowRoulette(false);
    setRevoting(true);
    // Boss regen
    const bonusHp = Math.round(maxHp * (challenge.modifier - 1.0) * 0.4);
    setBossHp(prev => Math.min(prev + bonusHp, Math.round(maxHp * 1.5)));
    addAchieve(ACHIEVEMENTS.find(a => a.id === "roulette"));
  }

  function doVote(v) {
    if (isR && !revoting && initialVote === null) {
      setInitialVote(v); // gem første estimat
    }
    setPv(v); sound("attack");
    setAtk(true);
    setSpellName(TEAM[0].cls.spellName);
    setTimeout(() => { setSpellName(null); }, 600);
    doBossHit(v * 2); addDmg(v, 50, v >= 8); doFlash(TEAM[0].cls.trail); doShake();
    setTimeout(() => setAtk(false), 500);
    setCombo(c => c + 1); addAchieve(ACHIEVEMENTS[0]);
    if (v >= 8) sound("combo");
  }

  function doReveal() {
    sound("countdown"); setCd(3);
    const i = setInterval(() => {
      setCd(p => {
        if (p <= 1) {
          clearInterval(i);
          setTimeout(() => {
            setCd(-1); sound("countgo"); doFlash(mc); doShake();
            setBossHp(0); setBossDead(true);
            setTimeout(() => {
              sound("boom"); doFlash(C.wht); doShake();
              setRev(true); setStep(1);
              const allV = [pv, ...votes.map(v => v.val)];
              const avg = allV.reduce((a, b) => a + b, 0) / allV.length;
              if (Math.abs(pv - avg) < 2) addAchieve(ACHIEVEMENTS[3]);
              const spread = Math.max(...allV) - Math.min(...allV);
              if (spread <= 3) addAchieve(ACHIEVEMENTS[4]);
            }, 800);
          }, 400);
          return 0;
        }
        sound("heartbeat"); return p - 1;
      });
    }, 750);
  }

  function doDisc() { setStep(2); sound("click"); }
  function doCv(v) {
    setCv(v); sound("select");
    if (v === 5) addAchieve(ACHIEVEMENTS[5]);
    setTimeout(() => { setAc(NPC_TEAM.map(m => ({ mid: m.id, val: Math.max(1, Math.min(5, v + Math.floor(Math.random() * 3) - 1)) }))); }, 500);
  }
  function doFin() {
    setStep(4); sound("victory"); doFlash(C.gld);
    const loots = [{ icon: "💎", label: `+${45 + Math.floor(Math.random() * 30)} XP`, color: C.xp }];
    if (rc.length > 0) loots.push({ icon: "🔍", label: "Risk Badge", color: C.acc });
    if (combo >= 3) loots.push({ icon: "🔥", label: "Streak Bonus", color: C.org });
    if (ll) loots.push({ icon: "⚡", label: "Power Badge", color: C.pur });
    loots.push({ icon: "⭐", label: "Session Star", color: C.gld });
    setLoot(loots);
    setTimeout(() => setShowLoot(true), 500);
    // auto-complete after showing victory for 5s
    setTimeout(() => safeComplete(), 5000);
  }
  function doLL(id) {
    setLl(id); sound("powerup"); doFlash(C.pur); addAchieve(ACHIEVEMENTS[2]);
    if (id === "expert") setLlr("💬 \"Denne type tog 8 pts sidst.\"");
    else if (id === "audience") { const av = [pv, ...votes.map(v => v.val)]; const d = {}; av.forEach(v => { d[v] = (d[v] || 0) + 1; }); setLlr(`📊 ${Object.entries(d).map(([k, v]) => `${k}:${Math.round(v / av.length * 100)}%`).join(" ")}`); }
    else if (id === "5050") setLlr("✂️ To dårlige antagelser fjernet!");
    else setLlr("🔮 Afhængighed til team på ferie!");
  }

  const allV = pv !== null ? [{ mid: 1, val: pv }, ...votes] : [];
  const avg = allV.length ? (allV.reduce((s, v) => s + v.val, 0) / allV.length).toFixed(1) : 0;
  const spread = allV.length ? Math.max(...allV.map(v => v.val)) - Math.min(...allV.map(v => v.val)) : 0;

  return (
    <Scene mc={mc}>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.5, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.3s ease-out forwards" }} />}
      {cd >= 0 && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `rgba(0,0,0,${cd > 0 ? 0.7 : 0.9})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        <div style={{ fontFamily: PF, fontSize: cd > 0 ? "80px" : "60px", color: cd > 0 ? C.acc : C.grn, textShadow: `0 0 50px ${cd > 0 ? C.acc : C.grn}`, animation: "pop 0.4s" }}>{cd > 0 ? cd : "⚔️ REVEAL!"}</div>
        {cd > 0 && <div style={{ fontFamily: PF, fontSize: "8px", color: C.dim, marginTop: "16px", animation: "pulse 0.75s infinite" }}>ALLE KORT VENDES...</div>}
      </div>}
      {showRoulette && <RouletteOverlay onComplete={handleChallengeComplete} />}
      {showAchieve && <AchievePopup achieve={showAchieve} onDone={() => setShowAchieve(null)} />}
      <ComboDisplay count={combo} />
      {spellName && <div style={{ position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 100, pointerEvents: "none", animation: "spellFlash 0.6s ease-out forwards" }}><div style={{ fontFamily: PF, fontSize: "14px", color: C.wht, textShadow: `0 0 20px ${C.wht}, 0 0 40px ${mc}`, letterSpacing: "3px" }}>{spellName}!</div></div>}

      <div style={{ animation: shake ? "screenShake 0.4s" : "none" }}>
        <div style={{ padding: "10px 14px" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <button onClick={() => { sound("click"); if (onBack) onBack(); }} style={{ fontFamily: PF, fontSize: "6px", color: C.wht, background: C.bgL, border: `3px solid ${C.bgL}`, borderBottom: `5px solid ${C.bg}`, padding: "4px 8px", cursor: "pointer" }}>←</button>
            <div style={{ fontFamily: PF, fontSize: "6px", padding: "3px 6px", background: mc, color: C.bg }}>{isR ? "🎰 ROULETTE" : "🃏 POKER"}</div>
            <div style={{ fontFamily: PF, fontSize: "5px", color: mc }}>{bossName}</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: PF, fontSize: "5px", color: C.org, marginRight: "4px" }}>🔥{combo}</div>
            {["ESTIMÉR", "REVEAL", "DISK.", "CONF.", "VICTORY"].map((s, i) => <div key={i} style={{ height: "9px", padding: "0 3px", background: i < step ? C.grn : i === step ? C.acc : C.bgL, fontFamily: PF, fontSize: "4px", color: C.wht, display: "flex", alignItems: "center" }}>{i === step ? s : i < step ? "✓" : ""}</div>)}
          </div>

          {/* BOSS */}
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <Boss hp={bossHp} maxHp={maxHp} name={bossName} hit={bossHit} defeated={bossDead} />
            {dmgNums.map(d => <DmgNum key={d.id} value={d.val} x={d.x} critical={d.critical} color={d.critical ? C.gld : C.acc} />)}
          </div>

          {/* Characters */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "14px", marginBottom: "10px", minHeight: "130px" }}>
            {TEAM.map((m, i) => {
              const hasV = m.isP ? pv !== null : votes.some(v => v.mid === m.id);
              const vv = m.isP ? pv : votes.find(v => v.mid === m.id)?.val;
              const isAtk = m.isP ? atk : npcAtk.includes(m.id);
              const isHit = npcHits.includes(m.id);
              const isVic = step === 4;
              const anim = isVic ? "celebrate 0.4s ease-in-out infinite" : isAtk ? "atkLunge 0.4s ease-out" : hasV && !rev ? "charBounce 0.8s ease-in-out infinite" : "none";
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {hasV && <div style={{ marginBottom: "4px", animation: "cardDrop 0.4s ease-out" }}><FlipCard value={vv} member={m} revealed={rev} delay={i * 0.12} mc={mc} /></div>}
                  {!hasV && <div style={{ height: "66px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>{!m.isP && <div style={{ fontFamily: PF, fontSize: "6px", color: m.hat || C.dim, animation: "pulse 1s infinite" }}>💭</div>}</div>}
                  <Sprite m={m} size={1.7} anim={anim} attacking={isAtk} hit={isHit} />
                </div>
              );
            })}
          </div>

          {/* Game UI */}
          <div style={{ maxWidth: "660px", margin: "0 auto" }}>
            {/* STEP 0: Vote */}
            {step === 0 && <div style={{ animation: "slideUp 0.3s", textAlign: "center" }}>
              <div style={{ fontFamily: PF, fontSize: "6px", color: C.dim, letterSpacing: "2px", marginBottom: "8px" }}>
                {pv === null ? "◈ VÆLG DIT KORT FOR AT ANGRIBE ◈" : rdy ? "◈ ALLE HAR ANGREBET! ◈" : "◈ PARTY ANGRIBER... ◈"}
              </div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap", marginBottom: "14px" }}>
                {PV.map((v, vi) => (
                  <div key={v} onClick={() => { if (pv === null) doVote(v); }} style={{ width: "56px", height: "78px", background: `linear-gradient(145deg,${C.bgL},${C.bgC})`, border: `3px solid ${pv === v ? mc : C.brd}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: pv === null ? "pointer" : "default", opacity: pv !== null && pv !== v ? 0.1 : 1, transform: pv === v ? "scale(1.15) translateY(-10px)" : "scale(1)", transition: "all 0.15s", boxShadow: pv === v ? `0 4px 16px ${mc}66` : `3px 3px 0 ${C.bg}`, animation: pv === null ? `cardFloat 2.5s ease-in-out ${vi * 0.12}s infinite` : "none", position: "relative" }}>
                    <div style={{ position: "absolute", top: "2px", left: "4px", fontFamily: PF, fontSize: "5px", color: pv === v ? mc : C.dim }}>{v}</div>
                    <div style={{ fontFamily: PF, fontSize: "18px", color: pv === v ? mc : C.txt, textShadow: pv === v ? `0 0 8px ${mc}` : "none" }}>{v}</div>
                    <div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>DMG</div>
                  </div>
                ))}
              </div>
              {rdy && isR && !activeChallenge && (
                <button onClick={() => setShowRoulette(true)}
                  style={{
                    fontFamily: PF, fontSize: 9, color: C.bg, background: C.yel,
                    border: `3px solid ${C.yel}`, borderBottom: `5px solid ${C.bg}`,
                    borderRight: `5px solid ${C.bg}`, padding: "12px 24px",
                    cursor: "pointer", letterSpacing: 1, animation: "pulse 1.5s ease-in-out infinite"
                  }}>
                  🎰 TRÆK CHALLENGE!
                </button>
              )}
              {rdy && isR && activeChallenge && !rev && (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <div style={{ fontFamily: PF, fontSize: 7, color: C.yel, marginBottom: 8 }}>
                    AKTIV CHALLENGE: {activeChallenge.title}
                  </div>
                  <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 12 }}>
                    RE-ESTIMER OG ANGRIB!
                  </div>
                  {revoting && pv !== null && (
                    <Btn large color={C.acc} onClick={doReveal} style={{ fontSize: "11px", animation: "pulse 0.8s infinite" }}>⚔️ REVEAL ATTACK!</Btn>
                  )}
                </div>
              )}
              {rdy && !isR && <Btn large color={C.acc} onClick={doReveal} style={{ fontSize: "11px", animation: "pulse 0.8s infinite" }}>⚔️ REVEAL ATTACK!</Btn>}
            </div>}

            {/* STEP 1: Reveal */}
            {step === 1 && <div style={{ animation: "slideUp 0.3s", textAlign: "center" }}>
              <div style={{ fontFamily: PF, fontSize: "7px", color: C.grn, marginBottom: "10px", textShadow: `0 0 6px ${C.grn}44` }}>👾 BOSS DEFEATED!</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px" }}>
                <Box glow={C.blu + "33"} style={{ padding: "10px", minWidth: "70px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>SNIT</div><div style={{ fontFamily: PF, fontSize: "18px", color: C.blu, textShadow: `0 0 6px ${C.blu}44` }}>{avg}</div></Box>
                <Box glow={(spread > 5 ? C.acc : C.grn) + "33"} style={{ padding: "10px", minWidth: "70px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>SPREAD</div><div style={{ fontFamily: PF, fontSize: "18px", color: spread > 5 ? C.acc : C.grn }}>{spread}</div></Box>
                <Box style={{ padding: "10px", minWidth: "70px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>STATUS</div><div style={{ fontFamily: PF, fontSize: "9px", color: spread > 5 ? C.acc : spread > 2 ? C.yel : C.grn }}>{spread > 5 ? "⚠️ HØJ" : spread > 2 ? "MEDIUM" : "✓ ALIGN"}</div></Box>
              </div>
              {isR && activeChallenge && initialVote !== null && (
                <div style={{ fontFamily: PF, fontSize: 7, color: C.yel, marginTop: 8, marginBottom: 8 }}>
                  FØRSTE ESTIMAT: {initialVote} SP → NU: {pv} SP
                  {pv > initialVote && <span style={{ color: C.red }}> (+{pv - initialVote} pga. {activeChallenge.title})</span>}
                  {pv === initialVote && <span style={{ color: C.grn }}> (INGEN ÆNDRING)</span>}
                </div>
              )}
              <Btn large color={C.blu} onClick={doDisc}>💬 DISKUSSION & POWER-UPS</Btn>
            </div>}

            {/* STEP 2: Discussion */}
            {step === 2 && <div style={{ animation: "slideUp 0.3s", textAlign: "center" }}>
              {spread > 3 && <Box color={C.yel} glow={C.yel + "33"} style={{ padding: "7px", marginBottom: "8px" }}><div style={{ fontFamily: PF, fontSize: "6px", color: C.yel }}>⚠️ UENIGHED — {spread} PTS!</div></Box>}
              <div style={{ fontFamily: PF, fontSize: "5px", color: C.dim, marginBottom: "5px" }}>RISK CARDS</div>
              <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap", marginBottom: "10px" }}>
                {["🔥 Dependency", "🧱 Legacy", "🕳️ Unknown", "🧑‍💻 Single PoK"].map(c => (
                  <div key={c} onClick={() => { if (!rc.includes(c)) { setRc([...rc, c]); sound("click"); addAchieve(ACHIEVEMENTS[1]); } }} style={{ fontFamily: PF, fontSize: "5px", padding: "5px 8px", cursor: "pointer", background: rc.includes(c) ? C.acc : C.bgL + "dd", color: rc.includes(c) ? C.wht : C.txt, border: `2px solid ${rc.includes(c) ? C.acc : C.brd}`, animation: rc.includes(c) ? "pop 0.3s" : "none" }}>{c}</div>
                ))}
              </div>
              <div style={{ fontFamily: PF, fontSize: "5px", color: C.dim, marginBottom: "6px" }}>POWER-UPS</div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "10px" }}>
                {[{ id: "expert", i: "📞", n: "Expert" }, { id: "audience", i: "📊", n: "Audience" }, { id: "5050", i: "✂️", n: "Cut" }, { id: "oracle", i: "🔮", n: "Oracle" }].map(l => (
                  <div key={l.id} onClick={() => { if (!ll) doLL(l.id); }} style={{ textAlign: "center", cursor: ll ? "default" : "pointer", opacity: ll && ll !== l.id ? 0.15 : 1, transform: ll === l.id ? "scale(1.2)" : "scale(1)", transition: "all 0.2s" }}>
                    <div style={{ width: "38px", height: "38px", margin: "0 auto", borderRadius: "50%", background: ll === l.id ? C.pur : C.bgL + "dd", border: `3px solid ${ll === l.id ? C.pur : C.brd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", boxShadow: ll === l.id ? `0 0 12px ${C.pur}66` : "none", animation: !ll ? "float 2s ease-in-out infinite" : "none" }}>{l.i}</div>
                    <div style={{ fontFamily: PF, fontSize: "4px", color: ll === l.id ? C.pur : C.dim, marginTop: "2px" }}>{l.n}</div>
                  </div>
                ))}
              </div>
              {llr && <Box color={C.pur} glow={C.pur + "22"} style={{ padding: "8px", marginBottom: "8px" }}><div style={{ fontFamily: BF, fontSize: "14px", color: C.txt }}>{llr}</div></Box>}
              <Btn large color={C.grn} onClick={() => { setStep(3); sound("click"); }}>✅ CONFIDENCE VOTE</Btn>
            </div>}

            {/* STEP 3: Confidence */}
            {step === 3 && <div style={{ animation: "slideUp 0.3s", textAlign: "center" }}>
              <div style={{ fontFamily: PF, fontSize: "6px", color: C.dim, marginBottom: "8px" }}>◈ HVOR SIKKER ER DU? ◈</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "14px" }}>
                {[1, 2, 3, 4, 5].map(v => {
                  const cols = [C.red, C.org, C.yel, C.grnL, C.grn], em = ["😰", "😐", "🤔", "😊", "💪"];
                  return (
                    <div key={v} onClick={() => { if (cv === null) doCv(v); }} style={{ textAlign: "center", cursor: cv === null ? "pointer" : "default", opacity: cv !== null && cv !== v ? 0.1 : 1, transform: cv === v ? "scale(1.25)" : "scale(1)", transition: "all 0.2s" }}>
                      <div style={{ width: "42px", height: "42px", margin: "0 auto", borderRadius: "50%", background: cv === v ? cols[v - 1] : C.bgL + "dd", border: `3px solid ${cv === v ? cols[v - 1] : C.brd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", boxShadow: cv === v ? `0 0 14px ${cols[v - 1]}66` : "none", animation: cv === null ? `float 2s ease-in-out ${v * 0.15}s infinite` : "none" }}>{em[v - 1]}</div>
                      <div style={{ fontFamily: PF, fontSize: "4px", color: cv === v ? cols[v - 1] : C.dim, marginTop: "2px" }}>{["USIKKER", "LIDT", "OK", "SIKKER", "100%"][v - 1]}</div>
                    </div>
                  );
                })}
              </div>
              {ac.length > 0 && <>
                <Box style={{ padding: "10px", maxWidth: "320px", margin: "0 auto 10px" }}>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    {[{ mid: 1, val: cv }, ...ac].map((c, i) => {
                      const m = TEAM.find(x => x.id === c.mid);
                      const cols = [C.red, C.org, C.yel, C.grnL, C.grn];
                      return <div key={i} style={{ textAlign: "center" }}><Sprite m={m} size={0.8} idle={false} /><div style={{ fontFamily: PF, fontSize: "7px", color: cols[c.val - 1] }}>{c.val}</div></div>;
                    })}
                  </div>
                </Box>
                <Btn large color={C.acc} onClick={doFin}>🏆 VICTORY!</Btn>
              </>}
            </div>}

            {/* STEP 4: Victory */}
            {step === 4 && <div style={{ animation: "slideUp 0.3s", textAlign: "center" }}>
              <div style={{ fontFamily: PF, fontSize: "16px", color: C.gld, marginBottom: "10px", textShadow: `0 0 25px ${C.gld}66`, letterSpacing: "4px", animation: "victoryPulse 1s ease-in-out infinite" }}>★ VICTORY ★</div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "10px" }}>
                <Box color={C.grn} glow={C.grn + "33"} style={{ padding: "10px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>ESTIMAT</div><div style={{ fontFamily: PF, fontSize: "22px", color: C.grn }}>{clamp(Math.round(allV.reduce((s, v) => s + v.val, 0) / allV.length))}</div></Box>
                <Box style={{ padding: "10px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>CONFIDENCE</div><div style={{ fontSize: "22px" }}>{["😰", "😐", "🤔", "😊", "💪"][(cv || 1) - 1]}</div></Box>
                <Box style={{ padding: "10px" }}><div style={{ fontFamily: PF, fontSize: "4px", color: C.dim }}>COMBO</div><div style={{ fontFamily: PF, fontSize: "22px", color: C.org }}>{combo}x</div></Box>
              </div>
              <div style={{ fontFamily: PF, fontSize: "6px", color: C.gld, marginBottom: "6px", animation: "pop 0.5s 0.3s both" }}>◈ LOOT DROPS ◈</div>
              <LootDrops items={loot} active={showLoot} />
              <Box color={C.xp} glow={C.xp + "33"} style={{ padding: "10px", maxWidth: "300px", margin: "10px auto" }}>
                <div style={{ fontFamily: PF, fontSize: "7px", color: C.xp }}>⭐ +{45 + combo * 5} XP</div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "4px" }}>
                  <span style={{ fontFamily: PF, fontSize: "5px", color: C.gld }}>LV3</span>
                  <div style={{ flex: 1, height: "7px", background: C.bg, border: `2px solid ${C.brd}` }}>
                    <div style={{ height: "100%", width: "72%", background: `linear-gradient(90deg,${C.xp},${C.bluL})`, transition: "width 2s", boxShadow: `0 0 6px ${C.xp}44` }} />
                  </div>
                </div>
              </Box>
              {achieves.length > 0 && <div style={{ marginTop: "8px" }}>
                <div style={{ fontFamily: PF, fontSize: "5px", color: C.gld, marginBottom: "4px" }}>ACHIEVEMENTS</div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                  {achieves.map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return a ? <div key={id} style={{ padding: "4px 8px", background: C.bgL, border: `2px solid ${C.gld}`, display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontSize: "12px" }}>{a.icon}</span><span style={{ fontFamily: PF, fontSize: "4px", color: C.gld }}>{a.name}</span></div> : null; })}
                </div>
              </div>}
              <div style={{ marginTop: "12px" }}>
                <Btn color={C.grn} onClick={safeComplete}>← TILBAGE TIL KORTET</Btn>
              </div>
            </div>}
          </div>
        </div>
      </div>
    </Scene>
  );
}
