/*
# Create Contractor Evaluation System

Plain-English summary:
This migration adds a contractor evaluation module so the owner can collect bids
from multiple contractors for a scope of work, score each bid across seven weighted
criteria, and generate database-calculated rankings.

## 1. New Tables
- `contractors`: master records for contractors by type (main, engineer, electrical,
  plumbing, tile, paint) with contact details and experience.
- `tenders`: a scope of work put out for bidding. Has a type, status, and closing date.
- `contractor_bids`: a bid submitted by a contractor for a tender. Stores the quoted
  amount, advance requirement, payment terms, timeline, and scope notes.
- `bid_scores`: evaluation scores (1-10) for each bid across seven criteria.

## 2. Criteria and Weights
The evaluation matrix uses these fixed weights (stored in the function):
- Price 25%
- Quality 25%
- Experience 15%
- Labor Availability 10%
- References 10%
- Timeline 10%
- Risk 5%

## 3. SQL Calculations
- `get_contractor_ranking(p_tender_id)`: aggregates each bid's scores, multiplies by
  the weights, sums to a weighted total (0-10 scale), and ranks bids from best to worst.
  The best bid has the highest weighted score.

## 4. Security
- RLS enabled on all four tables.
- The app has no sign-in screen, so CRUD policies target anon and authenticated.
- All tables use shared/public USING(true) policies (single-tenant no-auth app).

## 5. Important notes
1. Deleting a tender cascades to its bids; deleting a bid cascades to its scores.
2. Deleting a contractor is blocked if bids reference it (RESTRICT) to preserve audit history.
3. All money values are in BDT.
4. Scores are 1-10; weighted totals are calculated by the database, not the frontend.
5. No AI is involved.
6. Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  contractor_type text NOT NULL CHECK (contractor_type IN ('main','engineer','electrical','plumbing','tile','paint')),
  contact_person text,
  phone text,
  email text,
  years_experience integer NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  license_number text,
  notes text
);

CREATE TABLE IF NOT EXISTS tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  scope_description text,
  tender_type text NOT NULL CHECK (tender_type IN ('main','engineer','electrical','plumbing','tile','paint')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','under_evaluation','awarded','closed')),
  closing_date date,
  notes text
);

CREATE TABLE IF NOT EXISTS contractor_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  quotation_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (quotation_amount_bdt >= 0),
  advance_required_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (advance_required_pct >= 0 AND advance_required_pct <= 100),
  advance_amount_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (advance_amount_bdt >= 0),
  payment_terms text,
  timeline_days integer NOT NULL DEFAULT 0 CHECK (timeline_days >= 0),
  scope_notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected')),
  notes text,
  UNIQUE (tender_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS bid_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  bid_id uuid NOT NULL REFERENCES contractor_bids(id) ON DELETE CASCADE,
  criterion text NOT NULL CHECK (criterion IN ('price','quality','experience','labor_availability','references','timeline','risk')),
  score integer NOT NULL DEFAULT 5 CHECK (score >= 1 AND score <= 10),
  notes text,
  UNIQUE (bid_id, criterion)
);

CREATE INDEX IF NOT EXISTS idx_contractors_project ON contractors(project_id);
CREATE INDEX IF NOT EXISTS idx_contractors_type ON contractors(contractor_type);
CREATE INDEX IF NOT EXISTS idx_tenders_project ON tenders(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_tender ON contractor_bids(tender_id);
CREATE INDEX IF NOT EXISTS idx_bids_contractor ON contractor_bids(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bid_scores_bid ON bid_scores(bid_id);

DROP TRIGGER IF EXISTS trg_contractors_updated_at ON contractors;
CREATE TRIGGER trg_contractors_updated_at BEFORE UPDATE ON contractors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_tenders_updated_at ON tenders;
CREATE TRIGGER trg_tenders_updated_at BEFORE UPDATE ON tenders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_contractor_bids_updated_at ON contractor_bids;
CREATE TRIGGER trg_contractor_bids_updated_at BEFORE UPDATE ON contractor_bids FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_bid_scores_updated_at ON bid_scores;
CREATE TRIGGER trg_bid_scores_updated_at BEFORE UPDATE ON bid_scores FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_scores ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON contractors, tenders, contractor_bids, bid_scores TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_contractors" ON contractors;
CREATE POLICY "anon_select_contractors" ON contractors FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contractors" ON contractors;
CREATE POLICY "anon_insert_contractors" ON contractors FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contractors" ON contractors;
CREATE POLICY "anon_update_contractors" ON contractors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contractors" ON contractors;
CREATE POLICY "anon_delete_contractors" ON contractors FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_tenders" ON tenders;
CREATE POLICY "anon_select_tenders" ON tenders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tenders" ON tenders;
CREATE POLICY "anon_insert_tenders" ON tenders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tenders" ON tenders;
CREATE POLICY "anon_update_tenders" ON tenders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tenders" ON tenders;
CREATE POLICY "anon_delete_tenders" ON tenders FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_contractor_bids" ON contractor_bids;
CREATE POLICY "anon_select_contractor_bids" ON contractor_bids FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contractor_bids" ON contractor_bids;
CREATE POLICY "anon_insert_contractor_bids" ON contractor_bids FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contractor_bids" ON contractor_bids;
CREATE POLICY "anon_update_contractor_bids" ON contractor_bids FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contractor_bids" ON contractor_bids;
CREATE POLICY "anon_delete_contractor_bids" ON contractor_bids FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_bid_scores" ON bid_scores;
CREATE POLICY "anon_select_bid_scores" ON bid_scores FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bid_scores" ON bid_scores;
CREATE POLICY "anon_insert_bid_scores" ON bid_scores FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bid_scores" ON bid_scores;
CREATE POLICY "anon_update_bid_scores" ON bid_scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bid_scores" ON bid_scores;
CREATE POLICY "anon_delete_bid_scores" ON bid_scores FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION get_contractor_ranking(p_tender_id uuid)
RETURNS TABLE (
  bid_id uuid,
  contractor_id uuid,
  contractor_name text,
  contractor_type text,
  quotation_amount_bdt numeric,
  advance_required_pct numeric,
  timeline_days integer,
  price_score numeric,
  quality_score numeric,
  experience_score numeric,
  labor_availability_score numeric,
  references_score numeric,
  timeline_score numeric,
  risk_score numeric,
  weighted_total numeric,
  rank integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bid_data AS (
    SELECT
      b.id AS bid_id,
      b.contractor_id,
      c.name AS contractor_name,
      c.contractor_type,
      b.quotation_amount_bdt,
      b.advance_required_pct,
      b.timeline_days,
      COALESCE(s_price.score, 5) AS price_score,
      COALESCE(s_quality.score, 5) AS quality_score,
      COALESCE(s_exp.score, 5) AS experience_score,
      COALESCE(s_labor.score, 5) AS labor_availability_score,
      COALESCE(s_ref.score, 5) AS references_score,
      COALESCE(s_time.score, 5) AS timeline_score,
      COALESCE(s_risk.score, 5) AS risk_score
    FROM contractor_bids b
    JOIN contractors c ON c.id = b.contractor_id
    LEFT JOIN bid_scores s_price ON s_price.bid_id = b.id AND s_price.criterion = 'price'
    LEFT JOIN bid_scores s_quality ON s_quality.bid_id = b.id AND s_quality.criterion = 'quality'
    LEFT JOIN bid_scores s_exp ON s_exp.bid_id = b.id AND s_exp.criterion = 'experience'
    LEFT JOIN bid_scores s_labor ON s_labor.bid_id = b.id AND s_labor.criterion = 'labor_availability'
    LEFT JOIN bid_scores s_ref ON s_ref.bid_id = b.id AND s_ref.criterion = 'references'
    LEFT JOIN bid_scores s_time ON s_time.bid_id = b.id AND s_time.criterion = 'timeline'
    LEFT JOIN bid_scores s_risk ON s_risk.bid_id = b.id AND s_risk.criterion = 'risk'
    WHERE b.tender_id = p_tender_id
  ), scored AS (
    SELECT
      bid_id,
      contractor_id,
      contractor_name,
      contractor_type,
      quotation_amount_bdt,
      advance_required_pct,
      timeline_days,
      price_score,
      quality_score,
      experience_score,
      labor_availability_score,
      references_score,
      timeline_score,
      risk_score,
      (
        price_score * 0.25 +
        quality_score * 0.25 +
        experience_score * 0.15 +
        labor_availability_score * 0.10 +
        references_score * 0.10 +
        timeline_score * 0.10 +
        risk_score * 0.05
      )::numeric AS weighted_total
    FROM bid_data
  )
  SELECT
    bid_id,
    contractor_id,
    contractor_name,
    contractor_type,
    quotation_amount_bdt,
    advance_required_pct,
    timeline_days,
    price_score,
    quality_score,
    experience_score,
    labor_availability_score,
    references_score,
    timeline_score,
    risk_score,
    ROUND(weighted_total, 4),
    ROW_NUMBER() OVER (ORDER BY weighted_total DESC, quotation_amount_bdt ASC) AS rank
  FROM scored
  ORDER BY weighted_total DESC, quotation_amount_bdt ASC;
$$;

GRANT EXECUTE ON FUNCTION get_contractor_ranking(uuid) TO anon, authenticated;
