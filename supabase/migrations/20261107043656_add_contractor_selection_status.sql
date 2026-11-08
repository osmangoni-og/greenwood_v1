/*
# Add Contractor Selection Status

## Purpose
Adds a per-project contractor selection workflow so exactly one contractor
can be marked as the "Selected" contractor for a project. This replaces the
broken approach of querying contractor_bids for a non-existent 'selected'
bid status.

## Changes

### 1. New columns on `contractors`
- `selection_status` text with CHECK constraint allowing:
  'candidate' (default), 'evaluated', 'selected', 'inactive', 'rejected'
- `selection_date` date, nullable — set when contractor is selected

### 2. Partial unique index
- `contractors_one_selected_per_project` on `(project_id) WHERE selection_status = 'selected'`
  Ensures only ONE contractor per project can have 'selected' status.

### 3. RLS / Grants
- No new policies needed — contractors table already has full CRUD for anon+authenticated.
- UPDATE already granted, which covers the new columns.

### 4. Important notes
- Existing rows default to 'candidate' selection_status.
- The app enforces single-selection by setting the previous selected contractor
  to 'evaluated' before setting the new one to 'selected'. The DB index is a
  safety net.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractors' AND column_name = 'selection_status'
  ) THEN
    ALTER TABLE contractors ADD COLUMN selection_status text NOT NULL DEFAULT 'candidate'
      CHECK (selection_status = ANY (ARRAY['candidate','evaluated','selected','inactive','rejected']));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contractors' AND column_name = 'selection_date'
  ) THEN
    ALTER TABLE contractors ADD COLUMN selection_date date;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS contractors_one_selected_per_project
  ON contractors (project_id) WHERE selection_status = 'selected';
