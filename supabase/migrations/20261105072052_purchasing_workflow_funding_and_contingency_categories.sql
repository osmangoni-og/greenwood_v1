/*
# Purchasing workflow, supplier ledger, contingency categories

Plain-English summary
This migration changes how purchases flow into budget actuals and commitments,
so the same money is never counted twice. No existing table is replaced and no
existing record is modified.

1. Purchasing workflow
- Purchase order = commitment. An open (issued) order is committed cost, reduced
  by any delivery already linked to it, so it never double counts.
- Material delivery = actual cost. Deliveries are the only material actual cost.
- Supplier invoice = liability. Invoices create a payable balance, not cost.
- Supplier payment = cash outflow. Payments reduce the liability. They do not
  add cost again.

2. Changes to existing table
- material_deliveries: new nullable column purchase_order_id, linking a delivery
  to the order it fulfils. Existing deliveries are unchanged (null link).

3. New tables
- supplier_invoices: invoices from vendors, optionally linked to a purchase order.
- supplier_payments: append-only payments against an invoice. A trigger blocks
  payments above the unpaid balance.

4. Calculated views (security invoker)
- project_cost_actuals: now material deliveries, contractor payments and labor
  payments. Purchase orders are no longer counted as actual.
- project_cost_committed: open cost commitments plus issued purchase orders, with
  each order net of linked deliveries.
- supplier_invoice_balances: per-invoice amount, paid, and balance.

5. Contingency categories
- budget_contingencies: new column category (price_escalation, design_changes,
  scope_increase, emergency_costs, other). Existing rows default to other.
- Drawdowns are capped by the contingency line of the same category as well as
  the total contingency.

6. Security
- RLS is enabled on the new tables. Four policies each for supplier_invoices.
  supplier_payments is append-only (SELECT and INSERT only).
- Grants are issued in this migration. Trigger functions are not callable via the
  Data API.

7. Notes
- Budget freeze is enforced by the existing guards: approved versions cannot be
  edited or deleted, and only a new revision (a new draft that is approved) changes
  the budget.
- Earlier purchase orders marked received no longer add to actual cost. Their
  deliveries do.
*/

ALTER TABLE material_deliveries ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS material_deliveries_purchase_order_idx ON material_deliveries (purchase_order_id);

ALTER TABLE budget_contingencies ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other' CHECK (category IN ('price_escalation', 'design_changes', 'scope_increase', 'emergency_costs', 'other'));

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  notes text,
  UNIQUE (project_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS supplier_invoices_project_idx ON supplier_invoices (project_id);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_bdt numeric NOT NULL CHECK (amount_bdt > 0),
  method text,
  reference text,
  notes text
);

CREATE INDEX IF NOT EXISTS supplier_payments_invoice_idx ON supplier_payments (supplier_invoice_id);

CREATE OR REPLACE FUNCTION supplier_payment_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_paid numeric;
BEGIN
  SELECT amount_bdt INTO v_amount FROM supplier_invoices WHERE id = NEW.supplier_invoice_id;
  SELECT COALESCE(SUM(amount_bdt), 0) INTO v_paid FROM supplier_payments WHERE supplier_invoice_id = NEW.supplier_invoice_id;
  IF v_paid + NEW.amount_bdt > v_amount THEN
    RAISE EXCEPTION 'Payment exceeds the unpaid balance of this invoice';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION supplier_payment_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supplier_payment_guard_trg ON supplier_payments;
CREATE TRIGGER supplier_payment_guard_trg
BEFORE INSERT ON supplier_payments
FOR EACH ROW EXECUTE FUNCTION supplier_payment_guard();

CREATE OR REPLACE FUNCTION budget_contingency_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_active boolean;
  v_original numeric;
  v_used numeric;
  v_category_original numeric;
  v_category_used numeric;
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

  SELECT COALESCE(SUM(budget_amount_bdt), 0) INTO v_category_original
  FROM budget_version_lines
  WHERE budget_version_id = NEW.budget_version_id AND level = 'contingency' AND category = NEW.category;
  SELECT COALESCE(SUM(amount_bdt), 0) INTO v_category_used
  FROM budget_contingencies
  WHERE budget_version_id = NEW.budget_version_id AND category = NEW.category;
  IF v_category_used + NEW.amount_bdt > v_category_original THEN
    RAISE EXCEPTION 'Drawdown exceeds the remaining contingency for this category (Tk % remaining)', v_category_original - v_category_used;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW project_cost_actuals WITH (security_invoker = true) AS
SELECT project_id, 'material_delivery'::text AS source_type, 'Materials'::text AS category, COALESCE(NULL, 'unassigned')::text AS phase_key, total_amount_bdt AS amount_bdt, delivery_date AS entry_date
FROM material_deliveries
UNION ALL
SELECT project_id, 'contractor_payment', category, COALESCE(phase_key, 'unassigned'), amount_bdt, payment_date
FROM contractor_payments
UNION ALL
SELECT project_id, 'labor_payment', category, COALESCE(phase_key, 'unassigned'), amount_bdt, payment_date
FROM labor_payments;

CREATE OR REPLACE VIEW project_cost_committed WITH (security_invoker = true) AS
SELECT project_id, 'cost_commitment'::text AS source_type, category, COALESCE(phase_key, 'unassigned') AS phase_key, outstanding_amount_bdt AS amount_bdt
FROM cost_commitments
WHERE status = 'active'
UNION ALL
SELECT po.project_id, 'purchase_order'::text, po.category, COALESCE(po.phase_key, 'unassigned'),
  GREATEST(0, po.amount_bdt - COALESCE((SELECT SUM(md.total_amount_bdt) FROM material_deliveries md WHERE md.purchase_order_id = po.id), 0))
FROM purchase_orders po
WHERE po.status = 'issued';

CREATE OR REPLACE VIEW supplier_invoice_balances WITH (security_invoker = true) AS
SELECT i.id AS supplier_invoice_id, i.project_id, i.vendor_id, i.purchase_order_id, i.invoice_number, i.invoice_date, i.due_date,
  i.amount_bdt, COALESCE(p.paid_bdt, 0) AS paid_bdt, i.amount_bdt - COALESCE(p.paid_bdt, 0) AS balance_bdt
FROM supplier_invoices i
LEFT JOIN (SELECT supplier_invoice_id, SUM(amount_bdt) AS paid_bdt FROM supplier_payments GROUP BY supplier_invoice_id) p
  ON p.supplier_invoice_id = i.id;

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_invoices TO anon, authenticated;
GRANT SELECT, INSERT ON supplier_payments TO anon, authenticated;
GRANT SELECT ON supplier_invoice_balances TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_select_supplier_invoices" ON supplier_invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_insert_supplier_invoices" ON supplier_invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_update_supplier_invoices" ON supplier_invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_supplier_invoices" ON supplier_invoices;
CREATE POLICY "anon_delete_supplier_invoices" ON supplier_invoices FOR DELETE TO anon, authenticated
  USING (NOT EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.supplier_invoice_id = supplier_invoices.id));

DROP POLICY IF EXISTS "anon_select_supplier_payments" ON supplier_payments;
CREATE POLICY "anon_select_supplier_payments" ON supplier_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_supplier_payments" ON supplier_payments;
CREATE POLICY "anon_insert_supplier_payments" ON supplier_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
