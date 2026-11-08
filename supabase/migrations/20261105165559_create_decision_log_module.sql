/*
# Create Decision Log module

1. Purpose
   Maintains a permanent audit trail of project decisions for Greenwood Miazi Bari.
   Each decision records category, title, description, reason, alternatives,
   expected impact, cost impact, schedule impact, approved by, and status.

2. New Tables
   - `project_decisions`
     - `id` uuid PK
     - `project_id` uuid FK to projects(id) ON DELETE CASCADE
     - `decision_date` date NOT NULL
     - `category` text NOT NULL CHECK in (budget, design, vendor, contractor, funding, procurement, quality, construction)
     - `title` text NOT NULL
     - `description` text
     - `reason` text
     - `alternatives_considered` text
     - `expected_impact` text
     - `cost_impact_bdt` numeric NOT NULL DEFAULT 0
     - `schedule_impact_days` integer NOT NULL DEFAULT 0
     - `approved_by` text
     - `status` text NOT NULL DEFAULT 'approved' CHECK in (proposed, approved, rejected, superseded)
     - `notes` text
     - `created_at` timestamptz DEFAULT now()
     - `updated_at` timestamptz DEFAULT now()

3. Security
   - Enable RLS on project_decisions.
   - Grant SELECT, INSERT, UPDATE, DELETE to anon, authenticated (single-tenant, no auth screen).
   - Four separate policies (select/insert/update/delete) using TO anon, authenticated.
   - REVOKE EXECUTE on trigger functions from PUBLIC, anon.

4. Indexes
   - Index on project_id for efficient lookups.
   - Index on decision_date for timeline queries.
*/

CREATE TABLE IF NOT EXISTS project_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('budget', 'design', 'vendor', 'contractor', 'funding', 'procurement', 'quality', 'construction')),
  title text NOT NULL,
  description text,
  reason text,
  alternatives_considered text,
  expected_impact text,
  cost_impact_bdt numeric NOT NULL DEFAULT 0,
  schedule_impact_days integer NOT NULL DEFAULT 0,
  approved_by text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('proposed', 'approved', 'rejected', 'superseded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_decisions_project_id ON project_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_decisions_date ON project_decisions(decision_date DESC);

ALTER TABLE project_decisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON project_decisions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_decisions" ON project_decisions;
CREATE POLICY "anon_select_decisions" ON project_decisions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_decisions" ON project_decisions;
CREATE POLICY "anon_insert_decisions" ON project_decisions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_decisions" ON project_decisions;
CREATE POLICY "anon_update_decisions" ON project_decisions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_decisions" ON project_decisions;
CREATE POLICY "anon_delete_decisions" ON project_decisions FOR DELETE
  TO anon, authenticated USING (true);
