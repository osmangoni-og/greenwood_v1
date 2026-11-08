/*
# Extend Beam, Footing, Slab and Rebar Registers with Structural Detail

## Purpose
Bring the beam, footing, slab and rebar registers up to the same engineering
model as the column register: storey range, clear cover, quantity, stirrup/
tie spacing notation, and structured reinforcement groups stored as child rows.

## 1. Columns Added to Existing Tables (all idempotent)

### beam_registers
- quantity integer NOT NULL DEFAULT 1
- storey_range text
- clear_cover_mm numeric NOT NULL DEFAULT 25
- tie_spacing_notation text
- tie_spacing_mm numeric NOT NULL DEFAULT 0
- excavation_volume_cum numeric NOT NULL DEFAULT 0

### footing_registers
- quantity integer NOT NULL DEFAULT 1
- storey_range text
- clear_cover_mm numeric NOT NULL DEFAULT 50
- tie_spacing_notation text
- tie_spacing_mm numeric NOT NULL DEFAULT 0
- excavation_volume_cum numeric NOT NULL DEFAULT 0
- pedestal_length_mm integer NOT NULL DEFAULT 0
- pedestal_width_mm integer NOT NULL DEFAULT 0
- foundation_depth_m numeric NOT NULL DEFAULT 0
- footing_length_mm integer NOT NULL DEFAULT 0
- footing_width_mm integer NOT NULL DEFAULT 0
- thickness_mm integer NOT NULL DEFAULT 0

### slab_registers
- quantity integer NOT NULL DEFAULT 1
- storey_range text
- clear_cover_mm numeric NOT NULL DEFAULT 20
- tie_spacing_notation text
- tie_spacing_mm numeric NOT NULL DEFAULT 0

### rebar_registers
- element_mark text
- bar_mark text
- shape_code text
- remarks text
- weight_kg numeric NOT NULL DEFAULT 0

## 2. New Tables

### beam_reinforcement_groups
Child of beam_registers. Stores top, bottom and extra (left/mid/right)
reinforcement groups as structured bar-count/diameter rows.
- id uuid PK
- beam_register_id uuid FK -> beam_registers(id) ON DELETE CASCADE
- layer text NOT NULL  ('top' | 'bottom' | 'extra_left' | 'extra_mid' | 'extra_right')
- bar_count integer > 0
- diameter_mm integer > 0
- sort_order integer NOT NULL DEFAULT 0
- created_at timestamptz

### footing_reinforcement_groups
Child of footing_registers. Stores bottom X, bottom Y and top reinforcement
groups as structured bar-count/diameter rows.
- id uuid PK
- footing_register_id uuid FK -> footing_registers(id) ON DELETE CASCADE
- layer text NOT NULL ('bottom_x' | 'bottom_y' | 'top')
- bar_count integer > 0
- diameter_mm integer > 0
- sort_order integer NOT NULL DEFAULT 0
- created_at timestamptz

### slab_reinforcement_groups
Child of slab_registers. Stores main and distribution reinforcement groups
with an optional direction label.
- id uuid PK
- slab_register_id uuid FK -> slab_registers(id) ON DELETE CASCADE
- layer text NOT NULL ('main' | 'distribution')
- direction text
- bar_count integer > 0
- diameter_mm integer > 0
- length_m numeric NOT NULL DEFAULT 0
- sort_order integer NOT NULL DEFAULT 0
- created_at timestamptz

## 3. Indexes
- beam_reinforcement_groups(beam_register_id)
- footing_reinforcement_groups(footing_register_id)
- slab_reinforcement_groups(slab_register_id)

## 4. Security (RLS + Grants)
Single-tenant app with no sign-in, so all policies use TO anon, authenticated
with USING (true) / WITH CHECK (true) because the data is intentionally shared.
RLS enabled on all three new tables. GRANT SELECT, INSERT, UPDATE, DELETE
to anon, authenticated on each table. Four named policies per table
(select / insert / update / delete).

## 5. Important Notes
- No existing columns are dropped, renamed or retyped.
- Legacy text columns (dimensions_mm, main_reinforcement, tie_reinforcement)
  are retained as fallback for older rows.
- quantity defaults to 1 so existing rows are treated as single elements.
- clear_cover_mm defaults match common Bangladesh practice (25 beams, 50
  footings, 20 slabs).
*/

-- beam_registers additions
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS storey_range text;
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS clear_cover_mm numeric NOT NULL DEFAULT 25;
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS tie_spacing_notation text;
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS tie_spacing_mm numeric NOT NULL DEFAULT 0;
ALTER TABLE beam_registers ADD COLUMN IF NOT EXISTS excavation_volume_cum numeric NOT NULL DEFAULT 0;

-- footing_registers additions
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS storey_range text;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS clear_cover_mm numeric NOT NULL DEFAULT 50;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS tie_spacing_notation text;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS tie_spacing_mm numeric NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS excavation_volume_cum numeric NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS pedestal_length_mm integer NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS pedestal_width_mm integer NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS foundation_depth_m numeric NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS footing_length_mm integer NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS footing_width_mm integer NOT NULL DEFAULT 0;
ALTER TABLE footing_registers ADD COLUMN IF NOT EXISTS thickness_mm integer NOT NULL DEFAULT 0;

-- slab_registers additions
ALTER TABLE slab_registers ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE slab_registers ADD COLUMN IF NOT EXISTS storey_range text;
ALTER TABLE slab_registers ADD COLUMN IF NOT EXISTS clear_cover_mm numeric NOT NULL DEFAULT 20;
ALTER TABLE slab_registers ADD COLUMN IF NOT EXISTS tie_spacing_notation text;
ALTER TABLE slab_registers ADD COLUMN IF NOT EXISTS tie_spacing_mm numeric NOT NULL DEFAULT 0;

-- rebar_registers additions
ALTER TABLE rebar_registers ADD COLUMN IF NOT EXISTS element_mark text;
ALTER TABLE rebar_registers ADD COLUMN IF NOT EXISTS bar_mark text;
ALTER TABLE rebar_registers ADD COLUMN IF NOT EXISTS shape_code text;
ALTER TABLE rebar_registers ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE rebar_registers ADD COLUMN IF NOT EXISTS weight_kg numeric NOT NULL DEFAULT 0;

-- beam_reinforcement_groups
CREATE TABLE IF NOT EXISTS beam_reinforcement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beam_register_id uuid NOT NULL REFERENCES beam_registers(id) ON DELETE CASCADE,
  layer text NOT NULL,
  bar_count integer NOT NULL CHECK (bar_count > 0),
  diameter_mm integer NOT NULL CHECK (diameter_mm > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_beam_reinforcement_groups_register ON beam_reinforcement_groups(beam_register_id);
ALTER TABLE beam_reinforcement_groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON beam_reinforcement_groups TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_beam_reinforcement_groups" ON beam_reinforcement_groups;
CREATE POLICY "anon_select_beam_reinforcement_groups" ON beam_reinforcement_groups FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_beam_reinforcement_groups" ON beam_reinforcement_groups;
CREATE POLICY "anon_insert_beam_reinforcement_groups" ON beam_reinforcement_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_beam_reinforcement_groups" ON beam_reinforcement_groups;
CREATE POLICY "anon_update_beam_reinforcement_groups" ON beam_reinforcement_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_beam_reinforcement_groups" ON beam_reinforcement_groups;
CREATE POLICY "anon_delete_beam_reinforcement_groups" ON beam_reinforcement_groups FOR DELETE
  TO anon, authenticated USING (true);

-- footing_reinforcement_groups
CREATE TABLE IF NOT EXISTS footing_reinforcement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  footing_register_id uuid NOT NULL REFERENCES footing_registers(id) ON DELETE CASCADE,
  layer text NOT NULL,
  bar_count integer NOT NULL CHECK (bar_count > 0),
  diameter_mm integer NOT NULL CHECK (diameter_mm > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_footing_reinforcement_groups_register ON footing_reinforcement_groups(footing_register_id);
ALTER TABLE footing_reinforcement_groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON footing_reinforcement_groups TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_footing_reinforcement_groups" ON footing_reinforcement_groups;
CREATE POLICY "anon_select_footing_reinforcement_groups" ON footing_reinforcement_groups FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_footing_reinforcement_groups" ON footing_reinforcement_groups;
CREATE POLICY "anon_insert_footing_reinforcement_groups" ON footing_reinforcement_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_footing_reinforcement_groups" ON footing_reinforcement_groups;
CREATE POLICY "anon_update_footing_reinforcement_groups" ON footing_reinforcement_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_footing_reinforcement_groups" ON footing_reinforcement_groups;
CREATE POLICY "anon_delete_footing_reinforcement_groups" ON footing_reinforcement_groups FOR DELETE
  TO anon, authenticated USING (true);

-- slab_reinforcement_groups
CREATE TABLE IF NOT EXISTS slab_reinforcement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slab_register_id uuid NOT NULL REFERENCES slab_registers(id) ON DELETE CASCADE,
  layer text NOT NULL,
  direction text,
  bar_count integer NOT NULL CHECK (bar_count > 0),
  diameter_mm integer NOT NULL CHECK (diameter_mm > 0),
  length_m numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slab_reinforcement_groups_register ON slab_reinforcement_groups(slab_register_id);
ALTER TABLE slab_reinforcement_groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON slab_reinforcement_groups TO anon, authenticated;
DROP POLICY IF EXISTS "anon_select_slab_reinforcement_groups" ON slab_reinforcement_groups;
CREATE POLICY "anon_select_slab_reinforcement_groups" ON slab_reinforcement_groups FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_slab_reinforcement_groups" ON slab_reinforcement_groups;
CREATE POLICY "anon_insert_slab_reinforcement_groups" ON slab_reinforcement_groups FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_slab_reinforcement_groups" ON slab_reinforcement_groups;
CREATE POLICY "anon_update_slab_reinforcement_groups" ON slab_reinforcement_groups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_slab_reinforcement_groups" ON slab_reinforcement_groups;
CREATE POLICY "anon_delete_slab_reinforcement_groups" ON slab_reinforcement_groups FOR DELETE
  TO anon, authenticated USING (true);
