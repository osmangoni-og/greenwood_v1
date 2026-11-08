/*
# Create Quality Control Module

1. New Tables
- `quality_inspections`: inspection sessions per project and trade (Foundation,
  Columns, Beams, Slabs, Brick Work, Plaster, Electrical, Plumbing, Tiles, Paint).
  Stores inspection date, inspector, status, summary, and overall result.
- `quality_checklist_items`: checklist questions belonging to an inspection, with
  expected criteria, result, observations, and defect flag.
- `quality_defects`: defects found during inspections, including severity, location,
  description, rectification action, owner, due date, status, and completion date.

2. Security
- RLS is enabled on all three tables.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through separate policies.

3. Important Notes
1. Inspection results are constrained to pending, passed, failed, or conditional.
2. Defect statuses are open, in_progress, resolved, or accepted.
3. Deleting an inspection cascades to its checklist items and defects.
*/

CREATE TABLE IF NOT EXISTS quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspection_type text NOT NULL CHECK (inspection_type IN ('foundation','columns','beams','slabs','brick_work','plaster','electrical','plumbing','tiles','paint')),
  inspection_date date NOT NULL DEFAULT current_date,
  inspector_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','conditional')),
  summary text,
  UNIQUE (project_id, inspection_type, inspection_date)
);

CREATE TABLE IF NOT EXISTS quality_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  inspection_id uuid NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
  item_order integer NOT NULL DEFAULT 1,
  checklist_item text NOT NULL,
  acceptance_criteria text,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','pass','fail','na')),
  observations text,
  defect_found boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS quality_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  inspection_id uuid NOT NULL REFERENCES quality_inspections(id) ON DELETE CASCADE,
  location text,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  rectification_action text,
  responsible_party text,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','accepted')),
  resolved_date date
);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_project ON quality_inspections(project_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_quality_checklist_inspection ON quality_checklist_items(inspection_id, item_order);
CREATE INDEX IF NOT EXISTS idx_quality_defects_inspection ON quality_defects(inspection_id, status);

DROP TRIGGER IF EXISTS trg_quality_inspections_updated_at ON quality_inspections;
CREATE TRIGGER trg_quality_inspections_updated_at BEFORE UPDATE ON quality_inspections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_quality_checklist_items_updated_at ON quality_checklist_items;
CREATE TRIGGER trg_quality_checklist_items_updated_at BEFORE UPDATE ON quality_checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_quality_defects_updated_at ON quality_defects;
CREATE TRIGGER trg_quality_defects_updated_at BEFORE UPDATE ON quality_defects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_defects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON quality_inspections, quality_checklist_items, quality_defects TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_quality_inspections" ON quality_inspections;
CREATE POLICY "anon_select_quality_inspections" ON quality_inspections FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quality_inspections" ON quality_inspections;
CREATE POLICY "anon_insert_quality_inspections" ON quality_inspections FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quality_inspections" ON quality_inspections;
CREATE POLICY "anon_update_quality_inspections" ON quality_inspections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quality_inspections" ON quality_inspections;
CREATE POLICY "anon_delete_quality_inspections" ON quality_inspections FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_quality_checklist_items" ON quality_checklist_items;
CREATE POLICY "anon_select_quality_checklist_items" ON quality_checklist_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quality_checklist_items" ON quality_checklist_items;
CREATE POLICY "anon_insert_quality_checklist_items" ON quality_checklist_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quality_checklist_items" ON quality_checklist_items;
CREATE POLICY "anon_update_quality_checklist_items" ON quality_checklist_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quality_checklist_items" ON quality_checklist_items;
CREATE POLICY "anon_delete_quality_checklist_items" ON quality_checklist_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_quality_defects" ON quality_defects;
CREATE POLICY "anon_select_quality_defects" ON quality_defects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quality_defects" ON quality_defects;
CREATE POLICY "anon_insert_quality_defects" ON quality_defects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quality_defects" ON quality_defects;
CREATE POLICY "anon_update_quality_defects" ON quality_defects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quality_defects" ON quality_defects;
CREATE POLICY "anon_delete_quality_defects" ON quality_defects FOR DELETE TO anon, authenticated USING (true);
