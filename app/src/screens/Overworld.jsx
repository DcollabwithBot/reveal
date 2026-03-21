import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { C, PF, NPC_TEAM, CLASSES } from "../shared/constants.js";
import { dk, pick } from "../shared/utils.js";

const BLU = "#4488dd", RED = "#dd4444", GRN = "#44bb66", EVT = "#ff8844", PUR = "#aa44cc";
const BUBS = ["Klar!", "Lad os gå!", "💪", "🔥", "Focus!", "Nice!", "Hmm...", "👀", "Go go!", "⭐", "Ez!", "🎯"];

const AVATAR_CLASS_MAP = Object.fromEntries(CLASSES.map(c => [c.id, c]));
const NPC_SKIN_TONES = ["#fdd", "#fed", "#edc", "#ffe", "#fec", "#dbc", "#c9a"];

// Build team from avatar + real members (or NPC_TEAM fallback)
function buildTeam(avatar, realMembers) {
  const player = {
    id: 0, name: "Du", isP: true,
    hat: avatar?.helmet?.pv || avatar?.cls?.color || "#f04f78",
    body: avatar?.armor?.pv || avatar?.cls?.color || "#f04f78",
    btc: avatar?.boots?.pv || dk(avatar?.cls?.color || "#f04f78", 60),
    skin: avatar?.skin || "#fdd",
    cls: avatar?.cls || { icon: "⚔️", color: "#f04f78" },
  };
  const npcs = realMembers && realMembers.length > 0
    ? realMembers.map((m, i) => {
        const cls = AVATAR_CLASS_MAP[m.profiles?.avatar_class] || CLASSES[i % CLASSES.length];
        return {
          id: m.user_id,
          name: m.profiles?.display_name || `Member ${i + 1}`,
          lv: m.profiles?.level || 1,
          cls,
          hat: cls.color,
          body: cls.color,
          skin: NPC_SKIN_TONES[i % NPC_SKIN_TONES.length],
        };
      })
    : NPC_TEAM.map(m => ({ ...m, hat: m.hat, body: m.body, skin: m.skin, cls: m.cls }));
  return [player, ...npcs];
}

// Map item to node color based on type/risk
function nodeColor(item) {
  if (item.risk_flag) return PUR;
  if (item.priority === 'high') return RED;
  if (item.item_status === 'in_progress') return BLU;
  return GRN;
}

// Map item to node icon
function nodeIcon(item) {
  if (item.risk_flag) return "👾";
  if (item.priority === 'high') return "⚡";
  if (item.item_status === 'in_progress') return "🔧";
  return "🃏";
}

export default function Overworld({ project, avatar, userId, organizationId: orgIdProp, onBack, onNode, sound }) {
  const [t, setT] = useState(0);
  const [hov, setHov] = useState(null);
  const [flash, setFlash] = useState(null);
  const [shake, setShake] = useState(false);
  const [popup, setPopup] = useState(null);
  const [bubs, setBubs] = useState({});
  const [entering, setEntering] = useState(null);
  const [dice, setDice] = useState(null);
  const [dRoll, setDRoll] = useState(false);
  const [dResult, setDResult] = useState(null);
  const [weather, setWeather] = useState([]);
  const [fetchedNodes, setFetchedNodes] = useState(null);
  const [fetchedPaths, setFetchedPaths] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [bossInfo, setBossInfo] = useState(null);
  const [realMembers, setRealMembers] = useState(null);
  const [userXP, setUserXP] = useState(null);
  const [userProg, setUserProg] = useState(null); // { prog, tot }

  const projectId = project?.projectId || project?.id;
  // organization_id can come from prop OR from the project object itself
  const orgId = orgIdProp || project?.organization_id;

  // Fetch real data from Supabase
  useEffect(() => {
    if (!projectId) { setDataLoading(false); return; }

    async function fetchData() {
      try {
        // 1. Get active sprints for the project
        const { data: sprints, error: sprintErr } = await supabase
          .from('sprints')
          .select('id, name, status, end_date')
          .eq('project_id', projectId)
          .eq('status', 'active');

        if (sprintErr || !sprints || sprints.length === 0) {
          // No active sprints — show empty state
          setFetchedNodes([{
            id: 'empty', name: 'Ingen opgaver endnu', l: 'Ingen opgaver endnu',
            tp: 'c', dn: false, cur: true,
            x: 480, y: 220, c: EVT, i: '❓',
          }]);
          setFetchedPaths([]);
          setBossInfo(null);
          setDataLoading(false);
          return;
        }

        // 2. Get items for active sprints
        const sprintIds = sprints.map(s => s.id);
        const { data: items, error: itemErr } = await supabase
          .from('session_items')
          .select('id, title, description, item_status, final_estimate, risk_score, risk_flag, sprint_id, item_order, priority')
          .in('sprint_id', sprintIds)
          .neq('item_status', 'done')
          .order('item_order', { ascending: true })
          .limit(20);

        if (itemErr || !items || items.length === 0) {
          setFetchedNodes([{
            id: 'empty', name: 'Ingen opgaver endnu', l: 'Ingen opgaver endnu',
            tp: 'c', dn: false, cur: true,
            x: 480, y: 220, c: EVT, i: '❓',
          }]);
          setFetchedPaths([]);
          setBossInfo(null);
          setDataLoading(false);
          return;
        }

        // 3. Map items to nodes
        const nodes = items.map((item, i) => ({
          id: item.id,
          name: item.title,
          l: item.title,
          tp: item.risk_flag ? 'b' : 'p',
          dn: item.item_status === 'done' || item.item_status === 'completed',
          cur: i === 0, // first node is current
          x: 200 + (i % 4) * 180,
          y: 160 + Math.floor(i / 4) * 100,
          c: nodeColor(item),
          i: nodeIcon(item),
          // Keep original item data for session launch
          _item: item,
        }));

        // 4. Auto-generate paths (sequential chain)
        const paths = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          paths.push([i, i + 1]);
        }

        // 5. Boss info from sprint deadline
        const sprintWithDeadline = sprints.find(s => s.end_date);
        if (sprintWithDeadline) {
          const now = new Date();
          const end = new Date(sprintWithDeadline.end_date);
          const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
          const sprintDuration = 14; // default 14 days
          const hp = Math.min(100, Math.round((daysLeft / sprintDuration) * 100));
          setBossInfo({ name: sprintWithDeadline.name, daysLeft, hp, endDate: sprintWithDeadline.end_date });
        } else {
          setBossInfo(null);
        }

        setFetchedNodes(nodes);
        setFetchedPaths(paths);
      } catch (err) {
        console.error('Overworld fetch error:', err);
        setFetchedNodes([]);
        setFetchedPaths([]);
      } finally {
        setDataLoading(false);
      }
    }

    fetchData();
  }, [projectId]);

  // Fetch real org members for team display
  useEffect(() => {
    if (!orgId) { setRealMembers(null); return; }
    supabase
      .from('organization_members')
      .select('user_id, profiles(display_name, avatar_class, xp, level)')
      .eq('organization_id', orgId)
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setRealMembers(data);
        else setRealMembers(null);
      })
      .catch(() => setRealMembers(null));
  }, [orgId]);

  // Fetch real user XP
  useEffect(() => {
    if (!userId) { setUserXP(null); return; }
    supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setUserXP(data.xp ?? 0);
      })
      .catch(() => setUserXP(null));
  }, [userId]);

  // Compute real prog/tot from fetched nodes
  useEffect(() => {
    if (!fetchedNodes || fetchedNodes.length === 0) { setUserProg(null); return; }
    const tot = fetchedNodes.filter(n => n.id !== 'empty').length;
    const done = fetchedNodes.filter(n => n.dn).length;
    setUserProg({ prog: done, tot: tot || 1 });
  }, [fetchedNodes]);

  const NODES = fetchedNodes ?? (project?.nodes || []);
  const PATHS = fetchedPaths ?? (project?.paths || []);
  const TEAM = buildTeam(avatar, realMembers);

  useEffect(() => { const i = setInterval(() => setT(v => v + 1), 50); return () => clearInterval(i); }, []);

  // NPC speech bubbles — use actual NPC ids from TEAM
  useEffect(() => {
    const npcIds = TEAM.filter(m => !m.isP).map(m => m.id);
    const i = setInterval(() => {
      const ni = npcIds[Math.floor(Math.random() * npcIds.length)];
      setBubs(p => ({ ...p, [ni]: pick(BUBS) }));
      sound("npc");
      setTimeout(() => setBubs(p => { const n = { ...p }; delete n[ni]; return n; }), 2200);
    }, 3500);
    return () => clearInterval(i);
  }, []);

  // Weather particles — functional update, no weather in deps
  useEffect(() => {
    const i = setInterval(() => {
      setWeather(prev => {
        const next = prev.map(w => ({ ...w, y: w.y + w.sp })).filter(w => w.y < 110);
        if (next.length < 8) return [...next, { id: Date.now(), x: Math.random() * 100, y: -5, sp: 0.5 + Math.random() * 0.5 }];
        return next;
      });
    }, 200);
    return () => clearInterval(i);
  }, []);

  function clickNode(n) {
    if (n.tp === "b") { sound("boss"); setShake(true); setTimeout(() => setShake(false), 400); }
    else sound("select");
    setPopup(n);
  }

  function enterNode() {
    setDRoll(true); sound("dice"); let r = 0;
    const final = Math.floor(Math.random() * 6) + 1;
    const i = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1); r++; sound("click");
      if (r > 12) {
        clearInterval(i); setDice(final); setDResult(final); sound("enter");
        setTimeout(() => {
          setDRoll(false);
          setEntering(popup.id);
          setFlash(popup.tp === "b" ? C.pur : C.wht);
          setTimeout(() => {
            setFlash(null); setEntering(null);
            const nodeToEnter = popup;
            setPopup(null); setDResult(null);
            onNode(nodeToEnter);
          }, 700);
        }, 800);
      }
    }, 80);
  }

  const W = 1000, H = 480;
  const curN = NODES.find(n => n.cur);
  const pP = curN ? { x: curN.x, y: curN.y - 28 } : { x: 560, y: 170 };
  const nO = [{ dx: -28, dy: 12 }, { dx: 28, dy: 16 }, { dx: -18, dy: 32 }];

  function dC(m, x, y, sz = 1, isP = false) {
    const blink = t % 35 < 2;
    const by = y + (isP ? Math.sin(t * 0.06) * 2 : 0);
    return (
      <g key={m.id || m.name} transform={`translate(${x},${by})`}>
        <ellipse cx={0} cy={12 * sz} rx={7 * sz} ry={2.5 * sz} fill="rgba(0,0,0,0.15)" />
        <rect x={-6 * sz} y={-16 * sz} width={12 * sz} height={4 * sz} fill={m.hat} />
        <rect x={-5 * sz} y={-12 * sz} width={10 * sz} height={8 * sz} fill={m.skin} />
        {!blink && <><rect x={-3 * sz} y={-8 * sz} width={2 * sz} height={2 * sz} fill="#111" /><rect x={1 * sz} y={-8 * sz} width={2 * sz} height={2 * sz} fill="#111" /></>}
        <rect x={-7 * sz} y={-4 * sz} width={14 * sz} height={10 * sz} fill={m.body || m.hat} />
        <text x={9 * sz} y={2 * sz} fontSize={`${10 * sz}px`} opacity="0.7" transform={`rotate(${-20 + Math.sin(t * 0.08) * 6},${9 * sz},${2 * sz})`}>{m.cls?.icon || "⚔️"}</text>
        <rect x={-4 * sz} y={6 * sz} width={3.5 * sz} height={4 * sz} fill={dk(m.body || m.hat, 60)} />
        <rect x={1 * sz} y={6 * sz} width={3.5 * sz} height={4 * sz} fill={dk(m.body || m.hat, 60)} />
        {isP && <polygon points={`-4,${-20 * sz} 4,${-20 * sz} 0,${-16 * sz - 2}`} fill={C.acc} opacity="0.8">
          <animate attributeName="transform" type="translate" values="0,-3;0,2;0,-3" dur="0.8s" repeatCount="indefinite" />
        </polygon>}
        <text x={0} y={16 * sz} textAnchor="middle" fontFamily={PF} fontSize={`${3.5 * sz}px`} fill={isP ? C.acc : C.wht}>{m.name}</text>
        {bubs[m.id] && <g>
          <rect x={-22} y={-34 * sz} width={44} height={13} fill={C.bg + "ee"} stroke={m.hat} strokeWidth="1.5" rx="3" />
          <polygon points={`-2,${-21 * sz} 2,${-21 * sz} 0,${-18 * sz}`} fill={C.bg + "ee"} />
          <text x={0} y={-34 * sz + 10} textAnchor="middle" fontFamily={PF} fontSize="4px" fill={C.wht}>{bubs[m.id]}</text>
        </g>}
      </g>
    );
  }

  if (dataLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: '12px' }}>
        <div style={{ color: 'var(--jade, #44bb66)', fontFamily: PF, fontSize: '10px', letterSpacing: '2px' }}>INDLÆSER VERDEN...</div>
        <div style={{ width: '120px', height: '6px', background: C.bgL || '#1a1c2e', border: '1px solid #374151', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '60%', background: 'linear-gradient(90deg, #4c1d95, #7c3aed)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      {flash && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: flash, opacity: 0.35, pointerEvents: "none", zIndex: 200, animation: "flashOut 0.4s ease-out forwards" }} />}

      {/* Dice roll overlay */}
      {dRoll && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 150 }}>
        <div style={{ animation: dResult ? "pop 0.4s ease-out" : "diceRoll 0.15s linear infinite" }}>
          <div style={{ width: "70px", height: "70px", background: C.wht, border: `4px solid ${dResult ? C.gld : C.bg}`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", boxShadow: `0 0 ${dResult ? 30 : 15}px ${dResult ? C.gld : C.wht}44` }}>{dice || "🎲"}</div>
        </div>
        {dResult && <div style={{ fontFamily: PF, fontSize: "10px", color: C.gld, marginTop: "12px", animation: "pop 0.3s" }}>{dResult >= 4 ? "GODT SLAG! 🎉" : "NORMALT SLAG"}</div>}
        {dResult && <div style={{ fontFamily: PF, fontSize: "5px", color: C.xp, marginTop: "4px" }}>+{dResult * 5} BONUS XP</div>}
      </div>}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "5px 10px", background: C.bgC, borderBottom: `3px solid ${C.brd}`, gap: "5px" }}>
        <button onClick={() => { sound("click"); onBack(); }} style={{ fontFamily: PF, fontSize: "6px", color: C.wht, background: C.bgL, border: `3px solid ${C.bgL}`, borderBottom: `5px solid ${C.bg}`, padding: "4px 8px", cursor: "pointer" }}>←</button>
        <span style={{ fontSize: "12px" }}>{project?.icon}</span>
        <span style={{ fontFamily: PF, fontSize: "6px", color: project?.color || C.grn }}>{project?.name}</span>
        <span style={{ fontFamily: PF, fontSize: "3.5px", color: C.dim, marginLeft: "3px" }}>{project?.sprint}</span>
        <div style={{ flex: 1 }} />
        {TEAM.map(m => <div key={m.id || m.name} style={{ width: "14px", height: "14px", background: (m.hat || "#444") + "33", border: `2px solid ${m.hat || "#444"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "6px" }}>{m.cls?.icon || "⚔️"}</div>)}
        <span style={{ fontFamily: PF, fontSize: "4px", color: C.xp, marginLeft: "3px" }}>⭐{userXP !== null ? userXP : (project?.xp ?? 0)}</span>
        <div style={{ width: "60px", height: "5px", background: C.bg, border: `2px solid ${dk(project?.color || C.grn)}`, overflow: "hidden", marginLeft: "3px" }}>
          <div style={{ height: "100%", width: `${((userProg?.prog ?? project?.prog ?? 0) / (userProg?.tot ?? project?.tot ?? 1)) * 100}%`, background: project?.color || C.grn }} />
        </div>
        <span style={{ fontFamily: PF, fontSize: "3.5px", color: project?.color || C.grn }}>{userProg?.prog ?? project?.prog ?? 0}/{userProg?.tot ?? project?.tot ?? 0}</span>
        {bossInfo && <>
          <span data-tour="overworld-boss" style={{ fontFamily: PF, fontSize: "3.5px", color: C.red, marginLeft: "6px" }}>👾 {bossInfo.daysLeft}d</span>
          <div style={{ width: "40px", height: "5px", background: C.bg, border: `2px solid ${C.red}`, overflow: "hidden", marginLeft: "2px" }}>
            <div style={{ height: "100%", width: `${bossInfo.hp}%`, background: bossInfo.hp > 30 ? C.red : '#ff2222', transition: 'width 0.5s' }} />
          </div>
        </>}
      </div>

      {/* MAP */}
      <div style={{ flex: 1, minHeight: 0, padding: "3px", animation: shake ? "mapShake 0.4s" : "none" }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <radialGradient id="bg"><stop offset="0%" stopColor={C.pur} stopOpacity="0.15" /><stop offset="100%" stopColor={C.pur} stopOpacity="0" /></radialGradient>
            <radialGradient id="sun"><stop offset="0%" stopColor="#ffe477" stopOpacity="0.3" /><stop offset="100%" stopColor="#ffe477" stopOpacity="0" /></radialGradient>
          </defs>

          {/* Ocean */}
          <rect width={W} height={H} fill="#1a5080" />
          {Array.from({ length: 35 }).map((_, i) => <ellipse key={i} cx={i * 30 + Math.sin(t * 0.02 + i) * 12} cy={15 + i * 14 + Math.cos(t * 0.015 + i * 0.8) * 8} rx={20 + Math.sin(t * 0.025 + i) * 5} ry={4 + Math.sin(t * 0.02 + i) * 1.5} fill="#2568a0" opacity={0.1 + Math.sin(t * 0.018 + i) * 0.05} />)}
          {Array.from({ length: 12 }).map((_, i) => <circle key={`sp${i}`} cx={40 + i * 82 + Math.sin(t * 0.03 + i) * 15} cy={25 + i * 38 + Math.cos(t * 0.025 + i * 2) * 12} r={1.5} fill={C.wht} opacity={0.05 + Math.sin(t * 0.04 + i) * 0.04} />)}

          {/* Sun */}
          <circle cx={920} cy={35} r={18 + Math.sin(t * 0.02) * 2} fill="#ffe477" opacity="0.85" />
          <circle cx={920} cy={35} r={35} fill="url(#sun)" />

          {/* Clouds */}
          {[{ x: 50, y: 28, s: 1.3 }, { x: 300, y: 15, s: 0.9 }, { x: 600, y: 35, s: 1.1 }, { x: 850, y: 20, s: 0.7 }].map((cl, i) => {
            const bx = (cl.x + t * 0.3 * (0.8 + i * 0.15)) % (W + 80);
            return <g key={i} opacity={0.35 + Math.sin(t * 0.008 + i) * 0.1}><rect x={bx} y={cl.y} width={35 * cl.s} height={14 * cl.s} fill="#fff" rx="0" /><rect x={bx + 10 * cl.s} y={cl.y - 7 * cl.s} width={18 * cl.s} height={9 * cl.s} fill="#fff" /></g>;
          })}

          {/* Birds */}
          {[{ x: 100, y: 42, sp: 0.5 }, { x: 500, y: 28, sp: 0.35 }, { x: 780, y: 50, sp: 0.45 }].map((bd, i) => <g key={i} transform={`translate(${(bd.x + t * bd.sp) % (W + 50)},${bd.y + Math.sin(t * 0.12 + i * 4) * 3})`}><path d={`M-4,0 Q-2,${Math.sin(t * 0.2 + i) > 0 ? -3 : -1} 0,0 Q2,${Math.sin(t * 0.2 + i) > 0 ? -3 : -1} 4,0`} fill="none" stroke="#333" strokeWidth="1.5" opacity="0.3" /></g>)}

          {/* Island */}
          <ellipse cx={480} cy={278} rx={385} ry={162} fill="#44aa55" stroke="#338844" strokeWidth="4" />
          <ellipse cx={480} cy={278} rx={365} ry={148} fill="#55cc66" />
          <ellipse cx={480} cy={282} rx={355} ry={138} fill="#66dd77" opacity="0.4" />

          {/* Beach */}
          {[{ cx: 200, cy: 395, rx: 60, ry: 12 }, { cx: 700, cy: 380, rx: 55, ry: 11 }, { cx: 480, cy: 410, rx: 70, ry: 10 }].map((b, i) => <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="#e8d090" opacity="0.3" />)}

          {/* Boss zone */}
          <ellipse cx={870} cy={178} rx={82} ry={58} fill="#5a2060" stroke="#441550" strokeWidth="3" />
          <ellipse cx={870} cy={178} rx={72} ry={48} fill="#6a3070" />
          <circle cx={870} cy={178} r={62 + Math.sin(t * 0.03) * 5} fill="url(#bg)" />
          {t % 55 < 2 && <line x1={845 + Math.random() * 50} y1={118} x2={855 + Math.random() * 25} y2={158} stroke="#aa88ff" strokeWidth="2.5" opacity="0.6" />}
          {[{ x: 820, y: 210 }, { x: 920, y: 215 }].map((sk, i) => <text key={i} x={sk.x} y={sk.y + Math.sin(t * 0.03 + i) * 2} fontSize="8px" opacity="0.25">💀</text>)}
          <rect x={752} y={207} width={52} height={12} fill="#8B6914" stroke="#6B4F10" strokeWidth="2" rx="2" />

          {/* Hill */}
          <ellipse cx={130} cy={178} rx={72} ry={52} fill="#44aa55" stroke="#338844" strokeWidth="3" />
          <ellipse cx={130} cy={178} rx={62} ry={42} fill="#55cc66" />

          {/* Trees */}
          {[{ x: 150, y: 118 }, { x: 800, y: 348 }, { x: 250, y: 368 }, { x: 680, y: 338 }, { x: 350, y: 98 }, { x: 100, y: 300 }, { x: 900, y: 300 }].map((tr, i) => <g key={`t${i}`} transform={`rotate(${Math.sin(t * 0.012 + i * 2) * 1.5},${tr.x},${tr.y + 10})`}><rect x={tr.x - 2} y={tr.y} width={5} height={12} fill="#8B6914" /><circle cx={tr.x} cy={tr.y - 5} r={10} fill="#338844" /><circle cx={tr.x} cy={tr.y - 10} r={7} fill="#44aa55" /></g>)}

          {/* Flowers */}
          {[{ x: 200, y: 340 }, { x: 400, y: 310 }, { x: 600, y: 298 }, { x: 300, y: 198 }, { x: 550, y: 138 }].map((fl, i) => <text key={i} x={fl.x} y={fl.y + Math.sin(t * 0.025 + i) * 2} fontSize="8px" opacity="0.4">{["🌸", "🌼", "🌺", "💮", "🌻"][i]}</text>)}

          {/* Grass */}
          {Array.from({ length: 25 }).map((_, i) => { const gx = 180 + Math.sin(i * 2.3) * 260; const gy = 175 + Math.cos(i * 1.7) * 85; return <rect key={i} x={gx} y={gy} width="4" height={`${3 + Math.sin(t * 0.03 + i) * 1}`} fill="#88ee88" opacity="0.2" transform={`rotate(${Math.sin(t * 0.02 + i) * 8},${gx + 2},${gy + 3})`} />; })}

          {/* Butterflies */}
          {[{ x: 350, y: 168 }, { x: 600, y: 278 }].map((bf, i) => <text key={i} x={bf.x + Math.sin(t * 0.018 + i * 4) * 22} y={bf.y + Math.cos(t * 0.02 + i * 3) * 14} fontSize="8px" opacity="0.35">🦋</text>)}

          <text x={460} y={345} fontSize="10px" opacity={0.1 + Math.sin(t * 0.04) * 0.1}>💰</text>
          {weather.map(w => <circle key={w.id} cx={`${w.x}%`} cy={`${w.y}%`} r="2" fill={C.grnL} opacity="0.15" />)}

          {/* Paths */}
          {PATHS.map(([a, b], i) => {
            const n1 = NODES[a], n2 = NODES[b];
            if (!n1 || !n2) return null;
            const dn = n1.dn && n2.dn;
            return <g key={i}>
              <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={dn ? "#f4e8c1" : "#fff"} strokeWidth={dn ? "5" : "3"} strokeDasharray={dn ? "none" : "8,6"} opacity={dn ? 0.7 : 0.2} strokeLinecap="round" />
              {dn && <circle cx={(n1.x + n2.x) / 2} cy={(n1.y + n2.y) / 2} r="3" fill={C.gld} opacity="0.2" />}
            </g>;
          })}

          {/* Nodes */}
          <g data-tour="overworld-nodes">
          {NODES.map(n => {
            const isH = hov === n.id, cur = n.cur, dn = n.dn, boss = n.tp === "b", side = n.tp === "q" || n.tp === "c";
            const lock = !dn && !cur && !side, can = cur || (side && !dn), r = boss ? 24 : side ? 16 : 20, isE = entering === n.id;
            return (
              <g key={n.id} onMouseEnter={() => { setHov(n.id); if (can) sound("click"); }} onMouseLeave={() => setHov(null)} onClick={() => { if (can) clickNode(n); }} style={{ cursor: can ? "pointer" : "default" }}>
                {(cur || isH) && can && <circle cx={n.x} cy={n.y} r={r + 10} fill="none" stroke={cur ? C.acc : n.c} strokeWidth="2" opacity="0.2"><animate attributeName="r" values={`${r + 8};${r + 14};${r + 8}`} dur="1.5s" repeatCount="indefinite" /></circle>}
                {dn && n.tp !== "s" && [0, 1, 2].map(si => <circle key={si} cx={n.x + Math.cos(t * 0.04 + si * 2.1) * r * 1.2} cy={n.y + Math.sin(t * 0.04 + si * 2.1) * r * 1.2} r="2" fill={C.gld} opacity={0.2 + Math.sin(t * 0.05 + si) * 0.12} />)}
                {boss && !dn && [0, 1, 2, 3, 4].map(fi => <text key={fi} x={n.x + Math.cos(t * 0.05 + fi * 1.2) * r * 1.1} y={n.y - r + Math.sin(t * 0.04 + fi) * 12 - 5} fontSize="10px" opacity={0.3 + Math.sin(t * 0.06 + fi) * 0.15}>🔥</text>)}
                {n.tp === "r" && !lock && <circle cx={n.x} cy={n.y} r={r + 3} fill="none" stroke={n.c} strokeWidth="1" strokeDasharray="4,4" opacity="0.3" transform={`rotate(${t * 2},${n.x},${n.y})`} />}
                <ellipse cx={n.x} cy={n.y + r * 0.6} rx={r * 0.9} ry={r * 0.25} fill="rgba(0,0,0,0.15)" />
                <circle cx={n.x} cy={n.y} r={r} fill={lock ? "#444" : n.c} stroke={lock ? "#333" : dk(n.c, 30)} strokeWidth="3" />
                <circle cx={n.x} cy={n.y} r={r - 3} fill="none" stroke={C.wht} strokeWidth="2" strokeDasharray={`${r * 0.8},${r * 4}`} opacity={lock ? 0.05 : 0.25} transform={`rotate(-45,${n.x},${n.y})`} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" dominantBaseline="middle" fontSize={boss ? "22px" : side ? "13px" : "16px"} style={{ filter: lock ? "grayscale(1) opacity(0.3)" : "none" }}>{lock ? "🔒" : n.i}</text>
                {dn && n.id > 0 && <><circle cx={n.x + r * 0.7} cy={n.y - r * 0.7} r="8" fill={C.grn} stroke={C.bg} strokeWidth="2" /><text x={n.x + r * 0.7} y={n.y - r * 0.7 + 3} textAnchor="middle" fontSize="8px" fill={C.wht}>✓</text></>}
                {cur && <polygon points={`${n.x - 5},${n.y - r - 18} ${n.x + 5},${n.y - r - 18} ${n.x},${n.y - r - 8}`} fill={C.acc}><animate attributeName="transform" type="translate" values="0,-4;0,2;0,-4" dur="0.8s" repeatCount="indefinite" /></polygon>}
                {boss && !dn && <><rect x={n.x - 28} y={n.y - r - 16} width="56" height="13" fill={C.pur} stroke={C.bg} strokeWidth="2" rx="2" /><text x={n.x} y={n.y - r - 7} textAnchor="middle" fontFamily={PF} fontSize="5px" fill={C.wht}>⚔️ BOSS</text></>}
                {side && !dn && !lock && <text x={n.x + r * 0.8} y={n.y - r * 0.8} fontSize="10px" fill={C.yel}><animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />★</text>}
                {isH && <><rect x={n.x - 32} y={n.y + r + 6} width="64" height="14" fill={C.bg + "ee"} stroke={n.c} strokeWidth="2" rx="2" /><text x={n.x} y={n.y + r + 16} textAnchor="middle" fontFamily={PF} fontSize="5px" fill={C.wht}>{n.l}</text></>}
                {isE && <circle cx={n.x} cy={n.y} r={r} fill={n.tp === "b" ? C.pur : C.wht} opacity="0.3"><animate attributeName="r" values={`${r};${r * 4}`} dur="0.6s" /><animate attributeName="opacity" values="0.4;0" dur="0.6s" /></circle>}
              </g>
            );
          })}

          </g>

          {/* NPC party around player */}
          {TEAM.filter(m => !m.isP).slice(0, 3).map((m, i) => {
            const o = nO[i] || { dx: 0, dy: 20 };
            return dC(m, pP.x + o.dx + Math.sin(t * 0.008 + i * 2) * 3, pP.y + o.dy + Math.cos(t * 0.01 + i * 3) * 2, 0.9);
          })}
          {dC(TEAM[0], pP.x, pP.y, 1.1, true)}

          {/* Floating dice near player */}
          <g transform={`translate(${pP.x + 25},${pP.y - 15})`}>
            <rect x={-8} y={-8} width={16} height={16} fill={C.wht} stroke={C.bg} strokeWidth="2" rx="2" transform={`rotate(${Math.sin(t * 0.03) * 5})`} />
            <text x={0} y={3} textAnchor="middle" fontSize="10px" fontWeight="bold">{Math.floor(t / 8) % 6 + 1}</text>
          </g>

          {/* Goal near boss */}
          <text x={870} y={128} textAnchor="middle" fontSize="20px" opacity={0.5 + Math.sin(t * 0.04) * 0.2}>⭐</text>
          <text x={870} y={146} textAnchor="middle" fontFamily={PF} fontSize="4.5px" fill={C.gld} opacity="0.5">{(project?.tot || 0) - (project?.prog || 0)} LEFT</text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "2px 0", background: C.bg }}>
        {[{ c: BLU, l: "Poker" }, { c: RED, l: "Roulette" }, { c: GRN, l: "Check" }, { c: EVT, l: "Event" }, { c: PUR, l: "Boss" }].map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: x.c }} />
            <span style={{ fontFamily: PF, fontSize: "3px", color: C.dim }}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* Node popup */}
      {popup && !dRoll && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "fadeIn 0.2s" }} onClick={() => setPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: `linear-gradient(135deg,${C.bgC},${C.bgL})`, border: `3px solid ${popup.tp === "b" ? C.pur : popup.c}`, boxShadow: `0 0 30px ${(popup.tp === "b" ? C.pur : popup.c)}44`, padding: "18px 24px", maxWidth: "320px", animation: "pop 0.3s", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: popup.c, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", boxShadow: `0 0 15px ${popup.c}44`, animation: "float 1.5s ease-in-out infinite" }}>{popup.i}</div>
            <div style={{ fontFamily: PF, fontSize: "10px", color: C.wht, marginBottom: "3px" }}>{popup.l}</div>
            <div style={{ fontFamily: PF, fontSize: "5px", color: popup.c, marginBottom: "8px" }}>
              {popup.tp === "p" ? "🃏 Planning Poker" : popup.tp === "r" ? "🎰 Scope Roulette" : popup.tp === "b" ? "👾 Boss Battle" : popup.tp === "q" ? "⚡ Side Quest" : "⛳ Checkpoint"}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "10px" }}>
              <div style={{ textAlign: "center", padding: "4px 8px", background: C.bg + "88", border: `1px solid ${C.brd}` }}><div style={{ fontFamily: PF, fontSize: "3px", color: C.dim }}>SVÆRHED</div><div style={{ fontFamily: PF, fontSize: "7px", color: popup.tp === "b" ? C.red : popup.tp === "r" ? C.yel : C.grn }}>{popup.tp === "b" ? "★★★" : popup.tp === "r" ? "★★" : "★"}</div></div>
              <div style={{ textAlign: "center", padding: "4px 8px", background: C.bg + "88", border: `1px solid ${C.brd}` }}><div style={{ fontFamily: PF, fontSize: "3px", color: C.dim }}>BELØNNING</div><div style={{ fontFamily: PF, fontSize: "7px", color: C.xp }}>+{popup.tp === "b" ? 80 : popup.tp === "r" ? 50 : 30} XP</div></div>
              <div style={{ textAlign: "center", padding: "4px 8px", background: C.bg + "88", border: `1px solid ${C.brd}` }}><div style={{ fontFamily: PF, fontSize: "3px", color: C.dim }}>TID</div><div style={{ fontFamily: PF, fontSize: "7px", color: C.txt }}>{popup.tp === "b" ? "15m" : popup.tp === "r" ? "8m" : "5m"}</div></div>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button onClick={enterNode} style={{ fontFamily: PF, fontSize: "8px", color: C.wht, background: popup.tp === "b" ? C.pur : C.grn, border: `3px solid ${popup.tp === "b" ? C.pur : C.grn}`, borderBottom: `5px solid ${C.bg}`, padding: "10px 18px", cursor: "pointer", letterSpacing: "1px", animation: "pulse 1.5s ease-in-out infinite" }}>🎲 ROLL & START!</button>
              <button onClick={() => setPopup(null)} style={{ fontFamily: PF, fontSize: "6px", color: C.dim, background: C.bgL, border: `3px solid ${C.brd}`, borderBottom: `5px solid ${C.bg}`, padding: "10px 12px", cursor: "pointer" }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
