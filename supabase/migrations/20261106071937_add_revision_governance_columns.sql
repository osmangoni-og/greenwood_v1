-- Add revision governance columns to budget_revisions
ALTER TABLE budget_revisions
  ADD COLUMN IF NOT EXISTS revision_note text,
  ADD COLUMN IF NOT EXISTS impact_description text;

-- Update approve_budget_version to accept trigger_type, revision_note, impact_description
CREATE OR REPLACE FUNCTION approve_budget_version(
  p_version_id uuid,
  p_reason text,
  p_approved_by text,
  p_trigger_type text DEFAULT 'other',
  p_revision_note text DEFAULT NULL,
  p_impact_description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v budget_versions%ROWTYPE;
  v_prev_total numeric;
  v_new_total numeric;
  v_revision_number integer;
  v_snapshot jsonb;
  v_revision_id uuid;
BEGIN
  SELECT * INTO v FROM budget_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget version not found';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft budget versions can be approved';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL OR NULLIF(TRIM(p_approved_by), '') IS NULL THEN
    RAISE EXCEPTION 'A reason and an approver name are required';
  END IF;

  v_new_total := budget_version_total(v.id);
  IF v_new_total <= 0 THEN
    RAISE EXCEPTION 'Budget version has no amounts to approve';
  END IF;

  SELECT budget_version_total(id) INTO v_prev_total FROM budget_versions WHERE project_id = v.project_id AND is_active;
  v_prev_total := COALESCE(v_prev_total, 0);

  UPDATE budget_versions SET is_active = false, status = 'superseded', updated_at = now()
  WHERE project_id = v.project_id AND is_active;

  UPDATE budget_versions
  SET status = 'approved', is_active = true, approved_by = TRIM(p_approved_by), approved_at = now(), updated_at = now()
  WHERE id = v.id;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_revision_number FROM budget_revisions WHERE project_id = v.project_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'level', level, 'category', category, 'phase_key', phase_key,
    'budget_amount_bdt', budget_amount_bdt, 'notes', notes
  )), '[]'::jsonb) INTO v_snapshot
  FROM budget_version_lines WHERE budget_version_id = v.id;

  INSERT INTO budget_revisions (
    project_id, budget_version_id, revision_number, reason, approved_by,
    previous_total_bdt, new_total_bdt, snapshot, trigger_type, revision_note, impact_description
  )
  VALUES (
    v.project_id, v.id, v_revision_number, p_reason, TRIM(p_approved_by),
    v_prev_total, v_new_total, v_snapshot,
    COALESCE(NULLIF(TRIM(p_trigger_type), ''), 'other'),
    NULLIF(TRIM(p_revision_note), ''),
    NULLIF(TRIM(p_impact_description), '')
  )
  RETURNING id INTO v_revision_id;

  RETURN v_revision_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION approve_budget_version(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_budget_version(uuid, text, text, text, text, text) TO anon, authenticated;

-- Grant UPDATE on budget_revisions so trigger_type can be backfilled if needed
GRANT UPDATE ON budget_revisions TO anon, authenticated;
