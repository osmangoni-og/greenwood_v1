/*
# Create Design Management module

Plain-English summary:
This migration adds the Design Management module, which stores architectural,
structural, electrical, and plumbing drawings for the bungalow. Each drawing
is tracked in a register with an approval status. Drawings support versioned
file uploads (PDF, DWG, JPG, PNG) with revision notes, plus a comments thread
for review feedback. Files are stored in a Supabase Storage bucket.

No AI analysis is performed on the files. The module stores design records only.

## 1. Storage
- Creates a public bucket named `drawings` for uploaded drawing files.
- Adds storage policies so the anon and authenticated roles can read, upload,
  update, and delete objects in the `drawings` bucket. The app has no sign-in,
  so the bucket is intentionally shared.

## 2. New Tables
- `drawings`: the drawing register. One row per logical drawing (e.g. "Ground
  floor plan"). Holds the discipline, drawing number, title, description, and
  approval status.
- `drawing_versions`: a versioned upload for a drawing. Each row stores the file
  name, size, type, storage path, revision label, revision notes, and whether it
  is the current version. Only one version per drawing is current at a time.
- `drawing_comments`: review comments attached to a drawing, optionally pinned
  to a specific version. Comments can be resolved.

All three tables include `id`, `created_at`, `updated_at`, and `created_by`.

## 3. Triggers
- Reuses the existing `set_updated_at()` function for `updated_at` maintenance.

## 4. Security
- Row Level Security enabled on all three new tables.
- The app has no sign-in screen, so policies target `anon` and `authenticated`.
- `drawing_comments` allows SELECT, INSERT, UPDATE, DELETE (comments can be
  resolved or removed).
- Grants and policies follow the same single-tenant pattern as the other tables.

## 5. Important Notes
1. Deleting a drawing cascades to its versions and comments.
2. Deleting a project cascades to its drawings.
3. When a new version is uploaded the app sets `is_current = false` on prior
   versions in the same transaction or immediately after.
4. All statements are idempotent so the migration is safe to re-run.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_select_drawings_storage" ON storage.objects;
CREATE POLICY "anon_select_drawings_storage" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'drawings');

DROP POLICY IF EXISTS "anon_insert_drawings_storage" ON storage.objects;
CREATE POLICY "anon_insert_drawings_storage" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'drawings');

DROP POLICY IF EXISTS "anon_update_drawings_storage" ON storage.objects;
CREATE POLICY "anon_update_drawings_storage" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'drawings') WITH CHECK (bucket_id = 'drawings');

DROP POLICY IF EXISTS "anon_delete_drawings_storage" ON storage.objects;
CREATE POLICY "anon_delete_drawings_storage" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'drawings');

CREATE TABLE IF NOT EXISTS drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number text NOT NULL,
  title text NOT NULL,
  discipline text NOT NULL DEFAULT 'architectural' CHECK (discipline IN ('architectural','structural','electrical','plumbing')),
  approval_status text NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','submitted','under_review','approved','rejected','revision_required')),
  description text
);

CREATE TABLE IF NOT EXISTS drawing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  revision_label text NOT NULL DEFAULT 'Rev A',
  file_name text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL CHECK (file_type IN ('pdf','dwg','jpg','png')),
  storage_path text NOT NULL,
  revision_notes text,
  is_current boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS drawing_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  drawing_version_id uuid REFERENCES drawing_versions(id) ON DELETE SET NULL,
  comment text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drawings_project_number ON drawings(project_id, drawing_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drawing_versions_drawing_version ON drawing_versions(drawing_id, version_number);
CREATE INDEX IF NOT EXISTS idx_drawing_versions_drawing_current ON drawing_versions(drawing_id, is_current);
CREATE INDEX IF NOT EXISTS idx_drawing_comments_drawing_created ON drawing_comments(drawing_id, created_at);
CREATE INDEX IF NOT EXISTS idx_drawings_project_discipline ON drawings(project_id, discipline);

DROP TRIGGER IF EXISTS trg_drawings_updated_at ON drawings;
CREATE TRIGGER trg_drawings_updated_at BEFORE UPDATE ON drawings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_drawing_versions_updated_at ON drawing_versions;
CREATE TRIGGER trg_drawing_versions_updated_at BEFORE UPDATE ON drawing_versions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_drawing_comments_updated_at ON drawing_comments;
CREATE TRIGGER trg_drawing_comments_updated_at BEFORE UPDATE ON drawing_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON drawings, drawing_versions, drawing_comments TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_drawings" ON drawings;
CREATE POLICY "anon_select_drawings" ON drawings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_drawings" ON drawings;
CREATE POLICY "anon_insert_drawings" ON drawings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_drawings" ON drawings;
CREATE POLICY "anon_update_drawings" ON drawings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_drawings" ON drawings;
CREATE POLICY "anon_delete_drawings" ON drawings FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_drawing_versions" ON drawing_versions;
CREATE POLICY "anon_select_drawing_versions" ON drawing_versions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_drawing_versions" ON drawing_versions;
CREATE POLICY "anon_insert_drawing_versions" ON drawing_versions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_drawing_versions" ON drawing_versions;
CREATE POLICY "anon_update_drawing_versions" ON drawing_versions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_drawing_versions" ON drawing_versions;
CREATE POLICY "anon_delete_drawing_versions" ON drawing_versions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_drawing_comments" ON drawing_comments;
CREATE POLICY "anon_select_drawing_comments" ON drawing_comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_drawing_comments" ON drawing_comments;
CREATE POLICY "anon_insert_drawing_comments" ON drawing_comments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_drawing_comments" ON drawing_comments;
CREATE POLICY "anon_update_drawing_comments" ON drawing_comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_drawing_comments" ON drawing_comments;
CREATE POLICY "anon_delete_drawing_comments" ON drawing_comments FOR DELETE TO anon, authenticated USING (true);
