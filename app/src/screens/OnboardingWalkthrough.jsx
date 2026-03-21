/**
 * OnboardingWalkthrough — DEL 7
 * 7 kapitler, modulær progress i localStorage.
 * NPC-simuleret Planning Poker i kapitel 3.
 * Pixel art æstetik, Press Start 2P.
 */
import { useState, useEffect, useRef } from "react";
import { PF, BF, NPC_TEAM } from "../shared/constants.js";
import { ALL_MODES, ZONE_META } from "../components/discovery/SituationalRecommender.jsx";

const STORAGE_KEY = "reveal_onboarding_progress";

// ─── Chapters definition ─────────────────────────────────────────────────────
const CHAPTERS = [
  {
    id: "problem",
    num: 1,
    title: "Problemet vi løser",
    emoji: "💡",
    duration: "3 min",
    color: "#e05c5c",
    summary: "Forstå hvorfor traditionelle processer fejler, og hvad Reveal gør anderledes.",
  },
  {
    id: "pm_platform",
    num: 2,
    title: "Din PM Platform",
    emoji: "🏰",
    duration: "5 min",
    color: "#38b764",
    summary: "Opret dit første projekt og backlog. PM-data er altid source of truth.",
  },
  {
    id: "estimation",
    num: 3,
    title: "Estimation-spil",
    emoji: "⚔️",
    duration: "8 min",
    color: "#feae34",
    summary: "Simulér Planning Poker med NPC-teamet. Forstå hvornår du bruger de 4 estimerings-modes.",
  },
  {
    id: "scope",
    num: 4,
    title: "Scope & Discovery-spil",
    emoji: "🔭",
    duration: "6 min",
    color: "#5fcde4",
    summary: "Forstå hvad I skal bygge — FØR I estimerer. 5 modes til krav og kontekst.",
  },
  {
    id: "strategy",
    num: 5,
    title: "Strategi-spil",
    emoji: "🧠",
    duration: "5 min",
    color: "#b55088",
    summary: "Forstå jeres arbejdsmønster — ikke hvad I bygger, men hvordan I arbejder.",
  },
  {
    id: "missions",
    num: 6,
    title: "Missions, Quests & Events",
    emoji: "🎯",
    duration: "5 min",
    color: "#feae34",
    summary: "Daglige missions baseret på jeres backlog. Side quests, random events og XP.",
  },
  {
    id: "feedback",
    num: 7,
    title: "Feedback loop — du er klar!",
    emoji: "📊",
    duration: "4 min",
    color: "#38b764",
    summary: "Hvert spil giver data. Se accuracy-trend, KPI Dashboard og invitér teamet.",
  },
];

const C = {
  bg: "#0e1019", bg2: "#1a1230", bg3: "#251940",
  border: "rgba(255,255,255,0.08)",
  txt: "#d4c5f9", dim: "#7c6d8a",
  acc: "#feae34", jade: "#38b764", red: "#e05c5c", cyan: "#5fcde4", epic: "#b55088",
};

// ─── Pixel Sprite (simple) ────────────────────────────────────────────────────
function Sprite({ icon, color, size = 1, label, pulse }) {
  const s = size * 24;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: s, height: s, borderRadius: "50%", fontSize: s * 0.55,
        background: color + "22", border: `2px solid ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: pulse ? "availPulse 1.2s ease-in-out infinite" : "none",
      }}>
        {icon}
      </div>
      {label && <div style={{ fontFamily: PF, fontSize: 5, color: color, textAlign: "center" }}>{label}</div>}
    </div>
  );
}

// ─── NPC Vote Badge ───────────────────────────────────────────────────────────
function NpcVote({ npc, vote, revealed }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
      padding: "8px 12px",
      background: revealed ? npc.cls.color + "18" : "rgba(255,255,255,0.05)",
      border: `1.5px solid ${revealed ? npc.cls.color + "55" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 8, transition: "all 0.4s",
      minWidth: 64,
    }}>
      <div style={{ fontSize: 20 }}>{npc.cls.icon}</div>
      <div style={{ fontFamily: PF, fontSize: 5, color: npc.cls.color }}>{npc.name}</div>
      <div style={{
        fontFamily: PF, fontSize: revealed ? 14 : 12,
        color: revealed ? npc.cls.color : C.dim,
        background: revealed ? "transparent" : "rgba(255,255,255,0.08)",
        padding: "4px 8px", borderRadius: 4,
        minWidth: 28, textAlign: "center",
        transition: "all 0.3s",
        transform: revealed ? "scale(1.1)" : "scale(1)",
      }}>
        {revealed ? vote : "?"}
      </div>
    </div>
  );
}

// ─── Chapter Components ───────────────────────────────────────────────────────

function ChapterProblem() {
  const [scenario, setScenario] = useState(0);
  const scenarios = [
    {
      icon: "🤔",
      title: "Estimat er galt",
      problem: 'Udvikleren siger "3 dage", men alle tænker noget forskelligt. Resultatet: 2 ugers forsinkelse.',
      solution: 'Planning Poker tvinger alle til at afsløre estimat simultant — ingen anchoring, ingen tavs enighed.',
      mode: "Planning Poker",
    },
    {
      icon: "🙊",
      title: "Tavse bekymringer",
      problem: 'Halvdelen af teamet ser en alvorlig risiko. Ingen siger det højt. Sprinten fejler.',
      solution: 'Risk Poker og Truth Serum skaber psykologisk sikkerhed — "spillet" giver dækning til at sige det svære.',
      mode: "Risk Poker + Truth Serum",
    },
    {
      icon: "🔀",
      title: "Scope forstås forskelligt",
      problem: '"Bruger skal kunne se historik" — men hvad betyder det? 3 udviklere bygger 3 forskellige ting.',
      solution: 'Spec Wars og Assumption Slayer afsløre forskellig forståelse, INDEN koden skrives.',
      mode: "Spec Wars + Assumption Slayer",
    },
  ];
  const s = scenarios[scenario];

  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
        Reveal bruger spilmekanikker til at gøre{" "}
        <strong style={{ color: C.txt }}>usikkerhed synlig</strong> — ikke for sjov, men for at tage{" "}
        <strong style={{ color: C.acc }}>bedre beslutninger</strong>.
      </div>

      {/* Scenario tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {scenarios.map((sc, i) => (
          <button key={i} onClick={() => setScenario(i)} style={{
            fontFamily: BF, fontSize: 11, padding: "6px 12px",
            background: scenario === i ? "rgba(224,92,92,0.15)" : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${scenario === i ? "rgba(224,92,92,0.5)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 6, color: scenario === i ? C.red : C.dim, cursor: "pointer",
          }}>
            {sc.icon} Scenario {i + 1}
          </button>
        ))}
      </div>

      {/* Scenario card */}
      <div style={{ padding: "18px 20px", background: C.bg2, border: `1px solid rgba(224,92,92,0.2)`, borderRadius: 10, animation: "slideUp 0.2s both" }}>
        <div style={{ fontFamily: PF, fontSize: 8, color: C.red, marginBottom: 10 }}>{s.icon} {s.title}</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>🔴 PROBLEMET:</div>
          <div style={{ fontSize: 12, color: C.txt, lineHeight: 1.6, padding: "10px 14px", background: "rgba(224,92,92,0.08)", border: "1px solid rgba(224,92,92,0.2)", borderRadius: 6 }}>
            "{s.problem}"
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>🟢 REVEAL-LØSNINGEN:</div>
          <div style={{ fontSize: 12, color: C.jade, lineHeight: 1.6, padding: "10px 14px", background: "rgba(56,183,100,0.08)", border: "1px solid rgba(56,183,100,0.2)", borderRadius: 6 }}>
            {s.solution}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>
            Relevant mode: <span style={{ color: C.acc }}>{s.mode}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(254,174,52,0.08)", border: "1px solid rgba(254,174,52,0.2)", borderRadius: 8, fontSize: 12, color: C.acc, lineHeight: 1.5 }}>
        ✨ Reveal bruger spilmekanikker til at gøre usikkerhed synlig — ikke for sjov, men for at tage bedre beslutninger.
      </div>
    </div>
  );
}

function ChapterPMPlatform() {
  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
        Reveal er en <strong style={{ color: C.txt }}>professionel PM-platform</strong> med et game-lag ovenpå.
        PM-data er altid source of truth — spil er advisory overlay.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { icon: "📁", title: "Projekter", desc: "Organiser arbejde i projekter. Aktive projekter vises i Dashboard.", color: C.jade },
          { icon: "📋", title: "Backlog", desc: "Items med estimater, status og aktuel sprint. Altid synkroniseret.", color: C.acc },
          { icon: "🏃", title: "Sprints", desc: "Aktive sprints med items, fremgang og velocity tracking.", color: C.cyan },
          { icon: "🎮", title: "Game Layer", desc: "Ovenpå PM-data. Advisory — ændrer ikke PM-data uden godkendelse.", color: C.epic },
        ].map((item, i) => (
          <div key={i} style={{ padding: "12px 14px", background: item.color + "0a", border: `1px solid ${item.color}22`, borderRadius: 8 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "14px 16px", background: "rgba(56,183,100,0.08)", border: "1px solid rgba(56,183,100,0.25)", borderRadius: 8 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.jade, marginBottom: 8 }}>💡 NØGLEPRINCIP</div>
        <div style={{ fontSize: 12, color: C.txt, lineHeight: 1.5 }}>
          Spilresultater (estimater, decisions, XP) er <strong>forslag</strong> til PM-systemet.
          PM godkender, hvad der opdateres. Ingen overwrite uden PM-action.
        </div>
      </div>
    </div>
  );
}

function ChapterEstimation() {
  const POKER_CARDS = [1, 2, 3, 5, 8, 13, 21];
  const [phase, setPhase] = useState("intro"); // intro | voting | reveal | summary
  const [userVote, setUserVote] = useState(null);
  const [npcVotes, setNpcVotes] = useState({});
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef(null);

  function startSession() {
    setPhase("voting");
    setUserVote(null);
    setNpcVotes({});
    setRevealed(false);
    // NPC votes with random delay
    NPC_TEAM.forEach((npc, i) => {
      const delay = 1000 + i * 800 + Math.random() * 500;
      const choices = [3, 5, 5, 8, 8, 13, 13];
      const vote = choices[Math.floor(Math.random() * choices.length)];
      timerRef.current = setTimeout(() => {
        setNpcVotes(prev => ({ ...prev, [npc.id]: vote }));
      }, delay);
    });
  }

  function handleUserVote(v) {
    setUserVote(v);
    setTimeout(() => setPhase("reveal"), 800);
  }

  function reveal() {
    setRevealed(true);
    setTimeout(() => setPhase("summary"), 1500);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const allVotes = userVote ? [userVote, ...Object.values(npcVotes)] : Object.values(npcVotes);
  const avg = allVotes.length ? Math.round(allVotes.reduce((a, b) => a + b, 0) / allVotes.length) : 0;
  const outliers = allVotes.filter(v => Math.abs(v - avg) > avg * 0.5);

  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
        <strong style={{ color: C.txt }}>4 modes til estimering</strong> — vælg den der passer til situationen.
      </div>

      {/* Mode preview cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 20 }}>
        {[
          { id: "planning_poker", label: "Sprint start, 3+ items", when: "Estimér story points simultant" },
          { id: "speed_scope",    label: "Tight tid, 10+ items", when: "10 sek per item, hurtig konsensus" },
          { id: "bluff_poker",    label: "Find outliers",          when: "Afsløre hvem der bluffer" },
          { id: "perspective_poker", label: "Kompleks opgave",    when: "Estimér fra forskellige roller" },
        ].map(m => {
          const mode = ALL_MODES.find(x => x.id === m.id);
          const zm = mode ? ZONE_META[mode.zone] : { color: C.acc };
          return (
            <div key={m.id} style={{ padding: "10px 12px", background: zm.color + "0a", border: `1px solid ${zm.color}22`, borderRadius: 7 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{mode?.icon}</span>
                <div style={{ fontFamily: PF, fontSize: 5, color: zm.color }}>{mode?.name}</div>
              </div>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>⏱ {m.when}</div>
              <div style={{ fontSize: 10, color: C.txt }}>✅ {m.label}</div>
            </div>
          );
        })}
      </div>

      {/* Simulated Planning Poker */}
      <div style={{ padding: "16px", background: C.bg2, border: "1px solid rgba(254,174,52,0.2)", borderRadius: 10 }}>
        <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, marginBottom: 12 }}>
          ⚔️ PRØV: PLANNING POKER SIMULERING
        </div>

        {phase === "intro" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Item: "Implementér søgefunktion"</div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 16, opacity: 0.7 }}>
              Mia, Jonas, Sara og Emil er klar til at stemme. Du vælger dit kort — alle afslører simultant.
            </div>
            <button onClick={startSession} style={{
              fontFamily: PF, fontSize: 7, padding: "10px 24px",
              background: "rgba(254,174,52,0.15)", border: "2px solid rgba(254,174,52,0.4)",
              borderRadius: 7, color: C.acc, cursor: "pointer",
            }}>
              ▶ START SESSION
            </button>
          </div>
        )}

        {phase === "voting" && (
          <>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, textAlign: "center" }}>
              Item: <strong style={{ color: C.txt }}>"Implementér søgefunktion"</strong>
            </div>
            {/* NPC row */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
              {NPC_TEAM.map(npc => (
                <NpcVote key={npc.id} npc={npc} vote={npcVotes[npc.id]} revealed={false} />
              ))}
            </div>
            {/* User cards */}
            <div style={{ fontSize: 10, color: C.dim, textAlign: "center", marginBottom: 8 }}>Vælg dit estimat (story points):</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {POKER_CARDS.map(v => (
                <button key={v} onClick={() => handleUserVote(v)} style={{
                  fontFamily: PF, fontSize: 12, width: 44, height: 60,
                  background: userVote === v ? "rgba(254,174,52,0.25)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${userVote === v ? C.acc : "rgba(255,255,255,0.15)"}`,
                  borderRadius: 6, color: userVote === v ? C.acc : C.txt, cursor: "pointer",
                  transition: "all 0.15s",
                  transform: userVote === v ? "translateY(-4px)" : "none",
                }}>
                  {v}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "reveal" && (
          <>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 12, textAlign: "center" }}>
              Alle har stemt — {Object.keys(npcVotes).length + (userVote ? 1 : 0)}/5 stemmer modtaget
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
              {NPC_TEAM.map(npc => (
                <NpcVote key={npc.id} npc={npc} vote={npcVotes[npc.id] || "?"} revealed={revealed} />
              ))}
              {userVote && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 12px", background: "rgba(254,174,52,0.15)", border: "1.5px solid rgba(254,174,52,0.4)", borderRadius: 8, minWidth: 64 }}>
                  <div style={{ fontSize: 20 }}>🎮</div>
                  <div style={{ fontFamily: PF, fontSize: 5, color: C.acc }}>Du</div>
                  <div style={{ fontFamily: PF, fontSize: 14, color: C.acc }}>{revealed ? userVote : "?"}</div>
                </div>
              )}
            </div>
            {!revealed && (
              <div style={{ textAlign: "center" }}>
                <button onClick={reveal} style={{
                  fontFamily: PF, fontSize: 7, padding: "10px 24px",
                  background: "rgba(254,174,52,0.18)", border: "2px solid rgba(254,174,52,0.5)",
                  borderRadius: 7, color: C.acc, cursor: "pointer",
                }}>
                  🃏 AFSLØR ALLE KORT
                </button>
              </div>
            )}
          </>
        )}

        {phase === "summary" && (
          <div style={{ animation: "slideUp 0.3s both" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
              {NPC_TEAM.map(npc => (
                <NpcVote key={npc.id} npc={npc} vote={npcVotes[npc.id] || "?"} revealed={true} />
              ))}
              {userVote && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 12px", background: "rgba(254,174,52,0.15)", border: "1.5px solid rgba(254,174,52,0.4)", borderRadius: 8, minWidth: 64 }}>
                  <div style={{ fontSize: 20 }}>🎮</div>
                  <div style={{ fontFamily: PF, fontSize: 5, color: C.acc }}>Du</div>
                  <div style={{ fontFamily: PF, fontSize: 14, color: C.acc }}>{userVote}</div>
                </div>
              )}
            </div>
            <div style={{ padding: "12px 16px", background: "rgba(56,183,100,0.1)", border: "1px solid rgba(56,183,100,0.25)", borderRadius: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.jade, fontWeight: 600, marginBottom: 4 }}>
                Gennemsnit: {avg} SP
                {outliers.length > 0 && <span style={{ color: C.red, marginLeft: 10 }}>⚠ Outliers detekteret!</span>}
              </div>
              {outliers.length > 0 && (
                <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>
                  Stor spredning i estimaterne — teamet har forskellig forståelse. Diskutér FØR I beslutter estimat.
                </div>
              )}
              {outliers.length === 0 && (
                <div style={{ fontSize: 11, color: C.dim }}>God konsensus — teamet er enige om estimatet.</div>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
              💾 Estimat gemmes til item. PM godkender efterfølgende.
            </div>
            <button onClick={() => setPhase("intro")} style={{
              fontSize: 11, padding: "6px 14px", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: C.dim, cursor: "pointer",
            }}>
              Prøv igen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterScope() {
  const modes = ["spec_wars", "nesting_scope", "refinement_roulette", "dependency_mapper", "truth_serum"];
  const WHEN = {
    spec_wars:           "Nye krav, usikre krav — skriv acceptance criteria FØRST",
    nesting_scope:       "Epics der er for store til én sprint — nedbryd dem nu",
    refinement_roulette: "Backlog grooming — groom tilfældig item, undgå estimerings-bias",
    dependency_mapper:   "Blokkere og afhæng. — kortlæg dem visuelt, find kritisk vej",
    truth_serum:         "Tavse bekymringer — anonymt bias-tjek af teamets antagelser",
  };
  const DATA_AFTER = {
    spec_wars:           "Acceptance criteria gemmes direkte på backlog item",
    nesting_scope:       "Child items oprettes automatisk under parent epic",
    refinement_roulette: "Items scorer og prioriteres baseret på team-voting",
    dependency_mapper:   "Dependencies kortlægges som relationer på sprint items",
    truth_serum:         "Bias-score gemmes, outliers flagges til PM",
  };
  const [selected, setSelected] = useState("spec_wars");
  const mode = ALL_MODES.find(m => m.id === selected);
  const zm = mode ? ZONE_META[mode.zone] : { color: C.cyan };

  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
        Disse 5 modes handler om at{" "}
        <strong style={{ color: C.txt }}>forstå hvad I skal bygge</strong> — FØR I estimerer.
        Estimerer I en opgave I ikke forstår, er estimatet meningsløst.
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        {modes.map(id => {
          const m = ALL_MODES.find(x => x.id === id);
          const z = m ? ZONE_META[m.zone] : { color: C.cyan };
          return (
            <button key={id} onClick={() => setSelected(id)} style={{
              fontFamily: BF, fontSize: 10, padding: "5px 10px",
              background: selected === id ? z.color + "18" : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${selected === id ? z.color + "55" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 5, color: selected === id ? z.color : C.dim, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span>{m?.icon}</span>{m?.name}
            </button>
          );
        })}
      </div>

      {/* Selected mode detail */}
      {mode && (
        <div style={{ padding: "16px", background: C.bg2, border: `1px solid ${zm.color}22`, borderRadius: 10, animation: "slideUp 0.15s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{mode.icon}</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 8, color: zm.color }}>{mode.name}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{mode.desc}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "10px 12px", background: zm.color + "0a", border: `1px solid ${zm.color}22`, borderRadius: 7 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>⏱ HVORNÅR BRUGER JEG DET?</div>
              <div style={{ fontSize: 12, color: C.txt }}>{WHEN[selected]}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "rgba(56,183,100,0.07)", border: "1px solid rgba(56,183,100,0.2)", borderRadius: 7 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>💾 HVAD SKER MED DATA BAGEFTER?</div>
              <div style={{ fontSize: 12, color: C.jade }}>{DATA_AFTER[selected]}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterStrategy() {
  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
        Disse 3 modes handler om at{" "}
        <strong style={{ color: C.txt }}>forstå jeres arbejdsmønster</strong> — ikke hvad I bygger, men{" "}
        <strong style={{ color: C.epic }}>hvordan I arbejder</strong>.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Risk Poker */}
        <div style={{ padding: "14px 16px", background: C.bg2, border: "1px solid rgba(181,80,136,0.2)", borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 7, color: C.epic, marginBottom: 5 }}>RISK POKER</div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
                Estimér sandsynlighed × konsekvens for risici. Output: risk matrix med prioriterede risici.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["🔴", "Høj"], ["🟡", "Medium"], ["🟢", "Lav"]].map(([e, l]) => (
                  <div key={l} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 4, fontSize: 10, color: C.dim }}>
                    {e} {l}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>
                ✅ Brug ved: Sprint start, nye projekter, Q-review<br />
                💾 Data: Risici oprettes som flagged items i backlog
              </div>
            </div>
          </div>
        </div>

        {/* Assumption Slayer */}
        <div style={{ padding: "14px 16px", background: C.bg2, border: "1px solid rgba(181,80,136,0.2)", borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>🐉</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 7, color: C.epic, marginBottom: 5 }}>ASSUMPTION SLAYER</div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
                Teamet lister antagelser. Rangerer dem: "Farligst hvis forkert" øverst. Dragon-boss dræbes når antagelse valideres.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { icon: "🐲", label: "Farlig antagelse", color: C.red },
                  { icon: "⚠️", label: "Moderat antagelse", color: C.acc },
                  { icon: "✅", label: "Valideret", color: C.jade },
                  { icon: "❓", label: "Ukendt", color: C.dim },
                ].map(item => (
                  <div key={item.label} style={{ padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 4, fontSize: 9, color: item.color, display: "flex", gap: 5 }}>
                    {item.icon} {item.label}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>
                ✅ Brug ved: Ny feature, usikre krav, pre-sprint planning<br />
                💾 Data: Antagelser gemmes som risk-notes på items
              </div>
            </div>
          </div>
        </div>

        {/* Flow Poker */}
        <div style={{ padding: "14px 16px", background: C.bg2, border: "1px solid rgba(181,80,136,0.2)", borderRadius: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>🌊</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 7, color: C.epic, marginBottom: 5 }}>FLOW POKER</div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
                Estimér cycle time frem for story points. Output: cycle time histogram, velocity prediction.
              </div>
              <div style={{ fontSize: 11, color: C.txt, padding: "8px 10px", background: "rgba(95,205,228,0.08)", border: "1px solid rgba(95,205,228,0.2)", borderRadius: 5 }}>
                📊 Cycle time-data akkumuleres over sprints → KPI Dashboard viser forbedring over tid
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>
                ✅ Brug ved: Kanban-teams, efter sprint-review, capacity planning<br />
                💾 Data: Actual hours og cycle time gemmes på session items
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterMissions({ organizationId }) {
  const [showEvent, setShowEvent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowEvent(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
        Missions holdes teamet engageret og peger mod det{" "}
        <strong style={{ color: C.txt }}>næste naturlige skridt</strong> — baseret på hvad jeres backlog mangler.
      </div>

      {/* Daily missions preview */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, letterSpacing: 2, marginBottom: 10 }}>
          ─ DAGLIGE MISSIONER ─
        </div>
        {[
          { icon: "⚔️", title: "Estimer sprint", desc: "Afhold en Planning Poker session", xp: 40, progress: 0.66 },
          { icon: "🔍", title: "Groom 3 items", desc: "3 backlog items mangler estimat", xp: 35, progress: 0 },
          { icon: "⚠️", title: "Risikoanalyse", desc: "Ingen risk-assessment denne sprint", xp: 35, progress: 0 },
        ].map((m, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", marginBottom: 6,
            background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 7,
          }}>
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ fontSize: 12, color: C.txt, fontWeight: 500 }}>{m.title}</div>
                <span style={{ fontSize: 10, color: C.acc }}>+{m.xp} XP</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 5 }}>{m.desc}</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${m.progress * 100}%`, background: C.jade, borderRadius: 2 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Side Quest */}
      <div style={{ padding: "12px 14px", background: "rgba(181,80,136,0.08)", border: "1px solid rgba(181,80,136,0.25)", borderRadius: 8, marginBottom: 14 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.epic, marginBottom: 6 }}>🏆 SIDE QUEST — UGE 12</div>
        <div style={{ fontSize: 12, color: C.txt, marginBottom: 3 }}>The Accuracy Challenge</div>
        <div style={{ fontSize: 11, color: C.dim }}>Opnå &gt;80% estimation accuracy i 3 sessioner denne uge · +150 XP</div>
        <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: "33%", background: C.epic, borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 9, color: C.dim, marginTop: 3 }}>1/3 sessioner gennemført</div>
      </div>

      {/* Random Event animation */}
      {showEvent && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(254,174,52,0.12)",
          border: "2px solid rgba(254,174,52,0.5)",
          borderRadius: 8,
          animation: "slideUp 0.3s both, availPulse 1.5s ease-in-out 0.3s 3",
        }}>
          <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, marginBottom: 4 }}>
            ⚡ RANDOM EVENT: GOLDEN HOUR!
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>Double XP de næste 2 timer! Sæt gang i spillet nu.</div>
          <div style={{ fontSize: 10, color: C.acc, marginTop: 4, fontWeight: 700 }}>✨ 2.0x XP aktiveret!</div>
        </div>
      )}
      {!showEvent && (
        <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(254,174,52,0.3)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: C.dim, textAlign: "center" }}>
            ⏳ Venter på random event...{" "}
            <span style={{ color: C.dim, fontSize: 9 }}>(10-15% chance per dag)</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
        💡 <strong style={{ color: C.txt }}>Randomnessen er designet</strong> til at holde teamet engageret — man ved aldrig hvornår der sker noget ekstra.
      </div>
    </div>
  );
}

function ChapterFeedback() {
  const [showAchieve, setShowAchieve] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowAchieve(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const accuracyData = [65, 72, 68, 80, 84, 79, 88];

  return (
    <div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
        Hvert spil giver data. Over tid ser I{" "}
        <strong style={{ color: C.jade }}>forbedringen</strong> — ikke kun i XP, men i faktisk team-performance.
      </div>

      {/* PostSessionSummary preview */}
      <div style={{ padding: "14px 16px", background: C.bg2, border: "1px solid rgba(56,183,100,0.2)", borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.jade, marginBottom: 10 }}>📊 POST-SESSION SUMMARY</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Accuracy", value: "84%", color: C.jade },
            { label: "Konsensus", value: "4/5", color: C.acc },
            { label: "XP optjent", value: "+85", color: C.epic },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "8px", background: s.color + "0a", borderRadius: 6 }}>
              <div style={{ fontFamily: PF, fontSize: 11, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.dim }}>
          ✅ Estimater godkendt af PM → items opdateret · Outliers flagget til diskussion
        </div>
      </div>

      {/* Accuracy trend */}
      <div style={{ padding: "14px 16px", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.cyan, marginBottom: 10 }}>📈 ACCURACY TREND (7 SPRINTS)</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
          {accuracyData.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ fontSize: 7, color: C.dim }}>{v}%</div>
              <div style={{
                width: "100%", background: v >= 80 ? C.jade : C.acc,
                borderRadius: "2px 2px 0 0",
                height: `${(v / 100) * 50}px`,
                transition: "height 0.5s ease",
                boxShadow: v >= 80 ? `0 0 6px ${C.jade}44` : "none",
              }} />
              <div style={{ fontSize: 6, color: C.dim }}>S{i + 6}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: C.jade }}>↗ +23% accuracy over 7 sprints</div>
      </div>

      {/* Achievement unlock */}
      {showAchieve && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(181,80,136,0.12)",
          border: "2px solid rgba(181,80,136,0.4)",
          borderRadius: 8, marginBottom: 14,
          animation: "slideUp 0.4s both",
        }}>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.epic, marginBottom: 4 }}>🏆 ACHIEVEMENT UNLOCKED!</div>
          <div style={{ fontSize: 13, marginBottom: 2 }}>🎯 The Estimator</div>
          <div style={{ fontSize: 11, color: C.dim }}>Deltag i 5 Planning Poker sessioner · +100 XP</div>
        </div>
      )}

      {/* Invite team CTA */}
      <div style={{ padding: "14px 16px", background: "rgba(254,174,52,0.08)", border: "1px solid rgba(254,174,52,0.25)", borderRadius: 8 }}>
        <div style={{ fontFamily: PF, fontSize: 6, color: C.acc, marginBottom: 8 }}>👥 INVITÉR TEAMET</div>
        <div style={{ fontSize: 12, color: C.txt, marginBottom: 6 }}>
          Reveal virker bedst med hele teamet. Invitér via Workspace Settings → Team & Roller.
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>
          Team-members får automatisk adgang til alle aktive spil og missions.
        </div>
      </div>
    </div>
  );
}

// ─── Chapter Registry ─────────────────────────────────────────────────────────
const CHAPTER_COMPONENTS = {
  problem:     ChapterProblem,
  pm_platform: ChapterPMPlatform,
  estimation:  ChapterEstimation,
  scope:       ChapterScope,
  strategy:    ChapterStrategy,
  missions:    ChapterMissions,
  feedback:    ChapterFeedback,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OnboardingWalkthrough({ user, organizationId, onDone }) {
  const [currentChapter, setCurrentChapter] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).chapter || 0;
    } catch {}
    return 0;
  });
  const [completed, setCompleted] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).completed || [];
    } catch {}
    return [];
  });

  function saveProgress(chapter, completedArr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chapter, completed: completedArr }));
    } catch {}
  }

  function goTo(idx) {
    setCurrentChapter(idx);
    saveProgress(idx, completed);
  }

  function next() {
    const newCompleted = completed.includes(currentChapter) ? completed : [...completed, currentChapter];
    setCompleted(newCompleted);
    if (currentChapter >= CHAPTERS.length - 1) {
      saveProgress(currentChapter, newCompleted);
      onDone && onDone();
    } else {
      const next = currentChapter + 1;
      setCurrentChapter(next);
      saveProgress(next, newCompleted);
    }
  }

  const chapter = CHAPTERS[currentChapter];
  const ChapterContent = CHAPTER_COMPONENTS[chapter.id] || (() => null);
  const isLast = currentChapter === CHAPTERS.length - 1;
  const progressPct = ((currentChapter) / (CHAPTERS.length - 1)) * 100;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: "'system-ui', sans-serif" }}>
      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(14,16,25,0.95)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 24px",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, letterSpacing: 1 }}>
              📖 KOM I GANG — KAPITEL {currentChapter + 1} AF {CHAPTERS.length}
            </div>
            <button onClick={onDone} style={{
              fontSize: 10, color: C.dim, background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline",
            }}>
              Spring over
            </button>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, background: C.acc,
              width: `${progressPct}%`, transition: "width 0.4s ease",
              boxShadow: `0 0 6px ${C.acc}66`,
            }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 24px 80px" }}>
        {/* Chapter nav pills */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 24 }}>
          {CHAPTERS.map((ch, i) => {
            const isDone = completed.includes(i);
            const isCurrent = i === currentChapter;
            return (
              <button
                key={ch.id}
                onClick={() => goTo(i)}
                title={`${ch.num}. ${ch.title} (${ch.duration})`}
                style={{
                  fontFamily: PF, fontSize: 5, padding: "5px 9px",
                  background: isCurrent ? ch.color + "22" : isDone ? "rgba(56,183,100,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isCurrent ? ch.color + "88" : isDone ? "rgba(56,183,100,0.3)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 5,
                  color: isCurrent ? ch.color : isDone ? C.jade : C.dim,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {isDone ? "✓" : ch.num}. {ch.emoji}
              </button>
            );
          })}
        </div>

        {/* Chapter header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 32 }}>{chapter.emoji}</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 10, color: chapter.color, letterSpacing: 1 }}>
                KAPITEL {chapter.num}: {chapter.title.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                ⏱ {chapter.duration} · {chapter.summary}
              </div>
            </div>
          </div>
        </div>

        {/* Chapter content */}
        <div key={chapter.id} style={{ animation: "slideUp 0.25s both" }}>
          <ChapterContent organizationId={organizationId} user={user} />
        </div>

        {/* Navigation */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
          background: "rgba(14,16,25,0.95)", backdropFilter: "blur(12px)",
          borderTop: `1px solid ${C.border}`,
          padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          maxWidth: "100%",
        }}>
          <button
            onClick={() => goTo(Math.max(0, currentChapter - 1))}
            disabled={currentChapter === 0}
            style={{
              fontFamily: PF, fontSize: 6, padding: "9px 16px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6, color: currentChapter === 0 ? C.dim : C.txt,
              cursor: currentChapter === 0 ? "not-allowed" : "pointer",
              opacity: currentChapter === 0 ? 0.4 : 1,
            }}
          >
            ← FORRIGE
          </button>

          <div style={{ fontSize: 10, color: C.dim, textAlign: "center" }}>
            {currentChapter + 1} / {CHAPTERS.length}
            <div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>
              {completed.length} af {CHAPTERS.length} fuldført
            </div>
          </div>

          <button
            onClick={next}
            style={{
              fontFamily: PF, fontSize: 6, padding: "9px 20px",
              background: chapter.color + "22",
              border: `2px solid ${chapter.color + "66"}`,
              borderRadius: 6, color: chapter.color, cursor: "pointer",
              boxShadow: `0 0 12px ${chapter.color}22`,
              transition: "all 0.15s",
            }}
          >
            {isLast ? "✓ AFSLUT →" : "NÆSTE →"}
          </button>
        </div>
      </div>
    </div>
  );
}
