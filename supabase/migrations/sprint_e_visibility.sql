-- Sprint E: Mission Shield — Project & Sprint Visibility
-- Adds visibility control to prevent private projects from appearing in game surfaces

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'restricted'));

ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS visibility text
    CHECK (visibility IN ('public', 'private', 'restricted'));
-- NULL on sprints = inherit from project

-- Indexes for efficient visibility filtering
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_sprints_visibility ON sprints(visibility) WHERE visibility IS NOT NULL;

-- Also add game_preset to projects (D4 support)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS game_preset text DEFAULT 'standard'
    CHECK (game_preset IN ('standard', 'full_game', 'lean'));

-- Game availability cache table
CREATE TABLE IF NOT EXISTS game_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sprint_id       uuid REFERENCES sprints(id) ON DELETE CASCADE,
  session_type    text NOT NULL,
  state           text NOT NULL CHECK (state IN ('available', 'recommended', 'locked', 'completed')),
  reason          text,
  last_played_at  timestamptz,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(sprint_id, session_type)
);

CREATE INDEX IF NOT EXISTS idx_game_availability_sprint ON game_availability(sprint_id);
