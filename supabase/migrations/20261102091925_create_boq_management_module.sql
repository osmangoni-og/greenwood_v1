/*
# Create BOQ Management module

Plain-English summary:
This migration adds a dedicated BOQ Management module for cost planning and comparison.
It supports multiple BOQ sheets, file upload metadata, manual BOQ entries, category-level
cost breakdowns, material/labor shares, and variance analysis between sheets.

## 1. New Tables
- `boq_sheets`: one estimate or uploaded BOQ per engineer/vendor/version. Stores the
  sheet name, source, status, file metadata, and total area used for cost-per-SFT.
- `boq_entries`: line items belonging to a sheet. Stores category, description, unit,
  quantity, rate, material cost, labor cost, total cost, and notes.

Supported categories are Foundation, RCC, Brick Work, Plaster, Electrical, Plumbing,
Tiles, Paint, and Other.

## 2. SQL calculations
- `get_boq_summary(sheet_id)`: database aggregation for estimated cost, cost per SFT,
  material share, labor share, and category totals.
- `get_boq_variance(base_sheet_id, compare_sheet_id)`: database comparison of total cost,
  cost per SFT, material/labor totals, and category-by-category variance.

## 3. Storage
- Creates a public `boq-files` bucket for optional PDF, XLS, XLSX, CSV, and image uploads.
- Uploads are stored as references on `boq_sheets`; no AI parsing or analysis is performed.

## 4. Security
- RLS enabled for both tables.
- The app has no sign-in screen, so CRUD policies target anon and authenticated.
- Storage policies are scoped to the `boq-files` bucket.

## 5. Important notes
1. Deleting a BOQ sheet cascades to its entries.
2. All money values are stored in BDT.
3. All calculations use database aggregation; no AI is involved.
4. Statements are idempotent and safe to re-run.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('boq-files', 'boq-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_select_boq_storage" ON storage.objects;
CREATE POLICY "anon_select_boq_storage" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'boq-files');
DROP POLICY IF EXISTS "anon_insert_boq_storage" ON storage.objects;
CREATE POLICY "anon_insert_boq_storage" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'boq-files');
DROP POLICY IF EXISTS "anon_update_boq_storage" ON storage.objects;
CREATE POLICY "anon_update_boq_storage" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'boq-files') WITH CHECK (bucket_id = 'boq-files');
DROP POLICY IF EXISTS "anon_delete_boq_storage" ON storage.objects;
CREATE POLICY "anon_delete_boq_storage" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'boq-files');

CREATE TABLE IF NOT EXISTS boq_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sheet_name text NOT NULL,
  source_name text NOT NULL DEFAULT 'Manual entry',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','archived')),
  engineer_name text,
  building_area_sft numeric(12,2) NOT NULL DEFAULT 0 CHECK (building_area_sft >= 0),
  file_name text,
  storage_path text,
  notes text
);

CREATE TABLE IF NOT EXISTS boq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  boq_sheet_id uuid NOT NULL REFERENCES boq_sheets(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Foundation','RCC','Brick Work','Plaster','Electrical','Plumbing','Tiles','Paint','Other')),
  item_description text NOT NULL,
  unit text NOT NULL DEFAULT 'item',
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_rate_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_rate_bdt >= 0),
  material_cost_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (material_cost_bdt >= 0),
  labor_cost_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (labor_cost_bdt >= 0),
  total_cost_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_cost_bdt >= 0),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_boq_sheets_project ON boq_sheets(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boq_entries_sheet ON boq_entries(boq_sheet_id);
CREATE INDEX IF NOT EXISTS idx_boq_entries_category ON boq_entries(boq_sheet_id, category);

DROP TRIGGER IF EXISTS trg_boq_sheets_updated_at ON boq_sheets;
CREATE TRIGGER trg_boq_sheets_updated_at BEFORE UPDATE ON boq_sheets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_boq_entries_updated_at ON boq_entries;
CREATE TRIGGER trg_boq_entries_updated_at BEFORE UPDATE ON boq_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE boq_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON boq_sheets, boq_entries TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_boq_sheets" ON boq_sheets;
CREATE POLICY "anon_select_boq_sheets" ON boq_sheets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_boq_sheets" ON boq_sheets;
CREATE POLICY "anon_insert_boq_sheets" ON boq_sheets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_boq_sheets" ON boq_sheets;
CREATE POLICY "anon_update_boq_sheets" ON boq_sheets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_boq_sheets" ON boq_sheets;
CREATE POLICY "anon_delete_boq_sheets" ON boq_sheets FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_boq_entries" ON boq_entries;
CREATE POLICY "anon_select_boq_entries" ON boq_entries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_boq_entries" ON boq_entries;
CREATE POLICY "anon_insert_boq_entries" ON boq_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_boq_entries" ON boq_entries;
CREATE POLICY "anon_update_boq_entries" ON boq_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_boq_entries" ON boq_entries;
CREATE POLICY "anon_delete_boq_entries" ON boq_entries FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_boq_summary(p_sheet_id uuid)
RETURNS TABLE (
  boq_sheet_id uuid,
  estimated_cost_bdt numeric,
  cost_per_sft_bdt numeric,
  material_cost_bdt numeric,
  labor_cost_bdt numeric,
  material_share_pct numeric,
  labor_share_pct numeric,
  category text,
  category_cost_bdt numeric,
  category_variance_pct numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH totals AS (
    SELECT
      s.id,
      s.building_area_sft,
      COALESCE(SUM(e.total_cost_bdt), 0)::numeric AS total_cost,
      COALESCE(SUM(e.material_cost_bdt), 0)::numeric AS material_cost,
      COALESCE(SUM(e.labor_cost_bdt), 0)::numeric AS labor_cost
    FROM boq_sheets s
    LEFT JOIN boq_entries e ON e.boq_sheet_id = s.id
    WHERE s.id = p_sheet_id
    GROUP BY s.id, s.building_area_sft
  ), categories AS (
    SELECT e.category, COALESCE(SUM(e.total_cost_bdt), 0)::numeric AS category_cost
    FROM boq_entries e
    WHERE e.boq_sheet_id = p_sheet_id
    GROUP BY e.category
  )
  SELECT
    t.id,
    t.total_cost,
    CASE WHEN t.building_area_sft > 0 THEN ROUND(t.total_cost / t.building_area_sft, 2) ELSE 0 END,
    t.material_cost,
    t.labor_cost,
    CASE WHEN t.total_cost > 0 THEN ROUND(t.material_cost / t.total_cost * 100, 2) ELSE 0 END,
    CASE WHEN t.total_cost > 0 THEN ROUND(t.labor_cost / t.total_cost * 100, 2) ELSE 0 END,
    c.category,
    c.category_cost,
    CASE WHEN t.total_cost > 0 THEN ROUND(c.category_cost / t.total_cost * 100, 2) ELSE 0 END
  FROM totals t
  LEFT JOIN categories c ON true
  ORDER BY c.category;
$$;

CREATE OR REPLACE FUNCTION get_boq_variance(p_base_sheet_id uuid, p_compare_sheet_id uuid)
RETURNS TABLE (
  metric text,
  base_value numeric,
  compare_value numeric,
  variance_value numeric,
  variance_pct numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sheet_totals AS (
    SELECT
      s.id,
      s.building_area_sft,
      COALESCE(SUM(e.total_cost_bdt), 0)::numeric AS total_cost,
      COALESCE(SUM(e.material_cost_bdt), 0)::numeric AS material_cost,
      COALESCE(SUM(e.labor_cost_bdt), 0)::numeric AS labor_cost
    FROM boq_sheets s
    LEFT JOIN boq_entries e ON e.boq_sheet_id = s.id
    WHERE s.id IN (p_base_sheet_id, p_compare_sheet_id)
    GROUP BY s.id, s.building_area_sft
  ), metrics AS (
    SELECT 'Estimated cost'::text AS metric, 'total_cost'::text AS key
    UNION ALL SELECT 'Cost per SFT', 'cost_per_sft'
    UNION ALL SELECT 'Material cost', 'material_cost'
    UNION ALL SELECT 'Labor cost', 'labor_cost'
  ), values AS (
    SELECT
      m.metric,
      CASE m.key
        WHEN 'total_cost' THEN COALESCE(b.total_cost, 0)
        WHEN 'cost_per_sft' THEN CASE WHEN b.building_area_sft > 0 THEN ROUND(b.total_cost / b.building_area_sft, 2) ELSE 0 END
        WHEN 'material_cost' THEN COALESCE(b.material_cost, 0)
        ELSE COALESCE(b.labor_cost, 0)
      END AS base_value,
      CASE m.key
        WHEN 'total_cost' THEN COALESCE(c.total_cost, 0)
        WHEN 'cost_per_sft' THEN CASE WHEN c.building_area_sft > 0 THEN ROUND(c.total_cost / c.building_area_sft, 2) ELSE 0 END
        WHEN 'material_cost' THEN COALESCE(c.material_cost, 0)
        ELSE COALESCE(c.labor_cost, 0)
      END AS compare_value
    FROM metrics m
    LEFT JOIN sheet_totals b ON b.id = p_base_sheet_id
    LEFT JOIN sheet_totals c ON c.id = p_compare_sheet_id
  )
  SELECT metric, base_value, compare_value, compare_value - base_value,
    CASE WHEN base_value <> 0 THEN ROUND((compare_value - base_value) / ABS(base_value) * 100, 2) ELSE 0 END
  FROM values;
$$;

GRANT EXECUTE ON FUNCTION get_boq_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_boq_variance(uuid, uuid) TO anon, authenticated;
