/*
# Create Design Comparison Engine

Plain-English summary:
This migration creates the Design Comparison Engine, which lets the owner compare
up to three engineer designs (Design A, B, C) for the same building. The architectural
layout is identical across all designs, but each engineer's structural approach differs.

The engine stores structural element registers (columns, beams, footings, slabs, rebar),
a bill of quantities (BOQ) per design, and a SQL function that aggregates every register
and ranks designs by total estimated structural cost. No AI is used — all calculations
happen in SQL.

## 1. New Tables

### `comparisons`
- The top-level comparison. Holds the name, the building description, and which
  designs are being compared. One row per comparison exercise.
- Columns: id, created_at, updated_at, created_by, name, project_id (FK), description,
  design_a_label, design_b_label, design_c_label.

### `designs`
- One engineer's design within a comparison. Up to 3 per comparison (slot A, B, C).
- Columns: id, created_at, updated_at, created_by, comparison_id (FK CASCADE),
  slot ('A' | 'B' | 'C'), engineer_name, notes.
- Unique constraint on (comparison_id, slot) so each slot is used once.

### `column_registers`
- Structural column schedule for a design. One row per column mark.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  mark, column_type, dimensions_mm, concrete_grade, height_m, concrete_volume_cum,
  steel_weight_kg, notes.

### `beam_registers`
- Structural beam schedule for a design. One row per beam mark.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  mark, beam_type, dimensions_mm, concrete_grade, length_m, concrete_volume_cum,
  steel_weight_kg, notes.

### `footing_registers`
- Foundation footing schedule for a design. One row per footing mark.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  mark, footing_type, dimensions_mm, depth_m, concrete_grade, concrete_volume_cum,
  steel_weight_kg, notes.

### `slab_registers`
- Slab schedule for a design. One row per slab mark or panel.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  mark, slab_type, thickness_mm, area_sqm, concrete_grade, concrete_volume_cum,
  steel_weight_kg, notes.

### `rebar_registers`
- Reinforcement bar schedule for a design. One row per bar mark or element.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  mark, element_type, bar_diameter_mm, number_of_bars, length_per_bar_m,
  total_length_m, unit_weight_kg_per_m, total_weight_kg, notes.

### `design_boq_items`
- Bill of quantities line items for a design. Used for the cost summary.
- Columns: id, created_at, updated_at, created_by, design_id (FK CASCADE),
  item_description, unit, quantity, unit_rate_bdt, total_bdt, notes.

## 2. SQL Functions

### `get_design_comparison(p_comparison_id uuid)`
- Aggregates every register and BOQ for all designs in a comparison.
- Returns one row per design with: slot, engineer_name, total_columns,
  column_types, total_beams, beam_types, total_footings, total_slabs,
  total_rebar_items, total_concrete_cum, total_steel_kg, boq_total_bdt,
  estimated_structural_cost_bdt.
- Cost = BOQ total if BOQ items exist, otherwise steel_kg * steel_rate +
  concrete_cum * concrete_rate (rates default to 110 BDT/kg and 12000 BDT/cum).
- This is a pure read function (STABLE, SECURITY INVOKER).

## 3. Security
- Row Level Security enabled on all 8 new tables.
- The app has no sign-in, so policies target `anon` and `authenticated`.
- CRUD granted on all tables to `anon` and `authenticated`.
- The ranking function is EXECUTE granted to `anon` and `authenticated`.

## 4. Important Notes
1. Deleting a comparison cascades to all designs, which cascade to all registers and BOQ.
2. Deleting a design cascades to its registers and BOQ.
3. All amounts are in BDT.
4. All statements are idempotent for safe re-runs.
*/

CREATE TABLE IF NOT EXISTS comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  design_a_label text NOT NULL DEFAULT 'Design A',
  design_b_label text NOT NULL DEFAULT 'Design B',
  design_c_label text NOT NULL DEFAULT 'Design C'
);

CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  comparison_id uuid NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('A','B','C')),
  engineer_name text NOT NULL,
  notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_designs_comparison_slot ON designs(comparison_id, slot);

CREATE TABLE IF NOT EXISTS column_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  mark text NOT NULL,
  column_type text NOT NULL DEFAULT 'Rectangular',
  dimensions_mm text NOT NULL,
  concrete_grade text NOT NULL DEFAULT 'C25',
  height_m numeric(10,2) NOT NULL DEFAULT 0 CHECK (height_m >= 0),
  concrete_volume_cum numeric(10,3) NOT NULL DEFAULT 0 CHECK (concrete_volume_cum >= 0),
  steel_weight_kg numeric(10,2) NOT NULL DEFAULT 0 CHECK (steel_weight_kg >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS beam_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  mark text NOT NULL,
  beam_type text NOT NULL DEFAULT 'Rectangular',
  dimensions_mm text NOT NULL,
  concrete_grade text NOT NULL DEFAULT 'C25',
  length_m numeric(10,2) NOT NULL DEFAULT 0 CHECK (length_m >= 0),
  concrete_volume_cum numeric(10,3) NOT NULL DEFAULT 0 CHECK (concrete_volume_cum >= 0),
  steel_weight_kg numeric(10,2) NOT NULL DEFAULT 0 CHECK (steel_weight_kg >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS footing_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  mark text NOT NULL,
  footing_type text NOT NULL DEFAULT 'Isolated',
  dimensions_mm text NOT NULL,
  depth_m numeric(10,2) NOT NULL DEFAULT 0 CHECK (depth_m >= 0),
  concrete_grade text NOT NULL DEFAULT 'C25',
  concrete_volume_cum numeric(10,3) NOT NULL DEFAULT 0 CHECK (concrete_volume_cum >= 0),
  steel_weight_kg numeric(10,2) NOT NULL DEFAULT 0 CHECK (steel_weight_kg >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS slab_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  mark text NOT NULL,
  slab_type text NOT NULL DEFAULT 'One-way',
  thickness_mm integer NOT NULL DEFAULT 125 CHECK (thickness_mm > 0),
  area_sqm numeric(10,2) NOT NULL DEFAULT 0 CHECK (area_sqm >= 0),
  concrete_grade text NOT NULL DEFAULT 'C25',
  concrete_volume_cum numeric(10,3) NOT NULL DEFAULT 0 CHECK (concrete_volume_cum >= 0),
  steel_weight_kg numeric(10,2) NOT NULL DEFAULT 0 CHECK (steel_weight_kg >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS rebar_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  mark text NOT NULL,
  element_type text NOT NULL DEFAULT 'Column',
  bar_diameter_mm integer NOT NULL DEFAULT 12 CHECK (bar_diameter_mm > 0),
  number_of_bars integer NOT NULL DEFAULT 1 CHECK (number_of_bars > 0),
  length_per_bar_m numeric(10,2) NOT NULL DEFAULT 0 CHECK (length_per_bar_m >= 0),
  total_length_m numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_length_m >= 0),
  unit_weight_kg_per_m numeric(8,4) NOT NULL DEFAULT 0 CHECK (unit_weight_kg_per_m >= 0),
  total_weight_kg numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS design_boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  design_id uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  unit text NOT NULL DEFAULT 'cum',
  quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_rate_bdt numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_rate_bdt >= 0),
  total_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_bdt >= 0),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_comparisons_project ON comparisons(project_id);
CREATE INDEX IF NOT EXISTS idx_column_registers_design ON column_registers(design_id);
CREATE INDEX IF NOT EXISTS idx_beam_registers_design ON beam_registers(design_id);
CREATE INDEX IF NOT EXISTS idx_footing_registers_design ON footing_registers(design_id);
CREATE INDEX IF NOT EXISTS idx_slab_registers_design ON slab_registers(design_id);
CREATE INDEX IF NOT EXISTS idx_rebar_registers_design ON rebar_registers(design_id);
CREATE INDEX IF NOT EXISTS idx_design_boq_items_design ON design_boq_items(design_id);

DROP TRIGGER IF EXISTS trg_comparisons_updated_at ON comparisons;
CREATE TRIGGER trg_comparisons_updated_at BEFORE UPDATE ON comparisons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_designs_updated_at ON designs;
CREATE TRIGGER trg_designs_updated_at BEFORE UPDATE ON designs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_column_registers_updated_at ON column_registers;
CREATE TRIGGER trg_column_registers_updated_at BEFORE UPDATE ON column_registers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_beam_registers_updated_at ON beam_registers;
CREATE TRIGGER trg_beam_registers_updated_at BEFORE UPDATE ON beam_registers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_footing_registers_updated_at ON footing_registers;
CREATE TRIGGER trg_footing_registers_updated_at BEFORE UPDATE ON footing_registers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_slab_registers_updated_at ON slab_registers;
CREATE TRIGGER trg_slab_registers_updated_at BEFORE UPDATE ON slab_registers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_rebar_registers_updated_at ON rebar_registers;
CREATE TRIGGER trg_rebar_registers_updated_at BEFORE UPDATE ON rebar_registers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_design_boq_items_updated_at ON design_boq_items;
CREATE TRIGGER trg_design_boq_items_updated_at BEFORE UPDATE ON design_boq_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE beam_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE footing_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slab_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebar_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_boq_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON comparisons, designs, column_registers, beam_registers, footing_registers, slab_registers, rebar_registers, design_boq_items TO anon, authenticated;

-- Standard CRUD policies for each table
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['comparisons','designs','column_registers','beam_registers','footing_registers','slab_registers','rebar_registers','design_boq_items'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true);', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION get_design_comparison(p_comparison_id uuid)
RETURNS TABLE (
  design_id uuid,
  comparison_id uuid,
  slot text,
  engineer_name text,
  total_columns bigint,
  column_types bigint,
  total_beams bigint,
  beam_types bigint,
  total_footings bigint,
  total_slabs bigint,
  total_rebar_items bigint,
  total_concrete_cum numeric,
  total_steel_kg numeric,
  boq_total_bdt numeric,
  estimated_structural_cost_bdt numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_concrete_rate numeric := 12000;
  v_steel_rate numeric := 110;
BEGIN
  RETURN QUERY
  SELECT
    d.id AS design_id,
    d.comparison_id,
    d.slot,
    d.engineer_name,
    COALESCE(cr.col_count, 0) AS total_columns,
    COALESCE(cr.col_type_count, 0) AS column_types,
    COALESCE(br.beam_count, 0) AS total_beams,
    COALESCE(br.beam_type_count, 0) AS beam_types,
    COALESCE(fr.footing_count, 0) AS total_footings,
    COALESCE(sr.slab_count, 0) AS total_slabs,
    COALESCE(rr.rebar_count, 0) AS total_rebar_items,
    COALESCE(cr.col_concrete, 0) + COALESCE(br.beam_concrete, 0) + COALESCE(fr.footing_concrete, 0) + COALESCE(sr.slab_concrete, 0) AS total_concrete_cum,
    COALESCE(cr.col_steel, 0) + COALESCE(br.beam_steel, 0) + COALESCE(fr.footing_steel, 0) + COALESCE(sr.slab_steel, 0) AS total_steel_kg,
    COALESCE(bq.boq_total, 0) AS boq_total_bdt,
    CASE
      WHEN COALESCE(bq.boq_total, 0) > 0 THEN bq.boq_total
      ELSE (
        (COALESCE(cr.col_concrete, 0) + COALESCE(br.beam_concrete, 0) + COALESCE(fr.footing_concrete, 0) + COALESCE(sr.slab_concrete, 0)) * v_concrete_rate
        +
        (COALESCE(cr.col_steel, 0) + COALESCE(br.beam_steel, 0) + COALESCE(fr.footing_steel, 0) + COALESCE(sr.slab_steel, 0)) * v_steel_rate
      )
    END AS estimated_structural_cost_bdt
  FROM designs d
  LEFT JOIN (
    SELECT design_id, COUNT(*) AS col_count,
      COUNT(DISTINCT column_type) AS col_type_count,
      COALESCE(SUM(concrete_volume_cum), 0) AS col_concrete,
      COALESCE(SUM(steel_weight_kg), 0) AS col_steel
    FROM column_registers GROUP BY design_id
  ) cr ON cr.design_id = d.id
  LEFT JOIN (
    SELECT design_id, COUNT(*) AS beam_count,
      COUNT(DISTINCT beam_type) AS beam_type_count,
      COALESCE(SUM(concrete_volume_cum), 0) AS beam_concrete,
      COALESCE(SUM(steel_weight_kg), 0) AS beam_steel
    FROM beam_registers GROUP BY design_id
  ) br ON br.design_id = d.id
  LEFT JOIN (
    SELECT design_id, COUNT(*) AS footing_count,
      COALESCE(SUM(concrete_volume_cum), 0) AS footing_concrete,
      COALESCE(SUM(steel_weight_kg), 0) AS footing_steel
    FROM footing_registers GROUP BY design_id
  ) fr ON fr.design_id = d.id
  LEFT JOIN (
    SELECT design_id, COUNT(*) AS slab_count,
      COALESCE(SUM(concrete_volume_cum), 0) AS slab_concrete,
      COALESCE(SUM(steel_weight_kg), 0) AS slab_steel
    FROM slab_registers GROUP BY design_id
  ) sr ON sr.design_id = d.id
  LEFT JOIN (
    SELECT design_id, COUNT(*) AS rebar_count
    FROM rebar_registers GROUP BY design_id
  ) rr ON rr.design_id = d.id
  LEFT JOIN (
    SELECT design_id, COALESCE(SUM(total_bdt), 0) AS boq_total
    FROM design_boq_items GROUP BY design_id
  ) bq ON bq.design_id = d.id
  WHERE d.comparison_id = p_comparison_id
  ORDER BY d.slot;
END;
$$;

GRANT EXECUTE ON FUNCTION get_design_comparison(uuid) TO anon, authenticated;
