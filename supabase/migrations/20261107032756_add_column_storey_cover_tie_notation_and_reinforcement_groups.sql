/*
# Column register: storey range, clear cover, tie notation, reinforcement groups

1. Modified Tables
- `column_registers`
  - `storey_range` (text, nullable): where the column runs, e.g. "Ground Floor", "Ground to Roof", or a custom label.
  - `clear_cover_mm` (numeric, default 25): concrete cover used in the tie length calculation.
  - `tie_spacing_notation` (text, nullable): tie spacing exactly as written on the drawing, e.g. 4"/6"/4" or 100/150/100.
  No existing columns are altered or removed. Existing rows keep their values; new columns take their defaults.

2. New Tables
- `column_reinforcement_groups`: one row per bar group of a column's main reinforcement.
  - `column_register_id` (uuid, references column_registers, cascades on delete)
  - `bar_count` (integer, > 0)
  - `diameter_mm` (numeric, > 0)
  - `sort_order` (integer)

3. Security
- RLS enabled on the new table.
- Grants and policies match the existing column_registers table (single-tenant app, anon and authenticated).

4. Notes
- Existing rows keep their legacy main reinforcement text. They have no group rows until edited.
*/

ALTER TABLE column_registers ADD COLUMN IF NOT EXISTS storey_range text;
ALTER TABLE column_registers ADD COLUMN IF NOT EXISTS clear_cover_mm numeric NOT NULL DEFAULT 25;
ALTER TABLE column_registers ADD COLUMN IF NOT EXISTS tie_spacing_notation text;

CREATE TABLE IF NOT EXISTS column_reinforcement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_register_id uuid NOT NULL REFERENCES column_registers(id) ON DELETE CASCADE,
  bar_count integer NOT NULL CHECK (bar_count > 0),
  diameter_mm numeric NOT NULL CHECK (diameter_mm > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS column_reinforcement_groups_column_idx ON column_reinforcement_groups (column_register_id);

ALTER TABLE column_reinforcement_groups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON column_reinforcement_groups TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_column_reinforcement_groups" ON column_reinforcement_groups;
CREATE POLICY "anon_select_column_reinforcement_groups" ON column_reinforcement_groups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_column_reinforcement_groups" ON column_reinforcement_groups;
CREATE POLICY "anon_insert_column_reinforcement_groups" ON column_reinforcement_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_column_reinforcement_groups" ON column_reinforcement_groups;
CREATE POLICY "anon_update_column_reinforcement_groups" ON column_reinforcement_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_column_reinforcement_groups" ON column_reinforcement_groups;
CREATE POLICY "anon_delete_column_reinforcement_groups" ON column_reinforcement_groups FOR DELETE
  TO anon, authenticated USING (true);
