/**
 * PMModeSelector — DEL 5A
 * PM kan manuelt vælge specifik game mode (ikke kun anbefalet).
 * Modal med alle 14 modes som preview-cards. Filter på zone + varighed.
 */
import { useState } from "react";
import { PF, BF } from "../../shared/constants.js";
import { ALL_MODES, ZONE_META } from "./SituationalRecommender.jsx";

const DURATION_FILTERS = [
  { id: "all",       label: "Alle" },
  { id: "quick",     label: "Hurtig (≤20 min)", maxMin: 20 },
  { id: "medium",    label: "30-45 min",         minMin: 21, maxMin: 45 },
  { id: "long",      label: "60+ min",            minMin: 46 },
];

const MODE_DURATION_MAP = {
  planning_poker:      45, sprint_draft:      75, refinement_roulette: 45,
  dependency_mapper:   40, boss_battle_retro: 60, spec_wars:           30,
  perspective_poker:   40, nesting_scope:     28, truth_serum:         33,
  speed_scope:         15, bluff_poker:       25, flow_poker:          38,
  risk_poker:          33, assumption_slayer: 40,
};

const DIFFICULTY_LABELS = {
  easy:   { label: "Nem",    color: "#38b764" },
  normal: { label: "Normal", color: "#feae34" },
  hard:   { label: "Svær",   color: "#e05c5c" },
};

const MODE_DIFFICULTY = {
  speed_scope: "easy", bluff_poker: "easy", nesting_scope: "easy",
  planning_poker: "normal", refinement_roulette: "normal", dependency_mapper: "normal",
  spec_wars: "normal", perspective_poker: "normal", flow_poker: "normal",
  risk_poker: "normal", assumption_slayer: "hard",
  sprint_draft: "hard", boss_battle_retro: "hard", truth_serum: "hard",
};

export default function PMModeSelector({ onSelect, onClose, enabledModes = null }) {
  const [zoneFilter, setZoneFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [hovered, setHovered] = useState(null);

  const filtered = ALL_MODES.filter(m => {
    if (enabledModes && !enabledModes[m.id]) return false;
    if (zoneFilter !== "all" && m.zone !== zoneFilter) return false;
    const dur = MODE_DURATION_MAP[m.id] || 30;
    const df = DURATION_FILTERS.find(d => d.id === durationFilter);
    if (df && df.id !== "all") {
      if (df.maxMin && dur > df.maxMin) return false;
      if (df.minMin && dur < df.minMin) return false;
    }
    return true;
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto",
    }}>
      <div style={{
        background: "#1a1230", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14, width: "100%", maxWidth: 780,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        fontFamily: "'system-ui', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontFamily: PF, fontSize: 8, color: "#feae34", letterSpacing: 2, marginBottom: 3 }}>
              🎮 VÆLG SPILMODE
            </div>
            <div style={{ fontSize: 11, color: "#7c6d8a" }}>
              {filtered.length} modes tilgængelige · Vælg den der passer til situationen
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7c6d8a", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Filters */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {/* Zone filter */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#7c6d8a", marginRight: 3 }}>Zone:</span>
            {[{ id: "all", label: "Alle", color: "#feae34" }, ...Object.entries(ZONE_META).map(([id, m]) => ({ id, label: m.label.replace(" Zone", ""), color: m.color, icon: m.icon }))].map(z => (
              <button key={z.id} onClick={() => setZoneFilter(z.id)} style={{
                fontFamily: BF, fontSize: 10, padding: "4px 9px",
                background: zoneFilter === z.id ? z.color + "22" : "rgba(255,255,255,0.03)",
                border: `1px solid ${zoneFilter === z.id ? z.color + "66" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 5, color: zoneFilter === z.id ? z.color : "#7c6d8a",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
              }}>
                {z.icon && <span>{z.icon}</span>}{z.label}
              </button>
            ))}
          </div>

          {/* Duration filter */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#7c6d8a", marginRight: 3 }}>Tid:</span>
            {DURATION_FILTERS.map(d => (
              <button key={d.id} onClick={() => setDurationFilter(d.id)} style={{
                fontFamily: BF, fontSize: 10, padding: "4px 9px",
                background: durationFilter === d.id ? "rgba(95,205,228,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${durationFilter === d.id ? "rgba(95,205,228,0.4)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 5, color: durationFilter === d.id ? "#5fcde4" : "#7c6d8a",
                cursor: "pointer",
              }}>{d.label}</button>
            ))}
          </div>
        </div>

        {/* Mode grid */}
        <div style={{ padding: "16px 24px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          {filtered.map(mode => {
            const zm = ZONE_META[mode.zone] || { color: "#feae34", icon: "⭐" };
            const dur = MODE_DURATION_MAP[mode.id] || 30;
            const diff = DIFFICULTY_LABELS[MODE_DIFFICULTY[mode.id]] || DIFFICULTY_LABELS.normal;
            const isH = hovered === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => onSelect(mode)}
                onMouseEnter={() => setHovered(mode.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: "12px 14px",
                  background: isH ? zm.color + "12" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isH ? zm.color + "55" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8, cursor: "pointer",
                  transition: "all 0.15s",
                  transform: isH ? "translateY(-2px)" : "none",
                  boxShadow: isH ? `0 4px 16px ${zm.color}22` : "none",
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{mode.icon}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: zm.color, opacity: 0.7 }}>{zm.icon} {zm.label?.replace(" Zone","")}</div>
                    <div style={{ fontSize: 9, color: diff.color, marginTop: 1 }}>● {diff.label}</div>
                  </div>
                </div>
                {/* Name */}
                <div style={{ fontFamily: PF, fontSize: 6, color: isH ? zm.color : "#d4c5f9", marginBottom: 4, letterSpacing: 0.5 }}>
                  {mode.name}
                </div>
                {/* Desc */}
                <div style={{ fontSize: 10, color: "#7c6d8a", lineHeight: 1.4, marginBottom: 6 }}>
                  {mode.desc}
                </div>
                {/* Duration */}
                <div style={{ fontSize: 9, color: "#7c6d8a", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⏱</span>
                  <span>~{dur} min</span>
                  {isH && <span style={{ marginLeft: "auto", fontFamily: PF, fontSize: 5, color: zm.color }}>VÆLG →</span>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "32px 0", color: "#7c6d8a", fontSize: 12 }}>
              Ingen modes matcher dine filtre.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
