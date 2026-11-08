export const DESIGN_PACKAGE_STATUSES = ['draft', 'submitted', 'selected', 'approved', 'accepted', 'rejected', 'superseded'] as const;
export type DesignPackageStatus = (typeof DESIGN_PACKAGE_STATUSES)[number];

export const DESIGN_PACKAGE_STATUS_LABELS: Record<DesignPackageStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  selected: 'Selected',
  approved: 'Approved',
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

export interface EngineerRow {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  name: string;
  firm: string | null;
  license_number: string | null;
  mobile: string | null;
  email: string | null;
  notes: string | null;
}

export interface DesignPackageRow {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  engineer_id: string;
  name: string;
  revision_label: string;
  status: DesignPackageStatus;
  notes: string | null;
}
