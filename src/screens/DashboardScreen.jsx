import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Button, Card, WorkAreaShell } from '../components/WorkAreaUI'

const healthLabel = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track'
}

function healthClass(health) {
  if (health === 'off_track') return 'wa-badge-off_track'
  if (health === 'at_risk') return 'wa-badge-at_risk'
  return 'wa-badge-on_track'
}

export default function DashboardScreen({ onOpenSession, onOpenProjects, onSetup, onOpenResults, onOpenProject, onCreateProject }) {
  const [data, setData] = useState({ active: [], upcoming: [], finished: [], projects: [], activity: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/dashboard').then(setData).catch((e) => setError(e?.message || 'Could not load dashboard'))
  }, [])

  const kpis = useMemo(() => {
    const atRisk = data.projects.filter(p => p.health === 'at_risk' || p.health === 'off_track').length
    const completedWeek = data.finished.filter((s) => {
      if (!s.ended_at) return false
      const ageDays = (Date.now() - new Date(s.ended_at).getTime()) / (1000 * 60 * 60 * 24)
      return ageDays <= 7
    }).length

    return [
      { label: 'Active projects', value: data.projects.filter(p => p.status === 'active').length },
      { label: 'At-risk projects', value: atRisk },
      { label: 'Upcoming sessions', value: data.upcoming.length },
      { label: 'Completed this week', value: completedWeek }
    ]
  }, [data])

  const SessionList = ({ title, list }) => (
    <Card>
      <div className='wa-section-title'>{title} ({list.length})</div>
      {list.length === 0 && <div className='wa-subtitle'>No sessions in this section yet.</div>}
      {list.slice(0, 5).map(s => (
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
          <div className='wa-subtitle'>Professional overview of delivery, project health, and activity.</div>
        </div>
        <div className='wa-actions'>
          <Button variant='primary' onClick={onSetup}>New session</Button>
          <Button onClick={onCreateProject}>New project</Button>
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

      <Card style={{ marginBottom: 16 }}>
        <div className='wa-section-title'>Project health</div>
        {data.projects.length === 0 && <div className='wa-subtitle'>No projects yet. Create one to start tracking health and delivery progress.</div>}
        {data.projects.length > 0 && (
          <div className='wa-table-wrap'>
            <table className='wa-table'>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Progress</th>
                  <th>Updated</th>
                  <th>Next milestone</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.slice(0, 8).map((project) => (
                  <tr key={project.id} onClick={() => onOpenProject(project.id)} style={{ cursor: 'pointer' }}>
                    <td><strong>{project.name}</strong></td>
                    <td>{project.owner_name || 'Unassigned'}</td>
                    <td><span className={`wa-badge wa-badge-${project.status || 'active'}`}>{project.status || 'active'}</span></td>
                    <td><span className={`wa-badge ${healthClass(project.health)}`}>{healthLabel[project.health] || 'On track'}</span></td>
                    <td>
                      {project.progress || 0}%
                      <div className='wa-progress'><div style={{ width: `${project.progress || 0}%` }} /></div>
                    </td>
                    <td>{project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '—'}</td>
                    <td>{project.next_milestone ? `${project.next_milestone.name} (${new Date(project.next_milestone.end_date).toLocaleDateString()})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
        <SessionList title='Active sessions' list={data.active} />
        <SessionList title='Upcoming sessions' list={data.upcoming} />
        <SessionList title='Finished sessions' list={data.finished} />
      </div>

      <Card>
        <div className='wa-section-title'>Recent activity</div>
        {(!data.activity || data.activity.length === 0) && <div className='wa-subtitle'>Activity will appear as sessions and projects change.</div>}
        {(data.activity || []).map((event) => (
          <div key={event.id} className='wa-activity-row'>
            <div>
              <strong>{event.title}</strong>
              <div className='wa-subtitle'>{event.description}</div>
            </div>
            <div className='wa-subtitle'>{new Date(event.created_at).toLocaleString()}</div>
          </div>
        ))}
      </Card>
    </WorkAreaShell>
  )
}
