import { useEffect, useMemo, useState } from 'react'
import { apiFetch, fetchAssignees } from '../lib/api'
import ImportModal from '../components/ImportModal'

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
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    if (!projectId) {
      apiFetch('/api/projects').then(setProjects).catch(() => {})
    } else {
      apiFetch(`/api/projects/${projectId}`).then(setProject).catch(() => {})
      apiFetch(`/api/projects/${projectId}/sprints`).then(setSprints).catch(() => {})
      fetchAssignees().then(setAssignees).catch(() => {})
    }
  }, [projectId])

  const createProject = async () => {
    if (creatingProject) return
    setProjectCreateError('')
    setCreatingProject(true)
    try {
      const p = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(newProject) })
      setProjects(prev => [p, ...prev])
      setNewProject({ name: '', description: '' })
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
    setSprints(prev => prev.map(s => s.id === sprintId ? { ...s, items: [...s.items, it] } : s))
    setItemTitle(t => ({ ...t, [sprintId]: '' }))
  }

  const patchItem = async (itemId, patch) => {
    const updated = await apiFetch(`/api/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setSprints(prev => prev.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, ...updated } : i) })))
  }

  const velocity = useMemo(() => sprints.map(s => {
    const points = (s.items || []).reduce((sum, it) => sum + (Number(it.final_estimate) || 0), 0)
    const values = (s.items || []).map(it => Number(it.final_estimate) || 0).filter(Boolean)
    const spread = values.length ? (Math.max(...values) - Math.min(...values)) : 0
    return { id: s.id, name: s.name, points, spread, spreadLabel: spread > 13 ? 'high' : spread > 5 ? 'medium' : 'low' }
  }), [sprints])

  if (!projectId) {
    return <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0d8f0', padding: 16 }}>
      <button onClick={onBack}>← Dashboard</button>
      <h2>Projects</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input placeholder='Project name' value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
        <input placeholder='Description' value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
        <button onClick={createProject} disabled={creatingProject} style={{ opacity: creatingProject ? 0.7 : 1, cursor: creatingProject ? 'wait' : 'pointer' }}>
          {creatingProject ? 'Creating...' : 'Create'}
        </button>
      </div>
      {projectCreateError && (
        <div style={{ marginBottom: 10, color: '#f87171', fontSize: 14 }}>⚠️ {projectCreateError}</div>
      )}
      {projects.map(p => <div key={p.id} style={{ border: '1px solid #2a2a5a', padding: 8, marginBottom: 8 }}>
        <strong>{p.name}</strong>
        <div>{p.description}</div>
        <button onClick={() => onOpenProject(p.id)}>Open</button>
      </div>)}
    </div>
  }

  return <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0d8f0', padding: 16 }}>
    <button onClick={onBack}>← Projects</button>
    <h2>{project?.name || 'Project'}</h2>

    <div style={{ marginBottom: 12 }}>
      <input placeholder='Sprint name' value={newSprint.name} onChange={e => setNewSprint({ ...newSprint, name: e.target.value })} />
      <input placeholder='Goal' value={newSprint.goal} onChange={e => setNewSprint({ ...newSprint, goal: e.target.value })} style={{ marginLeft: 8 }} />
      <button onClick={createSprint} style={{ marginLeft: 8 }}>Create sprint</button>
    </div>

    {sprints.map(s => <div key={s.id} style={{ border: '2px solid #2a2a5a', borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <strong>{s.name}</strong> <span style={{ color: '#6060a0' }}>{s.goal}</span>
      <button onClick={() => setShowImportForSprint(s.id)} style={{ marginLeft: 8 }}>Import from Excel</button>
      <div style={{ marginTop: 8 }}>
        <input value={itemTitle[s.id] || ''} placeholder='Add item title' onChange={e => setItemTitle(t => ({ ...t, [s.id]: e.target.value }))} />
        <button onClick={() => addItem(s.id)}>Add</button>
      </div>
      {(s.items || []).map(it => <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(5,1fr)', gap: 6, marginTop: 8 }}>
        <input value={it.title || ''} onChange={e => patchItem(it.id, { title: e.target.value })} />
        <select value={it.assigned_to || ''} onChange={e => patchItem(it.id, { assigned_to: e.target.value || null })}>
          <option value=''>Unassigned</option>
          {assignees.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          {it.assigned_to && !assignees.some(person => person.id === it.assigned_to) && (
            <option value={it.assigned_to}>{it.assigned_to.slice(0, 8)}</option>
          )}
        </select>
        <input type='number' value={it.estimated_hours || ''} placeholder='est.h' onChange={e => patchItem(it.id, { estimated_hours: e.target.value ? Number(e.target.value) : null })} />
        <input type='number' value={it.actual_hours || ''} placeholder='act.h' onChange={e => patchItem(it.id, { actual_hours: e.target.value ? Number(e.target.value) : null })} />
        <input type='number' min='0' max='100' value={it.progress ?? 0} onChange={e => patchItem(it.id, { progress: Number(e.target.value) })} />
        <select value={it.item_status || 'backlog'} onChange={e => patchItem(it.id, { item_status: e.target.value })}>
          <option value='backlog'>backlog</option><option value='in_progress'>in_progress</option><option value='done'>done</option><option value='blocked'>blocked</option>
        </select>
      </div>)}
    </div>)}

    <h3>Velocity</h3>
    {velocity.map(v => <div key={v.id} style={{ marginBottom: 6 }}>
      <div>{v.name}: {v.points} pts · spread {v.spreadLabel}</div>
      <div style={{ height: 12, background: '#111130', border: '1px solid #2a2a5a' }}><div style={{ width: `${Math.min(v.points * 5, 100)}%`, height: '100%', background: '#7c5cbf' }} /></div>
    </div>)}

    {showImportForSprint && <ImportModal
      onClose={() => setShowImportForSprint(null)}
      onConfirm={async (items) => {
        const created = await apiFetch(`/api/sprints/${showImportForSprint}/items`, { method: 'POST', body: JSON.stringify({ items }) })
        setSprints(prev => prev.map(s => s.id === showImportForSprint ? { ...s, items: [...s.items, ...created] } : s))
        setShowImportForSprint(null)
      }}
    />}
  </div>
}
