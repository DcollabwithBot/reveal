-- Sprint TODO features: SMTP configs, onboarding columns
-- Run via Supabase Management API

-- SMTP configs table
CREATE TABLE IF NOT EXISTS smtp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  tls boolean NOT NULL DEFAULT true,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_address text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'Reveal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE smtp_configs ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read, owner/admin can write
CREATE POLICY "smtp_configs_select" ON smtp_configs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "smtp_configs_insert" ON smtp_configs FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "smtp_configs_update" ON smtp_configs FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Onboarding columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Jira sync log (sync_log already exists with different schema)
CREATE TABLE IF NOT EXISTS jira_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  action text NOT NULL,
  items_synced integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
