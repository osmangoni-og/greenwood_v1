/*
# Enhance Contracts with Signatories, Signatures, and Audit Trail

1. New Tables
- `contract_signatories`: one signing slot per contract role (Owner, Contractor,
  Engineer, Vendor, Witness 1, Witness 2). Captures full name, address, NID number,
  mobile number, signature method (none, electronic, or uploaded), the signature image,
  the signing time, and a fingerprint (SHA-256) of the signed details.
- `contract_audit_events`: a log of contract actions (signatory details saved, signature
  captured, signature uploaded, signature cleared, contract printed). Entries are
  append-only.

2. Security
- RLS is enabled on both tables.
- `contract_signatories` allows shared CRUD for anon and authenticated, matching the rest of
  this app (no sign-in screen).
- `contract_audit_events` allows only SELECT and INSERT. UPDATE and DELETE are not granted
  or permitted, so logged entries cannot be edited through the app.

3. Important Notes
1. Each contract can have at most one signatory record per role.
2. Uploaded or drawn signatures are stored as image data and limited to about 300 KB.
3. Deleting a contract removes its signatories and audit entries.
*/

CREATE TABLE IF NOT EXISTS contract_signatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  role_key text NOT NULL CHECK (role_key IN ('owner','contractor','engineer','vendor','witness_1','witness_2')),
  full_name text,
  address text,
  nid_number text,
  mobile_number text,
  signature_method text NOT NULL DEFAULT 'none' CHECK (signature_method IN ('none','electronic','uploaded')),
  signature_image text CHECK (signature_image IS NULL OR char_length(signature_image) <= 400000),
  signed_at timestamptz,
  signature_hash text,
  UNIQUE (contract_id, role_key)
);

CREATE TABLE IF NOT EXISTS contract_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  role_key text,
  action text NOT NULL CHECK (action IN ('signatory_updated','signature_captured','signature_uploaded','signature_cleared','contract_printed')),
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_contract_signatories_contract ON contract_signatories(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_events_contract ON contract_audit_events(contract_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_contract_signatories_updated_at ON contract_signatories;
CREATE TRIGGER trg_contract_signatories_updated_at BEFORE UPDATE ON contract_signatories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_audit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON contract_signatories TO anon, authenticated;
GRANT SELECT, INSERT ON contract_audit_events TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_contract_signatories" ON contract_signatories;
CREATE POLICY "anon_select_contract_signatories" ON contract_signatories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_signatories" ON contract_signatories;
CREATE POLICY "anon_insert_contract_signatories" ON contract_signatories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contract_signatories" ON contract_signatories;
CREATE POLICY "anon_update_contract_signatories" ON contract_signatories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contract_signatories" ON contract_signatories;
CREATE POLICY "anon_delete_contract_signatories" ON contract_signatories FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_contract_audit_events" ON contract_audit_events;
CREATE POLICY "anon_select_contract_audit_events" ON contract_audit_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_audit_events" ON contract_audit_events;
CREATE POLICY "anon_insert_contract_audit_events" ON contract_audit_events FOR INSERT TO anon, authenticated WITH CHECK (true);
