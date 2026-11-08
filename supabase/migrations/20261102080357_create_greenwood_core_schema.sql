/*
# Create core schema for Greenwood Miazi Bari

Plain-English summary:
This migration creates the six tables that power the project management system for the
two-storied duplex bungalow at Dhoon Shahadda, Feni, Bangladesh. It also seeds the single
project record, the owner profile, and the default app preferences.

## 1. New Tables
- `users`: team members and stakeholders (owner, engineer, contractor, etc.).
- `projects`: the bungalow project with phase, budget, funds, spending, and progress.
- `settings`: key/value application preferences (currency, alert thresholds).
- `documents`: metadata and reference links for project paperwork (drawings, permits, receipts).
- `activity_logs`: append-only audit trail of changes made in the app.
- `notifications`: in-app alerts such as budget warnings or upcoming deadlines.

Every table has `id`, `created_at`, `updated_at`, and `created_by`.

## 2. Triggers
- `set_updated_at()` function keeps `updated_at` current on every update.

## 3. Security
- Row Level Security is enabled on all six tables.
- The app has no sign-in screen, so policies target `anon` and `authenticated`.
- `activity_logs` is append-only: only SELECT and INSERT are granted and allowed.
- The trigger function is not callable through the Data API.

## 4. Important Notes
1. Money values are stored in Bangladeshi Taka (BDT) as numeric(14,2).
2. Deleting a project removes its documents, activity logs, and notifications.
3. Deleting a user keeps records but clears `created_by`.
4. All statements are idempotent so the migration is safe to re-run.
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','engineer','contractor','architect','family_member','viewer')),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  location text NOT NULL DEFAULT 'Dhoon Shahadda, Feni, Bangladesh',
  project_type text NOT NULL DEFAULT 'Two-storied duplex bungalow',
  phase text NOT NULL DEFAULT 'planning' CHECK (phase IN ('planning','financing','construction','maintenance')),
  plot_area_sqft numeric(10,2) CHECK (plot_area_sqft IS NULL OR plot_area_sqft >= 0),
  total_budget_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_budget_bdt >= 0),
  funds_secured_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (funds_secured_bdt >= 0),
  amount_spent_bdt numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_spent_bdt >= 0),
  construction_progress_pct integer NOT NULL DEFAULT 0 CHECK (construction_progress_pct BETWEEN 0 AND 100),
  start_date date,
  target_completion_date date,
  notes text
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('legal','design','finance','permits','construction','maintenance','other')),
  document_date date,
  file_name text,
  reference_url text,
  notes text
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create','update','delete','status_change','note')),
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  is_read boolean NOT NULL DEFAULT false,
  due_date date
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_created ON activity_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project_read ON notifications(project_id, is_read);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_activity_logs_updated_at ON activity_logs;
CREATE TRIGGER trg_activity_logs_updated_at BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON users, projects, settings, documents, notifications TO anon, authenticated;
GRANT SELECT, INSERT ON activity_logs TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_activity_logs" ON activity_logs;
CREATE POLICY "anon_select_activity_logs" ON activity_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity_logs" ON activity_logs;
CREATE POLICY "anon_insert_activity_logs" ON activity_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

INSERT INTO users (full_name, role, is_active)
SELECT 'Project Owner', 'owner', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner');

INSERT INTO projects (name, location, project_type, phase, notes)
SELECT 'Greenwood Miazi Bari', 'Dhoon Shahadda, Feni, Bangladesh', 'Two-storied duplex bungalow', 'planning',
       'Owner-side project for planning, financing, constructing, and maintaining the duplex bungalow.'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Greenwood Miazi Bari');

INSERT INTO settings (key, value, description) VALUES
  ('currency', '{"code": "BDT", "symbol": "Tk"}'::jsonb, 'Currency used for all money amounts'),
  ('budget_alert_threshold_pct', '{"value": 85}'::jsonb, 'Warn when spending reaches this percent of budget'),
  ('date_format', '{"value": "DD MMM YYYY"}'::jsonb, 'Display format for dates')
ON CONFLICT (key) DO NOTHING;
