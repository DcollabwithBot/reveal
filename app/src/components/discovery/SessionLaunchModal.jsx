import { useState, useEffect } from "react";
import { PF, BF } from "../../shared/constants.js";
import { supabase } from "../../lib/supabase.js";
import { fetchItemsForSprint } from "../../lib/helpers/projectHelpers.js";
import { handleError } from "../../lib/errorHandler.js";

const C = {
  bg: "#0e1019", bg2: "#1a1230", bg3: "#251940",
  border: "rgba(255,255,255,0.08)", borderHover: "rgba(255,255,255,0.15)",
  txt: "#d4c5f9", dim: "#7c6d8a", acc: "#feae34", jade: "#38b764",
  epic: "#b55088", red: "#e05c5c",
};

const ZONE_COLORS = {
  scrum:    "#38b764",
  scope:    "#feae34",
  speed:    "#5fcde4",
  strategy: "#b55088",
};

const MODE_META = {
  planning_poker:      { bestFor: "Sprint start, backlog refinement", duration: "30-60 min" },
  sprint_draft:        { bestFor: "Sprint planning, ny sprint", duration: "45-90 min" },
  refinement_roulette: { bestFor: "Backlog grooming, prioritering", duration: "30-60 min" },
  dependency_mapper:   { bestFor: "Find blokkere og afhæng.", duration: "30-45 min" },
  boss_battle_retro:   { bestFor: "Sprint retrospective", duration: "45-90 min" },
  spec_wars:           { bestFor: "Acceptance criteria, krav", duration: "20-40 min" },
  perspective_poker:   { bestFor: "Rollebaseret estimering", duration: "30-50 min" },
  nesting_scope:       { bestFor: "Opdel epics i sub-tasks", duration: "20-35 min" },
  truth_serum:         { bestFor: "Afslør skjult bias", duration: "25-40 min" },
  speed_scope:         { bestFor: "Hurtige estimater, tight tid", duration: "10-20 min" },
  bluff_poker:         { bestFor: "Find blufferen, estimer anderledes", duration: "20-30 min" },
  flow_poker:          { bestFor: "Cycle time, kanban flow", duration: "30-45 min" },
  risk_poker:          { bestFor: "Risici, usikkerheder", duration: "25-40 min" },
  assumption_slayer:   { bestFor: "Farlige antagelser, gaps", duration: "30-50 min" },
};

function TimeLeftLabel({ activeUntil }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function update() {
      if (!activeUntil) return;
      const diff = new Date(activeUntil).getTime() - Date.now();
      if (diff <= 0) { setLabel("Udløbet"); return; }
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) setLabel(`${hours}t ${mins}m`);
      else setLabel(`${mins} min`);
    }
    update();
    const i = setInterval(update, 30000);
    return () => clearInterval(i);
  }, [activeUntil]);
  return <>{label}</>;
}

export default function SessionLaunchModal({
  mode,             // ALL_MODES entry
  activeMissions = [],
  activeRandomEvent = null,
  organizationId,
  projectId,        // optional — if provided, fetch sprint items for this project
  onStart,          // ({ mode, selectedItems }) => void
  onClose,
}) {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [sprintName, setSprintName] = useState(null);
  const [hasActiveSprint, setHasActiveSprint] = useState(null); // null=unknown, true/false
  const [starting, setStarting] = useState(false);

  const zoneColor = ZONE_COLORS[mode?.zone] || C.acc;
  const meta = MODE_META[mode?.id] || {};

  // Missions relevant to this mode
  const relevantMissions = activeMissions.filter(m =>
    m.required_mode === mode?.id || m.mode === mode?.id ||
    (!m.required_mode && !m.mode)
  );

  // Load backlog items: prefer project's active sprint, fallback to org-level
  useEffect(() => {
    if (!mode) return;

    if (projectId) {
      // Fetch active sprint for this project, then items from sprint
      setLoadingItems(true);
      setHasActiveSprint(null);
      supabase
        .from("sprints")
        .select("id, name")
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle()
        .then(async ({ data: sprint, error: sprintErr }) => {
          if (sprintErr) handleError(sprintErr, "fetch-sprint");
          if (!sprint) {
            setHasActiveSprint(false);
            setItems([]);
            setLoadingItems(false);
            return;
          }
          setHasActiveSprint(true);
          setSprintName(sprint.name);
          try {
            const sprintItems = await fetchItemsForSprint(sprint.id, {
              fields: "id, title, description, item_status, estimated_hours, priority",
            });
            // Filter out done items
            const nonDone = sprintItems.filter(
              (i) => i.item_status !== "done" && i.item_status !== "completed"
            );
            setItems(nonDone);
          } catch (e) {
            handleError(e, "fetch-sprint-items");
            setItems([]);
          }
          setLoadingItems(false);
        })
        .catch((e) => {
          handleError(e, "fetch-sprint");
          setLoadingItems(false);
        });
    } else if (organizationId) {
      // Fallback: org-level items without sprint filter
      setLoadingItems(true);
      setHasActiveSprint(null);
      supabase
        .from("session_items")
        .select("id, title, description, estimated_hours, item_status, sprint_id")
        .eq("organization_id", organizationId)
        .is("sprint_id", null)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setItems(data || []);
          setLoadingItems(false);
        })
        .catch(() => setLoadingItems(false));
    }
  }, [projectId, organizationId, mode?.id]);

  function toggleItem(id) {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedItems(items.map(i => i.id));
  }

  function deselectAll() {
    setSelectedItems([]);
  }

  function handleStart() {
    if (starting) return;
    setStarting(true);
    onStart && onStart({ mode, selectedItems });
  }

  if (!mode) return null;

  const totalItems = items.length;
  const selectedCount = selectedItems.length;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: C.bg2, border: `2px solid ${zoneColor}55`,
        borderRadius: 14, width: "100%", maxWidth: 520,
        boxShadow: `0 0 40px ${zoneColor}22, 0 20px 60px rgba(0,0,0,0.6)`,
        fontFamily: BF, overflow: "hidden",
        animation: "slideUp 0.2s both",
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${zoneColor}18, transparent)`,
          padding: "20px 24px 14px",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 36 }}>{mode.icon}</span>
              <div>
                <div style={{ fontFamily: PF, fontSize: 9, color: zoneColor, letterSpacing: 1, marginBottom: 3 }}>
                  {mode.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.4 }}>{mode.desc}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: C.dim, fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1, marginTop: -2 }}
            >
              ✕
            </button>
          </div>

          {/* Best for */}
          {meta.bestFor && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: C.jade }}>✅</span>
              <span style={{ fontSize: 11, color: C.dim }}>
                <strong style={{ color: C.txt }}>Best for:</strong> {meta.bestFor}
              </span>
              {meta.duration && (
                <>
                  <span style={{ color: C.dim, opacity: 0.4 }}>·</span>
                  <span style={{ fontSize: 11, color: C.dim }}>⏱ {meta.duration}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", maxHeight: "60vh", overflowY: "auto" }}>

          {/* Random Event Banner */}
          {activeRandomEvent && (
            <div style={{
              marginBottom: 14,
              padding: "10px 14px",
              background: "rgba(254,174,52,0.12)",
              border: "1.5px solid rgba(254,174,52,0.4)",
              borderRadius: 8,
              animation: "availPulse 1.5s ease-in-out infinite",
            }}>
              <div style={{ fontFamily: PF, fontSize: 6, color: C.acc, marginBottom: 3 }}>
                ⚡ {activeRandomEvent.title || "RANDOM EVENT!"}
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>
                {activeRandomEvent.description}
                {activeRandomEvent.active_until && (
                  <span style={{ marginLeft: 6, color: C.acc }}>
                    · <TimeLeftLabel activeUntil={activeRandomEvent.active_until} /> tilbage
                  </span>
                )}
              </div>
              {activeRandomEvent.xp_multiplier > 1 && (
                <div style={{ marginTop: 4, fontSize: 10, color: C.acc, fontWeight: 700 }}>
                  ✨ {activeRandomEvent.xp_multiplier}x XP på denne session!
                </div>
              )}
            </div>
          )}

          {/* Active Missions */}
          {relevantMissions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 7 }}>🎯 Aktive missions der løses her:</div>
              {relevantMissions.slice(0, 3).map((m, i) => (
                <div key={m.mission_id || i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", marginBottom: 5,
                  background: "rgba(56,183,100,0.08)",
                  border: "1px solid rgba(56,183,100,0.2)",
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: 14 }}>{m.icon || "🎯"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.jade, fontWeight: 600 }}>{m.title}</div>
                    {typeof m.progress === "number" && m.progress > 0 && (
                      <div style={{ fontSize: 10, color: C.dim }}>
                        Fremgang: {Math.round(m.progress * 100)}%
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: C.acc, background: C.acc + "18", padding: "2px 7px", borderRadius: 4 }}>
                    +{m.xp_reward} XP
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Item selection */}
          <div style={{ marginBottom: 16 }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.dim }}>
                📋 {sprintName ? `Items i sprint: ${sprintName}` : "Vælg items til sessionen"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {totalItems > 0 && (
                  <span style={{ fontSize: 10, color: zoneColor }}>
                    {selectedCount} af {totalItems} items valgt
                  </span>
                )}
              </div>
            </div>

            {/* Select all / Deselect all */}
            {totalItems > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button
                  onClick={selectAll}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 5,
                    border: `1px solid ${zoneColor}55`,
                    background: zoneColor + "14",
                    color: zoneColor, cursor: "pointer",
                  }}
                >
                  Vælg alle
                </button>
                <button
                  onClick={deselectAll}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 5,
                    border: `1px solid ${C.border}`,
                    background: "rgba(255,255,255,0.03)",
                    color: C.dim, cursor: "pointer",
                  }}
                >
                  Fravælg alle
                </button>
              </div>
            )}

            {loadingItems ? (
              <div style={{ fontSize: 11, color: C.dim, textAlign: "center", padding: 12 }}>
                Indlæser items...
              </div>
            ) : hasActiveSprint === false ? (
              <div style={{
                fontSize: 11, color: C.dim, textAlign: "center",
                padding: "12px 14px", background: "rgba(255,255,255,0.03)",
                border: `1px solid ${C.border}`, borderRadius: 6,
              }}>
                Ingen items i aktiv sprint.
                <div style={{ marginTop: 4, opacity: 0.6 }}>Session startes uden PM-kontekst.</div>
              </div>
            ) : items.length === 0 && hasActiveSprint !== null ? (
              <div style={{
                fontSize: 11, color: C.dim, textAlign: "center",
                padding: "10px 14px", background: "rgba(255,255,255,0.03)",
                border: `1px solid ${C.border}`, borderRadius: 6,
              }}>
                Ingen items i aktiv sprint.
                <div style={{ marginTop: 4, opacity: 0.6 }}>Session startes uden PM-kontekst.</div>
              </div>
            ) : items.length === 0 && !loadingItems ? (
              <div style={{
                fontSize: 11, color: C.dim, textAlign: "center",
                padding: "10px 14px", background: "rgba(255,255,255,0.03)",
                border: `1px solid ${C.border}`, borderRadius: 6,
              }}>
                Ingen backlog items tilgængelige.
                <div style={{ marginTop: 4, opacity: 0.6 }}>Session startes med tomme items.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
                {items.map(item => {
                  const sel = selectedItems.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px",
                        background: sel ? zoneColor + "14" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${sel ? zoneColor + "55" : C.border}`,
                        borderRadius: 6, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: `2px solid ${sel ? zoneColor : C.dim}`,
                        background: sel ? zoneColor : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, fontSize: 8, color: "#fff", fontWeight: 700,
                      }}>
                        {sel && "✓"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: sel ? zoneColor : C.txt, fontWeight: sel ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                        {item.estimated_hours && (
                          <div style={{ fontSize: 10, color: C.dim }}>~{item.estimated_hours}h</div>
                        )}
                      </div>
                      {item.item_status && (
                        <span style={{ fontSize: 9, color: C.dim, whiteSpace: "nowrap" }}>
                          {item.item_status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px",
          borderTop: `1px solid ${C.border}`,
          background: C.bg,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: BF, fontSize: 12, padding: "10px 18px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`, borderRadius: 8,
              color: C.dim, cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            Annuller
          </button>
          <button
            onClick={handleStart}
            disabled={starting}
            style={{
              fontFamily: PF, fontSize: 7, padding: "12px 0",
              background: starting ? C.dim + "22" : `linear-gradient(135deg, ${zoneColor}cc, ${zoneColor})`,
              border: `2px solid ${starting ? C.dim : zoneColor}`,
              borderRadius: 8, color: "#fff",
              cursor: starting ? "not-allowed" : "pointer",
              flex: 1, letterSpacing: 1,
              boxShadow: starting ? "none" : `0 0 16px ${zoneColor}44`,
              transition: "all 0.2s",
            }}
          >
            {starting ? "STARTER..." : `▶ START SESSION →`}
          </button>
        </div>
      </div>
    </div>
  );
}
