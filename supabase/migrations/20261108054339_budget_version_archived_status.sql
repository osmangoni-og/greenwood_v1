ALTER TABLE budget_versions DROP CONSTRAINT budget_versions_status_check;
ALTER TABLE budget_versions ADD CONSTRAINT budget_versions_status_check
  CHECK (status IN ('draft', 'approved', 'superseded', 'archived'));
