-- ============================================================
-- Sprint: Roles, Comments, Global Search
-- ============================================================

-- ── Feature 1: Roller på org + team members ─────────────────

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner','admin','member','observer'));

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'developer'
  CHECK (role IN ('pm','tech_lead','developer','guest'));

-- RLS: kun owner/admin på org level kan opdatere roller
-- (Service role bruges fra backend, så RLS er advisory her)
-- Sæt eksisterende team_members admin til owner
UPDATE organization_members om
SET role = 'owner'
FROM teams t
JOIN team_members tm ON tm.team_id = t.id
WHERE t.organization_id = om.organization_id
  AND tm.user_id = om.user_id
  AND tm.role = 'admin'
  AND om.role = 'member';

-- ── Feature 2: Comments ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES session_items(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 5000),
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_select_org_members'
  ) THEN
    CREATE POLICY comments_select_org_members ON comments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM session_items si
          JOIN sprints sp ON sp.id = si.sprint_id
          JOIN projects pr ON pr.id = sp.project_id
          JOIN organization_members om ON om.organization_id = pr.organization_id
          WHERE si.id = comments.item_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_insert_org_members'
  ) THEN
    CREATE POLICY comments_insert_org_members ON comments
      FOR INSERT WITH CHECK (
        author_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM session_items si
          JOIN sprints sp ON sp.id = si.sprint_id
          JOIN projects pr ON pr.id = sp.project_id
          JOIN organization_members om ON om.organization_id = pr.organization_id
          WHERE si.id = item_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_update_own'
  ) THEN
    CREATE POLICY comments_update_own ON comments
      FOR UPDATE USING (author_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='comments_delete_own'
  ) THEN
    CREATE POLICY comments_delete_own ON comments
      FOR DELETE USING (author_id = auth.uid());
  END IF;
END $$;

-- ── Feature 3: Global Search ─────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- session_items: full-text search vector
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('danish', coalesce(title,'') || ' ' || coalesce(description,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_items_fts ON session_items USING GIN(search_vector);

-- Trigram index for ILIKE fallback
CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON session_items USING GIN(title gin_trgm_ops);

-- projects: full-text search vector
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('danish', coalesce(name,'') || ' ' || coalesce(description,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_fts ON projects USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING GIN(name gin_trgm_ops);

-- sprints: trigram index (simpler - no description)
CREATE INDEX IF NOT EXISTS idx_sprints_name_trgm ON sprints USING GIN(name gin_trgm_ops);
