/*
# Engineers, design packages, and budget lineage

Plain-English summary
- Adds an Engineer register so every design can be traced to the engineer who produced it.
- Adds Design Packages: a named version of an engineer's design (for example "Engineer A - Version 1").
- Links existing drawings and BOQ sheets to a design package. Nothing is deleted or recreated.
- Adds lineage columns to budget versions so each budget can show the engineer, design package, BOQ, contractor and primary vendor that generated it.
- Adds a trigger type to budget revisions so every budget change records its cause.

1. New Tables
- engineers: name, firm, license number, mobile, email, notes; belongs to a project.
- design_packages: belongs to a project and an engineer; name, revision label, status, notes.

2. Modified Tables (additive only, all new columns are nullable except trigger_type which has a default)
- drawings: design_package_id (optional link to a design package).
- boq_sheets: design_package_id (optional link to a design package).
- budget_versions: engineer_id, design_package_id, boq_sheet_id, contractor_id, primary_vendor_id (optional lineage links).
- budget_revisions: trigger_type (design_revision, engineer_revision, boq_revision, contractor_revision, vendor_revision, scope_revision, funding_revision, other). Existing rows default to 'other'.

3. Security
- RLS enabled on both new tables.
- Grants and policies follow the project's single-tenant pattern: anon and authenticated may read and write, as the app has no sign-in screen.

4. Important Notes
- No DROP, column type change, or rename is performed.
- Existing design tables (designs, comparisons, register tables, design_boq_items) and drawings are untouched.
- Foreign keys on link columns use ON DELETE SET NULL so deleting a package never deletes drawings, BOQ sheets or budgets.
*/

CREATE TABLE IF NOT EXISTS engineers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  firm text,
  license_number text,
  mobile text,
  email text,
  notes text
);

CREATE INDEX IF NOT EXISTS engineers_project_id_idx ON engineers (project_id);

CREATE TABLE IF NOT EXISTS design_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES engineers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  revision_label text NOT NULL DEFAULT 'Original',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'superseded')),
  notes text
);

CREATE INDEX IF NOT EXISTS design_packages_project_id_idx ON design_packages (project_id);
CREATE INDEX IF NOT EXISTS design_packages_engineer_id_idx ON design_packages (engineer_id);

ALTER TABLE drawings ADD COLUMN IF NOT EXISTS design_package_id uuid REFERENCES design_packages(id) ON DELETE SET NULL;
ALTER TABLE boq_sheets ADD COLUMN IF NOT EXISTS design_package_id uuid REFERENCES design_packages(id) ON DELETE SET NULL;

ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS engineer_id uuid REFERENCES engineers(id) ON DELETE SET NULL;
ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS design_package_id uuid REFERENCES design_packages(id) ON DELETE SET NULL;
ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS boq_sheet_id uuid REFERENCES boq_sheets(id) ON DELETE SET NULL;
ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL;
ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS primary_vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE budget_revisions ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'other';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_revisions_trigger_type_check') THEN
    ALTER TABLE budget_revisions ADD CONSTRAINT budget_revisions_trigger_type_check CHECK (trigger_type IN ('design_revision', 'engineer_revision', 'boq_revision', 'contractor_revision', 'vendor_revision', 'scope_revision', 'funding_revision', 'other'));
  END IF;
END $$;

ALTER TABLE engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_packages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON engineers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON design_packages TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_engineers" ON engineers;
CREATE POLICY "anon_select_engineers" ON engineers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_engineers" ON engineers;
CREATE POLICY "anon_insert_engineers" ON engineers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_engineers" ON engineers;
CREATE POLICY "anon_update_engineers" ON engineers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_engineers" ON engineers;
CREATE POLICY "anon_delete_engineers" ON engineers FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_design_packages" ON design_packages;
CREATE POLICY "anon_select_design_packages" ON design_packages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_design_packages" ON design_packages;
CREATE POLICY "anon_insert_design_packages" ON design_packages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_design_packages" ON design_packages;
CREATE POLICY "anon_update_design_packages" ON design_packages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_design_packages" ON design_packages;
CREATE POLICY "anon_delete_design_packages" ON design_packages FOR DELETE TO anon, authenticated USING (true);
