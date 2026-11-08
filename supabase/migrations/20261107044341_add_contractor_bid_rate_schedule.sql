/*
# Contractor bid rate schedule

1. New Tables
- `contractor_bid_items`: one row per construction element priced in a contractor bid.
  - `bid_id` links to the bid (deleted with the bid).
  - `element` is the construction element (e.g. Foundation, Ground Floor, Septic Tank).
  - `unit` is the measurement unit (default sft).
  - `area` is the quantity being priced; `rate` is the price per unit.
  - `amount` is calculated as area x rate and cannot be edited directly.

2. Security
- Row level security enabled.
- Grants and policies allow the anon and authenticated roles, matching the other contractor tables (single-tenant app, no sign-in).

3. Notes
- Existing bids and contractors are not modified.
*/

CREATE TABLE IF NOT EXISTS contractor_bid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES contractor_bids(id) ON DELETE CASCADE,
  element text NOT NULL,
  unit text NOT NULL DEFAULT 'sft',
  area numeric(14,2) NOT NULL DEFAULT 0 CHECK (area >= 0),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  amount numeric(16,2) GENERATED ALWAYS AS (round(area * rate, 2)) STORED,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_bid_items_bid_idx ON contractor_bid_items (bid_id);

ALTER TABLE contractor_bid_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON contractor_bid_items TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_contractor_bid_items" ON contractor_bid_items;
CREATE POLICY "anon_select_contractor_bid_items" ON contractor_bid_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_contractor_bid_items" ON contractor_bid_items;
CREATE POLICY "anon_insert_contractor_bid_items" ON contractor_bid_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_contractor_bid_items" ON contractor_bid_items;
CREATE POLICY "anon_update_contractor_bid_items" ON contractor_bid_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_contractor_bid_items" ON contractor_bid_items;
CREATE POLICY "anon_delete_contractor_bid_items" ON contractor_bid_items FOR DELETE
  TO anon, authenticated USING (true);
