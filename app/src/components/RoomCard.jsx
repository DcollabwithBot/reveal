import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getMembership } from '../lib/api';

export default function RoomCard({ team, project, sprint, accuracy, onStartSession, onOpenWorkspace, onViewHistory }) {
  const teamName = team?.name || project?.name || 'Team';
  const sprintName = sprint?.name || 'No active sprint';
  const itemCount = sprint?.item_count || 0;
  const lastSessionDate = project?.last_session_date;
  const accuracyScore = accuracy?.accuracy_score;

  function relativeTime(dateStr) {
    if (!dateStr) return 'Ingen sessions';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}t siden`;
    const days = Math.floor(hours / 24);
    return `${days}d siden`;
  }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: project?.color || 'var(--bg3)',
          display: 'grid', placeItems: 'center',
          fontSize: 14,
        }}>
          {project?.icon || '🏠'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{teamName}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Sprint: {sprintName} · {itemCount} items
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text2)' }}>
        <span>📅 {relativeTime(lastSessionDate)}</span>
        {accuracyScore != null && (
          <span style={{ color: accuracyScore > 80 ? 'var(--jade)' : accuracyScore > 60 ? 'var(--warn)' : 'var(--danger)' }}>
            🎯 {accuracyScore.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={onStartSession} style={actionBtn('var(--jade)')}>
          ▶ Start Session
        </button>
        <button onClick={onOpenWorkspace} style={actionBtn('var(--text2)', true)}>
          📂 Workspace
        </button>
      </div>
    </div>
  );
}

export function RoomsSection({ projects, onStartSession, onOpenWorkspace }) {
  const [accuracy, setAccuracy] = useState({});
  const [sessions, setSessions] = useState({});

  useEffect(() => {
    loadRoomData();
  }, []);

  async function loadRoomData() {
    try {
      const membership = await getMembership();
      if (!membership?.organization_id) return;

      // Load accuracy scores
      const { data: scores } = await supabase.from('team_accuracy_scores')
        .select('organization_id, sprint_id, accuracy_score')
        .eq('organization_id', membership.organization_id)
        .order('calculated_at', { ascending: false })
        .limit(20);

      const accMap = {};
      (scores || []).forEach(s => {
        if (!accMap[s.sprint_id]) accMap[s.sprint_id] = s;
      });
      setAccuracy(accMap);

      // Load latest session per project
      const { data: latestSessions } = await supabase.from('sessions')
        .select('id, project_id, created_at')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);

      const sessMap = {};
      (latestSessions || []).forEach(s => {
        if (s.project_id && !sessMap[s.project_id]) sessMap[s.project_id] = s;
      });
      setSessions(sessMap);
    } catch { /* silent */ }
  }

  const activeProjects = (projects || []).filter(p => p.status === 'active' || p.status === 'review');
  if (!activeProjects.length) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
          Mine Rooms
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          persistente samarbejdsrum
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {activeProjects.map(project => {
          const activeSprint = (project.sprints || []).find(s => s.status === 'active') || (project.sprints || [])[0];
          const sprintAccuracy = activeSprint ? accuracy[activeSprint.id] : null;
          const lastSession = sessions[project.id];

          return (
            <RoomCard
              key={project.id}
              project={{
                ...project,
                last_session_date: lastSession?.created_at,
              }}
              sprint={{
                name: activeSprint?.name,
                item_count: activeSprint?.session_items?.length || 0,
              }}
              accuracy={sprintAccuracy}
              onStartSession={() => onStartSession?.(project.id)}
              onOpenWorkspace={() => onOpenWorkspace?.(project.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function actionBtn(color, secondary = false) {
  return {
    fontSize: 11, fontWeight: 600, padding: '5px 12px',
    borderRadius: 'var(--radius)', cursor: 'pointer',
    border: secondary ? '1px solid var(--border)' : 'none',
    background: secondary ? 'var(--bg3)' : color,
    color: secondary ? 'var(--text2)' : '#fff',
  };
}
