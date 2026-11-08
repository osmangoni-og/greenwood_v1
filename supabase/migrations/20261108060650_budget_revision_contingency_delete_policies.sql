/*
# Allow deleting budget revision and contingency records

Lets a budget version be deleted together with its revision history (budget impact records) and its contingency allocations.

1. Modified Tables
- `budget_revisions`: adds a DELETE policy.
- `budget_contingencies`: adds a DELETE policy.

2. Security
- Both tables already have row level security enabled and DELETE granted to `anon` and `authenticated`, matching the sibling budget tables.
- The new policies follow the same single-tenant pattern: `TO anon, authenticated` with `USING (true)`, because this app has no sign-in and all budget data is shared.
- Existing SELECT and INSERT policies are unchanged.

3. Important notes
- Deleting a budget version removes these rows first, because their foreign keys to budget versions do not cascade.
- Policies are dropped and recreated so this migration is safe to re-run.
*/

DROP POLICY IF EXISTS "anon_delete_budget_revisions" ON budget_revisions;
CREATE POLICY "anon_delete_budget_revisions" ON budget_revisions FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_delete_budget_contingencies" ON budget_contingencies;
CREATE POLICY "anon_delete_budget_contingencies" ON budget_contingencies FOR DELETE
TO anon, authenticated USING (true);
