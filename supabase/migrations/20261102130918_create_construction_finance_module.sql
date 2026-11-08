/*
# Create Construction Finance Module

1. New Tables
- `construction_funding_sources`: funding source register for Savings, Salary Contributions,
  House Sales, Land Sales, DPS, FDR, Loan, and Family Contribution. Stores planned amount,
  received amount, expected date, status, and notes.
- `construction_budget_lines`: budget by cost category with actual cost, variance, and notes.
  Actual costs are entered separately from the planned budget so overruns remain visible.
- `construction_cash_flow_forecasts`: monthly expected cash inflows and outflows with notes.
  This supports expected cash and funding gap forecasting without changing historical records.

2. New Function
- `get_construction_finance_summary(p_project_id)`: calculates planned funding, received
  funding, total budget, actual cost, available cash, expected cash, funding gap, and overrun.

3. Security
- RLS is enabled on all new tables.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD access
  through four separate policies per table.
- The summary function is invoker-secured and executable by anon and authenticated.

4. Important Notes
1. Funding source records preserve planned and received values separately.
2. Budget lines preserve budget and actual cost separately; actual cost can exceed budget and
   is intentionally not capped.
3. Forecast rows are monthly and can be updated as planning assumptions change.
4. All currency values are stored in BDT.
*/

CREATE TABLE IF NOT EXISTS construction_funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('savings','salary_contributions','house_sales','land_sales','dps','fdr','loan','family_contribution')),
  source_name text NOT NULL,
  planned_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_amount_bdt >= 0),
  received_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (received_amount_bdt >= 0),
  expected_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','partial','received','cancelled')),
  notes text
);

CREATE TABLE IF NOT EXISTS construction_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  budget_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_amount_bdt >= 0),
  actual_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual_amount_bdt >= 0),
  notes text
);

CREATE TABLE IF NOT EXISTS construction_cash_flow_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  forecast_month date NOT NULL,
  expected_inflow_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (expected_inflow_bdt >= 0),
  expected_outflow_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (expected_outflow_bdt >= 0),
  notes text,
  UNIQUE (project_id, forecast_month)
);

CREATE INDEX IF NOT EXISTS idx_construction_funding_sources_project ON construction_funding_sources(project_id, expected_date);
CREATE INDEX IF NOT EXISTS idx_construction_budget_lines_project ON construction_budget_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_cash_forecasts_project ON construction_cash_flow_forecasts(project_id, forecast_month);

DROP TRIGGER IF EXISTS trg_construction_funding_sources_updated_at ON construction_funding_sources;
CREATE TRIGGER trg_construction_funding_sources_updated_at BEFORE UPDATE ON construction_funding_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_construction_budget_lines_updated_at ON construction_budget_lines;
CREATE TRIGGER trg_construction_budget_lines_updated_at BEFORE UPDATE ON construction_budget_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_construction_cash_forecasts_updated_at ON construction_cash_flow_forecasts;
CREATE TRIGGER trg_construction_cash_forecasts_updated_at BEFORE UPDATE ON construction_cash_flow_forecasts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE construction_funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_cash_flow_forecasts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON construction_funding_sources, construction_budget_lines, construction_cash_flow_forecasts TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_construction_funding_sources" ON construction_funding_sources;
CREATE POLICY "anon_select_construction_funding_sources" ON construction_funding_sources FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_construction_funding_sources" ON construction_funding_sources;
CREATE POLICY "anon_insert_construction_funding_sources" ON construction_funding_sources FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_construction_funding_sources" ON construction_funding_sources;
CREATE POLICY "anon_update_construction_funding_sources" ON construction_funding_sources FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_construction_funding_sources" ON construction_funding_sources;
CREATE POLICY "anon_delete_construction_funding_sources" ON construction_funding_sources FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_construction_budget_lines" ON construction_budget_lines;
CREATE POLICY "anon_select_construction_budget_lines" ON construction_budget_lines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_construction_budget_lines" ON construction_budget_lines;
CREATE POLICY "anon_insert_construction_budget_lines" ON construction_budget_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_construction_budget_lines" ON construction_budget_lines;
CREATE POLICY "anon_update_construction_budget_lines" ON construction_budget_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_construction_budget_lines" ON construction_budget_lines;
CREATE POLICY "anon_delete_construction_budget_lines" ON construction_budget_lines FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_construction_cash_forecasts" ON construction_cash_flow_forecasts;
CREATE POLICY "anon_select_construction_cash_forecasts" ON construction_cash_flow_forecasts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_construction_cash_forecasts" ON construction_cash_flow_forecasts;
CREATE POLICY "anon_insert_construction_cash_forecasts" ON construction_cash_flow_forecasts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_construction_cash_forecasts" ON construction_cash_flow_forecasts;
CREATE POLICY "anon_update_construction_cash_forecasts" ON construction_cash_flow_forecasts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_construction_cash_forecasts" ON construction_cash_flow_forecasts;
CREATE POLICY "anon_delete_construction_cash_forecasts" ON construction_cash_flow_forecasts FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_construction_finance_summary(p_project_id uuid)
RETURNS TABLE (
  project_id uuid,
  planned_funding numeric,
  received_funding numeric,
  total_budget numeric,
  actual_cost numeric,
  available_cash numeric,
  expected_cash numeric,
  funding_gap numeric,
  cost_overrun numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH funding AS (
    SELECT COALESCE(SUM(planned_amount_bdt), 0)::numeric planned,
      COALESCE(SUM(received_amount_bdt), 0)::numeric received
    FROM construction_funding_sources WHERE project_id = p_project_id
  ), budget AS (
    SELECT COALESCE(SUM(budget_amount_bdt), 0)::numeric planned,
      COALESCE(SUM(actual_amount_bdt), 0)::numeric actual
    FROM construction_budget_lines WHERE project_id = p_project_id
  ), forecast AS (
    SELECT COALESCE(SUM(expected_inflow_bdt), 0)::numeric inflow,
      COALESCE(SUM(expected_outflow_bdt), 0)::numeric outflow
    FROM construction_cash_flow_forecasts WHERE project_id = p_project_id
  )
  SELECT p_project_id, f.planned, f.received, b.planned, b.actual,
    f.received - b.actual,
    f.received + c.inflow - b.actual - c.outflow,
    GREATEST(b.planned - f.planned, 0),
    GREATEST(b.actual - b.planned, 0)
  FROM funding f, budget b, forecast c;
$$;

GRANT EXECUTE ON FUNCTION get_construction_finance_summary(uuid) TO anon, authenticated;
