import { useState, useEffect } from "react";
import { PF, BF } from "../shared/constants.js";
import { supabase } from "../lib/supabase.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function edgeFn(fnName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

const C = {
  bg:  "#0e1019",
  bg2: "#1a1230",
  bg3: "#221840",
  border: "rgba(255,255,255,0.08)",
  txt: "#d4c5f9",
  dim: "#7c6d8a",
  acc: "#feae34",
  jade: "#38b764",
  epic: "#b55088",
  cyan: "#5fcde4",
};

const EVENT_META = {
  cursed_sprint:  { icon: "💀", color: "#e05c5c", label: "Cursed Sprint" },
  golden_hour:    { icon: "✨", color: "#feae34", label: "Golden Hour" },
  mystery_mode:   { icon: "🎲", color: "#b55088", label: "Mystery Mode" },
  boss_rush:      { icon: "⚡", color: "#5fcde4", label: "Boss Rush" },
  xp_storm:       { icon: "🌪️", color: "#feae34", label: "XP Storm" },
};

const MISSION_TYPE_META = {
  daily:          { icon: "🎯", color: C.acc,  label: "Daglig" },
  side_quest:     { icon: "🏆", color: C.epic, label: "Side Quest" },
  bonus:          { icon: "⭐", color: C.jade, label: "Bonus" },
  slip_the_beast: { icon: "🐲", color: "#e05c5c", label: "Slip The Beast" },
};

function ProgressBar({ progress, color }) {
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 5 }}>
      <div style={{
        height: "100%", borderRadius: 2,
        width: `${Math.min(100, (progress || 0) * 100)}%`,
        background: color || C.acc,
        transition: "width 0.5s ease",
        boxShadow: `0 0 4px ${color || C.acc}66`,
      }} />
    </div>
  );
}

function MissionCard({ mission, showType = true }) {
  const typeMeta = MISSION_TYPE_META[mission.mission_type || mission.mission_category] || MISSION_TYPE_META.daily;
  const isCompleted = mission.status === "completed" || mission.progress >= 1;
  const isExpired = mission.expires_at && new Date(mission.expires_at) < new Date() && !isCompleted;

  return (
    <div style={{
      padding: "12px 14px", marginBottom: 8,
      background: isCompleted ? "rgba(56,183,100,0.06)" : isExpired ? "rgba(255,255,255,0.02)" : C.bg2,
      border: `1px solid ${isCompleted ? "rgba(56,183,100,0.25)" : isExpired ? "rgba(255,255,255,0.04)" : C.border}`,
      borderRadius: 8,
      opacity: isExpired ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20, flexShrink: 0, filter: isExpired ? "grayscale(1)" : "none" }}>
          {isCompleted ? "✅" : mission.icon || typeMeta.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isCompleted ? C.jade : isExpired ? C.dim : C.txt, textDecoration: isExpired ? "line-through" : "none" }}>
              {mission.title}
            </div>
            {showType && (
              <span style={{ fontSize: 9, padding: "1px 5px", background: typeMeta.color + "22", border: `1px solid ${typeMeta.color}44`, borderRadius: 4, color: typeMeta.color, fontWeight: 600, flexShrink: 0 }}>
                {typeMeta.label.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4, marginBottom: isCompleted ? 0 : 4 }}>
            {mission.description}
          </div>
          {!isCompleted && !isExpired && (
            <ProgressBar progress={mission.progress} color={typeMeta.color} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5 }}>
            {mission.xp_reward && (
              <span style={{ fontSize: 10, color: isCompleted ? C.jade : C.acc, fontWeight: 600 }}>
                {isCompleted ? "✓ XP optjent" : `+${mission.xp_reward} XP`}
              </span>
            )}
            {mission.required_mode && (
              <span style={{ fontSize: 9, color: C.dim }}>
                via {mission.required_mode.replace(/_/g, " ")}
              </span>
            )}
            {mission.difficulty && mission.difficulty !== "normal" && (
              <span style={{ fontSize: 9, color: mission.difficulty === "hard" ? "#e05c5c" : mission.difficulty === "expert" ? "#b55088" : C.dim }}>
                {mission.difficulty === "easy" ? "🟢" : mission.difficulty === "hard" ? "🔴" : "🟣"} {mission.difficulty}
              </span>
            )}
            {mission.expires_at && !isCompleted && !isExpired && (
              <span style={{ fontSize: 9, color: C.dim }}>
                {mission.mission_type === "side_quest" ? "Slutter " : "Udløber "}
                {new Date(mission.expires_at).toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
            {isExpired && <span style={{ fontSize: 9, color: "#e05c5c" }}>Udløbet</span>}
            {isCompleted && mission.completed_at && (
              <span style={{ fontSize: 9, color: C.dim }}>
                Fuldført {new Date(mission.completed_at).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventHistoryCard({ event }) {
  const meta = EVENT_META[event.event_type] || { icon: "⚡", color: C.acc, label: event.event_type };
  const isActive = new Date(event.active_until) > new Date();
  return (
    <div style={{
      padding: "12px 14px", marginBottom: 8,
      background: C.bg2, border: `1px solid ${isActive ? meta.color + "44" : C.border}`, borderRadius: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{event.title || meta.label}</div>
            {isActive && (
              <span style={{ fontSize: 9, padding: "1px 6px", background: meta.color + "22", border: `1px solid ${meta.color}55`, borderRadius: 4, color: meta.color, animation: "availPulse 1.4s ease-in-out infinite" }}>
                AKTIV
              </span>
            )}
          </div>
          {event.description && (
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{event.description}</div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {event.xp_multiplier > 1 && (
              <span style={{ fontSize: 10, color: C.acc, fontWeight: 600 }}>✨ {event.xp_multiplier}x XP</span>
            )}
            <span style={{ fontSize: 9, color: C.dim }}>
              {isActive ? "Aktiv til: " : "Sluttede: "}
              {new Date(event.active_until).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              {" "}
              {new Date(event.active_until).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestLogScreen({ organizationId, onBack }) {
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [activeMissions, setActiveMissions] = useState([]);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [randomEvents, setRandomEvents] = useState([]);
  const [missionData, setMissionData] = useState(null);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    Promise.all([
      edgeFn("generate-missions", { org_id: organizationId }),
      supabase.from("user_missions")
        .select("*, missions(*)")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(30)
        .then(r => r.data || []),
      supabase.from("random_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(r => r.data || []),
    ]).then(([missData, completed, events]) => {
      setMissionData(missData);
      const daily = (missData?.missions || []).map(m => ({ ...m, mission_type: m.mission_type || "daily" }));
      const bonus = missData?.bonus_mission ? [{ ...missData.bonus_mission, mission_type: "bonus" }] : [];
      const slip  = missData?.slip_the_beast ? [{ ...missData.slip_the_beast, mission_type: "slip_the_beast" }] : [];
      const side  = (missData?.active_side_quests || []).map(m => ({ ...m, mission_type: "side_quest" }));
      setActiveMissions([...daily, ...bonus, ...slip, ...side]);
      setCompletedMissions(completed.map(um => ({
        ...um,
        ...um.missions,
        status: "completed",
        mission_type: um.mission_type || "daily",
        completed_at: um.completed_at,
        xp_earned: um.xp_earned,
      })));
      setRandomEvents(events);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [organizationId]);

  const tabs = [
    { id: "active",    label: "🎯 Aktive",      count: activeMissions.filter(m => m.status !== "completed").length },
    { id: "history",   label: "📜 Historik",     count: completedMissions.length },
    { id: "events",    label: "⚡ Events",       count: randomEvents.filter(e => new Date(e.active_until) > new Date()).length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: "'Press Start 2P', monospace" }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(14,16,25,0.92)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 10, fontFamily: PF, padding: "4px 0" }}>
            ← TILBAGE
          </button>
        )}
        <span style={{ color: C.border }}>|</span>
        <span style={{ fontSize: 10, color: C.acc, letterSpacing: 2 }}>📜 QUEST LOG</span>
        {missionData && (
          <span style={{ fontSize: 9, color: C.dim, fontFamily: BF, marginLeft: "auto" }}>
            Team XP: {missionData.total_team_xp?.toLocaleString() || 0} · Vanskelighed: {missionData.difficulty || "normal"}
          </span>
        )}
      </div>

      <div style={{ padding: "24px 24px", maxWidth: 700, margin: "0 auto" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              fontFamily: PF, fontSize: 6, padding: "8px 14px",
              background: tab === t.id ? C.acc + "22" : "rgba(255,255,255,0.03)",
              border: `2px solid ${tab === t.id ? C.acc : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, color: tab === t.id ? C.acc : C.dim,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ fontSize: 8, background: tab === t.id ? C.acc : C.dim, color: "#000", borderRadius: "50%", width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: BF }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: C.dim, fontFamily: BF, fontSize: 12 }}>
            Indlæser quest log...
          </div>
        )}

        {/* ACTIVE missions */}
        {!loading && tab === "active" && (
          <>
            {activeMissions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.dim, fontFamily: BF }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📜</div>
                <div style={{ fontSize: 12 }}>Ingen aktive missions.</div>
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>Kom i gang med et spil for at låse op!</div>
              </div>
            ) : (
              <>
                {/* Daily */}
                {activeMissions.filter(m => m.mission_type === "daily").length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, letterSpacing: 2, marginBottom: 10 }}>
                      ─ DAGLIGE MISSIONER ─
                    </div>
                    {activeMissions.filter(m => m.mission_type === "daily").map((m, i) => (
                      <MissionCard key={m.mission_id || i} mission={m} showType={false} />
                    ))}
                  </div>
                )}
                {/* Bonus / Slip */}
                {activeMissions.filter(m => ["bonus", "slip_the_beast"].includes(m.mission_type)).map((m, i) => (
                  <MissionCard key={m.mission_id || i} mission={m} />
                ))}
                {/* Side Quests */}
                {activeMissions.filter(m => m.mission_type === "side_quest").length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontFamily: PF, fontSize: 7, color: C.epic, letterSpacing: 2, marginBottom: 10 }}>
                      ─ SIDE QUESTS ─
                    </div>
                    {activeMissions.filter(m => m.mission_type === "side_quest").map((m, i) => (
                      <MissionCard key={m.mission_id || i} mission={m} showType={false} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* HISTORY */}
        {!loading && tab === "history" && (
          <>
            {completedMissions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.dim, fontFamily: BF }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
                <div style={{ fontSize: 12 }}>Ingen fuldførte missions endnu.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 12, letterSpacing: 1 }}>
                  {completedMissions.length} MISSIONER FULDFØRT
                </div>
                {completedMissions.map((m, i) => (
                  <MissionCard key={m.mission_id || i} mission={m} />
                ))}
              </>
            )}
          </>
        )}

        {/* RANDOM EVENTS */}
        {!loading && tab === "events" && (
          <>
            {randomEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.dim, fontFamily: BF }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 12 }}>Ingen random events endnu.</div>
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>De dukker op med 10-15% chance per dag.</div>
              </div>
            ) : (
              <>
                {randomEvents.filter(e => new Date(e.active_until) > new Date()).length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: PF, fontSize: 7, color: C.acc, letterSpacing: 2, marginBottom: 10 }}>
                      ─ AKTIVE EVENTS ─
                    </div>
                    {randomEvents.filter(e => new Date(e.active_until) > new Date()).map((ev, i) => (
                      <EventHistoryCard key={ev.id || i} event={ev} />
                    ))}
                  </div>
                )}
                {randomEvents.filter(e => new Date(e.active_until) <= new Date()).length > 0 && (
                  <div>
                    <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, letterSpacing: 2, marginBottom: 10 }}>
                      ─ HISTORIK ─
                    </div>
                    {randomEvents.filter(e => new Date(e.active_until) <= new Date()).map((ev, i) => (
                      <EventHistoryCard key={ev.id || i} event={ev} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
