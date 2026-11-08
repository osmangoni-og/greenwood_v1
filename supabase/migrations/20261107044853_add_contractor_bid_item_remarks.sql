/*
# Add remarks to contractor bid rate items

1. Modified Table
- `contractor_bid_items`: new optional column `remarks` (text) for notes on each priced element.

2. Security
- No change to row level security or grants; existing policies still apply.

3. Notes
- Existing rate rows are kept; the new column is empty for them.
*/

ALTER TABLE contractor_bid_items ADD COLUMN IF NOT EXISTS remarks text;
