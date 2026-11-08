ALTER TABLE design_packages DROP CONSTRAINT design_packages_status_check;
ALTER TABLE design_packages ADD CONSTRAINT design_packages_status_check
  CHECK (status IN ('draft', 'submitted', 'selected', 'approved', 'accepted', 'rejected', 'superseded'));
