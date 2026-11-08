/*
# Fix budget_version_guard to allow archive and restore transitions

1. Problem
- The `budget_version_guard` trigger blocked Approved → Archived because it only allowed Approved → Approved or Approved → Superseded.
- It also blocked Superseded → Archived because it required Superseded to stay Superseded.
- This caused "Approved budget versions cannot return to draft" when archiving an active approved budget.

2. Allowed transitions (BEFORE UPDATE on budget_versions)
- Draft → any (unchanged: drafts are freely editable)
- Approved → Approved, Superseded, Archived (added Archived)
- Superseded → Superseded, Archived (added Archived)
- Archived → Approved (restore), Archived (stay archived)

3. What still cannot happen
- Approved versions still cannot go back to Draft.
- Superseded versions still cannot be reactivated or become Active.
- Approved/Superseded/Archived versions still cannot have project_id, version_number, version_label, notes, approved_by, or approved_at changed.

4. Active budget rule
- The application handles the active budget warning in the UI.
- The trigger does not block archiving an active version; it only sets is_active = false as the application sends.

5. Security
- No table or policy changes. Only the trigger function body is replaced.
- The function is SECURITY INVOKER (default), so RLS still applies.
*/

CREATE OR REPLACE FUNCTION public.budget_version_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.project_id <> OLD.project_id
  OR NEW.version_number <> OLD.version_number
  OR NEW.version_label <> OLD.version_label
  OR NEW.notes IS DISTINCT FROM OLD.notes
  OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
  OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Approved budget versions cannot be edited';
  END IF;

  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'superseded', 'archived') THEN
    RAISE EXCEPTION 'Approved budget versions can only be superseded or archived';
  END IF;

  IF OLD.status = 'superseded' AND NEW.status NOT IN ('superseded', 'archived') THEN
    RAISE EXCEPTION 'Superseded budget versions can only be archived';
  END IF;

  IF OLD.status = 'archived' AND NEW.status NOT IN ('archived', 'approved') THEN
    RAISE EXCEPTION 'Archived budget versions can only be restored to approved';
  END IF;

  IF OLD.status = 'archived' AND NEW.status = 'approved' AND NEW.is_active = true THEN
    -- Restore: deactivate any other active version so only one is active
    UPDATE budget_versions SET is_active = false, updated_at = now()
    WHERE project_id = OLD.project_id AND is_active = true AND id <> OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;
