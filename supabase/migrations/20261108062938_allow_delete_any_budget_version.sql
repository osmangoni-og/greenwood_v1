/*
# Allow deleting any budget version regardless of status

1. Modified Policies
- `budget_versions`: the DELETE policy previously required `status = 'draft' AND NOT is_active`, which blocked deleting Approved, Superseded and Archived versions.
- The new DELETE policy allows deleting any row, matching the single-tenant shared-data pattern used by all other budget tables.
- The application confirms before deleting and records a full activity log entry.

2. Security
- No new tables or columns.
- RLS remains enabled on `budget_versions`.
- DELETE remains granted to `anon` and `authenticated`.
- The policy is `USING (true)` which is correct for this single-tenant, no-auth app where all budget data is intentionally shared.

3. Important notes
- The `delete_budget_version` RPC runs as SECURITY INVOKER, so this policy controls who can delete.
- Budget lines cascade on version delete; revisions and contingencies are removed by the RPC before the version row.
- Policy is dropped and recreated so this migration is safe to re-run.
*/

DROP POLICY IF EXISTS "anon_delete_budget_versions" ON budget_versions;
CREATE POLICY "anon_delete_budget_versions" ON budget_versions FOR DELETE
TO anon, authenticated USING (true);
