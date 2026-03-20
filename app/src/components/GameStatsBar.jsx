import { useEffect, useState } from 'react';
import { getGameStats } from '../lib/api';

function Stat({ icon, label, tooltip, color }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span style={{ fontSize: 11 }}>{icon}</span>
      <span style={{ fontSize: 11, color: color || 'var(--text3)', fontWeight: 500 }}>{label}</span>
      {showTip && tooltip && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 6, padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap',
          zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

export default function GameStatsBar() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getGameStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const accColor = stats.estimation_accuracy >= 0.8 ? 'var(--jade)' :
    stats.estimation_accuracy >= 0.6 ? 'var(--warn)' : 'var(--danger)';
  const accLabel = stats.estimation_accuracy != null
    ? `${Math.round(stats.estimation_accuracy * 100)}% accurate`
    : '—';

  const velIcon = stats.team_velocity_trend === 'up' ? '↑' :
    stats.team_velocity_trend === 'down' ? '↓' : '→';
  const velLabel = stats.team_velocity_trend === 'up' ? 'Trending up' :
    stats.team_velocity_trend === 'down' ? 'Dropping' : 'Stable';

  const covPct = Math.round((stats.items_estimated_pct || 0) * 100);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '4px 32px',
      background: 'rgba(12,12,15,0.6)', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <Stat
        icon="🔥"
        label={`${stats.sprint_streak} sprints on time`}
        tooltip="Antal sprints afsluttet til tiden i træk"
      />
      <Stat
        icon="🎯"
        label={accLabel}
        color={stats.estimation_accuracy != null ? accColor : undefined}
        tooltip="Gennemsnitlig estimation accuracy over seneste 5 sprints"
      />
      <Stat
        icon="📈"
        label={`${velIcon} ${velLabel}`}
        tooltip="Team velocity trend baseret på seneste 3 sprints"
      />
      <Stat
        icon="⚔"
        label={`${stats.sessions_this_sprint} sessions this sprint`}
        tooltip="Antal estimation sessions i det aktive sprint"
      />
      <Stat
        icon="✓"
        label={`${covPct}% items estimated`}
        tooltip="Andel af items med estimat i det aktive sprint"
      />
    </div>
  );
}
