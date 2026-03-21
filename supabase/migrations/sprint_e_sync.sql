-- Sprint E: Bidirektionel Sync State Tracking

CREATE TABLE IF NOT EXISTS field_sync_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  field_name      text NOT NULL,
  game_value      jsonb,
  pm_value        jsonb,
  sync_status     text DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending_approval', 'conflict', 'game_ahead', 'pm_ahead')),
  last_game_write timestamptz,
  last_pm_write   timestamptz,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(entity_type, entity_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_field_sync_entity
  ON field_sync_state(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_field_sync_status
  ON field_sync_state(sync_status) WHERE sync_status != 'synced';

-- Session draft config (for "skift spil" flow - E3)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS draft_config jsonb;
