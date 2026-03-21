-- API Keys table for external REST API access (PowerBI, integrations etc.)
-- Keys are stored as SHA-256 hashes — raw key shown once, never stored

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,  -- first 12 chars for identification (rvl_xxxxxxxx)
  name TEXT NOT NULL DEFAULT 'Default',
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:projects', 'read:sprints', 'read:items', 'read:time', 'read:sessions', 'read:team'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- null = no expiry
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ  -- null = active
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
