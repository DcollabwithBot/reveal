import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'

const statusColor = { active: '#4ade80', on_hold: '#f0c040', completed: '#6060a0' }

export default function DashboardScreen({ onOpenSession, onOpenProjects, onSetup, onOpenResults, onOpenProject }) {
  const [data, setData] = useState({ active: [], upcoming: [], finished: [], projects: [] })
  const [showAllProjects, setShowAllProjects] = useState(false)

  useEffect(() => {
    apiFetch('/api/dashboard').then(setData).catch(() => {})
  }, [])

  const projects = useMemo(() => showAllProjects ? data.projects : data.projects.filter(p => p.status === 'active'), [data.projects, showAllProjects])

  const moveProject = async (projectId, status) => {
    await apiFetch(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setData(d => ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, status } : p) }))
  }

  const onDrop = (status, ev) => {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/project-id')
    if (id) moveProject(id, status)
  }

  const SessionList = ({ title, list }) => (
    <div style={{ background: '#111130', border: '2px solid #2a2a5a', borderRadius: 8, padding: 12 }}>
      <div style={{ marginBottom: 8, color: '#f0c040' }}>{title} ({list.length})</div>
      {list.map(s => (
        <div key={s.id} style={{ border: '1px solid #2a2a5a', borderRadius: 6, padding: 8, marginBottom: 8 }}>
          <div>{s.name}</div>
          <div style={{ fontSize: 12, color: '#6060a0' }}>{s.item_count} items · {s.participant_count} players</div>
          <button onClick={() => s.status === 'completed' ? onOpenResults(s.id) : onOpenSession(s.id)}>{s.status === 'completed' ? 'View results' : 'Open'}</button>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0d8f0', padding: 16 }}>
      <h2>Dashboard</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onSetup}>New Session</button>
        <button onClick={onOpenProjects}>Browse Projects</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        <SessionList title='Active' list={data.active} />
        <SessionList title='Upcoming' list={data.upcoming} />
        <SessionList title='Finished' list={data.finished} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Projects Kanban</strong>
        <button style={{ marginLeft: 8 }} onClick={() => setShowAllProjects(v => !v)}>{showAllProjects ? 'Only Active' : 'Show all'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showAllProjects ? 'repeat(3,1fr)' : '1fr', gap: 10 }}>
        {['active', 'on_hold', 'completed'].filter(s => showAllProjects || s === 'active').map(status => (
          <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(status, e)} style={{ minHeight: 160, border: '2px dashed #2a2a5a', borderRadius: 8, padding: 8 }}>
            <div style={{ color: statusColor[status], textTransform: 'uppercase', marginBottom: 8 }}>{status}</div>
            {projects.filter(p => p.status === status).map(p => (
              <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/project-id', p.id)} style={{ border: `1px solid ${p.color || '#2a2a5a'}`, borderRadius: 6, padding: 8, marginBottom: 8, background: '#111130' }}>
                <div>{p.icon || '📋'} {p.name}</div>
                <button onClick={() => onOpenProject(p.id)}>Open project</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
