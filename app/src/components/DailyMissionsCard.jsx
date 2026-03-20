import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function edgeFn(fnName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { missions: [] };
  return res.json();
}

export default function DailyMissionsCard({ organizationId, onNavigate }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrateId, setCelebrateId] = useState(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await edgeFn('generate-missions', { org_id: organizationId });
        if (!cancelled) setMissions(data.missions || []);
      } catch {
        // silent fail
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [organizationId]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>🎯 Today's Missions</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 0' }}>Loading...</div>
      </div>
    );
  }

  if (!missions.length) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>🎯 Today's Missions</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 0' }}>
          Ingen missions i dag — kom i gang!
        </div>
      </div>
    );
  }

  const soloMissions = missions.filter(m => m.scope === 'individual').slice(0, 2);
  const teamMissions = missions.filter(m => m.scope === 'team').slice(0, 1);
  const displayMissions = [...soloMissions, ...teamMissions];

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={headerStyle}>🎯 Today's Missions</div>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          {missions.filter(m => m.progress >= 1).length}/{missions.length} done
        </span>
      </div>

      {displayMissions.map((mission, i) => {
        const isCompleted = mission.progress >= 1;
        const isCelebrating = celebrateId === mission.mission_id;

        return (
          <div
            key={mission.mission_id || i}
            onClick={() => {
              if (isCompleted) return;
              if (onNavigate) onNavigate(mission);
            }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 12px', marginBottom: 8,
              background: isCompleted ? 'var(--jade-dim)' : 'var(--bg)',
              border: `1px solid ${isCompleted ? 'rgba(0,200,150,0.25)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              cursor: isCompleted ? 'default' : 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Celebrate animation */}
            {isCelebrating && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(0,200,150,0.15), transparent)',
                animation: 'shimmer 0.6s ease-out',
              }} />
            )}

            {/* Icon */}
            <div style={{
              fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2,
              filter: isCompleted ? 'none' : 'grayscale(0.3)',
            }}>
              {isCompleted ? '✅' : mission.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: isCompleted ? 'var(--jade)' : 'var(--text)',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                }}>
                  {mission.title}
                  {mission.scope === 'team' && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, padding: '1px 5px',
                      background: 'var(--epic-dim)', border: '1px solid var(--epic-border)',
                      borderRadius: 8, color: 'var(--epic)', fontWeight: 600,
                    }}>
                      TEAM
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isCompleted ? 'var(--jade)' : 'var(--gold)',
                  background: isCompleted ? 'transparent' : 'var(--gold-dim)',
                  padding: isCompleted ? 0 : '1px 6px',
                  borderRadius: 8,
                  border: isCompleted ? 'none' : '1px solid rgba(200,168,75,0.2)',
                }}>
                  {isCompleted ? 'XP earned!' : `+${mission.xp_reward} XP`}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, lineHeight: 1.4 }}>
                {mission.description}
              </div>

              {/* Progress bar */}
              {!isCompleted && (
                <div style={{
                  height: 3, background: 'var(--border)', borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: mission.progress > 0 ? 'var(--jade)' : 'var(--border2)',
                    width: `${Math.min(100, mission.progress * 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

const cardStyle = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '18px 20px',
};

const headerStyle = {
  fontSize: 13, fontWeight: 600, color: 'var(--text)',
  letterSpacing: '-0.01em',
};
