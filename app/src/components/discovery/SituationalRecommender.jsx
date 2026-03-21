import { useState } from "react";
import { PF, BF } from "../../shared/constants.js";

const C = {
  bg: "#0e1019", bg2: "#1a1230", border: "rgba(255,255,255,0.08)",
  txt: "#d4c5f9", dim: "#7c6d8a", acc: "#feae34", jade: "#38b764",
  epic: "#b55088",
};

// All 14 modes with metadata
export const ALL_MODES = [
  // Scrum Zone 🛡️
  { id: "planning_poker",      name: "Planning Poker",      zone: "scrum",    icon: "⚔️",  desc: "Estimér story points",        bestFor: ["estimate"], situation: ["sprint_start", "midway"], time: [30, 60, 99], xp: 10 },
  { id: "sprint_draft",        name: "Sprint Draft",        zone: "scrum",    icon: "📋",  desc: "Planlæg sprinten",             bestFor: ["estimate"], situation: ["sprint_start"], time: [30, 60, 99], xp: 8 },
  { id: "refinement_roulette", name: "Refinement Roulette", zone: "scrum",    icon: "🎡",  desc: "Groome backlog",               bestFor: ["groom"], situation: ["sprint_start", "midway", "ad_hoc"], time: [30, 60, 99], xp: 10 },
  { id: "dependency_mapper",   name: "Dependency Mapper",   zone: "scrum",    icon: "🕸️",  desc: "Kortlæg afhæng.",              bestFor: ["dependencies"], situation: ["midway", "ad_hoc"], time: [30, 60, 99], xp: 8 },
  { id: "boss_battle_retro",   name: "Boss Battle Retro",   zone: "scrum",    icon: "👾",  desc: "Sprint retrospective",         bestFor: ["retro"], situation: ["sprint_end"], time: [30, 60, 99], xp: 12 },
  // Scope Zone 🔭
  { id: "spec_wars",           name: "Spec Wars",           zone: "scope",    icon: "📜",  desc: "Skriv acceptance criteria",    bestFor: ["groom", "other"], situation: ["sprint_start", "ad_hoc"], time: [30, 60, 99], xp: 10 },
  { id: "perspective_poker",   name: "Perspektiv-Poker",    zone: "scope",    icon: "🎭",  desc: "Estimér fra roller",           bestFor: ["estimate", "retro"], situation: ["sprint_start", "midway"], time: [30, 60, 99], xp: 10 },
  { id: "nesting_scope",       name: "Nesting Scope",       zone: "scope",    icon: "🪆",  desc: "Nedbryd opgaver",              bestFor: ["groom", "estimate"], situation: ["sprint_start", "ad_hoc"], time: [30, 60, 99], xp: 8 },
  { id: "truth_serum",         name: "Truth Serum",         zone: "scope",    icon: "🧪",  desc: "Afslør bias",                  bestFor: ["risk", "other"], situation: ["midway", "ad_hoc"], time: [30, 60, 99], xp: 10 },
  // Speed Zone ⚡
  { id: "speed_scope",         name: "Speed Scope",         zone: "speed",    icon: "⚡",  desc: "Hurtige estimater",            bestFor: ["estimate"], situation: ["midway", "ad_hoc"], time: [15, 30], xp: 6 },
  { id: "bluff_poker",         name: "Bluff Poker",         zone: "speed",    icon: "🃏",  desc: "Find blufferen",               bestFor: ["estimate", "retro"], situation: ["sprint_start", "ad_hoc"], time: [15, 30], xp: 8 },
  // Strategy Zone 🧠
  { id: "flow_poker",          name: "Flow Poker",          zone: "strategy", icon: "🌊",  desc: "Estimér cycle time",           bestFor: ["estimate", "other"], situation: ["midway", "sprint_end"], time: [30, 60, 99], xp: 10 },
  { id: "risk_poker",          name: "Risk Poker",          zone: "strategy", icon: "⚠️",  desc: "Kortlæg risici",               bestFor: ["risk"], situation: ["midway", "ad_hoc"], time: [30, 60, 99], xp: 10 },
  { id: "assumption_slayer",   name: "Assumption Slayer",   zone: "strategy", icon: "🐉",  desc: "Dræb farlige antagelser",      bestFor: ["risk", "retro"], situation: ["midway", "sprint_end"], time: [30, 60, 99], xp: 12 },
];

export const ZONE_META = {
  scrum:    { label: "Scrum Zone",    icon: "🛡️", color: "#38b764" },
  scope:    { label: "Scope Zone",    icon: "🔭", color: "#feae34" },
  speed:    { label: "Speed Zone",    icon: "⚡", color: "#5fcde4" },
  strategy: { label: "Strategy Zone", icon: "🧠", color: "#b55088" },
};

function scoreMode(mode, goal, situation, time) {
  let score = 0;
  const timeMap = { "15": 15, "30": 30, "60": 60, "unlimited": 99 };
  const timeVal = timeMap[time] || 99;
  if (goal && mode.bestFor.includes(goal)) score += 40;
  if (situation && mode.situation.includes(situation)) score += 30;
  if (time && mode.time.includes(timeVal)) score += 20;
  else if (time && timeVal >= Math.min(...mode.time)) score += 10;
  return score;
}

function getRecommendationReason(mode, goal, situation, time) {
  const reasons = [];
  const situationLabels = { sprint_start: "sprint start", midway: "midtvejs", sprint_end: "sprint slut", ad_hoc: "ad hoc" };
  const goalLabels = { estimate: "estimering", groom: "grooming", dependencies: "afhængigheder", retro: "retrospective", risk: "risici", other: "din situation" };
  if (goal && mode.bestFor.includes(goal)) reasons.push(`perfekt til ${goalLabels[goal] || goal}`);
  if (situation && mode.situation.includes(situation)) reasons.push(`passer til ${situationLabels[situation] || situation}`);
  if (time === "15" || time === "30") reasons.push("kræver kun " + time + " min");
  return reasons.length ? reasons.join(", ") : mode.desc;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function SituationalRecommender({ onSelect, compact = false }) {
  const [goal, setGoal] = useState(null);
  const [situation, setSituation] = useState(null);
  const [time, setTime] = useState(null);
  const [done, setDone] = useState(false);

  const goals = [
    { id: "estimate",      label: "Estimere",    icon: "⚔️" },
    { id: "groom",         label: "Groome",      icon: "🔍" },
    { id: "dependencies",  label: "Afhæng.",     icon: "🕸️" },
    { id: "retro",         label: "Retro",       icon: "🎭" },
    { id: "risk",          label: "Risici",      icon: "⚡" },
    { id: "other",         label: "Andet",       icon: "🎯" },
  ];
  const situations = [
    { id: "sprint_start", label: "Sprint start" },
    { id: "midway",       label: "Midt i sprint" },
    { id: "sprint_end",   label: "Sprint slut" },
    { id: "ad_hoc",       label: "Ad hoc" },
  ];
  const times = [
    { id: "15",        label: "15 min" },
    { id: "30",        label: "30 min" },
    { id: "60",        label: "1 time" },
    { id: "unlimited", label: "Ubegrænset" },
  ];

  const recommendations = (() => {
    if (!goal && !situation && !time) return [];
    return ALL_MODES
      .map(m => ({ ...m, score: scoreMode(m, goal, situation, time) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((m, i) => ({ ...m, medal: MEDAL[i], reason: getRecommendationReason(m, goal, situation, time) }));
  })();

  const allAnswered = goal && situation && time;

  function reset() {
    setGoal(null); setSituation(null); setTime(null); setDone(false);
  }

  const chip = (label, icon, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      fontFamily: BF, fontSize: 12, padding: "7px 12px",
      background: active ? C.acc + "22" : "rgba(255,255,255,0.04)",
      border: `1.5px solid ${active ? C.acc : "rgba(255,255,255,0.12)"}`,
      borderRadius: 8, color: active ? C.acc : C.txt, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 5,
      transition: "all 0.15s", fontWeight: active ? 700 : 400,
    }}>
      {icon && <span>{icon}</span>}{label}
    </button>
  );

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, fontFamily: BF }}>
      <div style={{ fontFamily: PF, fontSize: 8, color: C.acc, letterSpacing: 2, marginBottom: 14 }}>
        🧭 FIND DIT SPIL
      </div>

      {/* Q1 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 7 }}>Hvad vil du opnå i dag?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {goals.map(g => chip(g.label, g.icon, goal === g.id, () => setGoal(goal === g.id ? null : g.id)))}
        </div>
      </div>

      {/* Q2 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 7 }}>Hvad er teamets situation?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {situations.map(s => chip(s.label, null, situation === s.id, () => setSituation(situation === s.id ? null : s.id)))}
        </div>
      </div>

      {/* Q3 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 7 }}>Tid til rådighed?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {times.map(t2 => chip(t2.label, null, time === t2.id, () => setTime(time === t2.id ? null : t2.id)))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 10 }}>Anbefalinger baseret på dine svar:</div>
          {recommendations.map((rec, i) => (
            <div key={rec.id}
              onClick={() => onSelect && onSelect(rec)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", marginBottom: 6,
                background: i === 0 ? C.acc + "12" : "rgba(255,255,255,0.03)",
                border: `1px solid ${i === 0 ? C.acc + "44" : C.border}`,
                borderRadius: 8, cursor: onSelect ? "pointer" : "default",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{rec.medal}</span>
              <span style={{ fontSize: 16 }}>{rec.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? C.acc : C.txt }}>{rec.name}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2, textTransform: "capitalize" }}>
                  {rec.reason}
                </div>
              </div>
              {i === 0 && (
                <div style={{ fontFamily: PF, fontSize: 5, color: C.acc, background: C.acc + "22", padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
                  TOP VALG
                </div>
              )}
              <span style={{ fontSize: 11, color: ZONE_META[rec.zone]?.color || C.dim }}>{ZONE_META[rec.zone]?.icon}</span>
            </div>
          ))}
          {allAnswered && onSelect && (
            <button onClick={reset} style={{
              marginTop: 6, fontSize: 10, color: C.dim, background: "none", border: "none",
              cursor: "pointer", padding: "4px 0", textDecoration: "underline",
            }}>
              Nulstil svar
            </button>
          )}
        </div>
      )}

      {!goal && !situation && !time && (
        <div style={{ fontSize: 10, color: C.dim, textAlign: "center", padding: "10px 0" }}>
          Vælg dine svar ovenfor for at få anbefalinger
        </div>
      )}
    </div>
  );
}
