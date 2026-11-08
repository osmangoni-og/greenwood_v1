/*
# Create Material Financing module

Plain-English summary:
This migration adds a material financing module so the owner can track capital
injections (owner deposits), vendor account deposits, and material deliveries from
vendors. It maintains a real-time running balance and supports monthly statements.

## 1. New Tables
- `owner_deposits`: capital deposited by the owner. Records an initial deposit
  (e.g. 500,000 BDT) and recurring monthly deposits (e.g. 100,000 BDT), with a
  deposit type label (initial / monthly / top_up).
- `vendor_deposits`: payments deposited to a vendor's account. Links to a vendor and
  records the amount, date, and payment method.
- `material_deliveries`: deliveries of materials (rod, cement, brick, sand, stone chips)
  from a vendor. Stores the material type, quantity, unit rate, total amount
  (calculated), delivery date, and optional invoice reference. Delivery rates may vary
  per delivery.

## 2. SQL Calculations
- `get_financing_balance()`: returns a single-row summary of the real-time running
  balance — total owner deposits, total vendor deposits, total delivery costs, net
  vendor deposits (deposits minus deliveries), and the available project fund
  (owner deposits minus total delivery costs). No AI; pure SQL aggregation.

## 3. Security
- RLS enabled on all three tables.
- The app has no sign-in screen, so CRUD policies target anon and authenticated.
- All tables use shared/public USING(true) policies (single-tenant no-auth app).

## 4. Important notes
1. Deleting a vendor does NOT cascade here (vendors table is in the vendor module);
   these tables reference vendors(id) with ON DELETE SET NULL to preserve ledger history.
2. All money values are in BDT.
3. Running balance is calculated by the database in real time from all transactions.
4. No AI is involved.
5. Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS owner_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_bdt >= 0),
  deposit_type text NOT NULL DEFAULT 'monthly' CHECK (deposit_type IN ('initial','monthly','top_up')),
  payment_method text,
  reference_number text,
  notes text
);

CREATE TABLE IF NOT EXISTS vendor_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  deposit_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_bdt >= 0),
  payment_method text,
  reference_number text,
  notes text
);

CREATE TABLE IF NOT EXISTS material_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  material_type text NOT NULL CHECK (material_type IN ('rod','cement','brick','sand','stone_chips')),
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unit',
  unit_rate_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_rate_bdt >= 0),
  total_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount_bdt >= 0),
  invoice_reference text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_owner_deposits_project ON owner_deposits(project_id, deposit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_deposits_project ON vendor_deposits(project_id, deposit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_deposits_vendor ON vendor_deposits(vendor_id);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_project ON material_deliveries(project_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_vendor ON material_deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_type ON material_deliveries(material_type);

DROP TRIGGER IF EXISTS trg_owner_deposits_updated_at ON owner_deposits;
CREATE TRIGGER trg_owner_deposits_updated_at BEFORE UPDATE ON owner_deposits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_vendor_deposits_updated_at ON vendor_deposits;
CREATE TRIGGER trg_vendor_deposits_updated_at BEFORE UPDATE ON vendor_deposits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_material_deliveries_updated_at ON material_deliveries;
CREATE TRIGGER trg_material_deliveries_updated_at BEFORE UPDATE ON material_deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE owner_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON owner_deposits, vendor_deposits, material_deliveries TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_owner_deposits" ON owner_deposits;
CREATE POLICY "anon_select_owner_deposits" ON owner_deposits FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_owner_deposits" ON owner_deposits;
CREATE POLICY "anon_insert_owner_deposits" ON owner_deposits FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_owner_deposits" ON owner_deposits;
CREATE POLICY "anon_update_owner_deposits" ON owner_deposits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_owner_deposits" ON owner_deposits;
CREATE POLICY "anon_delete_owner_deposits" ON owner_deposits FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_vendor_deposits" ON vendor_deposits;
CREATE POLICY "anon_select_vendor_deposits" ON vendor_deposits FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vendor_deposits" ON vendor_deposits;
CREATE POLICY "anon_insert_vendor_deposits" ON vendor_deposits FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vendor_deposits" ON vendor_deposits;
CREATE POLICY "anon_update_vendor_deposits" ON vendor_deposits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vendor_deposits" ON vendor_deposits;
CREATE POLICY "anon_delete_vendor_deposits" ON vendor_deposits FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_material_deliveries" ON material_deliveries;
CREATE POLICY "anon_select_material_deliveries" ON material_deliveries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_material_deliveries" ON material_deliveries;
CREATE POLICY "anon_insert_material_deliveries" ON material_deliveries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_material_deliveries" ON material_deliveries;
CREATE POLICY "anon_update_material_deliveries" ON material_deliveries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_material_deliveries" ON material_deliveries;
CREATE POLICY "anon_delete_material_deliveries" ON material_deliveries FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_financing_balance(p_project_id uuid)
RETURNS TABLE (
  project_id uuid,
  total_owner_deposits numeric,
  total_vendor_deposits numeric,
  total_delivery_cost numeric,
  net_vendor_balance numeric,
  available_funds numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH owner_totals AS (
    SELECT COALESCE(SUM(amount_bdt), 0)::numeric AS total
    FROM owner_deposits WHERE project_id = p_project_id
  ), vendor_totals AS (
    SELECT COALESCE(SUM(amount_bdt), 0)::numeric AS total
    FROM vendor_deposits WHERE project_id = p_project_id
  ), delivery_totals AS (
    SELECT COALESCE(SUM(total_amount_bdt), 0)::numeric AS total
    FROM material_deliveries WHERE project_id = p_project_id
  )
  SELECT
    p_project_id,
    o.total,
    v.total,
    d.total,
    v.total - d.total,
    o.total - d.total
  FROM owner_totals o, vendor_totals v, delivery_totals d;
$$;

GRANT EXECUTE ON FUNCTION get_financing_balance(uuid) TO anon, authenticated;
