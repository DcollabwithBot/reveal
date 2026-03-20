-- Sprint 12: Durable game session state + structured retro export support

CREATE TABLE IF NOT EXISTS game_session_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'ready_for_review', 'completed')),
  step int NOT NULL DEFAULT 0,
  final_estimate numeric(8,2),
  vote_count int NOT NULL DEFAULT 0,
  vote_min numeric(8,2),
  vote_max numeric(8,2),
  vote_avg numeric(8,2),
  saved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_game_session_states_org_project
  ON game_session_states(organization_id, project_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_session_states_team_saved
  ON game_session_states(team_id, saved_at DESC);

ALTER TABLE game_session_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_session_states'
      AND policyname = 'org members can read game session state'
  ) THEN
    CREATE POLICY "org members can read game session state"
      ON game_session_states FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.organization_id = game_session_states.organization_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;
