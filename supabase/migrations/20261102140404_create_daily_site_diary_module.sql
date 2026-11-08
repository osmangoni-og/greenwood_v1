/*
# Create Daily Site Diary Module

1. New Tables
- `daily_site_diaries`: one daily site record per project date. Stores work performed,
  labor count, material usage, weather, photo references, issues, and engineer notes.

2. Security
- RLS is enabled on `daily_site_diaries`.
- This app has no sign-in screen, so anon and authenticated roles receive shared CRUD
  access through four separate policies.

3. Reporting
- Records are ordered newest first and can be printed as a daily report from the app.
- A unique project/date constraint prevents duplicate diary entries for one day.

4. Important Notes
1. Labor count cannot be negative.
2. Photo references are stored as JSON to support multiple site photos per day.
3. Deleting a project cascades to its diaries.
*/

CREATE TABLE IF NOT EXISTS daily_site_diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  diary_date date NOT NULL,
  work_performed text NOT NULL,
  labor_count integer NOT NULL DEFAULT 0 CHECK (labor_count >= 0),
  material_usage text,
  weather text,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues text,
  engineer_notes text,
  UNIQUE (project_id, diary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_site_diaries_project_date ON daily_site_diaries(project_id, diary_date DESC);

DROP TRIGGER IF EXISTS trg_daily_site_diaries_updated_at ON daily_site_diaries;
CREATE TRIGGER trg_daily_site_diaries_updated_at BEFORE UPDATE ON daily_site_diaries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE daily_site_diaries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_site_diaries TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_daily_site_diaries" ON daily_site_diaries;
CREATE POLICY "anon_select_daily_site_diaries" ON daily_site_diaries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_daily_site_diaries" ON daily_site_diaries;
CREATE POLICY "anon_insert_daily_site_diaries" ON daily_site_diaries FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_daily_site_diaries" ON daily_site_diaries;
CREATE POLICY "anon_update_daily_site_diaries" ON daily_site_diaries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_daily_site_diaries" ON daily_site_diaries;
CREATE POLICY "anon_delete_daily_site_diaries" ON daily_site_diaries FOR DELETE TO anon, authenticated USING (true);
