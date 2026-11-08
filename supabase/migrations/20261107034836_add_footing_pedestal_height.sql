/*
# Add pedestal_height_mm to footing_registers

1. Modified Tables
- `footing_registers`: add `pedestal_height_mm` (integer, default 0) so the
  concrete volume formula can include the pedestal volume
  (pedestal_length x pedestal_width x pedestal_height x quantity).
- Existing rows keep working: the column defaults to 0, which adds zero
  pedestal volume and preserves the previous slab-only concrete total.
2. Security
- No RLS or policy changes — `footing_registers` already has full CRUD
  policies for `anon, authenticated` from the original migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'footing_registers' AND column_name = 'pedestal_height_mm'
  ) THEN
    ALTER TABLE footing_registers ADD COLUMN pedestal_height_mm integer NOT NULL DEFAULT 0;
  END IF;
END $$;
