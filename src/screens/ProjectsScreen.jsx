import { useEffect, useMemo, useState } from 'react'
import { apiFetch, fetchAssignees } from '../lib/api'
import ImportModal from '../components/ImportModal'
import KanbanBoard from '../components/KanbanBoard'
import { Banner, Button, Card, Input, Select, WorkAreaShell } from '../components/WorkAreaUI'

const STATUS_OPTIONS = ['all', 'active', 'on_hold', 'completed']
const TAB_OPTIONS = ['overview', 'work', 'activity', 'settings']

const healthLabel = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track'
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function healthClass(health) {
  if (health === 'off_track') return 'wa-badge-off_track'
  if (health === 'at_risk') return 'wa-badge-at_risk'
  return 'wa-badge-on_track'
}

export default function ProjectsScreen({ projectId, onOpenProject, onBack, onCreateProject }) {
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const [sprints, setSprints] = useState([])
  const [showImportForSprint, setShowImportForSprint] = useState(null)

  const [newSprint, setNewSprint] = useState({ name: '', goal: '' })
  const [itemTitle, setItemTitle] = useState({})
  const [assignees, setAssignees] = useState([])

  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [listViewMode, setListViewMode] = useState('kanban')
  const [activeTab, setActiveTab] = useState('overview')
  const [savingProject, setSavingProject] = useState(false)

  useEffect(() => {
    if (!projectId) {
      apiFetch('/api/projects')
        .then(setProjects)
        .catch((e) => setLoadError(e?.message || 'Could not load projects'))
      fetchAssignees().then(setAssignees).catch(() => {})
      return
    }

    setLoadError('')
    apiFetch(`/api/projects/${projectId}`).then(setProject).catch(() => setLoadError('Could not load project details'))
    apiFetch(`/api/projects/${projectId}/sprints`).then(setSprints).catch(() => setLoadError('Could not load sprints'))
    fetchAssignees().then(setAssignees).catch(() => {})
  }, [projectId])

  const createSprint = async () => {
    try {
      const s = await apiFetch(`/api/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(newSprint) })
      setSprints(prev => [{ ...s, items: [] }, ...prev])
      setNewSprint({ name: '', goal: '' })
    } catch (e) {
      setLoadError(e?.message || 'Could not create sprint')
    }
  }

  const addItem = async (sprintId) => {
    const title = itemTitle[sprintId]
    if (!title?.trim()) return
    try {
      const it = await apiFetch(`/api/sprints/${sprintId}/items`, { method: 'POST', body: JSON.stringify({ title }) })
      setSprints(prev => prev.map(s => (s.id === sprintId ? { ...s, items: [...s.items, it] } : s)))
      setItemTitle(t => ({ ...t, [sprintId]: '' }))
      const refreshed = await apiFetch(`/api/projects/${projectId}`)
      setProject(refreshed)
    } catch (e) {
      setLoadError(e?.message || 'Could not add item')
    }
  }

  const patchItem = async (itemId, patch) => {
    try {
      const updated = await apiFetch(`/api/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setSprints(prev => prev.map(s => ({ ...s, items: s.items.map(i => (i.id === itemId ? { ...i, ...updated } : i)) })))
      const refreshed = await apiFetch(`/api/projects/${projectId}`)
      setProject(refreshed)
    } catch (e) {
      setLoadError(e?.message || 'Could not update item')
    }
  }

  const updateProject = async (patch) => {
    setSavingProject(true)
    try {
      const updated = await apiFetch(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setProject(updated)
      setProjects((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
    } catch (e) {
      setLoadError(e?.message || 'Could not update project')
    } finally {
      setSavingProject(false)
    }
  }

  const updateProjectFromList = async (id, patch) => {
    try {
      const updated = await apiFetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)))
    } catch (e) {
      setLoadError(e?.message || 'Could not update project')
    }
  }

  const velocity = useMemo(() => sprints.map(s => {
    const points = (s.items || []).reduce((sum, it) => sum + (Number(it.final_estimate) || 0), 0)
    const values = (s.items || []).map(it => Number(it.final_estimate) || 0).filter(Boolean)
    const spread = values.length ? (Math.max(...values) - Math.min(...values)) : 0
    return { id: s.id, name: s.name, points, spread, spreadLabel: spread > 13 ? 'high' : spread > 5 ? 'medium' : 'low' }
  }), [sprints])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesQuery = p.name?.toLowerCase().includes(query.toLowerCase()) || p.description?.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [projects, query, statusFilter])

  if (!projectId) {
    return (
      <WorkAreaShell>
        <div className='wa-topbar'>
          <div>
            <div className='wa-title'>Projects</div>
            <div className='wa-subtitle'>Professional portfolio view with health, ownership, and progress.</div>
          </div>
          <div className='wa-actions'>
            <Button variant='primary' onClick={onCreateProject}>New project</Button>
            <Button onClick={onBack}>Back to dashboard</Button>
          </div>
        </div>

        <Card>
          <div className='wa-topbar' style={{ marginBottom: 6 }}>
            <div className='wa-section-title' style={{ marginBottom: 0 }}>Project list</div>
            <div className='wa-row'>
              <Input placeholder='Search projects…' value={query} onChange={(e) => setQuery(e.target.value)} aria-label='Search projects' />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label='Filter by status'>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
              </Select>
              <div className='wa-segmented'>
                <button className={`wa-segment ${listViewMode === 'kanban' ? 'is-active' : ''}`} onClick={() => setListViewMode('kanban')}>Kanban</button>
                <button className={`wa-segment ${listViewMode === 'table' ? 'is-active' : ''}`} onClick={() => setListViewMode('table')}>Table</button>
              </div>
            </div>
          </div>

          {loadError && <Banner type='error'>{loadError}</Banner>}

          {filteredProjects.length === 0 && !loadError && <div className='wa-subtitle'>No projects match your filter yet.</div>}

          {filteredProjects.length > 0 && listViewMode === 'kanban' && (
            <KanbanBoard
              projects={filteredProjects}
              onOpenProject={onOpenProject}
              onUpdateStatus={(id, status) => updateProjectFromList(id, { status })}
              emptyTitle='No projects in this board view'
              emptySubtitle='Adjust filters or create a new project.'
            />
          )}

          {filteredProjects.length > 0 && listViewMode === 'table' && (
            <div className='wa-table-wrap'>
              <table className='wa-table'>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Progress</th>
                    <th>Dates</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className='wa-subtitle'>{p.description || 'No description'}</div>
                      </td>
                      <td>{p.owner_name || 'Unassigned'}</td>
                      <td>
                        <Select value={p.status || 'active'} onChange={(e) => updateProjectFromList(p.id, { status: e.target.value })}>
                          <option value='active'>active</option>
                          <option value='on_hold'>on_hold</option>
                          <option value='completed'>completed</option>
                        </Select>
                      </td>
                      <td><span className={`wa-badge ${healthClass(p.health)}`}>{healthLabel[p.health] || 'On track'}</span></td>
                      <td>
                        <div>{p.progress || 0}%</div>
                        <div className='wa-progress'><div style={{ width: `${p.progress || 0}%` }} /></div>
                      </td>
                      <td>
                        <div>{formatDate(p.created_at)} → {formatDate(p.updated_at)}</div>
                        <div className='wa-subtitle'>{p.open_items || 0} open / {p.total_items || 0} total</div>
                      </td>
                      <td><Button onClick={() => onOpenProject(p.id)}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </WorkAreaShell>
    )
  }

  const projectActivity = [
    { id: `proj-${project?.id}`, label: 'Project updated', date: project?.updated_at },
    ...sprints.map((s) => ({ id: `sprint-${s.id}`, label: `Sprint created: ${s.name}`, date: s.created_at })),
    ...sprints.flatMap((s) => (s.items || []).map((i) => ({ id: `item-${i.id}`, label: `Work item: ${i.title}`, date: i.created_at })))
  ].filter((x) => x.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12)

  return (
    <WorkAreaShell>
      <div className='wa-topbar'>
        <div>
          <div className='wa-title'>{project?.name || 'Project'}</div>
          <div className='wa-subtitle'>{project?.description || 'Project details and sprint planning'}</div>
        </div>
        <div className='wa-actions'>
          <Button onClick={onBack}>Back to projects</Button>
        </div>
      </div>

      {loadError && <Banner type='error'>{loadError}</Banner>}

      <div className='wa-tabs' role='tablist' aria-label='Project sections'>
        {TAB_OPTIONS.map((tab) => (
          <button key={tab} role='tab' aria-selected={activeTab === tab} className={`wa-tab ${activeTab === tab ? 'is-active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'work' ? 'Work / Sprints' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card>
          <div className='wa-grid-kpi'>
            <Card>
              <div className='wa-kpi-label'>Status</div>
              <div className='wa-kpi-value' style={{ fontSize: 18 }}>{project?.status || 'active'}</div>
            </Card>
            <Card>
              <div className='wa-kpi-label'>Health</div>
              <div className='wa-kpi-value' style={{ fontSize: 18 }}>{healthLabel[project?.health] || 'On track'}</div>
            </Card>
            <Card>
              <div className='wa-kpi-label'>Progress</div>
              <div className='wa-kpi-value' style={{ fontSize: 18 }}>{project?.progress || 0}%</div>
            </Card>
            <Card>
              <div className='wa-kpi-label'>Owner</div>
              <div className='wa-kpi-value' style={{ fontSize: 18 }}>{project?.owner_name || 'Unassigned'}</div>
            </Card>
          </div>
          <div className='wa-subtitle'>Created {formatDate(project?.created_at)} · Updated {formatDate(project?.updated_at)}</div>
          {project?.next_milestone && <div className='wa-subtitle'>Next milestone: {project.next_milestone.name} ({formatDate(project.next_milestone.end_date)})</div>}
        </Card>
      )}

      {activeTab === 'work' && (
        <>
          <Card>
            <div className='wa-section-title'>Create sprint</div>
            <div className='wa-row'>
              <Input placeholder='Sprint name' value={newSprint.name} onChange={e => setNewSprint({ ...newSprint, name: e.target.value })} />
              <Input placeholder='Goal' value={newSprint.goal} onChange={e => setNewSprint({ ...newSprint, goal: e.target.value })} />
              <Button variant='primary' onClick={createSprint}>Create sprint</Button>
            </div>
          </Card>

          {sprints.map(s => (
            <Card key={s.id} className='wa-focus' style={{ marginTop: 12 }}>
              <div className='wa-topbar' style={{ marginBottom: 8 }}>
                <div>
                  <div className='wa-section-title' style={{ marginBottom: 4 }}>{s.name}</div>
                  <div className='wa-subtitle'>{s.goal || 'No sprint goal yet'}</div>
                </div>
                <Button onClick={() => setShowImportForSprint(s.id)}>Import from Excel</Button>
              </div>

              <div className='wa-row' style={{ marginBottom: 8 }}>
                <Input value={itemTitle[s.id] || ''} placeholder='Add item title' onChange={e => setItemTitle(t => ({ ...t, [s.id]: e.target.value }))} />
                <Button onClick={() => addItem(s.id)}>Add item</Button>
              </div>

              {(s.items || []).map(it => (
                <div key={it.id} className='wa-work-grid'>
                  <Input value={it.title || ''} onChange={e => patchItem(it.id, { title: e.target.value })} />
                  <Select value={it.assigned_to || ''} onChange={e => patchItem(it.id, { assigned_to: e.target.value || null })}>
                    <option value=''>Unassigned</option>
                    {assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
                    {it.assigned_to && !assignees.some(person => person.id === it.assigned_to) && <option value={it.assigned_to}>{it.assigned_to.slice(0, 8)}</option>}
                  </Select>
                  <Input type='number' value={it.estimated_hours || ''} placeholder='est.h' onChange={e => patchItem(it.id, { estimated_hours: e.target.value ? Number(e.target.value) : null })} />
                  <Input type='number' value={it.actual_hours || ''} placeholder='act.h' onChange={e => patchItem(it.id, { actual_hours: e.target.value ? Number(e.target.value) : null })} />
                  <Input type='number' min='0' max='100' value={it.progress ?? 0} onChange={e => patchItem(it.id, { progress: Number(e.target.value) })} />
                  <Select value={it.item_status || 'backlog'} onChange={e => patchItem(it.id, { item_status: e.target.value })}>
                    <option value='backlog'>backlog</option>
                    <option value='in_progress'>in_progress</option>
                    <option value='done'>done</option>
                    <option value='blocked'>blocked</option>
                  </Select>
                </div>
              ))}
            </Card>
          ))}

          <Card style={{ marginTop: 12 }}>
            <div className='wa-section-title'>Velocity</div>
            {velocity.map(v => (
              <div key={v.id} style={{ marginBottom: 8 }}>
                <div>{v.name}: {v.points} pts · spread {v.spreadLabel}</div>
                <div style={{ height: 10, background: 'var(--wa-surface-muted)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${Math.min(v.points * 5, 100)}%`, height: '100%', background: 'var(--wa-primary)' }} />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {activeTab === 'activity' && (
        <Card>
          <div className='wa-section-title'>Recent activity</div>
          {projectActivity.length === 0 && <div className='wa-subtitle'>No activity yet for this project.</div>}
          {projectActivity.map((event) => (
            <div key={event.id} className='wa-activity-row'>
              <div>{event.label}</div>
              <div className='wa-subtitle'>{new Date(event.date).toLocaleString()}</div>
            </div>
          ))}
        </Card>
      )}

      {activeTab === 'settings' && (
        <Card>
          <div className='wa-section-title'>Project settings</div>
          <div className='wa-row'>
            <Input value={project?.name || ''} onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))} aria-label='Project name' />
            <Input value={project?.description || ''} onChange={(e) => setProject((p) => ({ ...p, description: e.target.value }))} aria-label='Project description' />
          </div>
          <div className='wa-row' style={{ marginTop: 8 }}>
            <Select value={project?.status || 'active'} onChange={(e) => setProject((p) => ({ ...p, status: e.target.value }))}>
              <option value='active'>active</option>
              <option value='on_hold'>on_hold</option>
              <option value='completed'>completed</option>
            </Select>
            <Input value={project?.icon || '📋'} onChange={(e) => setProject((p) => ({ ...p, icon: e.target.value }))} aria-label='Project icon' />
            <Input value={project?.color || '#4488dd'} onChange={(e) => setProject((p) => ({ ...p, color: e.target.value }))} aria-label='Project color' />
            <Button variant='primary' disabled={savingProject} onClick={() => updateProject({ name: project?.name, description: project?.description, status: project?.status, icon: project?.icon, color: project?.color })}>
              {savingProject ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </Card>
      )}

      {showImportForSprint && (
        <ImportModal
          onClose={() => setShowImportForSprint(null)}
          onConfirm={async (items) => {
            const created = await apiFetch(`/api/sprints/${showImportForSprint}/items`, { method: 'POST', body: JSON.stringify({ items }) })
            setSprints(prev => prev.map(s => (s.id === showImportForSprint ? { ...s, items: [...s.items, ...created] } : s)))
            setShowImportForSprint(null)
          }}
        />
      )}
    </WorkAreaShell>
  )
}
