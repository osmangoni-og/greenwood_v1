/*
# Fix ambiguous "design_id" in get_design_comparison RPC

## Problem
The function `get_design_comparison(uuid)` declares `RETURNS TABLE (design_id uuid, ...)`.
In PL/pgSQL, each output column of a RETURNS TABLE function becomes a variable in the
function body. The subqueries inside the function body referenced bare `design_id`
in their SELECT and GROUP BY clauses. PostgreSQL could not decide whether `design_id`
meant the PL/pgSQL variable or the table column, so it raised:

  ERROR: column reference "design_id" is ambiguous
  DETAIL: It could refer to either a PL/pgSQL variable or a table column.

This error surfaced whenever the RankingSummary component called the RPC, which
happens on the Design Comparison detail page for every register tab
(Columns / Beams / Footings / Slabs / Rebar / BOQ).

## Fix
Replace the function with an identical body where every `design_id` reference inside
the subqueries is fully qualified with its table name:
  column_registers.design_id
  beam_registers.design_id
  footing_registers.design_id
  slab_registers.design_id
  rebar_registers.design_id
  design_boq_items.design_id

No schema, table, column, policy, or grant changes. The function signature, return
columns, grants, and logic are unchanged — only the ambiguous references are qualified.

## Security
- No new tables or columns.
- EXECUTE grant on the function is preserved (re-applied to anon, authenticated).
*/

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
    SELECT column_registers.design_id, COUNT(*) AS col_count,
      COUNT(DISTINCT column_registers.column_type) AS col_type_count,
      COALESCE(SUM(column_registers.concrete_volume_cum), 0) AS col_concrete,
      COALESCE(SUM(column_registers.steel_weight_kg), 0) AS col_steel
    FROM column_registers GROUP BY column_registers.design_id
  ) cr ON cr.design_id = d.id
  LEFT JOIN (
    SELECT beam_registers.design_id, COUNT(*) AS beam_count,
      COUNT(DISTINCT beam_registers.beam_type) AS beam_type_count,
      COALESCE(SUM(beam_registers.concrete_volume_cum), 0) AS beam_concrete,
      COALESCE(SUM(beam_registers.steel_weight_kg), 0) AS beam_steel
    FROM beam_registers GROUP BY beam_registers.design_id
  ) br ON br.design_id = d.id
  LEFT JOIN (
    SELECT footing_registers.design_id, COUNT(*) AS footing_count,
      COALESCE(SUM(footing_registers.concrete_volume_cum), 0) AS footing_concrete,
      COALESCE(SUM(footing_registers.steel_weight_kg), 0) AS footing_steel
    FROM footing_registers GROUP BY footing_registers.design_id
  ) fr ON fr.design_id = d.id
  LEFT JOIN (
    SELECT slab_registers.design_id, COUNT(*) AS slab_count,
      COALESCE(SUM(slab_registers.concrete_volume_cum), 0) AS slab_concrete,
      COALESCE(SUM(slab_registers.steel_weight_kg), 0) AS slab_steel
    FROM slab_registers GROUP BY slab_registers.design_id
  ) sr ON sr.design_id = d.id
  LEFT JOIN (
    SELECT rebar_registers.design_id, COUNT(*) AS rebar_count
    FROM rebar_registers GROUP BY rebar_registers.design_id
  ) rr ON rr.design_id = d.id
  LEFT JOIN (
    SELECT design_boq_items.design_id, COALESCE(SUM(design_boq_items.total_bdt), 0) AS boq_total
    FROM design_boq_items GROUP BY design_boq_items.design_id
  ) bq ON bq.design_id = d.id
  WHERE d.comparison_id = p_comparison_id
  ORDER BY d.slot;
END;
$$;

GRANT EXECUTE ON FUNCTION get_design_comparison(uuid) TO anon, authenticated;
