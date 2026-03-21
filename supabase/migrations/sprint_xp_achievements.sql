-- user_achievements tabel (no FK to achievement_definitions.key since it has composite unique on game_profile_id+key)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  session_id UUID REFERENCES sessions(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tilføj total_sessions til profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;
