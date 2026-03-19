import { useEffect, useState } from 'react'
import { apiFetch, fetchAssignees } from '../lib/api'
import { Banner, Button, Card, Input, Select, WorkAreaShell } from '../components/WorkAreaUI'

const DEFAULT_FORM = {
  name: '',
  description: '',
  status: 'active',
  color: '#4457ff',
  icon: '📋'
}

export default function ProjectCreateScreen({ onBack, onCreated }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignees, setAssignees] = useState([])

  useEffect(() => {
    fetchAssignees().then(setAssignees).catch(() => {})
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')

    if (form.name.trim().length < 2) {
      setError('Project name must be at least 2 characters')
      return
    }

    setSaving(true)
    try {
      const created = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(form) })
      onCreated(created)
    } catch (e) {
      setError(e?.message || 'Could not create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkAreaShell>
      <div className='wa-topbar'>
        <div>
          <div className='wa-title'>Create new project</div>
          <div className='wa-subtitle'>Set up a clean project workspace for sessions and sprint execution.</div>
        </div>
        <div className='wa-actions'>
          <Button onClick={onBack}>Back to projects</Button>
        </div>
      </div>

      <Card>
        <form onSubmit={submit} className='wa-form-grid'>
          <label className='wa-form-field'>
            <span>Project name *</span>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='Reveal Platform Upgrade' aria-label='Project name' />
          </label>

          <label className='wa-form-field'>
            <span>Status</span>
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value='active'>active</option>
              <option value='on_hold'>on_hold</option>
              <option value='completed'>completed</option>
            </Select>
          </label>

          <label className='wa-form-field'>
            <span>Description</span>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder='Describe the project goals and scope' aria-label='Project description' />
          </label>

          <div className='wa-row'>
            <label className='wa-form-field'>
              <span>Icon</span>
              <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} aria-label='Project icon' />
            </label>
            <label className='wa-form-field'>
              <span>Color</span>
              <Input type='color' value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} aria-label='Project color' />
            </label>
            <label className='wa-form-field'>
              <span>Owner</span>
              <Select disabled>
                <option>{assignees[0]?.display_name || 'Current user (default)'}</option>
              </Select>
            </label>
          </div>

          {error && <Banner type='error'>{error}</Banner>}

          <div className='wa-row'>
            <Button type='submit' variant='primary' disabled={saving || form.name.trim().length < 2}>
              {saving ? 'Creating...' : 'Create project'}
            </Button>
            <Button type='button' onClick={() => setForm(DEFAULT_FORM)}>Reset</Button>
          </div>
        </form>
      </Card>
    </WorkAreaShell>
  )
}
