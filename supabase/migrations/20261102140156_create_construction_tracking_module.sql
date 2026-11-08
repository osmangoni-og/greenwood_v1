/*
# Create Construction Tracking Module

1. New Tables
- `construction_phases`: one row per project phase. Stores the phase name, sequence,
  planned date, actual date, progress percentage, engineer comments, issues, delays,
  and photo references.

2. Security
- RLS is enabled on `construction_phases`.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through separate policies.

3. Supported Phases
- Site Preparation, Foundation, Ground Floor RCC, First Floor RCC, Roof, Brick Work,
  Electrical, Plumbing, Tiles, Paint, Finishing, and Handover.

4. Important Notes
1. Progress is constrained between 0 and 100.
2. Photo references are stored as JSON so the interface can support multiple photo URLs
   without changing the phase record shape.
3. Project deletion cascades to its tracking phases.
*/

CREATE TABLE IF NOT EXISTS construction_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key text NOT NULL CHECK (phase_key IN ('site_preparation','foundation','ground_floor_rcc','first_floor_rcc','roof','brick_work','electrical','plumbing','tiles','paint','finishing','handover')),
  phase_name text NOT NULL,
  sequence_number integer NOT NULL,
  planned_date date,
  actual_date date,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  engineer_comments text,
  issues text,
  delays text,
  UNIQUE (project_id, phase_key)
);

CREATE INDEX IF NOT EXISTS idx_construction_phases_project ON construction_phases(project_id, sequence_number);

DROP TRIGGER IF EXISTS trg_construction_phases_updated_at ON construction_phases;
CREATE TRIGGER trg_construction_phases_updated_at BEFORE UPDATE ON construction_phases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE construction_phases ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON construction_phases TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_construction_phases" ON construction_phases;
CREATE POLICY "anon_select_construction_phases" ON construction_phases FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_construction_phases" ON construction_phases;
CREATE POLICY "anon_insert_construction_phases" ON construction_phases FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_construction_phases" ON construction_phases;
CREATE POLICY "anon_update_construction_phases" ON construction_phases FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_construction_phases" ON construction_phases;
CREATE POLICY "anon_delete_construction_phases" ON construction_phases FOR DELETE TO anon, authenticated USING (true);
