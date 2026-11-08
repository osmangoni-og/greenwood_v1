import { supabase, unwrap } from '@/lib/supabase';
import { loadBudgetWorkspace } from '@/lib/budget';
import { computeBudgetTotals } from '@/lib/budgetCalculations';
import { calcStructuralCost } from '@/lib/structuralCalculations';
import type { FundingSummary } from '@/lib/fundingSummary';
import { fetchConstructionPhases, type ConstructionPhaseRow } from '@/lib/constructionTracking';
import { fetchFinancingBalance } from '@/lib/financing';
import { fetchAssets, fetchOffers, fetchPayments } from '@/lib/assetMonetization';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchEngineeringData } from '@/lib/engineering';
import { computeAverageRate, fetchLatestBidItems } from '@/lib/contractors';
import { fetchLineageLookup, buildLineageDisplay, type LineageDisplay } from '@/lib/lineage';
import { getBudgetGrowthPct } from '@/lib/comparisonScoring';
import { BUDGET_REVISION_TRIGGER_LABELS, type BudgetRevisionTrigger } from '@/types/database';
import type {
  ProjectRow,
  VendorRow,
} from '@/types/database';

export interface SelectedContractorSummary {
  name: string | null;
  selectionDate: string | null;
  averageRate: number | null;
  contractValue: number | null;
  contractStatus: string | null;
  lowestCompetingBid: number | null;
  potentialSaving: number | null;
}

export interface ProjectProfileSummary {
  project: ProjectRow;
  budget: {
    activeVersionLabel: string | null;
    activeVersionBudget: number;
    revisionCount: number;
    actual: number;
    committed: number;
    forecastFinal: number;
    forecastBasis: string;
  };
  funding: FundingSummary;
  contractor: SelectedContractorSummary;
  vendor: {
    primaryName: string | null;
    vendorBalance: number;
    monthlyDeposit: number;
    openingDeposit: number;
    vendorCount: number;
  };
  landSales: {
    landCount: number;
    totalEstimatedValue: number;
    saleProceeds: number;
    highestOffer: number | null;
  };
  houseSale: {
    valuation: number | null;
    highestOffer: number | null;
    expectedNetProceeds: number | null;
  };
  design: {
    versionCount: number;
    approvedCount: number;
    drawingCount: number;
    boqSheetCount: number;
  };
  documents: {
    total: number;
    contracts: number;
    drawings: number;
    certificates: number;
    invoices: number;
  };
  construction: {
    currentPhase: string | null;
    progressPct: number;
    daysElapsed: number | null;
    daysRemaining: number | null;
  };
  quality: {
    openIssues: number;
    closedIssues: number;
    qualityScore: number;
  };
  lineage: LineageDisplay | null;
  structure: {
    totalColumns: number;
    columnTypes: string[];
    totalConcreteCum: number;
    totalSteelKg: number;
    floorAreaSft: number;
    currentEngineer: string | null;
    currentPackage: string | null;
    totalFootings: number;
    footingTypes: string[];
    totalExcavationCum: number;
    footingConcreteCum: number;
    footingSteelKg: number;
    totalSlabs: number;
    slabAreaSqm: number;
    slabConcreteCum: number;
    slabSteelKg: number;
    totalRebarItems: number;
    rebarWeightKg: number;
    totalBeams: number;
    beamConcreteCum: number;
    beamSteelKg: number;
    structuralCostBdt: number;
    costPerSft: number;
  };
  revisions: {
    count: number;
    lastTrigger: string | null;
    lastDate: string | null;
    budgetGrowthPct: number;
  };
}

export async function fetchSelectedContractor(projectId: string): Promise<SelectedContractorSummary> {
  const contractorResult = await supabase
    .from('contractors')
    .select('id, name, selection_date')
    .eq('project_id', projectId)
    .eq('selection_status', 'selected')
    .maybeSingle();
  if (contractorResult.error) throw new Error(contractorResult.error.message);
  const contractor = contractorResult.data as { id: string; name: string; selection_date: string | null } | null;
  if (!contractor) return { name: null, selectionDate: null, averageRate: null, contractValue: null, contractStatus: null, lowestCompetingBid: null, potentialSaving: null };

  const acceptedBid = await supabase
    .from('contractor_bids')
    .select('quotation_amount_bdt')
    .eq('contractor_id', contractor.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (acceptedBid.error) throw new Error(acceptedBid.error.message);
  const bidAmount = (acceptedBid.data as { quotation_amount_bdt: number } | null)?.quotation_amount_bdt ?? null;

  const contractResult = await supabase
    .from('contracts')
    .select('contract_value_bdt, status')
    .eq('project_id', projectId)
    .eq('contract_type', 'contractor')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contractResult.error) throw new Error(contractResult.error.message);
  const contractValue = (contractResult.data as { contract_value_bdt: number | null } | null)?.contract_value_bdt ?? bidAmount;

  const otherContractorIds = unwrap<{ id: string }[]>(
    await supabase.from('contractors').select('id').eq('project_id', projectId).neq('id', contractor.id),
  ).map((c) => c.id);
  let lowestCompetingBid: number | null = null;
  if (otherContractorIds.length > 0) {
    const competingBids = unwrap<{ quotation_amount_bdt: number }[]>(
      await supabase
        .from('contractor_bids')
        .select('quotation_amount_bdt')
        .in('contractor_id', otherContractorIds),
    );
    lowestCompetingBid = competingBids.length > 0 ? Math.min(...competingBids.map((b) => Number(b.quotation_amount_bdt))) : null;
  }
  const potentialSaving = lowestCompetingBid !== null && contractValue !== null ? lowestCompetingBid - contractValue : null;

  return {
    name: contractor.name,
    selectionDate: contractor.selection_date,
    averageRate: computeAverageRate(await fetchLatestBidItems(contractor.id)),
    contractValue,
    contractStatus: (contractResult.data as { status: string | null } | null)?.status ?? null,
    lowestCompetingBid,
    potentialSaving,
  };
}

async function fetchVendorSummary(projectId: string): Promise<ProjectProfileSummary['vendor']> {
  const vendors = unwrap<VendorRow[]>(await supabase.from('vendors').select('*').eq('project_id', projectId).order('name'));
  const balance = await fetchFinancingBalance(projectId);
  const monthlyResult = await supabase
    .from('owner_deposits')
    .select('amount_bdt')
    .eq('project_id', projectId)
    .eq('deposit_type', 'monthly')
    .order('deposit_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (monthlyResult.error) throw new Error(monthlyResult.error.message);
  const openingResult = await supabase
    .from('owner_deposits')
    .select('amount_bdt')
    .eq('project_id', projectId)
    .eq('deposit_type', 'initial')
    .order('deposit_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (openingResult.error) throw new Error(openingResult.error.message);
  return {
    primaryName: vendors.length > 0 ? vendors[0].name : null,
    vendorBalance: balance?.net_vendor_balance ?? 0,
    monthlyDeposit: (monthlyResult.data as { amount_bdt: number } | null)?.amount_bdt ?? 0,
    openingDeposit: (openingResult.data as { amount_bdt: number } | null)?.amount_bdt ?? 0,
    vendorCount: vendors.length,
  };
}

async function fetchAssetSummary(projectId: string): Promise<{
  land: ProjectProfileSummary['landSales'];
  house: ProjectProfileSummary['houseSale'];
}> {
  const assets = await fetchAssets(projectId);
  const assetIds = assets.map((a) => a.id);
  const offers = assetIds.length > 0 ? await fetchOffers(assetIds) : [];
  const payments = assetIds.length > 0 ? await fetchPayments(assetIds) : [];

  const landAssets = assets.filter((a) => ['agricultural_land', 'residential_plot', 'commercial_land'].includes(a.asset_type));
  const houseAsset = assets.find((a) => a.asset_type === 'existing_house') ?? null;

  const landAssetIds = new Set(landAssets.map((a) => a.id));
  const landOffers = offers.filter((o) => landAssetIds.has(o.asset_id) && o.status !== 'rejected' && o.status !== 'expired');
  const houseOffers = offers.filter((o) => houseAsset && o.asset_id === houseAsset.id && o.status !== 'rejected' && o.status !== 'expired');

  const landPayments = payments.filter((p) => landAssetIds.has(p.asset_id));

  return {
    land: {
      landCount: landAssets.length,
      totalEstimatedValue: landAssets.reduce((s, a) => s + a.estimated_value_bdt, 0),
      saleProceeds: landPayments.reduce((s, p) => s + p.payment_amount_bdt, 0),
      highestOffer: landOffers.length > 0 ? Math.max(...landOffers.map((o) => o.offer_amount_bdt)) : null,
    },
    house: {
      valuation: houseAsset?.estimated_value_bdt ?? null,
      highestOffer: houseOffers.length > 0 ? Math.max(...houseOffers.map((o) => o.offer_amount_bdt)) : null,
      expectedNetProceeds: houseAsset?.sale_value_bdt ?? houseAsset?.estimated_value_bdt ?? null,
    },
  };
}

async function fetchDesignSummary(projectId: string): Promise<ProjectProfileSummary['design']> {
  const drawings = unwrap<{ id: string; approval_status: string }[]>(
    await supabase.from('drawings').select('id, approval_status').eq('project_id', projectId),
  );
  const drawingIds = drawings.map((d) => d.id);
  let versionCount = 0;
  if (drawingIds.length > 0) {
    const versionResult = await supabase.from('drawing_versions').select('id', { count: 'exact', head: true }).in('drawing_id', drawingIds);
    if (versionResult.error) throw new Error(versionResult.error.message);
    versionCount = versionResult.count ?? 0;
  }
  const boqResult = await supabase.from('boq_sheets').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  if (boqResult.error) throw new Error(boqResult.error.message);
  return {
    versionCount,
    approvedCount: drawings.filter((d) => d.approval_status === 'approved').length,
    drawingCount: drawings.length,
    boqSheetCount: boqResult.count ?? 0,
  };
}

async function fetchDocumentSummary(projectId: string): Promise<ProjectProfileSummary['documents']> {
  const docs = unwrap<{ category: string }[]>(await supabase.from('documents').select('category').eq('project_id', projectId));
  return {
    total: docs.length,
    contracts: docs.filter((d) => d.category === 'legal').length,
    drawings: docs.filter((d) => d.category === 'design').length,
    certificates: docs.filter((d) => d.category === 'permits' || d.category === 'maintenance').length,
    invoices: docs.filter((d) => d.category === 'finance').length,
  };
}

async function fetchConstructionSummary(project: ProjectRow, phases: ConstructionPhaseRow[]): Promise<ProjectProfileSummary['construction']> {
  const inProgress = phases.filter((p) => p.progress_percent > 0 && p.progress_percent < 100);
  const currentPhase = inProgress.length > 0 ? inProgress[0].phase_name : phases.find((p) => p.progress_percent === 0)?.phase_name ?? null;
  const today = new Date();
  const startDate = project.start_date ? new Date(project.start_date) : null;
  const targetDate = project.target_completion_date ? new Date(project.target_completion_date) : null;
  const daysElapsed = startDate ? Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / 86400000)) : null;
  const daysRemaining = targetDate ? Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / 86400000)) : null;
  return {
    currentPhase,
    progressPct: project.construction_progress_pct,
    daysElapsed,
    daysRemaining,
  };
}

async function fetchQualitySummary(projectId: string): Promise<ProjectProfileSummary['quality']> {
  const inspections = unwrap<{ id: string }[]>(
    await supabase.from('quality_inspections').select('id').eq('project_id', projectId),
  );
  if (inspections.length === 0) return { openIssues: 0, closedIssues: 0, qualityScore: 100 };
  const inspectionIds = inspections.map((i) => i.id);
  const openResult = await supabase
    .from('quality_defects')
    .select('id', { count: 'exact', head: true })
    .in('inspection_id', inspectionIds)
    .in('status', ['open', 'in_progress']);
  if (openResult.error) throw new Error(openResult.error.message);
  const closedResult = await supabase
    .from('quality_defects')
    .select('id', { count: 'exact', head: true })
    .in('inspection_id', inspectionIds)
    .eq('status', 'resolved');
  if (closedResult.error) throw new Error(closedResult.error.message);
  const openCount = openResult.count ?? 0;
  const closedCount = closedResult.count ?? 0;
  const total = openCount + closedCount;
  const qualityScore = total > 0 ? Math.round((closedCount / total) * 100) : 100;
  return { openIssues: openCount, closedIssues: closedCount, qualityScore };
}

async function fetchColumnSummary(projectId: string, lineage: LineageDisplay | null): Promise<ProjectProfileSummary['structure']> {
  const eng = await fetchEngineeringData(projectId);
  const packageIds = eng.packages.map((p) => p.id);
  const designs = packageIds.length > 0
    ? unwrap<{ id: string }[]>(await supabase.from('designs').select('id').in('design_package_id', packageIds))
    : [];
  const designIds = designs.map((d) => d.id);
  const columns = designIds.length > 0
    ? unwrap<{ quantity: number; column_type: string; concrete_volume_cum: number; steel_weight_kg: number }[]>(
        await supabase.from('column_registers').select('quantity, column_type, concrete_volume_cum, steel_weight_kg').in('design_id', designIds),
      )
    : [];
  const footings = designIds.length > 0
    ? unwrap<{ quantity: number; footing_type: string; concrete_volume_cum: number; steel_weight_kg: number; excavation_volume_cum: number }[]>(
        await supabase.from('footing_registers').select('quantity, footing_type, concrete_volume_cum, steel_weight_kg, excavation_volume_cum').in('design_id', designIds),
      )
    : [];
  const slabs = designIds.length > 0
    ? unwrap<{ quantity: number; slab_type: string; area_sqm: number; concrete_volume_cum: number; steel_weight_kg: number }[]>(
        await supabase.from('slab_registers').select('quantity, slab_type, area_sqm, concrete_volume_cum, steel_weight_kg').in('design_id', designIds),
      )
    : [];
  const rebars = designIds.length > 0
    ? unwrap<{ total_weight_kg: number; weight_kg: number }[]>(
        await supabase.from('rebar_registers').select('total_weight_kg, weight_kg').in('design_id', designIds),
      )
    : [];
  const beams = designIds.length > 0
    ? unwrap<{ quantity: number; concrete_volume_cum: number; steel_weight_kg: number }[]>(
        await supabase.from('beam_registers').select('quantity, concrete_volume_cum, steel_weight_kg').in('design_id', designIds),
      )
    : [];
  const boqSheets = packageIds.length > 0
    ? unwrap<{ building_area_sft: number }[]>(
        await supabase.from('boq_sheets').select('building_area_sft').in('design_package_id', packageIds),
      )
    : [];
  const floorAreaSft = boqSheets.reduce((s, b) => s + Number(b.building_area_sft), 0);
  const totalConcrete = columns.reduce((s, c) => s + Number(c.concrete_volume_cum), 0) + beams.reduce((s, b) => s + Number(b.concrete_volume_cum), 0) + footings.reduce((s, f) => s + Number(f.concrete_volume_cum), 0) + slabs.reduce((s, sl) => s + Number(sl.concrete_volume_cum), 0);
  const totalSteel = columns.reduce((s, c) => s + Number(c.steel_weight_kg), 0) + beams.reduce((s, b) => s + Number(b.steel_weight_kg), 0) + footings.reduce((s, f) => s + Number(f.steel_weight_kg), 0) + slabs.reduce((s, sl) => s + Number(sl.steel_weight_kg), 0) + rebars.reduce((s, r) => s + Number(r.total_weight_kg ?? r.weight_kg ?? 0), 0);
  const totalExcavation = footings.reduce((s, f) => s + Number(f.excavation_volume_cum), 0);
  const structuralCostBdt = calcStructuralCost(totalConcrete, totalSteel, totalExcavation);
  return {
    totalColumns: columns.reduce((s, c) => s + Number(c.quantity), 0),
    columnTypes: Array.from(new Set(columns.map((c) => c.column_type.trim()).filter(Boolean))),
    totalConcreteCum: columns.reduce((s, c) => s + Number(c.concrete_volume_cum), 0),
    totalSteelKg: columns.reduce((s, c) => s + Number(c.steel_weight_kg), 0),
    floorAreaSft,
    currentEngineer: lineage?.engineerName ?? null,
    currentPackage: lineage?.packageName ?? null,
    totalFootings: footings.reduce((s, f) => s + Number(f.quantity), 0),
    footingTypes: Array.from(new Set(footings.map((f) => f.footing_type.trim()).filter(Boolean))),
    totalExcavationCum: totalExcavation,
    footingConcreteCum: footings.reduce((s, f) => s + Number(f.concrete_volume_cum), 0),
    footingSteelKg: footings.reduce((s, f) => s + Number(f.steel_weight_kg), 0),
    totalSlabs: slabs.reduce((s, sl) => s + Number(sl.quantity), 0),
    slabAreaSqm: slabs.reduce((s, sl) => s + Number(sl.area_sqm) * Number(sl.quantity), 0),
    slabConcreteCum: slabs.reduce((s, sl) => s + Number(sl.concrete_volume_cum), 0),
    slabSteelKg: slabs.reduce((s, sl) => s + Number(sl.steel_weight_kg), 0),
    totalRebarItems: rebars.length,
    rebarWeightKg: rebars.reduce((s, r) => s + Number(r.total_weight_kg ?? r.weight_kg ?? 0), 0),
    totalBeams: beams.reduce((s, b) => s + Number(b.quantity), 0),
    beamConcreteCum: beams.reduce((s, b) => s + Number(b.concrete_volume_cum), 0),
    beamSteelKg: beams.reduce((s, b) => s + Number(b.steel_weight_kg), 0),
    structuralCostBdt,
    costPerSft: floorAreaSft > 0 ? structuralCostBdt / floorAreaSft : 0,
  };
}

export async function loadProjectProfile(): Promise<ProjectProfileSummary | null> {
  const project = await fetchPrimaryProject();
  if (!project) return null;

  const workspace = await loadBudgetWorkspace(project.id);
  const phases = await fetchConstructionPhases(project.id);

  const [contractor, vendor, assetSummary, design, documents, quality] = await Promise.all([
    fetchSelectedContractor(project.id),
    fetchVendorSummary(project.id),
    fetchAssetSummary(project.id),
    fetchDesignSummary(project.id),
    fetchDocumentSummary(project.id),
    fetchQualitySummary(project.id),
  ]);

  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const funding = workspace.fundingSummary;

  const construction = await fetchConstructionSummary(project, phases);

  const lineageLookup = await fetchLineageLookup(project.id);
  const activeVersion = workspace.versions.find((v) => v.is_active) ?? null;
  const selectedContractorRates = lineageLookup.contractors.find((c) => c.selection_status === 'selected');
  const selectedContractorHasRates = selectedContractorRates ? (await fetchLatestBidItems(selectedContractorRates.id)).length > 0 : false;
  const lineage = activeVersion ? buildLineageDisplay(activeVersion, lineageLookup, { selectedContractorHasRates }) : null;
  const structure = await fetchColumnSummary(project.id, lineage);

  const revCount = workspace.revisions.length;
  const lastRev = workspace.revisions[0] ?? null;
  const budgetGrowthPct = getBudgetGrowthPct(workspace.revisions);

  return {
    project,
    lineage,
    structure,
    revisions: {
      count: revCount,
      lastTrigger: lastRev?.trigger_type ? BUDGET_REVISION_TRIGGER_LABELS[lastRev.trigger_type as BudgetRevisionTrigger] ?? lastRev.trigger_type : null,
      lastDate: lastRev?.revision_date ?? null,
      budgetGrowthPct,
    },
    budget: {
      activeVersionLabel: active?.version_label ?? null,
      activeVersionBudget: totals.budget,
      revisionCount: workspace.revisions.filter((r) => active && r.budget_version_id === active.id).length,
      actual: totals.actual,
      committed: totals.committed,
      forecastFinal: totals.forecastFinal,
      forecastBasis: totals.forecastBasis,
    },
    funding,
    contractor,
    vendor,
    landSales: assetSummary.land,
    houseSale: assetSummary.house,
    design,
    documents,
    construction,
    quality,
  };
}
