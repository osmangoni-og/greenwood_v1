/*
# Enhance Column Register with detailed structural fields

## Purpose
Support detailed structural analysis and automatic quantity calculations for
design comparison, BOQ verification, and budget estimation.

## New Columns on `column_registers`
- `quantity` (integer, default 1) — number of columns of this mark/type
- `width_mm` (numeric, default 300) — cross-section width in mm
- `depth_mm` (numeric, default 450) — cross-section depth in mm
- `main_reinforcement` (text, nullable) — main bar specification (e.g. "4T16")
- `tie_reinforcement` (text, nullable) — tie bar specification (e.g. "T10")
- `tie_spacing_mm` (numeric, default 150) — tie spacing in mm

## Existing Columns (unchanged, kept for compatibility)
- `dimensions_mm` — retained as text for display/legacy; the form now also
  uses width_mm and depth_mm for precise volume calculation
- `concrete_volume_cum` — now auto-calculated by the frontend from
  (width_mm/1000) x (depth_mm/1000) x height_m x quantity
- `steel_weight_kg` — now auto-calculated by the frontend from main/tie
  reinforcement, tie spacing, height, and quantity

## Security
No RLS or grant changes — `column_registers` already has full CRUD granted to
anon and authenticated. No new tables or policies.

## Notes
1. All new columns have safe defaults so existing rows remain valid.
2. No existing columns are dropped or type-changed.
3. The migration is idempotent — re-running is safe.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'quantity') THEN
    ALTER TABLE column_registers ADD COLUMN quantity integer NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'width_mm') THEN
    ALTER TABLE column_registers ADD COLUMN width_mm numeric NOT NULL DEFAULT 300;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'depth_mm') THEN
    ALTER TABLE column_registers ADD COLUMN depth_mm numeric NOT NULL DEFAULT 450;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'main_reinforcement') THEN
    ALTER TABLE column_registers ADD COLUMN main_reinforcement text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'tie_reinforcement') THEN
    ALTER TABLE column_registers ADD COLUMN tie_reinforcement text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'column_registers' AND column_name = 'tie_spacing_mm') THEN
    ALTER TABLE column_registers ADD COLUMN tie_spacing_mm numeric NOT NULL DEFAULT 150;
  END IF;
END $$;
