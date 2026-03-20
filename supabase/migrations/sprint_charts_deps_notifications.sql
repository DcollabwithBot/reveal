-- ══════════════════════════════════════════════════════════════════
-- Feature 1: Burndown / Velocity Charts
-- ══════════════════════════════════════════════════════════════════

-- Sprint capacity og velocity
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS capacity_points int DEFAULT 0;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS velocity_planned int DEFAULT 0;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS velocity_actual int DEFAULT 0;

-- Daglige snapshots til burndown
CREATE TABLE IF NOT EXISTS sprint_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid REFERENCES sprints(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  items_total int DEFAULT 0,
  items_done int DEFAULT 0,
  hours_estimated numeric DEFAULT 0,
  hours_actual numeric DEFAULT 0,
  hours_remaining numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sprint_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_sprint ON sprint_daily_snapshots(sprint_id);

-- Velocity view
CREATE OR REPLACE VIEW sprint_velocity AS
SELECT 
  s.project_id,
  s.id as sprint_id,
  s.name as sprint_name,
  s.end_date,
  COUNT(si.id) FILTER (WHERE si.item_status = 'completed') as items_completed,
  COALESCE(SUM(si.estimated_hours) FILTER (WHERE si.item_status = 'completed'), 0) as hours_completed,
  COALESCE(SUM(si.actual_hours) FILTER (WHERE si.item_status = 'completed'), 0) as actual_hours,
  s.capacity_points,
  s.velocity_planned,
  s.velocity_actual
FROM sprints s
LEFT JOIN session_items si ON si.sprint_id = s.id
GROUP BY s.id, s.project_id, s.name, s.end_date, s.capacity_points, s.velocity_planned, s.velocity_actual;

-- ══════════════════════════════════════════════════════════════════
-- Feature 2: Dependencies og Blockers
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS item_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  depends_on_id uuid NOT NULL REFERENCES session_items(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN ('blocks','relates_to')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, depends_on_id),
  CHECK (item_id != depends_on_id)
);
CREATE INDEX IF NOT EXISTS idx_deps_item ON item_dependencies(item_id);
CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON item_dependencies(depends_on_id);
ALTER TABLE item_dependencies ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════
-- Feature 3: In-app Notifikationer
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notification rules (hvilke events trigger in-app)
CREATE TABLE IF NOT EXISTS notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','both')),
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, event_type, channel)
);
