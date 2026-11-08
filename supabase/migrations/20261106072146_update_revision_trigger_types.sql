-- Update trigger_type constraint to allow new values
ALTER TABLE budget_revisions DROP CONSTRAINT IF EXISTS budget_revisions_trigger_type_check;
ALTER TABLE budget_revisions ADD CONSTRAINT budget_revisions_trigger_type_check
  CHECK (trigger_type IN ('design_revision','engineer_revision','boq_revision','contractor_revision','vendor_revision','price_escalation','scope_increase','funding_revision','other'));
