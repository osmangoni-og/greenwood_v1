export const USER_ROLES = ['owner', 'engineer', 'contractor', 'architect', 'family_member', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_PHASES = ['planning', 'financing', 'construction', 'maintenance'] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const DOCUMENT_CATEGORIES = [
  'legal',
  'design',
  'finance',
  'permits',
  'construction',
  'maintenance',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const ACTIVITY_ACTIONS = ['create', 'update', 'delete', 'status_change', 'note'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'error'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UserRow extends BaseRow {
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface ProjectRow extends BaseRow {
  name: string;
  location: string;
  project_type: string;
  phase: ProjectPhase;
  plot_area_sqft: number | null;
  total_budget_bdt: number;
  funds_secured_bdt: number;
  amount_spent_bdt: number;
  construction_progress_pct: number;
  start_date: string | null;
  target_completion_date: string | null;
  notes: string | null;
  project_code: string | null;
  description: string | null;
  village: string | null;
  union: string | null;
  upazila: string | null;
  district: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_name: string | null;
}

export interface SettingRow extends BaseRow {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
}

export interface DocumentRow extends BaseRow {
  project_id: string;
  title: string;
  category: DocumentCategory;
  document_date: string | null;
  file_name: string | null;
  reference_url: string | null;
  notes: string | null;
}

export interface ActivityLogRow extends BaseRow {
  project_id: string | null;
  action: ActivityAction;
  entity_type: string;
  entity_id: string | null;
  summary: string;
}

export interface NotificationRow extends BaseRow {
  project_id: string | null;
  title: string;
  message: string | null;
  severity: NotificationSeverity;
  is_read: boolean;
  due_date: string | null;
}

export const DRAWING_DISCIPLINES = ['architectural', 'structural', 'electrical', 'plumbing'] as const;
export type DrawingDiscipline = (typeof DRAWING_DISCIPLINES)[number];

export const DRAWING_APPROVAL_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'revision_required',
] as const;
export type DrawingApprovalStatus = (typeof DRAWING_APPROVAL_STATUSES)[number];

export const DRAWING_FILE_TYPES = ['pdf', 'dwg', 'jpg', 'png'] as const;
export type DrawingFileType = (typeof DRAWING_FILE_TYPES)[number];

export interface DrawingRow extends BaseRow {
  project_id: string;
  design_package_id: string | null;
  drawing_number: string;
  title: string;
  discipline: DrawingDiscipline;
  approval_status: DrawingApprovalStatus;
  description: string | null;
}

export interface DrawingVersionRow extends BaseRow {
  drawing_id: string;
  version_number: number;
  revision_label: string;
  file_name: string;
  file_size_bytes: number;
  file_type: DrawingFileType;
  storage_path: string;
  revision_notes: string | null;
  is_current: boolean;
}

export interface DrawingCommentRow extends BaseRow {
  drawing_id: string;
  drawing_version_id: string | null;
  comment: string;
  is_resolved: boolean;
}

export const DESIGN_SLOTS = ['A', 'B', 'C'] as const;
export type DesignSlot = (typeof DESIGN_SLOTS)[number];

export interface ComparisonRow extends BaseRow {
  project_id: string;
  name: string;
  description: string | null;
  design_a_label: string;
  design_b_label: string;
  design_c_label: string;
}

export interface DesignRow extends BaseRow {
  comparison_id: string;
  slot: DesignSlot;
  engineer_name: string;
  notes: string | null;
  design_package_id: string | null;
}

export interface ColumnRegisterRow extends BaseRow {
  design_id: string;
  mark: string;
  column_type: string;
  dimensions_mm: string;
  concrete_grade: string;
  height_m: number;
  concrete_volume_cum: number;
  steel_weight_kg: number;
  notes: string | null;
  quantity: number;
  width_mm: number;
  depth_mm: number;
  main_reinforcement: string | null;
  tie_reinforcement: string | null;
  tie_spacing_mm: number;
  tie_spacing_notation: string | null;
  storey_range: string | null;
  clear_cover_mm: number;
}

export interface ColumnReinforcementGroupRow {
  id: string;
  created_at: string;
  column_register_id: string;
  bar_count: number;
  diameter_mm: number;
  sort_order: number;
}

export interface BeamRegisterRow extends BaseRow {
  design_id: string;
  mark: string;
  beam_type: string;
  dimensions_mm: string;
  concrete_grade: string;
  length_m: number;
  concrete_volume_cum: number;
  steel_weight_kg: number;
  notes: string | null;
  quantity: number;
  width_mm: number;
  depth_mm: number;
  storey_range: string | null;
  clear_cover_mm: number;
  main_reinforcement: string | null;
  tie_reinforcement: string | null;
  tie_spacing_mm: number;
  tie_spacing_notation: string | null;
  excavation_volume_cum: number;
}

export interface BeamReinforcementGroupRow {
  id: string;
  created_at: string;
  beam_register_id: string;
  layer: string;
  bar_count: number;
  diameter_mm: number;
  sort_order: number;
}

export interface FootingRegisterRow extends BaseRow {
  design_id: string;
  mark: string;
  footing_type: string;
  dimensions_mm: string;
  depth_m: number;
  concrete_grade: string;
  concrete_volume_cum: number;
  steel_weight_kg: number;
  notes: string | null;
  quantity: number;
  footing_length_mm: number;
  footing_width_mm: number;
  thickness_mm: number;
  foundation_depth_m: number;
  pedestal_length_mm: number;
  pedestal_width_mm: number;
  pedestal_height_mm: number;
  storey_range: string | null;
  clear_cover_mm: number;
  tie_spacing_notation: string | null;
  tie_spacing_mm: number;
  excavation_volume_cum: number;
}

export interface FootingReinforcementGroupRow {
  id: string;
  created_at: string;
  footing_register_id: string;
  layer: string;
  bar_count: number;
  diameter_mm: number;
  sort_order: number;
}

export interface SlabRegisterRow extends BaseRow {
  design_id: string;
  mark: string;
  slab_type: string;
  thickness_mm: number;
  area_sqm: number;
  concrete_grade: string;
  concrete_volume_cum: number;
  steel_weight_kg: number;
  notes: string | null;
  quantity: number;
  storey_range: string | null;
  clear_cover_mm: number;
  tie_spacing_notation: string | null;
  tie_spacing_mm: number;
}

export interface SlabReinforcementGroupRow {
  id: string;
  created_at: string;
  slab_register_id: string;
  layer: string;
  direction: string | null;
  bar_count: number;
  diameter_mm: number;
  length_m: number;
  sort_order: number;
}

export interface RebarRegisterRow extends BaseRow {
  design_id: string;
  mark: string;
  element_type: string;
  bar_diameter_mm: number;
  number_of_bars: number;
  length_per_bar_m: number;
  total_length_m: number;
  unit_weight_kg_per_m: number;
  total_weight_kg: number;
  notes: string | null;
  element_mark: string | null;
  bar_mark: string | null;
  shape_code: string | null;
  remarks: string | null;
  weight_kg: number;
}

export interface DesignBoqItemRow extends BaseRow {
  design_id: string;
  item_description: string;
  unit: string;
  quantity: number;
  unit_rate_bdt: number;
  total_bdt: number;
  notes: string | null;
}

export interface ComparisonSummaryRow {
  design_id: string;
  comparison_id: string;
  slot: string;
  engineer_name: string;
  total_columns: number;
  column_types: number;
  total_beams: number;
  beam_types: number;
  total_footings: number;
  total_slabs: number;
  total_rebar_items: number;
  total_concrete_cum: number;
  total_steel_kg: number;
  boq_total_bdt: number;
  estimated_structural_cost_bdt: number;
}

export const BOQ_CATEGORIES = [
  'Foundation',
  'RCC',
  'Brick Work',
  'Plaster',
  'Electrical',
  'Plumbing',
  'Tiles',
  'Paint',
  'Other',
] as const;
export type BoqCategory = (typeof BOQ_CATEGORIES)[number];

export const BOQ_SHEET_STATUSES = ['draft', 'submitted', 'approved', 'archived'] as const;
export type BoqSheetStatus = (typeof BOQ_SHEET_STATUSES)[number];

export interface BoqSheetRow extends BaseRow {
  project_id: string;
  sheet_name: string;
  source_name: string;
  status: BoqSheetStatus;
  design_package_id: string | null;
  engineer_name: string | null;
  building_area_sft: number;
  file_name: string | null;
  storage_path: string | null;
  notes: string | null;
}

export interface BoqEntryRow extends BaseRow {
  boq_sheet_id: string;
  category: BoqCategory;
  item_description: string;
  unit: string;
  quantity: number;
  unit_rate_bdt: number;
  material_cost_bdt: number;
  labor_cost_bdt: number;
  total_cost_bdt: number;
  notes: string | null;
}

export interface BoqSummaryRow {
  boq_sheet_id: string;
  estimated_cost_bdt: number;
  cost_per_sft_bdt: number;
  material_cost_bdt: number;
  labor_cost_bdt: number;
  material_share_pct: number;
  labor_share_pct: number;
  category: string | null;
  category_cost_bdt: number;
  category_variance_pct: number;
}

export interface BoqVarianceRow {
  metric: string;
  base_value: number;
  compare_value: number;
  variance_value: number;
  variance_pct: number;
}

export const CONTRACTOR_TYPES = ['main', 'engineer', 'electrical', 'plumbing', 'tile', 'paint'] as const;
export type ContractorType = (typeof CONTRACTOR_TYPES)[number];

export const CONTRACTOR_SELECTION_STATUSES = ['candidate', 'evaluated', 'selected', 'inactive', 'rejected'] as const;

export type ContractorSelectionStatus = (typeof CONTRACTOR_SELECTION_STATUSES)[number];

export const CONTRACTOR_SELECTION_LABELS: Record<ContractorSelectionStatus, string> = {
  candidate: 'Candidate',
  evaluated: 'Evaluated',
  selected: 'Selected',
  inactive: 'Inactive',
  rejected: 'Rejected',
};

export const CONTRACTOR_TYPE_LABELS: Record<ContractorType, string> = {
  main: 'Main Contractor',
  engineer: 'Engineer',
  electrical: 'Electrical Contractor',
  plumbing: 'Plumbing Contractor',
  tile: 'Tile Contractor',
  paint: 'Paint Contractor',
};

export const TENDER_STATUSES = ['draft', 'open', 'under_evaluation', 'awarded', 'closed'] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const BID_STATUSES = ['submitted', 'under_review', 'accepted', 'rejected'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const EVALUATION_CRITERIA = [
  'price',
  'quality',
  'experience',
  'labor_availability',
  'references',
  'timeline',
  'risk',
] as const;
export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export const CRITERION_LABELS: Record<EvaluationCriterion, string> = {
  price: 'Price',
  quality: 'Quality',
  experience: 'Experience',
  labor_availability: 'Labor Availability',
  references: 'References',
  timeline: 'Timeline',
  risk: 'Risk',
};

export const CRITERION_WEIGHTS: Record<EvaluationCriterion, number> = {
  price: 25,
  quality: 25,
  experience: 15,
  labor_availability: 10,
  references: 10,
  timeline: 10,
  risk: 5,
};

export interface ContractorRow extends BaseRow {
  project_id: string;
  name: string;
  contractor_type: ContractorType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  years_experience: number;
  license_number: string | null;
  notes: string | null;
  selection_status: ContractorSelectionStatus;
  selection_date: string | null;
}

export interface TenderRow extends BaseRow {
  project_id: string;
  title: string;
  scope_description: string | null;
  tender_type: ContractorType;
  status: TenderStatus;
  closing_date: string | null;
  notes: string | null;
}

export interface ContractorBidItemRow {
  id: string;
  bid_id: string;
  element: string;
  unit: string;
  area: number;
  rate: number;
  amount: number;
  remarks: string | null;
  sort_order: number;
  created_at: string;
}

export const CONTRACTOR_RATE_ELEMENTS = [
  'Foundation',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  'Tinshed',
  'Parapet Terrace',
  'Parapet Roof',
  'Lift Room',
  'Septic Tank',
] as const;

export interface ContractorBidRow extends BaseRow {
  tender_id: string;
  contractor_id: string;
  quotation_amount_bdt: number;
  advance_required_pct: number;
  advance_amount_bdt: number;
  payment_terms: string | null;
  timeline_days: number;
  scope_notes: string | null;
  status: BidStatus;
  notes: string | null;
}

export interface BidScoreRow extends BaseRow {
  bid_id: string;
  criterion: EvaluationCriterion;
  score: number;
  notes: string | null;
}

export interface ContractorRankingRow {
  bid_id: string;
  contractor_id: string;
  contractor_name: string;
  contractor_type: string;
  quotation_amount_bdt: number;
  advance_required_pct: number;
  timeline_days: number;
  price_score: number;
  quality_score: number;
  experience_score: number;
  labor_availability_score: number;
  references_score: number;
  timeline_score: number;
  risk_score: number;
  weighted_total: number;
  rank: number;
}

export const VENDOR_CATEGORIES = [
  'material',
  'rod',
  'cement',
  'brick',
  'sand',
  'stone',
  'electrical',
  'plumbing',
  'tile',
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  material: 'Material Supplier',
  rod: 'Rod Supplier',
  cement: 'Cement Supplier',
  brick: 'Brick Supplier',
  sand: 'Sand Supplier',
  stone: 'Stone Supplier',
  electrical: 'Electrical Supplier',
  plumbing: 'Plumbing Supplier',
  tile: 'Tile Supplier',
};

export const VENDOR_PERFORMANCE_STATUSES = ['unrated', 'poor', 'average', 'good', 'excellent'] as const;
export type VendorPerformanceStatus = (typeof VENDOR_PERFORMANCE_STATUSES)[number];

export const VENDOR_PERFORMANCE_LABELS: Record<VendorPerformanceStatus, string> = {
  unrated: 'Unrated',
  poor: 'Poor',
  average: 'Average',
  good: 'Good',
  excellent: 'Excellent',
};

export const VENDOR_CONTRACT_STATUSES = ['draft', 'active', 'completed', 'terminated'] as const;
export type VendorContractStatus = (typeof VENDOR_CONTRACT_STATUSES)[number];

export const PERFORMANCE_CRITERIA = ['quality', 'delivery', 'pricing', 'responsiveness'] as const;
export type PerformanceCriterion = (typeof PERFORMANCE_CRITERIA)[number];

export const PERFORMANCE_CRITERION_LABELS: Record<PerformanceCriterion, string> = {
  quality: 'Quality',
  delivery: 'Delivery',
  pricing: 'Pricing',
  responsiveness: 'Responsiveness',
};

export const PERFORMANCE_CRITERION_WEIGHTS: Record<PerformanceCriterion, number> = {
  quality: 30,
  delivery: 25,
  pricing: 25,
  responsiveness: 20,
};

export interface VendorRow extends BaseRow {
  project_id: string;
  name: string;
  vendor_category: VendorCategory;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  trade_license_number: string | null;
  nid_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  performance_status: VendorPerformanceStatus;
  notes: string | null;
}

export interface VendorContractRow extends BaseRow {
  vendor_id: string;
  project_id: string;
  contract_title: string;
  scope: string | null;
  contract_value_bdt: number;
  start_date: string | null;
  end_date: string | null;
  status: VendorContractStatus;
  notes: string | null;
}

export interface VendorPerformanceRow extends BaseRow {
  vendor_id: string;
  project_id: string;
  review_date: string;
  quality_score: number;
  delivery_score: number;
  pricing_score: number;
  responsiveness_score: number;
  notes: string | null;
}

export interface VendorScorecardRow {
  vendor_id: string;
  review_count: number;
  avg_quality: number;
  avg_delivery: number;
  avg_pricing: number;
  avg_responsiveness: number;
  overall_score: number;
  rating: string;
}

export const OWNER_DEPOSIT_TYPES = ['initial', 'monthly', 'top_up'] as const;
export type OwnerDepositType = (typeof OWNER_DEPOSIT_TYPES)[number];

export const OWNER_DEPOSIT_TYPE_LABELS: Record<OwnerDepositType, string> = {
  initial: 'Initial Deposit',
  monthly: 'Monthly Deposit',
  top_up: 'Top-up',
};

export const MATERIAL_TYPES = ['rod', 'cement', 'brick', 'sand', 'stone_chips'] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  rod: 'Rod',
  cement: 'Cement',
  brick: 'Brick',
  sand: 'Sand',
  stone_chips: 'Stone Chips',
};

export interface OwnerDepositRow extends BaseRow {
  project_id: string;
  deposit_date: string;
  amount_bdt: number;
  deposit_type: OwnerDepositType;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

export interface VendorDepositRow extends BaseRow {
  project_id: string;
  vendor_id: string | null;
  deposit_date: string;
  amount_bdt: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

export interface MaterialDeliveryRow extends BaseRow {
  project_id: string;
  vendor_id: string | null;
  delivery_date: string;
  material_type: MaterialType;
  quantity: number;
  unit: string;
  unit_rate_bdt: number;
  total_amount_bdt: number;
  invoice_reference: string | null;
  notes: string | null;
}

export interface FinancingBalanceRow {
  project_id: string;
  total_owner_deposits: number;
  total_vendor_deposits: number;
  total_delivery_cost: number;
  net_vendor_balance: number;
  available_funds: number;
}

export const RATE_MATERIAL_TYPES = ['rod', 'cement', 'brick', 'sand', 'stone_chips', 'electrical_items', 'plumbing_items', 'tiles', 'paint'] as const;
export type RateMaterialType = (typeof RATE_MATERIAL_TYPES)[number];

export const RATE_MATERIAL_LABELS: Record<RateMaterialType, string> = {
  rod: 'Rod',
  cement: 'Cement',
  brick: 'Brick',
  sand: 'Sand',
  stone_chips: 'Stone Chips',
  electrical_items: 'Electrical Items',
  plumbing_items: 'Plumbing Items',
  tiles: 'Tiles',
  paint: 'Paint',
};

export const RATE_SOURCE_TYPES = ['purchase', 'market', 'quotation', 'manual'] as const;
export type RateSourceType = (typeof RATE_SOURCE_TYPES)[number];

export interface MaterialRateHistoryRow extends BaseRow {
  project_id: string;
  vendor_id: string | null;
  material_type: RateMaterialType;
  rate_date: string;
  rate_bdt: number;
  unit: string;
  source_type: RateSourceType;
  purchase_reference: string | null;
  notes: string | null;
}

export interface MonthlyMarketSnapshotRow extends BaseRow {
  project_id: string;
  snapshot_month: string;
  material_type: RateMaterialType;
  market_rate_bdt: number;
  unit: string;
  source: string | null;
  notes: string | null;
}

export interface RateTrendSummaryRow {
  material_type: RateMaterialType;
  latest_rate: number;
  latest_unit: string;
  latest_date: string;
  previous_rate: number | null;
  previous_date: string | null;
  change_percent: number | null;
}

export const CONSTRUCTION_FUNDING_TYPES = ['savings', 'salary_contributions', 'house_sales', 'land_sales', 'dps', 'fdr', 'loan', 'family_contribution'] as const;
export type ConstructionFundingType = (typeof CONSTRUCTION_FUNDING_TYPES)[number];
export const CONSTRUCTION_FUNDING_LABELS: Record<ConstructionFundingType, string> = {
  savings: 'Savings',
  salary_contributions: 'Salary Contributions',
  house_sales: 'House Sales',
  land_sales: 'Land Sales',
  dps: 'DPS',
  fdr: 'FDR',
  loan: 'Loan',
  family_contribution: 'Family Contribution',
};
export type ConstructionFundingStatus = 'planned' | 'partial' | 'received' | 'cancelled';
export interface ConstructionFundingSourceRow extends BaseRow {
  project_id: string;
  source_type: ConstructionFundingType;
  source_name: string;
  planned_amount_bdt: number;
  received_amount_bdt: number;
  expected_date: string | null;
  probability_pct: number;
  status: ConstructionFundingStatus;
  notes: string | null;
}
export type FundingDependencyStatus = 'pending' | 'partially_funded' | 'funded' | 'cancelled';
export type FundingRiskLevel = 'low' | 'medium' | 'high';
export interface FundingDependencyRow extends BaseRow {
  project_id: string;
  phase_key: string;
  funding_source_id: string;
  required_amount_bdt: number;
  status: FundingDependencyStatus;
  risk_level: FundingRiskLevel;
  notes: string | null;
}
export interface ConstructionBudgetLineRow extends BaseRow {
  project_id: string;
  category: string;
  budget_amount_bdt: number;
  actual_amount_bdt: number;
  notes: string | null;
}
export interface ConstructionCashFlowForecastRow extends BaseRow {
  project_id: string;
  forecast_month: string;
  expected_inflow_bdt: number;
  expected_outflow_bdt: number;
  notes: string | null;
}
export interface ConstructionFinanceSummaryRow {
  project_id: string;
  planned_funding: number;
  received_funding: number;
  total_budget: number;
  actual_cost: number;
  available_cash: number;
  expected_cash: number;
  funding_gap: number;
  cost_overrun: number;
}

export const BUDGET_LEVELS = [['project', 'Project'], ['construction', 'Construction'], ['material', 'Material'], ['phase', 'Phase'], ['contingency', 'Contingency']] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number][0];
export type BudgetVersionStatus = 'draft' | 'approved' | 'superseded' | 'archived';
export interface BudgetVersionRow { id: string; created_at: string; updated_at: string; project_id: string; version_number: number; version_label: string; status: BudgetVersionStatus; is_active: boolean; approved_by: string | null; approved_at: string | null; notes: string | null; engineer_id: string | null; design_package_id: string | null; boq_sheet_id: string | null; contractor_id: string | null; primary_vendor_id: string | null; }
export interface BudgetVersionLineRow { id: string; created_at: string; budget_version_id: string; project_id: string; level: BudgetLevel; category: string; phase_key: string | null; budget_amount_bdt: number; notes: string | null; }
export const BUDGET_REVISION_TRIGGERS = ['design_revision', 'engineer_revision', 'boq_revision', 'contractor_revision', 'vendor_revision', 'price_escalation', 'scope_increase', 'funding_revision', 'other'] as const;
export type BudgetRevisionTrigger = (typeof BUDGET_REVISION_TRIGGERS)[number];
export const BUDGET_REVISION_TRIGGER_LABELS: Record<BudgetRevisionTrigger, string> = { design_revision: 'Design Revision', engineer_revision: 'Engineer Revision', boq_revision: 'BOQ Revision', contractor_revision: 'Contractor Revision', vendor_revision: 'Vendor Revision', price_escalation: 'Price Escalation', scope_increase: 'Scope Increase', funding_revision: 'Funding Revision', other: 'Other' };
export interface BudgetRevisionRow { id: string; created_at: string; project_id: string; budget_version_id: string; revision_number: number; revision_date: string; reason: string; approved_by: string; previous_total_bdt: number; new_total_bdt: number; snapshot: unknown[]; trigger_type: BudgetRevisionTrigger | null; revision_note: string | null; impact_description: string | null; }
export const CONTINGENCY_CATEGORIES = [['price_escalation', 'Price Escalation'], ['design_changes', 'Design Changes'], ['scope_increase', 'Scope Increase'], ['emergency_costs', 'Emergency Costs'], ['other', 'Other']] as const;
export type ContingencyCategory = (typeof CONTINGENCY_CATEGORIES)[number][0];
export interface BudgetContingencyDrawdownRow { id: string; created_at: string; project_id: string; budget_version_id: string; drawdown_date: string; amount_bdt: number; phase_key: string | null; category: ContingencyCategory; purpose: string; approved_by: string; notes: string | null; }
export interface ContractorPaymentRow { id: string; created_at: string; updated_at: string; project_id: string; contractor_id: string | null; payee_name: string; payment_date: string; category: string; phase_key: string | null; amount_bdt: number; reference: string | null; notes: string | null; }
export interface LaborPaymentRow { id: string; created_at: string; updated_at: string; project_id: string; payment_date: string; worker_group: string; workers_count: number; category: string; phase_key: string | null; amount_bdt: number; notes: string | null; }
export type PurchaseOrderStatus = 'issued' | 'received' | 'cancelled';
export interface PurchaseOrderRow { id: string; created_at: string; updated_at: string; project_id: string; vendor_id: string | null; po_number: string; order_date: string; received_date: string | null; category: string; phase_key: string | null; description: string | null; amount_bdt: number; status: PurchaseOrderStatus; notes: string | null; }
export type CostCommitmentType = 'contractor_contract' | 'vendor_contract' | 'labor_agreement' | 'other';
export interface CostCommitmentRow { id: string; created_at: string; updated_at: string; project_id: string; commitment_type: CostCommitmentType; party_name: string; reference: string | null; category: string; phase_key: string | null; contract_value_bdt: number; outstanding_amount_bdt: number; status: 'active' | 'closed'; notes: string | null; }
export interface ProjectCostActualRow { project_id: string; source_type: string; category: string; phase_key: string; amount_bdt: number; entry_date: string; }
export interface ProjectCostCommittedRow { project_id: string; source_type: string; category: string; phase_key: string; amount_bdt: number; }
export interface SupplierInvoiceRow { id: string; created_at: string; updated_at: string; project_id: string; vendor_id: string | null; purchase_order_id: string | null; invoice_number: string; invoice_date: string; due_date: string | null; amount_bdt: number; notes: string | null; }
export interface SupplierPaymentRow { id: string; created_at: string; project_id: string; supplier_invoice_id: string; payment_date: string; amount_bdt: number; method: string | null; reference: string | null; notes: string | null; }
export interface SupplierInvoiceBalanceRow { supplier_invoice_id: string; project_id: string; vendor_id: string | null; purchase_order_id: string | null; invoice_number: string; invoice_date: string; due_date: string | null; amount_bdt: number; paid_bdt: number; balance_bdt: number; }
export interface MaterialDeliveryLinkRow { id: string; project_id: string; delivery_date: string; material_type: string; total_amount_bdt: number; purchase_order_id: string | null; }

export const ASSET_TYPES = ['existing_house', 'agricultural_land', 'residential_plot', 'commercial_land', 'fdr', 'dps'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const ASSET_TYPE_LABELS: Record<AssetType, string> = { existing_house: 'Existing House', agricultural_land: 'Agricultural Land', residential_plot: 'Residential Plot', commercial_land: 'Commercial Land', fdr: 'FDR', dps: 'DPS' };
export type AssetStatus = 'planned' | 'listed' | 'negotiating' | 'sold' | 'withdrawn';
export interface MonetizableAssetRow extends BaseRow { project_id: string; asset_type: AssetType; asset_name: string; estimated_value_bdt: number; sale_value_bdt: number | null; status: AssetStatus; buyer_name: string | null; buyer_phone: string | null; buyer_email: string | null; buyer_address: string | null; sale_date: string | null; notes: string | null; }
export type AssetOfferStatus = 'received' | 'negotiating' | 'accepted' | 'rejected' | 'expired';
export interface AssetOfferRow extends BaseRow { asset_id: string; buyer_name: string; buyer_phone: string | null; buyer_email: string | null; offer_amount_bdt: number; counter_amount_bdt: number | null; offer_date: string; status: AssetOfferStatus; negotiation_notes: string | null; }
export interface AssetPaymentRow { id: string; created_at: string; created_by: string | null; asset_id: string; offer_id: string | null; payment_amount_bdt: number; payment_date: string; payment_method: string; payment_reference: string | null; transferred_to_finance: boolean; transferred_at: string | null; finance_source_id: string | null; notes: string | null; }

export const LAND_SALE_FACTORS = [
  { key: 'funding_need_score', label: 'Funding Need', group: 'sell', weight: 20, description: 'How urgently the construction project needs cash.' },
  { key: 'market_demand_score', label: 'Market Demand', group: 'sell', weight: 15, description: 'Strength of current buyer interest in this asset.' },
  { key: 'ease_of_sale_score', label: 'Ease of Sale', group: 'sell', weight: 10, description: 'How quickly and simply the asset can be liquidated.' },
  { key: 'appreciation_potential_score', label: 'Appreciation Potential', group: 'hold', weight: 15, description: 'Expected future value growth if kept.' },
  { key: 'ownership_complexity_score', label: 'Ownership Complexity', group: 'hold', weight: 10, description: 'Difficulty of transferring or clearing title.' },
  { key: 'strategic_importance_score', label: 'Strategic Importance', group: 'hold', weight: 15, description: 'Long-term strategic value to the family or project.' },
  { key: 'future_family_use_score', label: 'Future Family Use', group: 'hold', weight: 10, description: 'Likelihood the family will need this asset later.' },
  { key: 'income_potential_score', label: 'Income Potential', group: 'hold', weight: 5, description: 'Rental or recurring income the asset can generate.' },
] as const;

export type LandSaleFactorKey = (typeof LAND_SALE_FACTORS)[number]['key'];

export type LandSaleRecommendation = 'sell_immediately' | 'sell_if_needed' | 'hold' | 'protected_asset';
export const LAND_SALE_RECOMMENDATION_LABELS: Record<LandSaleRecommendation, string> = { sell_immediately: 'Sell Immediately', sell_if_needed: 'Sell If Needed', hold: 'Hold', protected_asset: 'Protected Asset' };

export type ContractType = 'engineer' | 'contractor' | 'supplier' | 'work_order' | 'change_order' | 'completion_certificate' | 'warranty_certificate';
export type ContractLanguage = 'english' | 'bangla' | 'bilingual';
export type ContractStatus = 'draft' | 'issued' | 'signed' | 'active' | 'completed' | 'terminated' | 'expired';
export const CONTRACT_TYPES: { value: ContractType; label: string; shortLabel: string }[] = [
  { value: 'engineer', label: 'Engineer Contract', shortLabel: 'Engineer' },
  { value: 'contractor', label: 'Contractor Contract', shortLabel: 'Contractor' },
  { value: 'supplier', label: 'Supplier Contract', shortLabel: 'Supplier' },
  { value: 'work_order', label: 'Work Order', shortLabel: 'Work Order' },
  { value: 'change_order', label: 'Change Order', shortLabel: 'Change Order' },
  { value: 'completion_certificate', label: 'Completion Certificate', shortLabel: 'Completion' },
  { value: 'warranty_certificate', label: 'Warranty Certificate', shortLabel: 'Warranty' },
];
export interface ContractRow extends BaseRow { project_id: string; contract_number: string | null; contract_type: ContractType; title: string; language: ContractLanguage; status: ContractStatus; party_a_name: string; party_a_role: string; party_a_address: string | null; party_a_phone: string | null; party_a_email: string | null; party_b_name: string; party_b_role: string; party_b_address: string | null; party_b_phone: string | null; party_b_email: string | null; scope_of_work: string | null; contract_value_bdt: number | null; start_date: string | null; end_date: string | null; signed_date: string | null; metadata: Record<string, unknown>; notes: string | null; }
export interface ContractVersionRow { id: string; created_at: string; created_by: string | null; contract_id: string; version_number: number; body: Record<string, unknown>; change_summary: string | null; }

export type DecisionCategory = 'budget' | 'design' | 'vendor' | 'contractor' | 'funding' | 'procurement' | 'quality' | 'construction';
export const DECISION_CATEGORIES: { value: DecisionCategory; label: string }[] = [
  { value: 'budget', label: 'Budget' },
  { value: 'design', label: 'Design' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'funding', label: 'Funding' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'quality', label: 'Quality' },
  { value: 'construction', label: 'Construction' },
];
export type DecisionStatus = 'proposed' | 'approved' | 'rejected' | 'superseded';
export interface ProjectDecisionRow extends BaseRow {
  project_id: string;
  decision_date: string;
  category: DecisionCategory;
  title: string;
  description: string | null;
  reason: string | null;
  alternatives_considered: string | null;
  expected_impact: string | null;
  cost_impact_bdt: number;
  schedule_impact_days: number;
  approved_by: string | null;
  status: DecisionStatus;
  notes: string | null;
}

export interface LandSaleScoreRow extends BaseRow {
  project_id: string;
  asset_id: string | null;
  asset_name: string;
  location: string | null;
  estimated_value_bdt: number | null;
  funding_need_score: number;
  market_demand_score: number;
  appreciation_potential_score: number;
  ease_of_sale_score: number;
  ownership_complexity_score: number;
  strategic_importance_score: number;
  future_family_use_score: number;
  income_potential_score: number;
  sell_pressure: number;
  hold_pressure: number;
  net_signal: number;
  recommendation: LandSaleRecommendation;
  notes: string | null;
}
