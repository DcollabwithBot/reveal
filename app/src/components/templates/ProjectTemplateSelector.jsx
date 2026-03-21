/**
 * ProjectTemplateSelector — DEL 6
 * 3 system-templates + PM egne templates.
 * Bruges i project creation flow: "Brug template →" dropdown.
 */
import { useState, useEffect } from "react";
import { PF, BF } from "../../shared/constants.js";
import { supabase } from "../../lib/supabase.js";
import { ALL_MODES, ZONE_META } from "../discovery/SituationalRecommender.jsx";

const SYSTEM_TEMPLATES = [
  {
    id: "scrum_standard",
    name: "Scrum Standard",
    description: "De klassiske Scrum-modes: estimering, planning, grooming og retrospective.",
    icon: "🛡️",
    color: "#38b764",
    is_system: true,
    game_mode_config: {
      planning_poker: true, sprint_draft: true, refinement_roulette: true,
      boss_battle_retro: true,
    },
    modes: ["planning_poker", "sprint_draft", "refinement_roulette", "boss_battle_retro"],
    best_for: "Teams der kører klassisk Scrum",
  },
  {
    id: "discovery_sprint",
    name: "Discovery Sprint",
    description: "Forstå hvad I skal bygge, før I estimerer. Til krav-workshops og discovery.",
    icon: "🔭",
    color: "#feae34",
    is_system: true,
    game_mode_config: {
      spec_wars: true, assumption_slayer: true, risk_poker: true, dependency_mapper: true,
    },
    modes: ["spec_wars", "assumption_slayer", "risk_poker", "dependency_mapper"],
    best_for: "Nye projekter og usikre krav",
  },
  {
    id: "full_arsenal",
    name: "Full Arsenal",
    description: "Alle 14 game modes aktiveret. Vælg situationelt via Situational Recommender.",
    icon: "⚔️",
    color: "#b55088",
    is_system: true,
    game_mode_config: Object.fromEntries(ALL_MODES.map(m => [m.id, true])),
    modes: ALL_MODES.map(m => m.id),
    best_for: "Erfarne teams der vil eksperimentere",
  },
];

function TemplateCard({ template, onSelect, isSelected }) {
  const [expanded, setExpanded] = useState(false);
  const activeModes = template.modes
    ? ALL_MODES.filter(m => template.modes.includes(m.id))
    : ALL_MODES.filter(m => template.game_mode_config?.[m.id]);

  return (
    <div style={{
      border: `2px solid ${isSelected ? template.color : "rgba(255,255,255,0.08)"}`,
      borderRadius: 10, overflow: "hidden",
      background: isSelected ? template.color + "0a" : "#1a1230",
      transition: "all 0.15s",
      boxShadow: isSelected ? `0 0 16px ${template.color}22` : "none",
    }}>
      {/* Header */}
      <div
        style={{ padding: "14px 16px", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>{template.icon}</span>
            <div>
              <div style={{ fontFamily: PF, fontSize: 7, color: template.color, letterSpacing: 0.5, marginBottom: 3 }}>
                {template.name}
                {template.is_system && (
                  <span style={{ marginLeft: 6, fontSize: 5, color: "#7c6d8a", fontFamily: "'system-ui',sans-serif", fontWeight: 600 }}>
                    SYSTEM
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#a09ab8", lineHeight: 1.4 }}>{template.description}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: template.color, fontWeight: 600 }}>
              {activeModes.length} modes
            </div>
            <div style={{ fontSize: 9, color: "#7c6d8a", marginTop: 2 }}>
              {expanded ? "▲ Skjul" : "▼ Vis"}
            </div>
          </div>
        </div>

        {/* Best for */}
        {template.best_for && (
          <div style={{ marginTop: 7, fontSize: 10, color: "#7c6d8a" }}>
            ✅ Best for: <span style={{ color: "#a09ab8" }}>{template.best_for}</span>
          </div>
        )}

        {/* Mode pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {activeModes.map(m => {
            const zm = ZONE_META[m.zone] || { color: "#feae34" };
            return (
              <span key={m.id} style={{
                fontSize: 9, padding: "2px 7px",
                background: zm.color + "18",
                border: `1px solid ${zm.color}33`,
                borderRadius: 4, color: zm.color,
              }}>
                {m.icon} {m.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Expanded: zone breakdown */}
      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {["scrum","scope","speed","strategy"].map(zone => {
            const zm = ZONE_META[zone];
            const zoneModes = activeModes.filter(m => m.zone === zone);
            if (!zoneModes.length) return null;
            return (
              <div key={zone} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: zm.color, fontWeight: 600, marginBottom: 5 }}>
                  {zm.icon} {zm.label}
                </div>
                {zoneModes.map(m => (
                  <div key={m.id} style={{ fontSize: 10, color: "#a09ab8", padding: "2px 0", display: "flex", gap: 6 }}>
                    <span>{m.icon}</span>
                    <span style={{ color: "#d4c5f9" }}>{m.name}</span>
                    <span style={{ color: "#7c6d8a" }}>— {m.desc}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onSelect(template)}
          style={{
            fontFamily: PF, fontSize: 6, padding: "8px 18px",
            background: isSelected ? template.color + "33" : template.color + "18",
            border: `1.5px solid ${template.color + "66"}`,
            borderRadius: 6, color: template.color,
            cursor: "pointer", transition: "all 0.15s",
            letterSpacing: 1,
          }}
        >
          {isSelected ? "✓ VALGT" : "BRUG TEMPLATE →"}
        </button>
      </div>
    </div>
  );
}

function CustomTemplateForm({ organizationId, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedModes, setSelectedModes] = useState({});
  const [saving, setSaving] = useState(false);

  function toggleMode(id) {
    setSelectedModes(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const config = {};
    ALL_MODES.forEach(m => { config[m.id] = !!selectedModes[m.id]; });
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("project_templates").insert({
      organization_id: organizationId,
      name: name.trim(),
      description: desc.trim() || null,
      game_mode_config: config,
      is_system: false,
      created_by: user?.id,
    }).select().single();
    setSaving(false);
    if (data) onSave(data);
  }

  const selectedCount = ALL_MODES.filter(m => selectedModes[m.id]).length;

  return (
    <div style={{ padding: "20px", background: "#251940", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontFamily: PF, fontSize: 7, color: "#feae34", marginBottom: 14 }}>
        ✏️ NY TEMPLATE
      </div>
      <div style={{ marginBottom: 10 }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Template navn"
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Beskrivelse (valgfri)"
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#7c6d8a", marginBottom: 8 }}>
          Vælg modes ({selectedCount} valgt):
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 5 }}>
          {ALL_MODES.map(m => {
            const on = !!selectedModes[m.id];
            const zm = ZONE_META[m.zone] || { color: "#feae34" };
            return (
              <div key={m.id} onClick={() => toggleMode(m.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                background: on ? zm.color + "12" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? zm.color + "44" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 5, cursor: "pointer", transition: "all 0.1s",
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                  border: `1.5px solid ${on ? zm.color : "rgba(255,255,255,0.2)"}`,
                  background: on ? zm.color : "transparent",
                  fontSize: 7, color: "#000", display: "flex", alignItems: "center", justifyContent: "center",
                }}>{on && "✓"}</div>
                <span style={{ fontSize: 11 }}>{m.icon}</span>
                <span style={{ fontSize: 9, color: on ? "#d4c5f9" : "#7c6d8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnBase, color: "#7c6d8a", border: "1px solid rgba(255,255,255,0.08)" }}>Annuller</button>
        <button onClick={save} disabled={!name.trim() || saving || selectedCount === 0} style={{ ...btnBase, background: "rgba(254,174,52,0.15)", border: "1px solid rgba(254,174,52,0.4)", color: "#feae34" }}>
          {saving ? "Gemmer..." : "Gem template"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 12,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6, color: "#d4c5f9", fontFamily: "'system-ui',sans-serif",
  outline: "none", boxSizing: "border-box",
};
const btnBase = {
  fontFamily: "'system-ui',sans-serif", fontSize: 12, padding: "8px 16px",
  borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
  background: "rgba(255,255,255,0.04)",
};

export default function ProjectTemplateSelector({ organizationId, onSelect, onClose }) {
  const [selected, setSelected] = useState(null);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    supabase.from("project_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_system", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCustomTemplates(data || []); setLoading(false); });
  }, [organizationId]);

  function handleSelect(template) {
    setSelected(template.id);
    onSelect && onSelect(template);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1200,
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "20px 16px", overflowY: "auto",
      fontFamily: "'system-ui',sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <div style={{ fontFamily: PF, fontSize: 9, color: "#feae34", letterSpacing: 2, marginBottom: 4 }}>
              📋 PROJEKT TEMPLATES
            </div>
            <div style={{ fontSize: 12, color: "#7c6d8a" }}>
              Vælg et sæt game modes som udgangspunkt — du kan altid ændre det bagefter.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7c6d8a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* System templates */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: "#7c6d8a", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
            System Templates
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SYSTEM_TEMPLATES.map(t => (
              <TemplateCard key={t.id} template={t} onSelect={handleSelect} isSelected={selected === t.id} />
            ))}
          </div>
        </div>

        {/* Custom templates */}
        {(customTemplates.length > 0 || !showCreate) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#7c6d8a", textTransform: "uppercase", letterSpacing: 1 }}>
                Dine Templates {customTemplates.length > 0 && `(${customTemplates.length})`}
              </div>
              {!showCreate && (
                <button onClick={() => setShowCreate(true)} style={{
                  fontFamily: BF, fontSize: 10, padding: "5px 12px",
                  background: "rgba(95,205,228,0.1)", border: "1px solid rgba(95,205,228,0.3)",
                  borderRadius: 5, color: "#5fcde4", cursor: "pointer",
                }}>
                  + Ny template
                </button>
              )}
            </div>
            {loading ? (
              <div style={{ fontSize: 11, color: "#7c6d8a" }}>Indlæser...</div>
            ) : customTemplates.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customTemplates.map(t => (
                  <TemplateCard key={t.id} template={{ ...t, color: "#5fcde4", icon: "✨" }} onSelect={handleSelect} isSelected={selected === t.id} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#7c6d8a", padding: "10px 0" }}>
                Ingen egne templates endnu. Opret din første →
              </div>
            )}
          </div>
        )}

        {/* Create custom template */}
        {showCreate && (
          <div style={{ marginBottom: 24 }}>
            <CustomTemplateForm
              organizationId={organizationId}
              onSave={t => { setCustomTemplates(prev => [t, ...prev]); setShowCreate(false); }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        )}

        {/* Footer */}
        {selected && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 11, color: "#7c6d8a", marginBottom: 10 }}>
              Template valgt · Modes kan justeres efter oprettelse i Workspace Settings
            </div>
            <button onClick={onClose} style={{
              fontFamily: PF, fontSize: 7, padding: "12px 32px",
              background: "rgba(254,174,52,0.18)", border: "2px solid rgba(254,174,52,0.5)",
              borderRadius: 8, color: "#feae34", cursor: "pointer", letterSpacing: 1,
            }}>
              FORTSÆT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
