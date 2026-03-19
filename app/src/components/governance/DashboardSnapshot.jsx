import { governanceStyles as s, formatShortDate } from './styles';

export default function DashboardSnapshot({ activeProjects, recentActivity }) {
  return (
    <div style={s.dashboardGrid}>
      <SectionBox title="Active Projects">
        {activeProjects.map((project) => (
          <div key={project.id} style={s.projectRow}>
            <div>
              <div style={s.projectName}>{project.icon || '📋'} {project.name}</div>
              <div style={s.projectMeta}>status: {project.status} · progress: {project.progress ?? 0}%</div>
            </div>
            <div style={s.projectStats}>{project.total_items || 0} items</div>
          </div>
        ))}
        {!activeProjects.length && <div style={s.muted}>Ingen aktive projekter endnu.</div>}
      </SectionBox>

      <SectionBox title="Recent Activity">
        {recentActivity.map((item) => (
          <div key={item.id} style={s.activityRow}>
            <div style={s.activityTitle}>{item.title}</div>
            <div style={s.activityMeta}>{item.description} · {formatShortDate(item.created_at)}</div>
          </div>
        ))}
        {!recentActivity.length && <div style={s.muted}>Ingen aktivitet endnu.</div>}
      </SectionBox>
    </div>
  );
}

function SectionBox({ title, children }) {
  return (
    <div style={s.sectionBox}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
