import { supabase, unwrap } from '@/lib/supabase';
import { fetchContractors } from '@/lib/contractors';
import { fetchEngineeringData } from '@/lib/engineering';
import { fetchBoqSheets } from '@/lib/boq';
import type { BoqSheetRow, ContractorRow, VendorRow } from '@/types/database';
import type { BudgetVersionRow } from '@/types/database';
import type { DesignPackageRow, DesignPackageStatus, EngineerRow } from '@/types/engineering';

export interface LineageLookup {
  engineers: EngineerRow[];
  packages: DesignPackageRow[];
  boqSheets: BoqSheetRow[];
  contractors: ContractorRow[];
  vendors: VendorRow[];
}

export async function fetchLineageLookup(projectId: string): Promise<LineageLookup> {
  const [eng, boqSheets, contractors, vendorRes] = await Promise.all([
    fetchEngineeringData(projectId),
    fetchBoqSheets(projectId),
    fetchContractors(projectId),
    supabase.from('vendors').select('*').eq('project_id', projectId).order('name'),
  ]);
  return {
    engineers: eng.engineers,
    packages: eng.packages,
    boqSheets,
    contractors,
    vendors: unwrap<VendorRow[]>(vendorRes),
  };
}

export type LineageStatus = 'COMPLETE' | 'PARTIAL' | 'MISSING';

export function getLineageStatus(version: Pick<BudgetVersionRow, 'engineer_id' | 'design_package_id' | 'boq_sheet_id' | 'contractor_id' | 'primary_vendor_id'>): LineageStatus {
  const assigned = [
    version.engineer_id,
    version.design_package_id,
    version.boq_sheet_id,
    version.contractor_id,
    version.primary_vendor_id,
  ].filter(Boolean).length;
  if (assigned === 5) return 'COMPLETE';
  if (assigned === 0) return 'MISSING';
  return 'PARTIAL';
}

export interface LineageDisplay {
  engineerName: string | null;
  packageName: string | null;
  packageStatus: DesignPackageStatus | null;
  hasAcceptedPackage: boolean;
  budgetStatus: BudgetVersionRow['status'];
  budgetIsActive: boolean;
  revisionLabel: string | null;
  boqName: string | null;
  contractorName: string | null;
  vendorName: string | null;
  status: LineageStatus;
  selectedContractorName: string | null;
  selectionDate: string | null;
  selectedCount: number;
  selectedContractorHasRates: boolean;
  engineerHasPackage: boolean;
}

export function buildLineageDisplay(
  version: Pick<BudgetVersionRow, 'status' | 'is_active' | 'engineer_id' | 'design_package_id' | 'boq_sheet_id' | 'contractor_id' | 'primary_vendor_id'>,
  lookup: LineageLookup,
  options?: { selectedContractorHasRates?: boolean },
): LineageDisplay {
  const pkg = version.design_package_id ? lookup.packages.find((p) => p.id === version.design_package_id) ?? null : null;
  const engineer = version.engineer_id ? lookup.engineers.find((e) => e.id === version.engineer_id) ?? null
    : pkg ? lookup.engineers.find((e) => e.id === pkg.engineer_id) ?? null : null;
  const boq = version.boq_sheet_id ? lookup.boqSheets.find((s) => s.id === version.boq_sheet_id) ?? null : null;
  const contractor = version.contractor_id ? lookup.contractors.find((c) => c.id === version.contractor_id) ?? null : null;
  const vendor = version.primary_vendor_id ? lookup.vendors.find((v) => v.id === version.primary_vendor_id) ?? null : null;
  const selected = lookup.contractors.filter((c) => c.selection_status === 'selected');
  const engineerHasPackage = engineer ? lookup.packages.some((p) => p.engineer_id === engineer.id) : false;
  return {
    selectedContractorName: selected[0]?.name ?? null,
    selectionDate: selected[0]?.selection_date ?? null,
    selectedCount: selected.length,
    selectedContractorHasRates: options?.selectedContractorHasRates ?? false,
    engineerHasPackage,
    engineerName: engineer?.name ?? null,
    packageName: pkg?.name ?? null,
    packageStatus: pkg?.status ?? null,
    hasAcceptedPackage: lookup.packages.some((p) => p.status === 'accepted'),
    budgetStatus: version.status,
    budgetIsActive: version.is_active,
    revisionLabel: pkg?.revision_label ?? null,
    boqName: boq?.sheet_name ?? null,
    contractorName: contractor?.name ?? null,
    vendorName: vendor?.name ?? null,
    status: getLineageStatus(version),
  };
}

export interface LineageValidationCheck {
  id: string;
  name: string;
  result: 'PASS' | 'WARNING' | 'FAIL';
  detail: string;
}

export function validateLineage(
  versions: BudgetVersionRow[],
  lookup: LineageLookup,
  drawings: { design_package_id: string | null }[],
  boqSheets: { design_package_id: string | null }[],
): LineageValidationCheck[] {
  const checks: LineageValidationCheck[] = [];
  const packageById = new Map(lookup.packages.map((p) => [p.id, p]));
  const linkedPackages = versions.map((v) => (v.design_package_id ? packageById.get(v.design_package_id) : undefined)).filter((p): p is DesignPackageRow => Boolean(p));
  const unapprovedLinked = linkedPackages.filter((p) => !['approved', 'accepted'].includes(p.status)).length;
  const archivedLinked = linkedPackages.filter((p) => p.status === 'superseded').length;
  const archivedActive = versions.filter((v) => v.status === 'archived' && v.is_active).length;
  checks.push({
    id: 'package_approval',
    name: 'Budget packages approved',
    result: linkedPackages.length === 0 ? 'WARNING' : unapprovedLinked === 0 ? 'PASS' : 'FAIL',
    detail: `${unapprovedLinked} budget-linked packages are not approved or accepted.`,
  });
  checks.push({
    id: 'accepted_package_exists',
    name: 'Accepted Design Package exists',
    result: lookup.packages.length === 0 ? 'WARNING' : lookup.packages.some((p) => p.status === 'accepted') ? 'PASS' : 'FAIL',
    detail: lookup.packages.some((p) => p.status === 'accepted') ? 'An accepted package is set.' : 'No design package has been accepted.',
  });
  checks.push({
    id: 'archived_references',
    name: 'No archived references in use',
    result: archivedLinked === 0 && archivedActive === 0 ? 'PASS' : 'FAIL',
    detail: `${archivedLinked} budgets link to a superseded package, ${archivedActive} archived budgets are still active.`,
  });
  const orphanDrawings = drawings.filter((d) => !d.design_package_id).length;
  checks.push({
    id: 'drawings_to_package',
    name: 'Drawings linked to Design Package',
    result: drawings.length === 0 ? 'WARNING' : orphanDrawings === 0 ? 'PASS' : 'WARNING',
    detail: `${drawings.length} drawings, ${orphanDrawings} without a package assignment.`,
  });
  const orphanBoq = boqSheets.filter((s) => !s.design_package_id).length;
  checks.push({
    id: 'boq_to_package',
    name: 'BOQ linked to Design Package',
    result: boqSheets.length === 0 ? 'WARNING' : orphanBoq === 0 ? 'PASS' : 'WARNING',
    detail: `${boqSheets.length} BOQ sheets, ${orphanBoq} without a package assignment.`,
  });
  const activeVersions = versions.filter((v) => v.is_active);
  const completeVersions = versions.filter((v) => getLineageStatus(v) === 'COMPLETE');
  checks.push({
    id: 'budget_to_engineer',
    name: 'Budget version linked to Engineer',
    result: versions.length === 0 ? 'WARNING' : versions.every((v) => v.engineer_id) ? 'PASS' : 'WARNING',
    detail: `${versions.filter((v) => v.engineer_id).length} of ${versions.length} versions have an engineer.`,
  });
  checks.push({
    id: 'budget_to_package',
    name: 'Budget version linked to Design Package',
    result: versions.length === 0 ? 'WARNING' : versions.every((v) => v.design_package_id) ? 'PASS' : 'WARNING',
    detail: `${versions.filter((v) => v.design_package_id).length} of ${versions.length} versions have a package.`,
  });
  checks.push({
    id: 'budget_to_boq',
    name: 'Budget version linked to BOQ',
    result: versions.length === 0 ? 'WARNING' : versions.every((v) => v.boq_sheet_id) ? 'PASS' : 'WARNING',
    detail: `${versions.filter((v) => v.boq_sheet_id).length} of ${versions.length} versions have a BOQ.`,
  });
  checks.push({
    id: 'budget_to_contractor',
    name: 'Budget version linked to Contractor',
    result: versions.length === 0 ? 'WARNING' : versions.every((v) => v.contractor_id) ? 'PASS' : 'WARNING',
    detail: `${versions.filter((v) => v.contractor_id).length} of ${versions.length} versions have a contractor.`,
  });
  checks.push({
    id: 'budget_to_vendor',
    name: 'Budget version linked to Vendor',
    result: versions.length === 0 ? 'WARNING' : versions.every((v) => v.primary_vendor_id) ? 'PASS' : 'WARNING',
    detail: `${versions.filter((v) => v.primary_vendor_id).length} of ${versions.length} versions have a vendor.`,
  });
  checks.push({
    id: 'budget_lineage_complete',
    name: 'Active Budget Lineage Status',
    result: activeVersions.length === 0 ? 'WARNING' : completeVersions.some((v) => v.is_active) ? 'PASS' : 'FAIL',
    detail: activeVersions.length === 0 ? 'No active budget version.' : `Active version lineage: ${getLineageStatus(activeVersions[0])}.`,
  });
  const packagesWithoutEngineer = lookup.packages.filter((p) => !p.engineer_id).length;
  checks.push({
    id: 'package_without_engineer',
    name: 'Design Package without Engineer',
    result: lookup.packages.length === 0 ? 'WARNING' : packagesWithoutEngineer === 0 ? 'PASS' : 'FAIL',
    detail: `${lookup.packages.length} packages, ${packagesWithoutEngineer} without an engineer.`,
  });
  return checks;
}

export interface LineageWarning {
  key: string;
  label: string;
  active: boolean;
}

export function computeLineageWarnings(display: LineageDisplay): LineageWarning[] {
  return [
    { key: 'no_selected_contractor', label: 'No Contractor Selected', active: display.selectedCount === 0 },
    { key: 'multiple_selected_contractors', label: 'Multiple Contractors Selected', active: display.selectedCount > 1 },
    { key: 'budget_without_contractor', label: 'Budget Without Contractor', active: !display.contractorName },
    { key: 'engineer', label: 'No Engineer Assigned', active: !display.engineerName },
    { key: 'package', label: 'No Design Package', active: !display.packageName },
    { key: 'boq', label: 'No BOQ Linked', active: !display.boqName },
    { key: 'vendor', label: 'No Vendor Selected', active: !display.vendorName },
    { key: 'budget_without_lineage', label: 'Budget Without Lineage', active: display.status === 'MISSING' },
    { key: 'selected_contractor_without_rates', label: 'Selected Contractor Without Rates', active: display.selectedCount > 0 && !display.selectedContractorHasRates },
    { key: 'selected_engineer_without_package', label: 'Selected Engineer Without Package', active: display.engineerName !== null && !display.engineerHasPackage },
    { key: 'package_not_approved', label: 'Design Package Not Approved', active: display.packageStatus !== null && !['approved', 'accepted'].includes(display.packageStatus) },
    { key: 'budget_on_archived_package', label: 'Budget On Archived Package', active: display.packageStatus === 'superseded' },
    { key: 'missing_accepted_package', label: 'No Accepted Design Package', active: !display.hasAcceptedPackage },
    { key: 'archived_budget_referenced', label: 'Archived Budget Still Referenced', active: display.budgetStatus === 'archived' && display.budgetIsActive },
  ];
}

export async function updateBudgetVersionLineage(
  versionId: string,
  lineage: { engineer_id: string | null; design_package_id: string | null; boq_sheet_id: string | null; contractor_id: string | null; primary_vendor_id: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('budget_versions')
    .update({
      engineer_id: lineage.engineer_id,
      design_package_id: lineage.design_package_id,
      boq_sheet_id: lineage.boq_sheet_id,
      contractor_id: lineage.contractor_id,
      primary_vendor_id: lineage.primary_vendor_id,
    })
    .eq('id', versionId);
  if (error) throw new Error(error.message);
}
