import { fetchAssets, fetchOffers } from '@/lib/assetMonetization';
import { fetchConstructionPhases, type ConstructionPhaseRow } from '@/lib/constructionTracking';
import { fetchConstructionFinanceSummary } from '@/lib/constructionFinance';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { fetchContracts } from '@/lib/contracts';
import { fetchFinancingBalance } from '@/lib/financing';
import { summarizeFinancials } from '@/lib/finance';
import { fetchLandSaleScores } from '@/lib/landSaleScoring';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchRateTrends } from '@/lib/rates';
import type { FundingSummary } from '@/lib/fundingSummary';
import { supabase, unwrap } from '@/lib/supabase';
import type {
  AssetOfferRow,
  ConstructionCashFlowForecastRow,
  ConstructionFinanceSummaryRow,
  ConstructionFundingSourceRow,
  DocumentRow,
  LandSaleScoreRow,
  MonetizableAssetRow,
  NotificationRow,
  ProjectRow,
  RateTrendSummaryRow,
} from '@/types/database';

export interface OpenDefect {
  id: string;
  description: string;
  location: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress';
  responsible_party: string | null;
  due_date: string | null;
  inspection_type: string;
}

export interface ExecutiveDashboardData {
  project: ProjectRow;
  progressPct: number;
  budget: ReturnType<typeof summarizeFinancials>;
  finance: ConstructionFinanceSummaryRow | null;
  funding: FundingSummary;
  fundingSources: ConstructionFundingSourceRow[];
  cashForecasts: ConstructionCashFlowForecastRow[];
  contractorCommitted: number;
  contractorCount: number;
  vendorBalance: number;
  vendorCommitted: number;
  vendorDeposits: number;
  upcomingDue: NotificationRow[];
  assets: MonetizableAssetRow[];
  assetProgress: { soldCount: number; totalCount: number; soldValue: number; estimatedValue: number };
  highestOffer: { amount: number; assetName: string; buyerName: string; status: AssetOfferRow['status'] } | null;
  landRanking: LandSaleScoreRow[];
  rateTrends: RateTrendSummaryRow[];
  phases: ConstructionPhaseRow[];
  delayedPhases: ConstructionPhaseRow[];
  openDefects: OpenDefect[];
  recentDocuments: DocumentRow[];
  milestones: ConstructionPhaseRow[];
  revisions: BudgetWorkspace['revisions'];
  budgetLines: BudgetWorkspace['lines'];
  versions: BudgetWorkspace['versions'];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchOpenDefects(projectId: string): Promise<OpenDefect[]> {
  const rows = unwrap<
    Array<{
      id: string;
      description: string;
      location: string | null;
      severity: OpenDefect['severity'];
      status: OpenDefect['status'];
      responsible_party: string | null;
      due_date: string | null;
      quality_inspections: { project_id: string; inspection_type: string }[];
    }>
  >(
    await supabase
      .from('quality_defects')
      .select('id, description, location, severity, status, responsible_party, due_date, quality_inspections!inner(project_id, inspection_type)')
      .eq('quality_inspections.project_id', projectId)
      .in('status', ['open', 'in_progress']),
  );
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    location: row.location,
    severity: row.severity,
    status: row.status,
    responsible_party: row.responsible_party,
    due_date: row.due_date,
    inspection_type: row.quality_inspections[0]?.inspection_type ?? '',
  }));
}

async function fetchVendorTotals(projectId: string): Promise<{ committed: number }> {
  const rows = unwrap<{ contract_value_bdt: number }[]>(
    await supabase.from('vendor_contracts').select('contract_value_bdt').eq('project_id', projectId).neq('status', 'terminated'),
  );
  return { committed: rows.reduce((sum, row) => sum + row.contract_value_bdt, 0) };
}

async function fetchRecentDocuments(projectId: string): Promise<DocumentRow[]> {
  return unwrap<DocumentRow[]>(
    await supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
  );
}

async function fetchUpcomingDue(projectId: string): Promise<NotificationRow[]> {
  return unwrap<NotificationRow[]>(
    await supabase
      .from('notifications')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_read', false)
      .gte('due_date', todayIso())
      .order('due_date', { ascending: true })
      .limit(6),
  );
}

function summarizeAssets(assets: MonetizableAssetRow[]) {
  const sold = assets.filter((asset) => asset.status === 'sold');
  return {
    soldCount: sold.length,
    totalCount: assets.length,
    soldValue: sold.reduce((sum, asset) => sum + (asset.sale_value_bdt ?? 0), 0),
    estimatedValue: assets.reduce((sum, asset) => sum + asset.estimated_value_bdt, 0),
  };
}

function findHighestOffer(assets: MonetizableAssetRow[], offers: AssetOfferRow[]): ExecutiveDashboardData['highestOffer'] {
  const live = offers.filter((offer) => offer.status !== 'rejected' && offer.status !== 'expired');
  if (live.length === 0) return null;
  const best = live.reduce((top, offer) => (offer.offer_amount_bdt > top.offer_amount_bdt ? offer : top));
  const asset = assets.find((item) => item.id === best.asset_id);
  return {
    amount: best.offer_amount_bdt,
    assetName: asset?.asset_name ?? 'Unknown asset',
    buyerName: best.buyer_name,
    status: best.status,
  };
}

export async function loadExecutiveDashboard(): Promise<ExecutiveDashboardData | null> {
  const project = await fetchPrimaryProject();
  if (!project) return null;
  const projectId = project.id;

  const workspace = await loadBudgetWorkspace(projectId);

  const [
    phases,
    finance,
    contracts,
    balance,
    vendorTotals,
    upcomingDue,
    assets,
    landRanking,
    rateTrends,
    openDefects,
    recentDocuments,
  ] = await Promise.all([
    fetchConstructionPhases(projectId),
    fetchConstructionFinanceSummary(projectId),
    fetchContracts(projectId),
    fetchFinancingBalance(projectId),
    fetchVendorTotals(projectId),
    fetchUpcomingDue(projectId),
    fetchAssets(projectId),
    fetchLandSaleScores(projectId),
    fetchRateTrends(projectId),
    fetchOpenDefects(projectId),
    fetchRecentDocuments(projectId),
  ]);

  const assetIds = assets.map((asset) => asset.id);
  const offers = await fetchOffers(assetIds);

  const constructionContracts = contracts.filter((contract) => contract.contract_type === 'contractor' || contract.contract_type === 'engineer');
  const delayedPhases = phases.filter((phase) => phase.delays && phase.delays.trim().length > 0);
  const milestones = phases
    .filter((phase) => phase.actual_date === null && phase.planned_date !== null)
    .sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''))
    .slice(0, 6);
  const activeVersion = workspace.versions.find((v) => v.is_active) ?? null;
  const activeLines = activeVersion ? workspace.lines.filter((l) => l.budget_version_id === activeVersion.id) : workspace.lines;

  return {
    project,
    progressPct: project.construction_progress_pct,
    budget: summarizeFinancials(project),
    finance,
    funding: workspace.fundingSummary,
    fundingSources: workspace.fundingSources,
    cashForecasts: workspace.cashForecasts,
    contractorCommitted: constructionContracts.reduce((sum, contract) => sum + (contract.contract_value_bdt ?? 0), 0),
    contractorCount: constructionContracts.length,
    vendorBalance: balance?.net_vendor_balance ?? 0,
    vendorCommitted: vendorTotals.committed,
    vendorDeposits: balance?.total_vendor_deposits ?? 0,
    upcomingDue,
    assets,
    assetProgress: summarizeAssets(assets),
    highestOffer: findHighestOffer(assets, offers),
    landRanking,
    rateTrends,
    phases,
    delayedPhases,
    openDefects,
    recentDocuments,
    milestones,
    revisions: workspace.revisions,
    budgetLines: activeLines,
    versions: workspace.versions,
  };
}
