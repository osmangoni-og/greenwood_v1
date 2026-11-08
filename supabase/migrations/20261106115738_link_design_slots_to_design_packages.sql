/*
# Link design comparison slots to design packages

1. Modified Tables
- `designs`: new nullable column `design_package_id` referencing `design_packages(id)`.

2. Behavior
- Existing design rows keep all their data and get a NULL package link until a user assigns one.
- Deleting a design package clears the link on any comparison slot (ON DELETE SET NULL) and never deletes the slot or its registers.

3. Security
- No policy or grant changes; the existing anon/authenticated policies on `designs` cover the new column.

4. Notes
- No data is removed or rewritten.
*/

ALTER TABLE designs ADD COLUMN IF NOT EXISTS design_package_id uuid REFERENCES design_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS designs_design_package_id_idx ON designs (design_package_id);
