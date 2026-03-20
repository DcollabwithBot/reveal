-- Migration: estimation pipeline
-- Tilføj source_item_id på session_items (link tilbage til PM-opgave)
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS source_item_id uuid REFERENCES session_items(id) ON DELETE SET NULL;

-- Tilføj estimation_session_id på session_items (link til session der estimerede den)
ALTER TABLE session_items ADD COLUMN IF NOT EXISTS estimation_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_session_items_source_item ON session_items(source_item_id);
