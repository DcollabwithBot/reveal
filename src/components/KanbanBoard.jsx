import { Button } from './WorkAreaUI'

const STATUS_LABEL = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed'
}

const HEALTH_LABEL = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track'
}

const COLUMNS = [
  { id: 'active', title: 'Active' },
  { id: 'attention', title: 'On hold / At risk' },
  { id: 'completed', title: 'Completed' }
]

function toColumn(project) {
  if (project.status === 'completed') return 'completed'
  if (project.status === 'on_hold' || project.health === 'at_risk' || project.health === 'off_track') return 'attention'
  return 'active'
}

function healthClass(health) {
  if (health === 'off_track') return 'wa-badge-off_track'
  if (health === 'at_risk') return 'wa-badge-at_risk'
  return 'wa-badge-on_track'
}

export default function KanbanBoard({
  projects = [],
  onOpenProject,
  onUpdateStatus,
  emptyTitle = 'No projects yet',
  emptySubtitle = 'Create your first project to populate this board.'
}) {
  const columns = COLUMNS.map((column) => ({
    ...column,
    items: projects.filter((project) => toColumn(project) === column.id)
  }))

  const hasProjects = projects.length > 0

  return (
    <div className='wa-kanban-wrap'>
      {!hasProjects && (
        <div className='wa-kanban-empty'>
          <strong>{emptyTitle}</strong>
          <span>{emptySubtitle}</span>
        </div>
      )}

      <div className='wa-kanban-grid'>
        {columns.map((column) => (
          <section key={column.id} className='wa-kanban-column'>
            <header className='wa-kanban-column-header'>
              <div>{column.title}</div>
              <span>{column.items.length}</span>
            </header>

            {column.items.length === 0 ? (
              <div className='wa-kanban-column-empty'>No projects in this lane.</div>
            ) : (
              <div className='wa-kanban-cards'>
                {column.items.map((project) => (
                  <article key={project.id} className='wa-kanban-card'>
                    <div className='wa-kanban-card-top'>
                      <strong>{project.name}</strong>
                      <Button onClick={() => onOpenProject?.(project.id)}>Open</Button>
                    </div>

                    <div className='wa-kanban-meta'>
                      <div>Owner: {project.owner_name || 'Unassigned'}</div>
                      <div>Progress: {project.progress || 0}%</div>
                    </div>

                    <div className='wa-kanban-badges'>
                      <span className={`wa-badge wa-badge-${project.status || 'active'}`}>
                        {STATUS_LABEL[project.status] || 'Active'}
                      </span>
                      <span className={`wa-badge ${healthClass(project.health)}`}>
                        {HEALTH_LABEL[project.health] || 'On track'}
                      </span>
                    </div>

                    <div className='wa-progress'><div style={{ width: `${project.progress || 0}%` }} /></div>

                    <div className='wa-kanban-controls'>
                      <label htmlFor={`status-${project.id}`}>Move to</label>
                      <select
                        id={`status-${project.id}`}
                        className='wa-select wa-focus'
                        value={project.status || 'active'}
                        onChange={(e) => onUpdateStatus?.(project.id, e.target.value)}
                      >
                        <option value='active'>Active</option>
                        <option value='on_hold'>On hold</option>
                        <option value='completed'>Completed</option>
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
