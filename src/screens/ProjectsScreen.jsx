import { useEffect, useMemo, useState } from 'react'
import { apiFetch, fetchAssignees } from '../lib/api'
import ImportModal from '../components/ImportModal'
import { Banner, Button, Card, Input, Select, WorkAreaShell } from '../components/WorkAreaUI'

const STATUS_OPTIONS = ['all', 'active', 'on_hold', 'completed']

export default function ProjectsScreen({ projectId, onOpenProject, onBack }) {
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const [sprints, setSprints] = useState([])
  const [showImportForSprint, setShowImportForSprint] = useState(null)

  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [newSprint, setNewSprint] = useState({ name: '', goal: '' })
  const [itemTitle, setItemTitle] = useState({})
  const [assignees, setAssignees] = useState([])

  const [projectCreateError, setProjectCreateError] = useState('')
  const [projectCreateSuccess, setProjectCreateSuccess] = useState('')
  const [loadError, setLoadError] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!projectId) {
      apiFetch('/api/projects')
        .then(setProjects)
        .catch((e) => setLoadError(e?.message || 'Could not load projects'))
      return
    }

    apiFetch(`/api/projects/${projectId}`).then(setProject).catch(() => setLoadError('Could not load project details'))
    apiFetch(`/api/projects/${projectId}/sprints`).then(setSprints).catch(() => setLoadError('Could not load sprints'))
    fetchAssignees().then(setAssignees).catch(() => {})
  }, [projectId])

  const createProject = async () => {
    if (creatingProject) return
    setProjectCreateError('')
    setProjectCreateSuccess('')

    if (newProject.name.trim().length < 2) {
      setProjectCreateError('Project name must be at least 2 characters')
      return
    }

    setCreatingProject(true)
    try {
      const p = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProject.name.trim(), description: newProject.description.trim() })
      })
      setProjects(prev => [p, ...prev])
      setNewProject({ name: '', description: '' })
      setProjectCreateSuccess('Project created successfully')
    } catch (e) {
      setProjectCreateError(e?.message || 'Could not create project')
    } finally {
      setCreatingProject(false)
    }
  }

  const createSprint = async () => {
    const s = await apiFetch(`/api/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(newSprint) })
    setSprints(prev => [{ ...s, items: [] }, ...prev])
    setNewSprint({ name: '', goal: '' })
  }

  const addItem = async (sprintId) => {
    const title = itemTitle[sprintId]
    if (!title?.trim()) return
    const it = await apiFetch(`/api/sprints/${sprintId}/items`, { method: 'POST', body: JSON.stringify({ title }) })
    setSprints(prev => prev.map(s => (s.id === sprintId ? { ...s, items: [...s.items, it] } : s)))
    setItemTitle(t => ({ ...t, [sprintId]: '' }))
  }

  const patchItem = async (itemId, patch) => {
    const updated = await apiFetch(`/api/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setSprints(prev => prev.map(s => ({ ...s, items: s.items.map(i => (i.id === itemId ? { ...i, ...updated } : i)) })))
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
            <div className='wa-subtitle'>Manage project portfolio, search, and create new workspaces.</div>
          </div>
          <div className='wa-actions'>
            <Button onClick={onBack}>Back to dashboard</Button>
          </div>
        </div>

        <Card>
          <div className='wa-section-title'>Create project</div>
          <div className='wa-row'>
            <Input
              placeholder='Project name'
              value={newProject.name}
              onChange={e => setNewProject({ ...newProject, name: e.target.value })}
              aria-label='Project name'
            />
            <Input
              placeholder='Description'
              value={newProject.description}
              onChange={e => setNewProject({ ...newProject, description: e.target.value })}
              aria-label='Project description'
            />
            <Button variant='primary' onClick={createProject} disabled={creatingProject || newProject.name.trim().length < 2}>
              {creatingProject ? 'Creating...' : 'Create project'}
            </Button>
          </div>
          {projectCreateError && <Banner type='error'>{projectCreateError}</Banner>}
          {projectCreateSuccess && <Banner type='success'>{projectCreateSuccess}</Banner>}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <div className='wa-topbar' style={{ marginBottom: 6 }}>
            <div className='wa-section-title' style={{ marginBottom: 0 }}>Project list</div>
            <div className='wa-row'>
              <Input placeholder='Search projects…' value={query} onChange={(e) => setQuery(e.target.value)} aria-label='Search projects' />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label='Filter by status'>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
              </Select>
            </div>
          </div>

          {loadError && <Banner type='error'>{loadError}</Banner>}

          {filteredProjects.length === 0 && !loadError && <div className='wa-subtitle'>No projects match your filter yet.</div>}

          {filteredProjects.length > 0 && (
            <div className='wa-table-wrap'>
              <table className='wa-table'>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.description || <span className='wa-subtitle'>No description</span>}</td>
                      <td><span className={`wa-badge wa-badge-${p.status || 'active'}`}>{p.status || 'active'}</span></td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
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
            <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(5, minmax(100px, 1fr))', gap: 6, marginTop: 8 }}>
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
