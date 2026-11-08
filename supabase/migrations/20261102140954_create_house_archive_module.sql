/*
# Create Greenwood Miazi Bari House Archive

1. New Tables
- `house_archive_items`: permanent digital archive entries linked to the project.
  Stores archive category, title, description, document date, reference number,
  file name, file URL, and additional metadata.

2. Supported Categories
- Final Drawings, Contracts, Invoices, BOQ, Material Records, Warranty Certificates,
  Electrical Layout, Plumbing Layout, Paint Information, Tile Information, and
  Equipment Manuals.

3. Security
- RLS is enabled on `house_archive_items`.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through four separate policies.

4. Important Notes
1. Each archive item is a durable reference record; the original file can be linked
   from its file URL.
2. Records are never removed automatically when another module changes.
3. Deleting the project cascades to its archive records.
*/

CREATE TABLE IF NOT EXISTS house_archive_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('final_drawings','contracts','invoices','boq','material_records','warranty_certificates','electrical_layout','plumbing_layout','paint_information','tile_information','equipment_manuals')),
  title text NOT NULL,
  description text,
  document_date date,
  reference_number text,
  file_name text,
  file_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_house_archive_project_category ON house_archive_items(project_id, category, title);

DROP TRIGGER IF EXISTS trg_house_archive_items_updated_at ON house_archive_items;
CREATE TRIGGER trg_house_archive_items_updated_at BEFORE UPDATE ON house_archive_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE house_archive_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON house_archive_items TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_house_archive_items" ON house_archive_items;
CREATE POLICY "anon_select_house_archive_items" ON house_archive_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_house_archive_items" ON house_archive_items;
CREATE POLICY "anon_insert_house_archive_items" ON house_archive_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_house_archive_items" ON house_archive_items;
CREATE POLICY "anon_update_house_archive_items" ON house_archive_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_house_archive_items" ON house_archive_items;
CREATE POLICY "anon_delete_house_archive_items" ON house_archive_items FOR DELETE TO anon, authenticated USING (true);
