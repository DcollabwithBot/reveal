-- Sprint D: New Achievements for SprintDraft + Retro screens
-- ═══════════════════════════════════════════════════════════════════════════════
-- Applied: Sprint D (2026-03-21)
-- New game soul additions for SprintDraftScreen and RetroScreen

-- achievement_unlocks table (if not already created by previous migrations)
CREATE TABLE IF NOT EXISTS achievement_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  session_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
  xp_awarded  INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS achievement_unlocks_user_key
  ON achievement_unlocks (user_id, achievement_key);

ALTER TABLE achievement_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievement_unlocks_read"  ON achievement_unlocks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "achievement_unlocks_write" ON achievement_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── New Achievement Definitions ─────────────────────────────────────────────
INSERT INTO achievement_definitions (id, key, name, description, icon, rule)
VALUES
  (gen_random_uuid(), 'perfect_fill',          'Perfect Fill',          'Completed a sprint draft at exactly 100% capacity',  '🎯', '{"xp": 50, "mode": "sprint_draft"}'),
  (gen_random_uuid(), 'retrospective_veteran',  'Retrospective Veteran', 'Participated in 10+ retrospectives',                  '📋', '{"xp": 75, "mode": "retro"}')
ON CONFLICT (key) DO NOTHING;
