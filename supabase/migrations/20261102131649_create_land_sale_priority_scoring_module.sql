/*
# Create Land Sale Priority Scoring Module

1. New Tables
- `land_sale_scores`: priority scoring for land and property assets across eight
  factors. Each factor is scored 1-10. The table stores the computed sell pressure,
  hold pressure, net signal, and recommendation category.

2. New Functions
- `compute_land_sale_recommendation`: calculates sell pressure, hold pressure, net
  signal, and recommendation from the eight factor scores. Called by trigger.
- Trigger `trg_land_sale_scores_compute`: runs before insert/update to auto-compute
  the recommendation so stored values are always consistent with the scores.

3. Security
- RLS is enabled on `land_sale_scores`.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through four separate policies.
- The compute function is invoker-secured and executable by anon and authenticated.

4. Scoring Model
1. Sell factors (higher score = stronger reason to sell): Funding Need, Market Demand,
   Ease of Sale.
2. Hold factors (higher score = stronger reason to keep): Appreciation Potential,
   Ownership Complexity, Strategic Importance, Future Family Use, Income Potential.
3. Sell pressure = weighted average of sell factors normalized to 1-10.
4. Hold pressure = weighted average of hold factors normalized to 1-10.
5. Net signal = sell pressure - hold pressure.
6. Recommendation thresholds:
   - Net >= 2.5: Sell Immediately
   - Net >= 0.5: Sell If Needed
   - Net >= -2: Hold
   - Net < -2: Protected Asset

5. Important Notes
1. Scores can be linked to a monetizable asset or entered standalone.
2. Recommendations are recomputed automatically whenever scores change.
3. Weights are fixed in the database function for consistent scoring across assets.
*/

CREATE TABLE IF NOT EXISTS land_sale_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES monetizable_assets(id) ON DELETE SET NULL,
  asset_name text NOT NULL,
  location text,
  estimated_value_bdt numeric(14,2) CHECK (estimated_value_bdt IS NULL OR estimated_value_bdt >= 0),
  funding_need_score smallint NOT NULL DEFAULT 5 CHECK (funding_need_score BETWEEN 1 AND 10),
  market_demand_score smallint NOT NULL DEFAULT 5 CHECK (market_demand_score BETWEEN 1 AND 10),
  appreciation_potential_score smallint NOT NULL DEFAULT 5 CHECK (appreciation_potential_score BETWEEN 1 AND 10),
  ease_of_sale_score smallint NOT NULL DEFAULT 5 CHECK (ease_of_sale_score BETWEEN 1 AND 10),
  ownership_complexity_score smallint NOT NULL DEFAULT 5 CHECK (ownership_complexity_score BETWEEN 1 AND 10),
  strategic_importance_score smallint NOT NULL DEFAULT 5 CHECK (strategic_importance_score BETWEEN 1 AND 10),
  future_family_use_score smallint NOT NULL DEFAULT 5 CHECK (future_family_use_score BETWEEN 1 AND 10),
  income_potential_score smallint NOT NULL DEFAULT 5 CHECK (income_potential_score BETWEEN 1 AND 10),
  sell_pressure numeric(5,2) NOT NULL DEFAULT 5,
  hold_pressure numeric(5,2) NOT NULL DEFAULT 5,
  net_signal numeric(5,2) NOT NULL DEFAULT 0,
  recommendation text NOT NULL DEFAULT 'hold' CHECK (recommendation IN ('sell_immediately','sell_if_needed','hold','protected_asset')),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_land_sale_scores_project ON land_sale_scores(project_id, net_signal DESC);

DROP TRIGGER IF EXISTS trg_land_sale_scores_updated_at ON land_sale_scores;
CREATE TRIGGER trg_land_sale_scores_updated_at BEFORE UPDATE ON land_sale_scores FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION compute_land_sale_recommendation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sell_pressure numeric(5,2);
  v_hold_pressure numeric(5,2);
  v_net numeric(5,2);
  v_rec text;
BEGIN
  v_sell_pressure := ROUND((
    NEW.funding_need_score * 20 + NEW.market_demand_score * 15 + NEW.ease_of_sale_score * 10
  ) / 45.0, 2);

  v_hold_pressure := ROUND((
    NEW.appreciation_potential_score * 15 + NEW.ownership_complexity_score * 10 +
    NEW.strategic_importance_score * 15 + NEW.future_family_use_score * 10 +
    NEW.income_potential_score * 5
  ) / 55.0, 2);

  v_net := ROUND(v_sell_pressure - v_hold_pressure, 2);

  IF v_net >= 2.5 THEN v_rec := 'sell_immediately';
  ELSEIF v_net >= 0.5 THEN v_rec := 'sell_if_needed';
  ELSEIF v_net >= -2 THEN v_rec := 'hold';
  ELSE v_rec := 'protected_asset';
  END IF;

  NEW.sell_pressure := v_sell_pressure;
  NEW.hold_pressure := v_hold_pressure;
  NEW.net_signal := v_net;
  NEW.recommendation := v_rec;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_land_sale_scores_compute ON land_sale_scores;
CREATE TRIGGER trg_land_sale_scores_compute
BEFORE INSERT OR UPDATE OF funding_need_score, market_demand_score, appreciation_potential_score, ease_of_sale_score, ownership_complexity_score, strategic_importance_score, future_family_use_score, income_potential_score ON land_sale_scores
FOR EACH ROW EXECUTE FUNCTION compute_land_sale_recommendation();

ALTER TABLE land_sale_scores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON land_sale_scores TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_land_sale_scores" ON land_sale_scores;
CREATE POLICY "anon_select_land_sale_scores" ON land_sale_scores FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_land_sale_scores" ON land_sale_scores;
CREATE POLICY "anon_insert_land_sale_scores" ON land_sale_scores FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_land_sale_scores" ON land_sale_scores;
CREATE POLICY "anon_update_land_sale_scores" ON land_sale_scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_land_sale_scores" ON land_sale_scores;
CREATE POLICY "anon_delete_land_sale_scores" ON land_sale_scores FOR DELETE TO anon, authenticated USING (true);

GRANT EXECUTE ON FUNCTION compute_land_sale_recommendation() TO anon, authenticated;
