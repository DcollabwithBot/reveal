-- Sprint E14: Leaderboard infrastructure
-- profiles.xp and profiles.level already exist (v31_core_mechanics.sql)
-- This migration adds avatar_class column and leaderboard view

-- Avatar class for mini avatar display in leaderboard
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_class jsonb DEFAULT NULL;
  -- Stores { icon, color, name } from the game avatar creator

-- Ensure xp and level columns exist (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS xp    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level int DEFAULT 1;

-- Index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp DESC);

-- Leaderboard summary view (non-materialized for simplicity)
-- Materialized version can be added later when perf requires it
CREATE OR REPLACE VIEW leaderboard_org AS
SELECT
  p.id,
  p.display_name,
  p.avatar_class,
  p.xp,
  p.level,
  om.organization_id
FROM profiles p
JOIN organization_members om ON om.user_id = p.id
ORDER BY p.xp DESC;

-- RLS: members can see their org's leaderboard
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_org_read'
  ) THEN
    CREATE POLICY profiles_org_read ON profiles
      FOR SELECT USING (
        id IN (
          SELECT user_id FROM organization_members
          WHERE organization_id IN (
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
          )
        )
        OR id = auth.uid()
      );
  END IF;
END $$;
