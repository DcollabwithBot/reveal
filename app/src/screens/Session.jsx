import { useState, useEffect, useRef } from "react";
import { C, PF, BF, CLASSES, NPC_TEAM, ROULETTE_CHALLENGES, SPRINT_EVENTS } from "../shared/constants.js";
import { dk, pick } from "../shared/utils.js";
import { buildRewardLoot } from "../domain/session/rewards/buildRewardLoot.js";
import { FALLBACK_ACHIEVEMENTS, createAchievementResolver } from "../domain/session/rewards/achievements.js";
import { projectBossEncounter } from "../domain/session/boss/bossProjection.js";
import { projectApprovalOverlay } from "../domain/session/governance/approvalProjection.js";
import { buildRootState } from "../domain/session/root/selectors.js";
import { buildSessionViewModel } from "../domain/session/root/viewModel.js";
import { projectWorld } from "../domain/session/world/projectWorld.js";
import { buildChallenge } from "../domain/session/challenge/buildChallenge.js";
import RouletteOverlay from "../components/RouletteOverlay.jsx";
import BossRetroStage from "../components/session/BossRetroStage.jsx";
import PokerRouletteSteps from "../components/session/PokerRouletteSteps.jsx";
import SessionChrome from "../components/session/SessionChrome.jsx";
import SessionCombatStage from "../components/session/SessionCombatStage.jsx";
import { applyOracleDecision, applyRetroEventVote, applyRootCauseDecision, buildBossRetroViewModel } from "../domain/session/challenge/retroDecisions.js";
import { createChallengeCompletionResult, createConfidenceResult, createLifelineResult, createVictoryResult, createVoteResult } from "../domain/session/challenge/sessionTransitions.js";
import { getLatestApprovalState, getProjectionConfig, submitAdvisoryRequest } from "../lib/api";
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
  const isB = node?.tp === "b";
  const mc = isR ? C.yel : isB ? C.red : C.blu;

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
  const [projectionConfig, setProjectionConfig] = useState(null);
  const [showLoot, setShowLoot] = useState(false);

  const { bossName, maxHp, bossDamageMultiplier } = projectBossEncounter({
    projectionConfig,
    node,
    project,
    bossKey: 'delivery-pressure-default',
  });
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

  // Boss Battle / Retro states
  const [bossStep, setBossStep] = useState(0); // 0=intro, 1=events, 2=reveal, 3=rootcause, 4=confidence, 5=end
  const [retroEvents] = useState(() => {
    const shuffled = [...SPRINT_EVENTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  });
  const [currentEvtIdx, setCurrentEvtIdx] = useState(0);
  const [eventVotes, setEventVotes] = useState({});
  const [oracleEvents, setOracleEvents] = useState([]);
  const [oracleUsed, setOracleUsed] = useState(false);
  const [rootCauses, setRootCauses] = useState({});
  const [bossBattleHp, setBossBattleHp] = useState(0);
  const [problemEvents, setProblemEvents] = useState([]);
  const [rootCauseIdx, setRootCauseIdx] = useState(0);
  const [approvalState, setApprovalState] = useState(null);
  const [advisoryBusy, setAdvisoryBusy] = useState(false);
  const [advisoryError, setAdvisoryError] = useState(null);

  function safeComplete() {
    if (finCalled.current) return;
    finCalled.current = true;
    if (onComplete) onComplete(node?.id);
  }

  const resolveProjectionAchievement = createAchievementResolver(projectionConfig?.achievements || [], FALLBACK_ACHIEVEMENTS);
  const sessionRewardRule = (projectionConfig?.rewardRules || []).find((rule) => rule.key === 'session-complete-default') || null;
  const rootState = buildRootState({
    selectedVote: pv,
    votes,
    approvalState,
    projectionConfig,
    node,
    project,
    step,
    combo,
    ready: rdy,
    activeChallenge,
    rootCauseCount: rc.length,
    lifelineUsed: Boolean(ll),
  });
  const approvalOverlay = projectApprovalOverlay(approvalState, { yel: C.yel, blu: C.blu, red: C.red, grn: C.grn, dim: C.dim });
  const world = projectWorld(rootState, projectionConfig, { xp: C.xp, acc: C.acc, org: C.org, pur: C.pur, gld: C.gld, yel: C.yel, blu: C.blu, red: C.red, grn: C.grn, dim: C.dim });
  const currentChallenge = buildChallenge(rootState, world);

  function addDmg(val, x, critical = false) { setDmgNums(p => [...p, { id: Date.now() + Math.random(), val, x, critical }]); setTimeout(() => setDmgNums(p => p.slice(1)), 1200); }
  function addAchieve(a) {
    const resolved = typeof a === 'string' ? resolveProjectionAchievement(a) : a;
    if (!resolved || achieves.includes(resolved.id)) return;
    setAchieves(p => [...p, resolved.id]);
    setShowAchieve(resolved);
    sound("achieve");
  }
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

  useEffect(() => {
    let active = true;
    const targetId = project?.id || node?.id;
    if (!targetId) return () => { active = false; };

    getLatestApprovalState(targetId)
      .then((state) => {
        if (!active) return;
        setApprovalState(state || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [project?.id, node?.id]);

  useEffect(() => {
    let active = true;
    getProjectionConfig()
      .then((data) => {
        if (!active) return;
        setProjectionConfig(data || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function handleChallengeComplete(challenge) {
    const result = createChallengeCompletionResult({ maxHp, challenge });
    setActiveChallenge(result.activeChallenge);
    setShowRoulette(result.showRoulette);
    setRevoting(result.revoting);
    setBossHp(prev => Math.min(prev + result.bonusHp, Math.round(maxHp * 1.5)));
    addAchieve(result.achievementId);
  }

  function doVote(v) {
    const result = createVoteResult({ vote: v, bossDamageMultiplier });
    if (isR && !revoting && initialVote === null) {
      setInitialVote(v);
    }
    setPv(result.selectedVote);
    sound('attack');
    setAtk(true);
    setSpellName(TEAM[0].cls.spellName);
    setTimeout(() => { setSpellName(null); }, 600);
    doBossHit(result.attackDamage);
    addDmg(v, 50, result.critical);
    doFlash(TEAM[0].cls.trail);
    doShake();
    setTimeout(() => setAtk(false), 500);
    setCombo(c => c + result.comboDelta);
    result.achievementIds.forEach((id) => addAchieve(id));
    if (result.sound === 'combo') sound('combo');
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
              if (Math.abs(pv - avg) < 2) addAchieve('sniper');
              const spread = Math.max(...allV) - Math.min(...allV);
              if (spread <= 3) addAchieve('team');
            }, 800);
          }, 400);
          return 0;
        }
        sound("heartbeat"); return p - 1;
      });
    }, 750);
  }

  function doDisc(riskCard) {
    if (riskCard) {
      if (!rc.includes(riskCard)) {
        setRc([...rc, riskCard]);
        sound('click');
        addAchieve('detective');
      }
      return;
    }
    setStep(2);
    sound('click');
  }
  function doCv(v) {
    if (v === null) {
      setStep(3);
      sound('click');
      return;
    }
    const result = createConfidenceResult({ value: v });
    setCv(result.confidence);
    sound('select');
    if (result.achievementId) addAchieve(result.achievementId);
    setTimeout(() => { setAc(NPC_TEAM.map(m => ({ mid: m.id, val: Math.max(1, Math.min(5, v + Math.floor(Math.random() * 3) - 1)) }))); }, 500);
  }
  function doFin() {
    const result = createVictoryResult({
      rewardRule: sessionRewardRule,
      combo,
      rootCauseCount: rc.length,
      lifelineUsed: Boolean(ll),
      colors: { xp: C.xp, acc: C.acc, org: C.org, pur: C.pur, gld: C.gld },
      buildRewardLoot,
    });
    setStep(result.step);
    sound(result.sound);
    doFlash(result.flashColor);
    setLoot(result.loot);
    setTimeout(() => setShowLoot(true), result.showLootDelayMs);
    setTimeout(() => safeComplete(), result.completeDelayMs);
  }
  function doLL(id) {
    const result = createLifelineResult({ id, pv, votes });
    setLl(result.lifelineId);
    sound('powerup');
    doFlash(C.pur);
    if (result.achievementId) addAchieve(result.achievementId);
    setLlr(result.response);
  }

  async function sendToApprovalQueue() {
    if (advisoryBusy) return;
    setAdvisoryBusy(true);
    setAdvisoryError(null);
    try {
      const estimate = pv ?? clamp(rootState.voting.roundedEstimate || 0);
      const targetId = project?.id || node?.id;
      const payload = {
        target_type: 'project',
        target_id: targetId,
        requested_patch: {
          status: estimate >= 8 ? 'on_hold' : 'active',
          description: `Advisory fra game: est=${estimate}, spread=${spread}, confidence=${cv || 'na'}`
        },
        idempotency_key: `game:${targetId}:${Date.now()}`
      };
      const created = await submitAdvisoryRequest(payload);
      setApprovalState(created?.state || 'pending_approval');
    } catch (err) {
      setAdvisoryError(err.message);
    } finally {
      setAdvisoryBusy(false);
    }
  }

  function handleEventVote(vote) {
    const ev = retroEvents[currentEvtIdx];
    const decision = applyRetroEventVote({
      vote,
      event: ev,
      currentEvtIdx,
      totalEvents: retroEvents.length,
      maxHp,
    });

    setEventVotes(p => ({ ...p, [ev.id]: vote }));
    if (decision.addProblemEvent) {
      setBossBattleHp(p => p + decision.hpGain);
      setProblemEvents(p => [...p, ev]);
    }
    setBossHp(p => {
      const next = p + decision.bossHpDelta;
      return decision.bossHpDelta >= 0
        ? Math.min(next, decision.bossHpCap)
        : Math.max(0, next);
    });

    setTimeout(() => {
      if (decision.resetOracle) setOracleUsed(false);
      if (decision.nextBossStep === 1) {
        setCurrentEvtIdx(decision.nextEventIndex);
      } else {
        setBossStep(decision.nextBossStep);
      }
    }, 600);
  }

  function handleOracle() {
    const ev = retroEvents[currentEvtIdx];
    setOracleEvents(p => {
      const next = [...p, ev.id];
      const decision = applyOracleDecision({ currentOracleEvents: p });
      decision.unlocks.forEach((achievementId) => addAchieve(achievementId));
      return next;
    });
    setOracleUsed(true);
    setBossHp(p => Math.max(0, p - 15));
    sound("achieve");
  }

  function handleRootCause(cause) {
    const ev = problemEvents[rootCauseIdx];
    const decision = applyRootCauseDecision({
      rootCauseIdx,
      totalProblemEvents: problemEvents.length,
    });

    setRootCauses(p => ({ ...p, [ev.id]: cause }));
    setBossHp(p => Math.max(0, p - decision.bossDamage));
    setBossBattleHp(p => Math.max(0, p - decision.bossDamage));
    setTimeout(() => {
      if (decision.nextBossStep === 3) {
        setRootCauseIdx(decision.nextRootCauseIdx);
      } else {
        setBossStep(decision.nextBossStep);
      }
    }, 500);
  }

  const allV = rootState.voting.allVotes;
  const avg = rootState.voting.averageDisplay;
  const spread = rootState.voting.spread;
  const bossRetroVm = buildBossRetroViewModel({
    bossStep,
    currentEvtIdx,
    retroEvents,
    bossBattleHp,
    maxHp,
    problemEvents,
    rootCauseIdx,
    oracleEvents,
    bossHp,
  });
  const sessionVm = buildSessionViewModel({
    root: rootState,
    world,
    bossName,
    bossHp,
    maxHp,
    bossHit,
    bossDead,
    advisoryBusy,
    advisoryError,
    showRoulette,
    showAchieve,
    spellName,
    shake,
    dmgNums,
  });

  return (
    <>
    {/* ═══ SPRINT BOSS BATTLE MODE ═══ */}
    {isB && (
      <Scene mc={C.red}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 20 }}>
          <BossRetroStage
            C={C}
            PF={PF}
            bossVm={bossRetroVm}
            oracleUsed={oracleUsed}
            onStart={() => setBossStep(1)}
            onVote={handleEventVote}
            onOracle={handleOracle}
            onContinue={() => setBossStep(bossBattleHp === 0 ? 5 : 3)}
            onRootCause={handleRootCause}
            onConfidence={(n) => {
              if (n >= 4) setBossHp(p => Math.max(0, p - 15));
              if (problemEvents.length >= 5) addAchieve('honest');
              setBossStep(5);
              sound("reveal");
            }}
            onFinish={() => safeComplete(node?.id)}
          />
        </div>
      </Scene>
    )}

    {/* Eksisterende Poker + Roulette mode — uændret */}
    {!isB && (
    <Scene mc={mc}>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.5, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.3s ease-out forwards" }} />}
      {cd >= 0 && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `rgba(0,0,0,${cd > 0 ? 0.7 : 0.9})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        <div style={{ fontFamily: PF, fontSize: cd > 0 ? "80px" : "60px", color: cd > 0 ? C.acc : C.grn, textShadow: `0 0 50px ${cd > 0 ? C.acc : C.grn}`, animation: "pop 0.4s" }}>{cd > 0 ? cd : "⚔️ REVEAL!"}</div>
        {cd > 0 && <div style={{ fontFamily: PF, fontSize: "8px", color: C.dim, marginTop: "16px", animation: "pulse 0.75s infinite" }}>ALLE KORT VENDES...</div>}
      </div>}
      {sessionVm.overlays.showRoulette && <RouletteOverlay onComplete={handleChallengeComplete} />}
      {sessionVm.overlays.showAchieve && <AchievePopup achieve={showAchieve} onDone={() => setShowAchieve(null)} />}
      <ComboDisplay count={combo} />
      {sessionVm.overlays.spellName && <div style={{ position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 100, pointerEvents: "none", animation: "spellFlash 0.6s ease-out forwards" }}><div style={{ fontFamily: PF, fontSize: "14px", color: C.wht, textShadow: `0 0 20px ${C.wht}, 0 0 40px ${mc}`, letterSpacing: "3px" }}>{sessionVm.overlays.spellName}!</div></div>}

      <div style={{ animation: sessionVm.overlays.shake ? "screenShake 0.4s" : "none" }}>
        <div style={{ padding: "10px 14px" }}>
          <SessionChrome
            C={C}
            PF={PF}
            combo={sessionVm.chrome.combo}
            step={sessionVm.chrome.step}
            modeLabel={sessionVm.chrome.modeLabel}
            modeColor={sessionVm.chrome.modeColor}
            title={sessionVm.chrome.title}
            approvalLabel={sessionVm.chrome.approvalLabel}
            approvalColor={sessionVm.chrome.approvalColor}
            advisoryBusy={sessionVm.chrome.advisoryBusy}
            canSubmitAdvisory={sessionVm.chrome.canSubmitAdvisory}
            advisoryError={sessionVm.chrome.advisoryError}
            onBack={() => { sound("click"); if (onBack) onBack(); }}
            onSendToApprovalQueue={sendToApprovalQueue}
          />

          <SessionCombatStage
            C={C}
            PF={PF}
            boss={sessionVm.combat.boss}
            dmgNums={sessionVm.combat.dmgNums}
            Boss={Boss}
            DmgNum={DmgNum}
            TEAM={TEAM}
            pv={pv}
            votes={votes}
            npcAtk={npcAtk}
            npcHits={npcHits}
            atk={atk}
            rev={rev}
            step={step}
            Sprite={Sprite}
            FlipCard={FlipCard}
            mc={mc}
          />

          {/* Game UI */}
          <div style={{ maxWidth: "660px", margin: "0 auto" }}>
            <PokerRouletteSteps
              step={step}
              rdy={rdy}
              isR={isR}
              activeChallenge={activeChallenge}
              currentChallenge={currentChallenge}
              rev={rev}
              revoting={revoting}
              pv={pv}
              avg={avg}
              spread={spread}
              initialVote={initialVote}
              rc={rc}
              ll={ll}
              llr={llr}
              cv={cv}
              ac={ac}
              TEAM={TEAM}
              combo={combo}
              loot={loot}
              showLoot={showLoot}
              achieves={achieves}
              resolveProjectionAchievement={resolveProjectionAchievement}
              allV={allV}
              clamp={clamp}
              doVote={doVote}
              doReveal={doReveal}
              doDisc={doDisc}
              doCv={doCv}
              doFin={doFin}
              doLL={doLL}
              safeComplete={safeComplete}
              setShowRoulette={setShowRoulette}
              Btn={Btn}
              Box={Box}
              Sprite={Sprite}
              LootDrops={LootDrops}
              C={C}
              PF={PF}
            />
          </div>
        </div>
      </div>
    </Scene>
    )}
    </>
  );
}


