/*
# Budget Management module: versions, revisions, contingency, and cost automation

Plain-English summary
This migration adds a versioned budget system on top of the existing project,
construction budget lines, and construction phases. Existing tables are not
changed or replaced.

1. New tables
- budget_versions: Budget V1, V2, V3 ... per project. Only one version can be
  active per project (enforced by a partial unique index). Versions are draft
  until approved; approved versions are locked.
- budget_version_lines: the amounts inside a version, grouped by level
  (project, construction, material, phase, contingency) and category or phase.
  Lines can only change while their version is a draft.
- budget_revisions: append-only history. One row per approved version with
  revision number, revision date, reason, approver, previous and new totals,
  and a snapshot of the lines at approval time.
- budget_contingencies: append-only contingency drawdown ledger. Each drawdown
  records amount, date, phase, purpose, and approver. Drawdowns cannot exceed
  the contingency line of the active version.
- contractor_payments, labor_payments: actual cash paid out, per project and
  phase.
- purchase_orders: issued orders are committed cost; received orders are actual
  cost.
- cost_commitments: open contract balances still owed (unpaid balance of a
  contractor, vendor, or labor agreement).

2. Calculated views (security invoker, so they follow the underlying tables)
- project_cost_actuals: material deliveries (vendor ledger charges), contractor
  payments, labor payments, and received purchase orders.
- project_cost_committed: open cost commitments and issued purchase orders.

3. Functions
- budget_version_total: total of project, construction, and contingency lines.
- create_budget_draft: creates the next version (optionally copying lines from
  an existing version) in one step.
- approve_budget_version: approves a draft, records the revision, and makes it
  the single active version in one step. The previously active version becomes
  superseded.

4. Security
- Row level security is enabled on every new table.
- The app has no sign-in, so every policy targets anon and authenticated.
- Four separate policies per table. budget_revisions and budget_contingencies
  allow only SELECT and INSERT, so history cannot be edited or deleted.
- Triggers enforce: approved versions cannot be edited; superseded versions
  cannot be reactivated; lines cannot change outside draft versions; drawdowns
  must come from the active version and cannot exceed the remaining
  contingency.
- Trigger functions are not callable through the Data API.

5. Important notes
- Total budget = project + construction + contingency lines. Material and phase
  lines are allocations that break construction down; they are not added again.
- Forecast final cost = max(budget, actual + committed). This assumes any
  uncommitted budget is spent.
- No existing table is altered. No existing data is modified.
*/

CREATE TABLE IF NOT EXISTS budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  version_label text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'superseded')),
  is_active boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  notes text,
  UNIQUE (project_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_versions_one_active_per_project ON budget_versions (project_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS budget_versions_project_idx ON budget_versions (project_id);

CREATE TABLE IF NOT EXISTS budget_version_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('project', 'construction', 'material', 'phase', 'contingency')),
  category text NOT NULL,
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  budget_amount_bdt numeric NOT NULL DEFAULT 0 CHECK (budget_amount_bdt >= 0),
  notes text,
  CHECK (level <> 'phase' OR phase_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS budget_version_lines_version_idx ON budget_version_lines (budget_version_id);

CREATE TABLE IF NOT EXISTS budget_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id),
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  revision_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  approved_by text NOT NULL,
  previous_total_bdt numeric NOT NULL DEFAULT 0,
  new_total_bdt numeric NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (project_id, revision_number)
);

CREATE TABLE IF NOT EXISTS budget_contingencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget_version_id uuid NOT NULL REFERENCES budget_versions(id),
  drawdown_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  purpose text NOT NULL,
  approved_by text NOT NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS budget_contingencies_version_idx ON budget_contingencies (budget_version_id);

CREATE TABLE IF NOT EXISTS contractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  payee_name text NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'Construction',
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  reference text,
  notes text
);

CREATE INDEX IF NOT EXISTS contractor_payments_project_idx ON contractor_payments (project_id);

CREATE TABLE IF NOT EXISTS labor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  worker_group text NOT NULL,
  workers_count integer NOT NULL DEFAULT 0 CHECK (workers_count >= 0),
  category text NOT NULL DEFAULT 'Labor',
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  notes text
);

CREATE INDEX IF NOT EXISTS labor_payments_project_idx ON labor_payments (project_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  received_date date,
  category text NOT NULL DEFAULT 'Materials',
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  description text,
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'received', 'cancelled')),
  notes text,
  UNIQUE (project_id, po_number)
);

CREATE INDEX IF NOT EXISTS purchase_orders_project_idx ON purchase_orders (project_id);

CREATE TABLE IF NOT EXISTS cost_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  commitment_type text NOT NULL CHECK (commitment_type IN ('contractor_contract', 'vendor_contract', 'labor_agreement', 'other')),
  party_name text NOT NULL,
  reference text,
  category text NOT NULL DEFAULT 'Construction',
  phase_key text CHECK (phase_key IS NULL OR phase_key IN ('site_preparation', 'foundation', 'ground_floor_rcc', 'first_floor_rcc', 'roof', 'brick_work', 'electrical', 'plumbing', 'tiles', 'paint', 'finishing', 'handover')),
  contract_value_bdt numeric NOT NULL DEFAULT 0 CHECK (contract_value_bdt >= 0),
  outstanding_amount_bdt numeric NOT NULL DEFAULT 0 CHECK (outstanding_amount_bdt >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes text
);

CREATE INDEX IF NOT EXISTS cost_commitments_project_idx ON cost_commitments (project_id);

-- Guards: lines editable only in drafts; approved versions locked; history append-only.

CREATE OR REPLACE FUNCTION budget_version_lines_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM budget_versions WHERE id = COALESCE(NEW.budget_version_id, OLD.budget_version_id);
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Budget lines can only change while the budget version is a draft';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION budget_version_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF NEW.project_id <> OLD.project_id
     OR NEW.version_number <> OLD.version_number
     OR NEW.version_label <> OLD.version_label
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Approved budget versions cannot be edited';
  END IF;
  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'superseded') THEN
    RAISE EXCEPTION 'Approved budget versions cannot return to draft';
  END IF;
  IF OLD.status = 'superseded' AND (NEW.status <> 'superseded' OR NEW.is_active) THEN
    RAISE EXCEPTION 'Superseded budget versions cannot be reactivated';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION budget_contingency_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_active boolean;
  v_original numeric;
  v_used numeric;
BEGIN
  SELECT is_active INTO v_active FROM budget_versions WHERE id = NEW.budget_version_id;
  IF NOT COALESCE(v_active, false) THEN
    RAISE EXCEPTION 'Contingency can only be drawn from the active budget version';
  END IF;
  SELECT COALESCE(SUM(budget_amount_bdt), 0) INTO v_original
  FROM budget_version_lines
  WHERE budget_version_id = NEW.budget_version_id AND level = 'contingency';
  SELECT COALESCE(SUM(amount_bdt), 0) INTO v_used
  FROM budget_contingencies
  WHERE budget_version_id = NEW.budget_version_id;
  IF v_used + NEW.amount_bdt > v_original THEN
    RAISE EXCEPTION 'Drawdown exceeds the remaining contingency (Tk % remaining)', v_original - v_used;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budget_version_lines_guard_trg ON budget_version_lines;
CREATE TRIGGER budget_version_lines_guard_trg
BEFORE INSERT OR UPDATE OR DELETE ON budget_version_lines
FOR EACH ROW EXECUTE FUNCTION budget_version_lines_guard();

DROP TRIGGER IF EXISTS budget_version_guard_trg ON budget_versions;
CREATE TRIGGER budget_version_guard_trg
BEFORE UPDATE ON budget_versions
FOR EACH ROW EXECUTE FUNCTION budget_version_guard();

DROP TRIGGER IF EXISTS budget_contingency_guard_trg ON budget_contingencies;
CREATE TRIGGER budget_contingency_guard_trg
BEFORE INSERT ON budget_contingencies
FOR EACH ROW EXECUTE FUNCTION budget_contingency_guard();

REVOKE EXECUTE ON FUNCTION budget_version_lines_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION budget_version_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION budget_contingency_guard() FROM PUBLIC, anon, authenticated;

-- Calculations

CREATE OR REPLACE FUNCTION budget_version_total(p_version_id uuid) RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(budget_amount_bdt) FILTER (WHERE level IN ('project', 'construction', 'contingency')), 0)
  FROM budget_version_lines
  WHERE budget_version_id = p_version_id;
$$;

CREATE OR REPLACE VIEW project_cost_actuals WITH (security_invoker = true) AS
SELECT project_id, 'material_delivery'::text AS source_type, 'Materials'::text AS category, 'unassigned'::text AS phase_key, total_amount_bdt AS amount_bdt, delivery_date AS entry_date
FROM material_deliveries
UNION ALL
SELECT project_id, 'contractor_payment', category, COALESCE(phase_key, 'unassigned'), amount_bdt, payment_date
FROM contractor_payments
UNION ALL
SELECT project_id, 'labor_payment', category, COALESCE(phase_key, 'unassigned'), amount_bdt, payment_date
FROM labor_payments
UNION ALL
SELECT project_id, 'purchase_order', category, COALESCE(phase_key, 'unassigned'), amount_bdt, COALESCE(received_date, order_date)
FROM purchase_orders
WHERE status = 'received';

CREATE OR REPLACE VIEW project_cost_committed WITH (security_invoker = true) AS
SELECT project_id, 'cost_commitment'::text AS source_type, category, COALESCE(phase_key, 'unassigned') AS phase_key, outstanding_amount_bdt AS amount_bdt
FROM cost_commitments
WHERE status = 'active'
UNION ALL
SELECT project_id, 'purchase_order', category, COALESCE(phase_key, 'unassigned'), amount_bdt
FROM purchase_orders
WHERE status = 'issued';

-- Workflows

CREATE OR REPLACE FUNCTION create_budget_draft(p_project_id uuid, p_copy_from uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_next integer;
  v_id uuid;
BEGIN
  IF p_copy_from IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM budget_versions WHERE id = p_copy_from AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Source budget version does not belong to this project';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next FROM budget_versions WHERE project_id = p_project_id;

  INSERT INTO budget_versions (project_id, version_number, version_label, status, is_active)
  VALUES (p_project_id, v_next, 'Budget V' || v_next, 'draft', false)
  RETURNING id INTO v_id;

  IF p_copy_from IS NOT NULL THEN
    INSERT INTO budget_version_lines (budget_version_id, project_id, level, category, phase_key, budget_amount_bdt, notes)
    SELECT v_id, project_id, level, category, phase_key, budget_amount_bdt, notes
    FROM budget_version_lines
    WHERE budget_version_id = p_copy_from;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION approve_budget_version(p_version_id uuid, p_reason text, p_approved_by text) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v budget_versions%ROWTYPE;
  v_prev_total numeric;
  v_new_total numeric;
  v_revision_number integer;
  v_snapshot jsonb;
  v_revision_id uuid;
BEGIN
  SELECT * INTO v FROM budget_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget version not found';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft budget versions can be approved';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL OR NULLIF(TRIM(p_approved_by), '') IS NULL THEN
    RAISE EXCEPTION 'A reason and an approver name are required';
  END IF;

  v_new_total := budget_version_total(v.id);
  IF v_new_total <= 0 THEN
    RAISE EXCEPTION 'Budget version has no amounts to approve';
  END IF;

  SELECT budget_version_total(id) INTO v_prev_total FROM budget_versions WHERE project_id = v.project_id AND is_active;
  v_prev_total := COALESCE(v_prev_total, 0);

  UPDATE budget_versions SET is_active = false, status = 'superseded', updated_at = now()
  WHERE project_id = v.project_id AND is_active;

  UPDATE budget_versions
  SET status = 'approved', is_active = true, approved_by = TRIM(p_approved_by), approved_at = now(), updated_at = now()
  WHERE id = v.id;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_revision_number FROM budget_revisions WHERE project_id = v.project_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'level', level, 'category', category, 'phase_key', phase_key,
    'budget_amount_bdt', budget_amount_bdt, 'notes', notes
  ) ORDER BY level, category, phase_key), '[]'::jsonb)
  INTO v_snapshot
  FROM budget_version_lines
  WHERE budget_version_id = v.id;

  INSERT INTO budget_revisions (project_id, budget_version_id, revision_number, reason, approved_by, previous_total_bdt, new_total_bdt, snapshot)
  VALUES (v.project_id, v.id, v_revision_number, TRIM(p_reason), TRIM(p_approved_by), v_prev_total, v_new_total, v_snapshot)
  RETURNING id INTO v_revision_id;

  RETURN v_revision_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_budget_draft(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION approve_budget_version(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget_version_total(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_budget_draft(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_budget_version(uuid, text, text) TO anon, authenticated;

-- Row level security and grants (no sign-in: anon and authenticated, intentionally shared)

ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_version_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_contingencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_commitments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON budget_versions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON budget_version_lines TO anon, authenticated;
GRANT SELECT, INSERT ON budget_revisions TO anon, authenticated;
GRANT SELECT, INSERT ON budget_contingencies TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contractor_payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON labor_payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_commitments TO anon, authenticated;
GRANT SELECT ON project_cost_actuals TO anon, authenticated;
GRANT SELECT ON project_cost_committed TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_budget_versions" ON budget_versions;
CREATE POLICY "anon_select_budget_versions" ON budget_versions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_budget_versions" ON budget_versions;
CREATE POLICY "anon_insert_budget_versions" ON budget_versions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_budget_versions" ON budget_versions;
CREATE POLICY "anon_update_budget_versions" ON budget_versions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_budget_versions" ON budget_versions;
CREATE POLICY "anon_delete_budget_versions" ON budget_versions FOR DELETE TO anon, authenticated USING (status = 'draft' AND NOT is_active);

DROP POLICY IF EXISTS "anon_select_budget_version_lines" ON budget_version_lines;
CREATE POLICY "anon_select_budget_version_lines" ON budget_version_lines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_budget_version_lines" ON budget_version_lines;
CREATE POLICY "anon_insert_budget_version_lines" ON budget_version_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_budget_version_lines" ON budget_version_lines;
CREATE POLICY "anon_update_budget_version_lines" ON budget_version_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_budget_version_lines" ON budget_version_lines;
CREATE POLICY "anon_delete_budget_version_lines" ON budget_version_lines FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_budget_revisions" ON budget_revisions;
CREATE POLICY "anon_select_budget_revisions" ON budget_revisions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_budget_revisions" ON budget_revisions;
CREATE POLICY "anon_insert_budget_revisions" ON budget_revisions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_budget_contingencies" ON budget_contingencies;
CREATE POLICY "anon_select_budget_contingencies" ON budget_contingencies FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_budget_contingencies" ON budget_contingencies;
CREATE POLICY "anon_insert_budget_contingencies" ON budget_contingencies FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_contractor_payments" ON contractor_payments;
CREATE POLICY "anon_select_contractor_payments" ON contractor_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contractor_payments" ON contractor_payments;
CREATE POLICY "anon_insert_contractor_payments" ON contractor_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contractor_payments" ON contractor_payments;
CREATE POLICY "anon_update_contractor_payments" ON contractor_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contractor_payments" ON contractor_payments;
CREATE POLICY "anon_delete_contractor_payments" ON contractor_payments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_labor_payments" ON labor_payments;
CREATE POLICY "anon_select_labor_payments" ON labor_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_labor_payments" ON labor_payments;
CREATE POLICY "anon_insert_labor_payments" ON labor_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_labor_payments" ON labor_payments;
CREATE POLICY "anon_update_labor_payments" ON labor_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_labor_payments" ON labor_payments;
CREATE POLICY "anon_delete_labor_payments" ON labor_payments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_purchase_orders" ON purchase_orders;
CREATE POLICY "anon_select_purchase_orders" ON purchase_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_purchase_orders" ON purchase_orders;
CREATE POLICY "anon_insert_purchase_orders" ON purchase_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_purchase_orders" ON purchase_orders;
CREATE POLICY "anon_update_purchase_orders" ON purchase_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_purchase_orders" ON purchase_orders;
CREATE POLICY "anon_delete_purchase_orders" ON purchase_orders FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_cost_commitments" ON cost_commitments;
CREATE POLICY "anon_select_cost_commitments" ON cost_commitments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cost_commitments" ON cost_commitments;
CREATE POLICY "anon_insert_cost_commitments" ON cost_commitments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cost_commitments" ON cost_commitments;
CREATE POLICY "anon_update_cost_commitments" ON cost_commitments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cost_commitments" ON cost_commitments;
CREATE POLICY "anon_delete_cost_commitments" ON cost_commitments FOR DELETE TO anon, authenticated USING (true);
