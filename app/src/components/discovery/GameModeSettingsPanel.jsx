/**
 * GameModeSettingsPanel — DEL 5B
 * Checkboxe per game mode per projekt. Gemmes som game_mode_config JSONB på projects.
 * Bruges i WorkspaceSettings og ProjectWorkspace.
 */
import { useState, useEffect } from "react";
import { PF, BF } from "../../shared/constants.js";
import { supabase } from "../../lib/supabase.js";
import { ALL_MODES, ZONE_META } from "./SituationalRecommender.jsx";

export default function GameModeSettingsPanel({ projectId, organizationId }) {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    supabase
      .from("projects")
      .select("game_mode_config")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data?.game_mode_config) setConfig(data.game_mode_config);
        else {
          // Default: all modes enabled
          const defaults = {};
          ALL_MODES.forEach(m => { defaults[m.id] = true; });
          setConfig(defaults);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  function isEnabled(modeId) {
    // If not in config, default to true
    return config[modeId] !== false;
  }

  function toggleMode(modeId) {
    setConfig(prev => ({ ...prev, [modeId]: !isEnabled(modeId) }));
  }

  function enableZone(zone) {
    const updates = {};
    ALL_MODES.filter(m => m.zone === zone).forEach(m => { updates[m.id] = true; });
    setConfig(prev => ({ ...prev, ...updates }));
  }

  function disableZone(zone) {
    const updates = {};
    ALL_MODES.filter(m => m.zone === zone).forEach(m => { updates[m.id] = false; });
    setConfig(prev => ({ ...prev, ...updates }));
  }

  function enableAll() {
    const all = {};
    ALL_MODES.forEach(m => { all[m.id] = true; });
    setConfig(all);
  }

  async function save() {
    if (!projectId || saving) return;
    setSaving(true);
    await supabase
      .from("projects")
      .update({ game_mode_config: config })
      .eq("id", projectId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const enabledCount = ALL_MODES.filter(m => isEnabled(m.id)).length;
  const zoneOrder = ["scrum", "scope", "speed", "strategy"];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: PF, fontSize: 7, color: "var(--accent, #feae34)", letterSpacing: 1, marginBottom: 4 }}>
            🎮 GAME MODE INDSTILLINGER
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            Vælg hvilke spilmodes der er aktive for dette projekt.
            {" "}<strong style={{ color: "var(--text2)" }}>{enabledCount}/{ALL_MODES.length} aktiveret.</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={enableAll} style={btnStyle({ small: true })}>Aktivér alle</button>
          <button
            onClick={save}
            disabled={saving}
            style={btnStyle({ primary: true, small: true, disabled: saving })}
          >
            {saving ? "Gemmer..." : saved ? "✓ Gemt!" : "Gem"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: "var(--text3)", padding: "20px 0" }}>Indlæser...</div>
      ) : (
        zoneOrder.map(zone => {
          const meta = ZONE_META[zone];
          const modes = ALL_MODES.filter(m => m.zone === zone);
          const allOn = modes.every(m => isEnabled(m.id));
          const someOn = modes.some(m => isEnabled(m.id));

          return (
            <div key={zone} style={{ marginBottom: 20 }}>
              {/* Zone header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px",
                background: meta.color + "0e",
                border: `1px solid ${meta.color}22`,
                borderRadius: 6, marginBottom: 8,
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ fontFamily: PF, fontSize: 6, color: meta.color, letterSpacing: 1, flex: 1 }}>
                  {meta.label.toUpperCase()}
                </span>
                <button
                  onClick={() => allOn ? disableZone(zone) : enableZone(zone)}
                  style={{
                    fontFamily: "var(--sans)", fontSize: 10, padding: "3px 9px",
                    background: allOn ? meta.color + "22" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${allOn ? meta.color + "55" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 4, color: allOn ? meta.color : "var(--text3)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {allOn ? "Deaktivér zone" : "Aktivér zone"}
                </button>
              </div>

              {/* Mode checkboxes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                {modes.map(mode => {
                  const on = isEnabled(mode.id);
                  return (
                    <div
                      key={mode.id}
                      onClick={() => toggleMode(mode.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px",
                        background: on ? meta.color + "0a" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${on ? meta.color + "33" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: 6, cursor: "pointer",
                        opacity: on ? 1 : 0.5,
                        transition: "all 0.15s",
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: `2px solid ${on ? meta.color : "rgba(255,255,255,0.2)"}`,
                        background: on ? meta.color : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, fontSize: 8, color: "#000", fontWeight: 700,
                        transition: "all 0.15s",
                      }}>
                        {on && "✓"}
                      </div>
                      <span style={{ fontSize: 13 }}>{mode.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: on ? "var(--text)" : "var(--text3)", fontWeight: on ? 500 : 400 }}>
                          {mode.name}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 1 }}>{mode.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function btnStyle({ primary, small, disabled } = {}) {
  return {
    fontFamily: "var(--sans)",
    fontSize: small ? 11 : 12,
    padding: small ? "5px 12px" : "8px 16px",
    background: primary
      ? (disabled ? "rgba(254,174,52,0.1)" : "rgba(254,174,52,0.15)")
      : "rgba(255,255,255,0.04)",
    border: `1px solid ${primary ? "rgba(254,174,52,0.4)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 6,
    color: primary ? (disabled ? "rgba(254,174,52,0.5)" : "rgba(254,174,52,0.9)") : "var(--text3)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s",
    fontWeight: 500,
  };
}
