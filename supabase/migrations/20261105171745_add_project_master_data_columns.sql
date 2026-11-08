/*
# Add Project Master Data Columns

## Purpose
Extends the `projects` table with additional master-data fields needed by the
enhanced Project Profile page. These are owner-editable fields that describe
the project's identity, geographic location, and ownership — none of them are
calculated values.

## Changes
1. New columns on `projects` (all nullable, additive — no existing column is touched):
   - `project_code` (text) — short identifier code for the project
   - `description` (text) — long-form project description
   - `village` (text) — village name
   - `union` (text) — union name
   - `upazila` (text) — upazila name
   - `district` (text) — district name
   - `country` (text) — country name
   - `latitude` (double precision) — GPS latitude
   - `longitude` (double precision) — GPS longitude
   - `owner_name` (text) — name of the project owner

2. Security
   - No new tables — existing RLS policies on `projects` still apply.
   - No grant changes needed — `projects` is already accessible to
     `anon, authenticated` for all CRUD operations.

## Notes
- All columns are nullable so existing rows are unaffected.
- No data is modified or deleted.
- The existing `total_budget_bdt`, `funds_secured_bdt`, `amount_spent_bdt`,
  and `construction_progress_pct` columns remain in the table for backward
  compatibility with existing code, but the Project Profile UI will display
  auto-calculated values from linked modules instead of these stored values.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'project_code') THEN
    ALTER TABLE projects ADD COLUMN project_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'description') THEN
    ALTER TABLE projects ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'village') THEN
    ALTER TABLE projects ADD COLUMN village text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'union') THEN
    ALTER TABLE projects ADD COLUMN "union" text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'upazila') THEN
    ALTER TABLE projects ADD COLUMN upazila text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'district') THEN
    ALTER TABLE projects ADD COLUMN district text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'country') THEN
    ALTER TABLE projects ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'latitude') THEN
    ALTER TABLE projects ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'longitude') THEN
    ALTER TABLE projects ADD COLUMN longitude double precision;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'owner_name') THEN
    ALTER TABLE projects ADD COLUMN owner_name text;
  END IF;
END $$;
