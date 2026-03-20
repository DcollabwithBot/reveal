-- v3.1 Core Mechanics Migration
-- Risk Cards, Truth Serum, Confidence Signal, Lifelines, Feedback Loop, XP/Badges

-- ═══ 1. Risk Cards ═══
CREATE TABLE IF NOT EXISTS session_risk_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid REFERENCES session_items(id) ON DELETE SET NULL,
  played_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  card_type text NOT NULL CHECK (card_type IN (
    'dependency_risk', 'legacy_complexity', 'unknown_unknowns',
    'single_point_of_knowledge', 'truth_serum', 'scope_creep', 'integration_risk'
  )),
  note text,
  acknowledged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_cards_session ON session_risk_cards(session_id);
ALTER TABLE session_risk_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can read risk cards" ON session_risk_cards
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM sessions s JOIN organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = session_risk_cards.session_id AND om.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org members can insert risk cards" ON session_risk_cards
    FOR INSERT WITH CHECK (played_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 2. Truth Serum Responses ═══
CREATE TABLE IF NOT EXISTS truth_serum_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  session_item_id uuid REFERENCES session_items(id) ON DELETE SET NULL,
  response text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE truth_serum_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can read truth serum" ON truth_serum_responses
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM sessions s JOIN organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = truth_serum_responses.session_id AND om.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "anyone can insert truth serum" ON truth_serum_responses
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 3. Confidence on Votes ═══
ALTER TABLE votes ADD COLUMN IF NOT EXISTS confidence int CHECK (confidence BETWEEN 1 AND 5);

-- ═══ 4. Session Items — Confidence & Risk Fields ═══
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS confidence_avg numeric(3,2);
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS risk_score numeric(3,2);
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS risk_flag boolean DEFAULT false;

-- ═══ 5. Lifelines ═══
CREATE TABLE IF NOT EXISTS session_lifelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lifeline_type text NOT NULL CHECK (lifeline_type IN (
    'call_expert', 'scope_reduction', 'audience_vote', 'facilitator_insight'
  )),
  used_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT now(),
  result_data jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_lifelines_session ON session_lifelines(session_id);
ALTER TABLE session_lifelines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can read lifelines" ON session_lifelines
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM sessions s JOIN organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = session_lifelines.session_id AND om.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org members can insert lifelines" ON session_lifelines
    FOR INSERT WITH CHECK (used_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 6. Sprint Close + Accuracy ═══
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS closed_at timestamptz;
-- status may already exist with different constraint, use DO block
DO $$ BEGIN
  ALTER TABLE sprints ADD COLUMN IF NOT EXISTS status text DEFAULT 'upcoming';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE session_items ADD COLUMN IF NOT EXISTS actual_hours_logged numeric(8,2);
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS estimate_accuracy numeric(5,2);

CREATE TABLE IF NOT EXISTS team_accuracy_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL,
  accuracy_score numeric(5,2) NOT NULL,
  items_measured int DEFAULT 0,
  avg_overestimate numeric(5,2),
  avg_underestimate numeric(5,2),
  risk_catch_rate numeric(5,2),
  calculated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accuracy_org ON team_accuracy_scores(organization_id);
ALTER TABLE team_accuracy_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "org members can read accuracy" ON team_accuracy_scores
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM organization_members om
      WHERE om.organization_id = team_accuracy_scores.organization_id AND om.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org members can insert accuracy" ON team_accuracy_scores
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM organization_members om
      WHERE om.organization_id = team_accuracy_scores.organization_id AND om.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 7. XP + Badges ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level int DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accuracy_score numeric(5,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (badge_type IN (
    'estimation_sniper', 'risk_hunter', 'scope_master',
    'truth_teller', 'team_anchor', 'sprint_streak', 'perfect_fill'
  )),
  earned_at timestamptz DEFAULT now(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  UNIQUE(user_id, badge_type)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users can see own badges" ON user_badges
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "users can see org badges" ON user_badges
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = user_badges.user_id AND om2.user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "service role inserts badges" ON user_badges
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 8. Sessions — truth serum active flag ═══
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS truth_serum_active boolean DEFAULT false;
