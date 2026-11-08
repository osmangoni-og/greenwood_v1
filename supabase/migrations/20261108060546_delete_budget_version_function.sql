/*
# Delete budget version (any status) with dependent records

1. New Function
- `delete_budget_version(p_version_id uuid)` physically removes one budget version and everything that belongs to it.

2. What gets removed (in order)
- Contingency allocations linked to the version (budget_contingencies)
- Revision history / budget impact records linked to the version (budget_revisions)
- Budget lines of the version (budget_version_lines)
- The budget version itself (budget_versions)

3. Security
- The function runs as the calling role (SECURITY INVOKER), so existing row level security policies on each table still apply.
- No table grants or policies are changed.

4. Important notes
- Deleting an active budget leaves the project without an active budget until another budget is approved; the app warns before calling this.
- The statements run in one transaction, so a failure leaves nothing half-deleted.
- Raises an error when the version does not exist, so the app can show a visible message.
*/

CREATE OR REPLACE FUNCTION public.delete_budget_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM budget_contingencies WHERE budget_version_id = p_version_id;
  DELETE FROM budget_revisions WHERE budget_version_id = p_version_id;
  DELETE FROM budget_version_lines WHERE budget_version_id = p_version_id;
  DELETE FROM budget_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget version not found';
  END IF;
END;
$function$;
