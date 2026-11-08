/*
# Funding dependencies and risk-adjusted funding

Plain-English summary
Adds a probability to each existing funding source so expected funding can be
risk adjusted, and a new table that records which construction phase depends on
which funding source. No existing table is replaced, and no existing record is changed.

1. Changes to existing table
- construction_funding_sources: new column probability_pct (0 to 100, default 100).
  Existing funding sources default to 100 so their figures do not change.

2. New table
- funding_dependencies: links a construction phase to the funding source it relies on,
  with the amount required, status and risk level.

3. Security
- RLS is enabled. Four policies per table, granted in this migration, TO anon, authenticated
  (single-tenant app with no sign-in).

4. Notes
- Risk-adjusted funding = planned amount x probability / 100. Calculated in the app from
  these rows, not stored.
*/

ALTER TABLE construction_funding_sources ADD COLUMN IF NOT EXISTS probability_pct numeric NOT NULL DEFAULT 100 CHECK (probability_pct >= 0 AND probability_pct <= 100);

CREATE TABLE IF NOT EXISTS funding_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key text NOT NULL CHECK (phase_key IN ('site_preparation','foundation','ground_floor_rcc','first_floor_rcc','roof','brick_work','electrical','plumbing','tiles','paint','finishing','handover')),
  funding_source_id uuid NOT NULL REFERENCES construction_funding_sources(id) ON DELETE CASCADE,
  required_amount_bdt numeric NOT NULL CHECK (required_amount_bdt > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_funded','funded','cancelled')),
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high')),
  notes text
);

CREATE INDEX IF NOT EXISTS funding_dependencies_project_idx ON funding_dependencies (project_id);
CREATE INDEX IF NOT EXISTS funding_dependencies_source_idx ON funding_dependencies (funding_source_id);

ALTER TABLE funding_dependencies ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON funding_dependencies TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_funding_dependencies" ON funding_dependencies;
CREATE POLICY "anon_select_funding_dependencies" ON funding_dependencies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_funding_dependencies" ON funding_dependencies;
CREATE POLICY "anon_insert_funding_dependencies" ON funding_dependencies FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_funding_dependencies" ON funding_dependencies;
CREATE POLICY "anon_update_funding_dependencies" ON funding_dependencies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_funding_dependencies" ON funding_dependencies;
CREATE POLICY "anon_delete_funding_dependencies" ON funding_dependencies FOR DELETE TO anon, authenticated USING (true);
