/*
# Create Contract Management System

1. New Tables
- `contracts`: the main contract record. Stores contract type (engineer, contractor,
  supplier, work_order, change_order, completion_certificate, warranty_certificate),
  the parties, scope, value, dates, status, language, and metadata.
- `contract_versions`: every saved version of a contract's body. The latest version
  (highest version_number) is the current draft. Storing all versions provides full
  version control and audit trail.

2. Security
- RLS is enabled on both tables.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through four separate policies per table.

3. Contract Types
1. Engineer Contracts
2. Contractor Contracts
3. Supplier Contracts
4. Work Orders
5. Change Orders
6. Completion Certificates
7. Warranty Certificates

4. Language Support
- English, Bangla, and Bilingual (English + Bangla side by side).

5. Version Control
- Every save creates a new version row with an incrementing version_number.
- The latest version is always the one with the highest version_number for a contract.
- Previous versions remain accessible for comparison and audit.

6. Important Notes
1. The contract body is stored as structured JSON so it can be rendered in the chosen
   language template.
2. Statuses track the contract lifecycle: draft, issued, signed, active, completed,
   terminated, expired.
3. Each contract version stores who created it and when, plus optional change notes.
*/

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_number text,
  contract_type text NOT NULL CHECK (contract_type IN ('engineer','contractor','supplier','work_order','change_order','completion_certificate','warranty_certificate')),
  title text NOT NULL,
  language text NOT NULL DEFAULT 'english' CHECK (language IN ('english','bangla','bilingual')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','signed','active','completed','terminated','expired')),
  party_a_name text NOT NULL,
  party_a_role text NOT NULL DEFAULT 'Owner',
  party_a_address text,
  party_a_phone text,
  party_a_email text,
  party_b_name text NOT NULL,
  party_b_role text NOT NULL DEFAULT 'Contractor',
  party_b_address text,
  party_b_phone text,
  party_b_email text,
  scope_of_work text,
  contract_value_bdt numeric(14,2) CHECK (contract_value_bdt IS NULL OR contract_value_bdt >= 0),
  start_date date,
  end_date date,
  signed_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  UNIQUE (contract_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_type ON contracts(project_id, contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id, version_number DESC);

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON contracts, contract_versions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_contracts" ON contracts;
CREATE POLICY "anon_select_contracts" ON contracts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contracts" ON contracts;
CREATE POLICY "anon_insert_contracts" ON contracts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contracts" ON contracts;
CREATE POLICY "anon_update_contracts" ON contracts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contracts" ON contracts;
CREATE POLICY "anon_delete_contracts" ON contracts FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_contract_versions" ON contract_versions;
CREATE POLICY "anon_select_contract_versions" ON contract_versions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_versions" ON contract_versions;
CREATE POLICY "anon_insert_contract_versions" ON contract_versions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contract_versions" ON contract_versions;
CREATE POLICY "anon_update_contract_versions" ON contract_versions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contract_versions" ON contract_versions;
CREATE POLICY "anon_delete_contract_versions" ON contract_versions FOR DELETE TO anon, authenticated USING (true);
