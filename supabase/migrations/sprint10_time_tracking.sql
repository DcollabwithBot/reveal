-- ============================================================
-- Sprint 10: Time Tracking + Invoicing layer
-- Modelleret efter IT-konsulenters Excel-flow (FAK/INT/UB/Kørsel)
-- ============================================================

-- Tilføj time-tracking felter til session_items
ALTER TABLE session_items
  ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS hours_fak        NUMERIC(8,2) DEFAULT 0,  -- fakturerbare timer
  ADD COLUMN IF NOT EXISTS hours_int        NUMERIC(8,2) DEFAULT 0,  -- interne timer
  ADD COLUMN IF NOT EXISTS hours_ub         NUMERIC(8,2) DEFAULT 0,  -- uddannelse/ubetalt
  ADD COLUMN IF NOT EXISTS km_driven        NUMERIC(8,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiced_dkk     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS to_invoice_dkk   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_code        TEXT,                     -- fx "2001-3"
  ADD COLUMN IF NOT EXISTS parent_code      TEXT;                     -- fx "2001"

-- Granulær tidsregistrering per person per opgave
CREATE TABLE IF NOT EXISTS time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_item_id UUID REFERENCES session_items(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  hours           NUMERIC(6,2) NOT NULL CHECK (hours > 0),
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('FAK','INT','UB','Kørsel')),
  km              NUMERIC(8,1),                                       -- kun ved Kørsel
  hourly_rate     NUMERIC(8,2),                                       -- DKK/time snapshot
  registered_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  invoiced        BOOLEAN DEFAULT FALSE,
  invoice_ref     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_item     ON time_entries(session_item_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user     ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date     ON time_entries(registered_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoiced ON time_entries(invoiced);

-- Excel import log (hvem importerede hvad hvornår)
CREATE TABLE IF NOT EXISTS excel_imports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename    TEXT,
  row_count   INTEGER,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data    JSONB   -- gemmer original payload til audit
);

-- View: aggregeret per session_item (hvad Excel viser)
CREATE OR REPLACE VIEW v_item_summary AS
SELECT
  si.id,
  si.item_code,
  si.parent_code,
  si.title,
  si.status,
  si.estimated_hours,
  si.invoiced_dkk,
  si.to_invoice_dkk,
  COALESCE(SUM(CASE WHEN te.entry_type = 'FAK'    THEN te.hours  END), 0) AS hours_fak,
  COALESCE(SUM(CASE WHEN te.entry_type = 'INT'    THEN te.hours  END), 0) AS hours_int,
  COALESCE(SUM(CASE WHEN te.entry_type = 'UB'     THEN te.hours  END), 0) AS hours_ub,
  COALESCE(SUM(CASE WHEN te.entry_type = 'Kørsel' THEN te.km     END), 0) AS km_total,
  COALESCE(SUM(te.hours), 0)                                               AS hours_total,
  COUNT(te.id)                                                              AS entry_count
FROM session_items si
LEFT JOIN time_entries te ON te.session_item_id = si.id
GROUP BY si.id;

-- View: aggregeret per projekt/sprint (portfolio-niveau)
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  sp.id AS sprint_id,
  sp.name AS sprint_name,
  sp.sprint_code,
  COALESCE(SUM(si.estimated_hours), 0)                                     AS estimated_hours,
  COALESCE(SUM(CASE WHEN te.entry_type = 'FAK' THEN te.hours END), 0)      AS hours_fak,
  COALESCE(SUM(CASE WHEN te.entry_type = 'INT' THEN te.hours END), 0)      AS hours_int,
  COALESCE(SUM(si.invoiced_dkk), 0)                                         AS invoiced_dkk,
  COALESCE(SUM(si.to_invoice_dkk), 0)                                       AS to_invoice_dkk,
  COALESCE(SUM(si.invoiced_dkk) + SUM(si.to_invoice_dkk), 0)               AS total_dkk
FROM projects p
JOIN sprints sp       ON sp.project_id = p.id
JOIN session_items si ON si.sprint_id  = sp.id
LEFT JOIN time_entries te ON te.session_item_id = si.id
GROUP BY p.id, sp.id;

-- RLS
ALTER TABLE time_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE excel_imports ENABLE ROW LEVEL SECURITY;

-- Medlemmer af en organisation kan se time entries for projekter i organisationen
CREATE POLICY "org members can view time entries"
  ON time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_items si
      JOIN sprints sp ON sp.id = si.sprint_id
      JOIN projects p ON p.id = sp.project_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE si.id = time_entries.session_item_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users can update own time entries"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid() AND invoiced = FALSE);

-- Sprints: tilføj sprint_code kolonne hvis den ikke er der
ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS sprint_code TEXT;  -- fx "2001", "2002"
