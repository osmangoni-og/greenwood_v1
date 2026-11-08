import { supabase } from '@/lib/supabase';
import type { ModuleId } from '@/lib/modules';

type CountTable =
  | 'budget_versions'
  | 'construction_funding_sources'
  | 'monetizable_assets'
  | 'land_sale_scores'
  | 'contractors'
  | 'vendors'
  | 'drawings'
  | 'boq_sheets'
  | 'construction_budget_lines'
  | 'construction_phases';

export interface DataEntryItem {
  key: string;
  title: string;
  description: string;
  moduleId: ModuleId;
  count: number;
  target: number;
  percent: number;
}

const LAND_ASSET_TYPES = ['agricultural_land', 'residential_plot', 'commercial_land'];

async function countRows(table: CountTable, projectId: string, assetTypes?: string[]): Promise<number> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  if (assetTypes) query = query.in('asset_type', assetTypes);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

function toItem(base: Omit<DataEntryItem, 'percent'>): DataEntryItem {
  const percent = base.target > 0 ? Math.min(100, Math.round((base.count / base.target) * 100)) : 0;
  return { ...base, percent };
}

export async function loadDataEntryReadiness(projectId: string): Promise<DataEntryItem[]> {
  const [budgetVersions, fundingSources, houseAssets, landAssets, landScores, contractors, vendors, drawings, boqSheets, phaseCount, phaseBudgetLines] = await Promise.all([
    countRows('budget_versions', projectId),
    countRows('construction_funding_sources', projectId),
    countRows('monetizable_assets', projectId, ['existing_house']),
    countRows('monetizable_assets', projectId, LAND_ASSET_TYPES),
    countRows('land_sale_scores', projectId),
    countRows('contractors', projectId),
    countRows('vendors', projectId),
    countRows('drawings', projectId),
    countRows('boq_sheets', projectId),
    countRows('construction_phases', projectId),
    countRows('construction_budget_lines', projectId),
  ]);

  return [
    toItem({ key: 'budget_v1', title: 'Budget V1', description: 'Create the first approved budget version with its cost lines.', moduleId: 'budget_management', count: budgetVersions, target: 1 }),
    toItem({ key: 'funding_sources', title: 'Funding Sources', description: 'Record savings, family contributions, loans and other money sources.', moduleId: 'construction_finance', count: fundingSources, target: 1 }),
    toItem({ key: 'house_sale', title: 'Existing House Sale', description: 'Register the existing house as a monetizable asset with its offers.', moduleId: 'asset_monetization', count: houseAssets, target: 1 }),
    toItem({ key: 'land_register', title: 'Land Register', description: 'Register each land plot that may be sold or used for funding.', moduleId: 'asset_monetization', count: landAssets, target: 1 }),
    toItem({ key: 'land_sale_opportunities', title: 'Land Sale Opportunities', description: 'Score each land plot to produce the sale priority ranking.', moduleId: 'asset_monetization', count: landScores, target: 1 }),
    toItem({ key: 'contractor_selection', title: 'Contractor Selection', description: 'Add contractors and their evaluated bids.', moduleId: 'contractors', count: contractors, target: 1 }),
    toItem({ key: 'material_vendors', title: 'Material Vendor Setup', description: 'Add material suppliers and vendors used for purchasing.', moduleId: 'vendors', count: vendors, target: 1 }),
    toItem({ key: 'design_versions', title: 'Design Version Setup', description: 'Upload at least one design drawing to start version tracking.', moduleId: 'design', count: drawings, target: 1 }),
    toItem({ key: 'boq_entry', title: 'BOQ Entry', description: 'Create a bill of quantities sheet and enter its items.', moduleId: 'boq', count: boqSheets, target: 1 }),
    toItem({ key: 'phase_budgets', title: 'Construction Phase Budgets', description: 'Assign a budget line to each construction phase.', moduleId: 'budget_management', count: phaseBudgetLines, target: Math.max(1, phaseCount) }),
  ];
}
