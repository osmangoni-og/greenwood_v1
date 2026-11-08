/*
# Create Rate History Database

1. New Tables
- `material_rate_history`: immutable purchase and market rate records for Rod, Cement,
  Brick, Sand, Stone Chips, Electrical Items, Plumbing Items, Tiles, and Paint.
  Each row stores material, rate, unit, effective date, vendor, source, and optional
  purchase/invoice reference. A record is never overwritten by the application; a new
  purchase creates a new row.
- `monthly_market_snapshots`: monthly market reference rates by material and unit,
  with optional notes and source. Each month/material combination is unique.

2. New Functions
- `get_rate_trend_summary(p_project_id)`: returns the latest and previous recorded
  rate for each material, plus percentage change, for the project.

3. Security
- RLS is enabled on both tables.
- This app has no sign-in screen, so anon and authenticated roles receive CRUD access
  through four separate shared-data policies per table.
- The trend function is invoker-secured and executable by anon and authenticated.

4. Important Notes
1. Historical purchase records are append-only by application behavior: the UI only
   offers creation and deletion, never editing of an existing rate record.
2. Every rate keeps its original vendor, date, unit, and source context.
3. Rates are stored in BDT and can use different units such as ton, bag, piece, meter,
   square foot, litre, or another project-specific unit.
4. Existing vendor records remain intact if a vendor is deleted; rate history keeps
   the historical row with a null vendor reference.
*/

CREATE TABLE IF NOT EXISTS material_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  material_type text NOT NULL CHECK (material_type IN ('rod','cement','brick','sand','stone_chips','electrical_items','plumbing_items','tiles','paint')),
  rate_date date NOT NULL DEFAULT CURRENT_DATE,
  rate_bdt numeric(14,2) NOT NULL CHECK (rate_bdt >= 0),
  unit text NOT NULL,
  source_type text NOT NULL DEFAULT 'purchase' CHECK (source_type IN ('purchase','market','quotation','manual')),
  purchase_reference text,
  notes text
);

CREATE TABLE IF NOT EXISTS monthly_market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_month date NOT NULL,
  material_type text NOT NULL CHECK (material_type IN ('rod','cement','brick','sand','stone_chips','electrical_items','plumbing_items','tiles','paint')),
  market_rate_bdt numeric(14,2) NOT NULL CHECK (market_rate_bdt >= 0),
  unit text NOT NULL,
  source text,
  notes text,
  UNIQUE (project_id, snapshot_month, material_type)
);

CREATE INDEX IF NOT EXISTS idx_material_rate_history_project_date ON material_rate_history(project_id, rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_rate_history_material_date ON material_rate_history(project_id, material_type, rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_rate_history_vendor ON material_rate_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_monthly_market_snapshots_project_month ON monthly_market_snapshots(project_id, snapshot_month DESC);

DROP TRIGGER IF EXISTS trg_monthly_market_snapshots_updated_at ON monthly_market_snapshots;
CREATE TRIGGER trg_monthly_market_snapshots_updated_at BEFORE UPDATE ON monthly_market_snapshots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE material_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_market_snapshots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON material_rate_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON monthly_market_snapshots TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_material_rate_history" ON material_rate_history;
CREATE POLICY "anon_select_material_rate_history" ON material_rate_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_material_rate_history" ON material_rate_history;
CREATE POLICY "anon_insert_material_rate_history" ON material_rate_history FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_material_rate_history" ON material_rate_history;
CREATE POLICY "anon_delete_material_rate_history" ON material_rate_history FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_monthly_market_snapshots" ON monthly_market_snapshots;
CREATE POLICY "anon_select_monthly_market_snapshots" ON monthly_market_snapshots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_monthly_market_snapshots" ON monthly_market_snapshots;
CREATE POLICY "anon_insert_monthly_market_snapshots" ON monthly_market_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_monthly_market_snapshots" ON monthly_market_snapshots;
CREATE POLICY "anon_update_monthly_market_snapshots" ON monthly_market_snapshots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_monthly_market_snapshots" ON monthly_market_snapshots;
CREATE POLICY "anon_delete_monthly_market_snapshots" ON monthly_market_snapshots FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_rate_trend_summary(p_project_id uuid)
RETURNS TABLE (
  material_type text,
  latest_rate numeric,
  latest_unit text,
  latest_date date,
  previous_rate numeric,
  previous_date date,
  change_percent numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT material_type, rate_bdt, unit, rate_date,
      ROW_NUMBER() OVER (PARTITION BY material_type ORDER BY rate_date DESC, created_at DESC) AS rn
    FROM material_rate_history
    WHERE project_id = p_project_id
  ), latest AS (
    SELECT * FROM ranked WHERE rn = 1
  ), previous AS (
    SELECT * FROM ranked WHERE rn = 2
  )
  SELECT l.material_type, l.rate_bdt, l.unit, l.rate_date,
    p.rate_bdt, p.rate_date,
    CASE WHEN p.rate_bdt IS NULL OR p.rate_bdt = 0 THEN NULL
      ELSE ROUND(((l.rate_bdt - p.rate_bdt) / p.rate_bdt) * 100, 2)
    END
  FROM latest l LEFT JOIN previous p ON p.material_type = l.material_type
  ORDER BY l.material_type;
$$;

GRANT EXECUTE ON FUNCTION get_rate_trend_summary(uuid) TO anon, authenticated;
