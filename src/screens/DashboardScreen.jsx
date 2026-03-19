import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Button, Card, WorkAreaShell } from '../components/WorkAreaUI'

const statusLabel = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed'
}

export default function DashboardScreen({ onOpenSession, onOpenProjects, onSetup, onOpenResults, onOpenProject }) {
  const [data, setData] = useState({ active: [], upcoming: [], finished: [], projects: [] })
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/dashboard').then(setData).catch((e) => setError(e?.message || 'Could not load dashboard'))
  }, [])

  const projects = useMemo(
    () => (showAllProjects ? data.projects : data.projects.filter(p => p.status === 'active')),
    [data.projects, showAllProjects]
  )

  const kpis = useMemo(() => {
    const atRisk = data.projects.filter(p => p.status === 'on_hold').length
    return [
      { label: 'Active projects', value: data.projects.filter(p => p.status === 'active').length },
      { label: 'At risk projects', value: atRisk },
      { label: 'Upcoming sessions', value: data.upcoming.length },
      { label: 'Completed sessions', value: data.finished.length }
    ]
  }, [data])

  const moveProject = async (projectId, status) => {
    await apiFetch(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setData(d => ({ ...d, projects: d.projects.map(p => (p.id === projectId ? { ...p, status } : p)) }))
  }

  const onDrop = (status, ev) => {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/project-id')
    if (id) moveProject(id, status)
  }

  const SessionList = ({ title, list }) => (
    <Card>
      <div className='wa-section-title'>{title} ({list.length})</div>
      {list.length === 0 && <div className='wa-subtitle'>No sessions in this section yet.</div>}
      {list.map(s => (
        <div key={s.id} className='wa-card' style={{ marginBottom: 8, padding: 10, background: 'var(--wa-surface-muted)' }}>
          <div style={{ fontWeight: 600 }}>{s.name}</div>
          <div className='wa-subtitle'>{s.item_count} items · {s.participant_count} players</div>
          <div style={{ marginTop: 8 }}>
            <Button onClick={() => (s.status === 'completed' ? onOpenResults(s.id) : onOpenSession(s.id))}>
              {s.status === 'completed' ? 'View results' : 'Open session'}
            </Button>
          </div>
        </div>
      ))}
    </Card>
  )

  return (
    <WorkAreaShell>
      <div className='wa-topbar'>
        <div>
          <div className='wa-title'>Dashboard</div>
          <div className='wa-subtitle'>Professional overview of sessions and project health.</div>
        </div>
        <div className='wa-actions'>
          <Button variant='primary' onClick={onSetup}>New session</Button>
          <Button onClick={onOpenProjects}>Browse projects</Button>
        </div>
      </div>

      {error && <div className='wa-banner wa-banner-error'>{error}</div>}

      <div className='wa-grid-kpi'>
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <div className='wa-kpi-label'>{kpi.label}</div>
            <div className='wa-kpi-value'>{kpi.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <SessionList title='Active sessions' list={data.active} />
        <SessionList title='Upcoming sessions' list={data.upcoming} />
        <SessionList title='Finished sessions' list={data.finished} />
      </div>

      <Card>
        <div className='wa-topbar' style={{ marginBottom: 8 }}>
          <div className='wa-section-title' style={{ marginBottom: 0 }}>Projects board</div>
          <Button onClick={() => setShowAllProjects(v => !v)}>{showAllProjects ? 'Show active only' : 'Show all statuses'}</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: showAllProjects ? 'repeat(3, minmax(0, 1fr))' : '1fr', gap: 10 }}>
          {['active', 'on_hold', 'completed'].filter(s => showAllProjects || s === 'active').map(status => (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(status, e)}
              className='wa-card'
              style={{ background: 'var(--wa-surface-muted)' }}
            >
              <div className={`wa-badge wa-badge-${status}`}>{statusLabel[status]}</div>
              <div style={{ marginTop: 10 }}>
                {projects.filter(p => p.status === status).map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/project-id', p.id)}
                    className='wa-card'
                    style={{ marginBottom: 8, borderLeft: `4px solid ${p.color || '#4457ff'}` }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.icon || '📋'} {p.name}</div>
                    <div style={{ marginTop: 8 }}>
                      <Button onClick={() => onOpenProject(p.id)}>Open project</Button>
                    </div>
                  </div>
                ))}
                {projects.filter(p => p.status === status).length === 0 && <div className='wa-subtitle'>No projects</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </WorkAreaShell>
  )
}
