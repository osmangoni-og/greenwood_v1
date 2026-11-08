/*
# Create Vendor Management module

Plain-English summary:
This migration adds a vendor management module so the owner can maintain a register of
material suppliers by category (rod, cement, brick, sand, stone, electrical, plumbing,
tile, and general material), track contracts with each vendor, and record performance
reviews that roll up into a database-calculated vendor scorecard.

## 1. New Tables
- `vendors`: master record for a supplier. Stores category, contact information, trade
  license number, NID number, and bank details (account name, number, bank name, branch).
  Also stores an overall performance status derived from the latest scorecard.
- `vendor_contracts`: contracts awarded to a vendor. Stores scope, value in BDT, start
  and end dates, and status.
- `vendor_performance`: performance review entries for a vendor. Each entry scores
  four criteria (quality, delivery, pricing, responsiveness) from 1 to 10, plus a date
  and notes.

## 2. SQL Calculations
- `get_vendor_scorecard(p_vendor_id)`: aggregates all performance entries for a vendor,
  calculates the average score for each criterion and an overall weighted score on a
  0-10 scale, and returns a single-row scorecard. Weights: quality 30%, delivery 25%,
  pricing 25%, responsiveness 20%.

## 3. Security
- RLS enabled on all three tables.
- The app has no sign-in screen, so CRUD policies target anon and authenticated.
- All tables use shared/public USING(true) policies (single-tenant no-auth app).

## 4. Important notes
1. Deleting a vendor cascades to contracts and performance entries.
2. All money values are in BDT.
3. Scorecard is calculated by the database, not the frontend.
4. No AI is involved.
5. Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  vendor_category text NOT NULL CHECK (vendor_category IN (
    'material','rod','cement','brick','sand','stone','electrical','plumbing','tile'
  )),
  contact_person text,
  phone text,
  email text,
  address text,
  trade_license_number text,
  nid_number text,
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  bank_branch text,
  performance_status text NOT NULL DEFAULT 'unrated' CHECK (performance_status IN ('unrated','poor','average','good','excellent')),
  notes text
);

CREATE TABLE IF NOT EXISTS vendor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_title text NOT NULL,
  scope text,
  contract_value_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (contract_value_bdt >= 0),
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','terminated')),
  notes text
);

CREATE TABLE IF NOT EXISTS vendor_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  quality_score integer NOT NULL DEFAULT 5 CHECK (quality_score >= 1 AND quality_score <= 10),
  delivery_score integer NOT NULL DEFAULT 5 CHECK (delivery_score >= 1 AND delivery_score <= 10),
  pricing_score integer NOT NULL DEFAULT 5 CHECK (pricing_score >= 1 AND pricing_score <= 10),
  responsiveness_score integer NOT NULL DEFAULT 5 CHECK (responsiveness_score >= 1 AND responsiveness_score <= 10),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_vendors_project ON vendors(project_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(vendor_category);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor ON vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_project ON vendor_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_vendor_performance_vendor ON vendor_performance(vendor_id, review_date DESC);

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_vendor_contracts_updated_at ON vendor_contracts;
CREATE TRIGGER trg_vendor_contracts_updated_at BEFORE UPDATE ON vendor_contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_vendor_performance_updated_at ON vendor_performance;
CREATE TRIGGER trg_vendor_performance_updated_at BEFORE UPDATE ON vendor_performance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_performance ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON vendors, vendor_contracts, vendor_performance TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_vendors" ON vendors;
CREATE POLICY "anon_select_vendors" ON vendors FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vendors" ON vendors;
CREATE POLICY "anon_insert_vendors" ON vendors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vendors" ON vendors;
CREATE POLICY "anon_update_vendors" ON vendors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vendors" ON vendors;
CREATE POLICY "anon_delete_vendors" ON vendors FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_vendor_contracts" ON vendor_contracts;
CREATE POLICY "anon_select_vendor_contracts" ON vendor_contracts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vendor_contracts" ON vendor_contracts;
CREATE POLICY "anon_insert_vendor_contracts" ON vendor_contracts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vendor_contracts" ON vendor_contracts;
CREATE POLICY "anon_update_vendor_contracts" ON vendor_contracts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vendor_contracts" ON vendor_contracts;
CREATE POLICY "anon_delete_vendor_contracts" ON vendor_contracts FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_vendor_performance" ON vendor_performance;
CREATE POLICY "anon_select_vendor_performance" ON vendor_performance FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vendor_performance" ON vendor_performance;
CREATE POLICY "anon_insert_vendor_performance" ON vendor_performance FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vendor_performance" ON vendor_performance;
CREATE POLICY "anon_update_vendor_performance" ON vendor_performance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vendor_performance" ON vendor_performance;
CREATE POLICY "anon_delete_vendor_performance" ON vendor_performance FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_vendor_scorecard(p_vendor_id uuid)
RETURNS TABLE (
  vendor_id uuid,
  review_count bigint,
  avg_quality numeric,
  avg_delivery numeric,
  avg_pricing numeric,
  avg_responsiveness numeric,
  overall_score numeric,
  rating text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      v.id,
      COUNT(p.id) AS review_count,
      COALESCE(AVG(p.quality_score), 0)::numeric AS avg_quality,
      COALESCE(AVG(p.delivery_score), 0)::numeric AS avg_delivery,
      COALESCE(AVG(p.pricing_score), 0)::numeric AS avg_pricing,
      COALESCE(AVG(p.responsiveness_score), 0)::numeric AS avg_responsiveness
    FROM vendors v
    LEFT JOIN vendor_performance p ON p.vendor_id = v.id
    WHERE v.id = p_vendor_id
    GROUP BY v.id
  )
  SELECT
    s.id,
    s.review_count,
    ROUND(s.avg_quality, 2),
    ROUND(s.avg_delivery, 2),
    ROUND(s.avg_pricing, 2),
    ROUND(s.avg_responsiveness, 2),
    ROUND(
      s.avg_quality * 0.30 +
      s.avg_delivery * 0.25 +
      s.avg_pricing * 0.25 +
      s.avg_responsiveness * 0.20,
      2
    ),
    CASE
      WHEN s.review_count = 0 THEN 'unrated'
      WHEN s.avg_quality * 0.30 + s.avg_delivery * 0.25 + s.avg_pricing * 0.25 + s.avg_responsiveness * 0.20 >= 8 THEN 'excellent'
      WHEN s.avg_quality * 0.30 + s.avg_delivery * 0.25 + s.avg_pricing * 0.25 + s.avg_responsiveness * 0.20 >= 6.5 THEN 'good'
      WHEN s.avg_quality * 0.30 + s.avg_delivery * 0.25 + s.avg_pricing * 0.25 + s.avg_responsiveness * 0.20 >= 5 THEN 'average'
      ELSE 'poor'
    END
  FROM stats s;
$$;

GRANT EXECUTE ON FUNCTION get_vendor_scorecard(uuid) TO anon, authenticated;
