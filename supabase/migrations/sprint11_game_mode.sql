-- Sprint 11: Game Mode / Intensity Setting per Organization
-- Tre niveauer: focus | engaged | full

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'engaged'
  CHECK (game_mode IN ('focus', 'engaged', 'full'));

-- Seed eksisterende orgs til 'engaged' (allerede default, men sikrer konsistens)
UPDATE organizations SET game_mode = 'engaged' WHERE game_mode IS NULL;
