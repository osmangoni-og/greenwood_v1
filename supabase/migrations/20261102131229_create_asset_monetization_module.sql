/*
# Create Asset Monetization Module

1. New Tables
- `monetizable_assets`: assets available for sale or liquidation, including Existing House,
  Agricultural Land, Residential Plot, Commercial Land, FDR, and DPS. Stores estimated value,
  sale value, status, buyer details, and notes.
- `asset_offers`: offers and negotiation records linked to an asset. Stores buyer details,
  offer value, offer date, status, negotiation notes, and the latest counter amount.
- `asset_payments`: payment records linked to an asset and optional offer. Stores paid amount,
  payment date, method, reference, and whether proceeds were transferred into construction finance.

2. New Function
- `record_asset_payment_and_transfer`: validates and records a payment, then automatically
  creates or updates a construction funding source using the correct source type for the asset.
  Existing House maps to House Sales, land assets map to Land Sales, and FDR/DPS retain their
  matching finance source type.

3. Security
- RLS is enabled on all new tables.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD access
  through four separate policies per table.
- The transfer function is invoker-secured, validates the asset and amount, and is executable
  by anon and authenticated because this is a shared single-tenant app.

4. Important Notes
1. Estimated value and final sale value are stored separately.
2. Offers and payments remain separate records so negotiations do not overwrite payment history.
3. Every payment transfer is recorded against a construction funding source and increases its
   received amount.
4. Amounts are validated server-side and must be greater than zero.
*/

CREATE TABLE IF NOT EXISTS monetizable_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('existing_house','agricultural_land','residential_plot','commercial_land','fdr','dps')),
  asset_name text NOT NULL,
  estimated_value_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_value_bdt >= 0),
  sale_value_bdt numeric(14,2) CHECK (sale_value_bdt IS NULL OR sale_value_bdt >= 0),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','listed','negotiating','sold','withdrawn')),
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  buyer_address text,
  sale_date date,
  notes text
);

CREATE TABLE IF NOT EXISTS asset_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  asset_id uuid NOT NULL REFERENCES monetizable_assets(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  buyer_phone text,
  buyer_email text,
  offer_amount_bdt numeric(14,2) NOT NULL CHECK (offer_amount_bdt > 0),
  counter_amount_bdt numeric(14,2) CHECK (counter_amount_bdt IS NULL OR counter_amount_bdt > 0),
  offer_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','negotiating','accepted','rejected','expired')),
  negotiation_notes text
);

CREATE TABLE IF NOT EXISTS asset_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  asset_id uuid NOT NULL REFERENCES monetizable_assets(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES asset_offers(id) ON DELETE SET NULL,
  payment_amount_bdt numeric(14,2) NOT NULL CHECK (payment_amount_bdt > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  payment_reference text,
  transferred_to_finance boolean NOT NULL DEFAULT false,
  transferred_at timestamptz,
  finance_source_id uuid REFERENCES construction_funding_sources(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_monetizable_assets_project_status ON monetizable_assets(project_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_offers_asset_date ON asset_offers(asset_id, offer_date DESC);
CREATE INDEX IF NOT EXISTS idx_asset_payments_asset_date ON asset_payments(asset_id, payment_date DESC);

DROP TRIGGER IF EXISTS trg_monetizable_assets_updated_at ON monetizable_assets;
CREATE TRIGGER trg_monetizable_assets_updated_at BEFORE UPDATE ON monetizable_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_asset_offers_updated_at ON asset_offers;
CREATE TRIGGER trg_asset_offers_updated_at BEFORE UPDATE ON asset_offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE monetizable_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON monetizable_assets, asset_offers, asset_payments TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_monetizable_assets" ON monetizable_assets;
CREATE POLICY "anon_select_monetizable_assets" ON monetizable_assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_monetizable_assets" ON monetizable_assets;
CREATE POLICY "anon_insert_monetizable_assets" ON monetizable_assets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_monetizable_assets" ON monetizable_assets;
CREATE POLICY "anon_update_monetizable_assets" ON monetizable_assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_monetizable_assets" ON monetizable_assets;
CREATE POLICY "anon_delete_monetizable_assets" ON monetizable_assets FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_asset_offers" ON asset_offers;
CREATE POLICY "anon_select_asset_offers" ON asset_offers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_asset_offers" ON asset_offers;
CREATE POLICY "anon_insert_asset_offers" ON asset_offers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_asset_offers" ON asset_offers;
CREATE POLICY "anon_update_asset_offers" ON asset_offers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_asset_offers" ON asset_offers;
CREATE POLICY "anon_delete_asset_offers" ON asset_offers FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_asset_payments" ON asset_payments;
CREATE POLICY "anon_select_asset_payments" ON asset_payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_asset_payments" ON asset_payments;
CREATE POLICY "anon_insert_asset_payments" ON asset_payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_asset_payments" ON asset_payments;
CREATE POLICY "anon_update_asset_payments" ON asset_payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_asset_payments" ON asset_payments;
CREATE POLICY "anon_delete_asset_payments" ON asset_payments FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION record_asset_payment_and_transfer(
  p_asset_id uuid,
  p_offer_id uuid,
  p_payment_amount_bdt numeric,
  p_payment_date date,
  p_payment_method text,
  p_payment_reference text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_asset monetizable_assets%ROWTYPE;
  v_source_type text;
  v_finance_source_id uuid;
  v_payment_id uuid;
BEGIN
  IF p_payment_amount_bdt IS NULL OR p_payment_amount_bdt <= 0 OR p_payment_amount_bdt > 100000000000 THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;
  SELECT * INTO v_asset FROM monetizable_assets WHERE id = p_asset_id;
  IF v_asset.id IS NULL THEN RAISE EXCEPTION 'Asset not found'; END IF;
  IF p_offer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM asset_offers WHERE id = p_offer_id AND asset_id = p_asset_id) THEN
    RAISE EXCEPTION 'Offer does not belong to asset';
  END IF;
  v_source_type := CASE
    WHEN v_asset.asset_type = 'existing_house' THEN 'house_sales'
    WHEN v_asset.asset_type IN ('agricultural_land','residential_plot','commercial_land') THEN 'land_sales'
    WHEN v_asset.asset_type = 'fdr' THEN 'fdr'
    ELSE 'dps'
  END;
  INSERT INTO construction_funding_sources (project_id, source_type, source_name, planned_amount_bdt, received_amount_bdt, status, notes)
  VALUES (v_asset.project_id, v_source_type, v_asset.asset_name || ' proceeds', 0, p_payment_amount_bdt, 'received', 'Automatically transferred from asset payment')
  RETURNING id INTO v_finance_source_id;
  INSERT INTO asset_payments (created_by, asset_id, offer_id, payment_amount_bdt, payment_date, payment_method, payment_reference, transferred_to_finance, transferred_at, finance_source_id, notes)
  VALUES (NULL, p_asset_id, p_offer_id, p_payment_amount_bdt, COALESCE(p_payment_date, CURRENT_DATE), COALESCE(NULLIF(trim(p_payment_method), ''), 'bank_transfer'), NULLIF(trim(p_payment_reference), ''), true, now(), v_finance_source_id, p_notes)
  RETURNING id INTO v_payment_id;
  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_asset_payment_and_transfer(uuid, uuid, numeric, date, text, text, text) TO anon, authenticated;
