import { useState } from 'react';
import { ArrowLeft, GitCompare, Trophy, Lightbulb, ShieldCheck, Scale } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchEngineeringData, applyDesignPackageAction, getAvailablePackageActions, type PackageAction } from '@/lib/engineering';
import { Button } from '@/components/Button';
import { fetchBoqSheets } from '@/lib/boq';
import { supabase, unwrap } from '@/lib/supabase';
import { scorePackage, generateRecommendations, resolvePackageEngineer, CONSTRUCTABILITY_TONE, RISK_TONE, RECOMMENDATION_LABELS, type PackageComparisonResult, type RecommendationResult } from '@/lib/comparisonScoring';
import { STRUCTURAL_RATES, calcStructuralCost } from '@/lib/structuralCalculations';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';
import type { DesignPackageRow, DesignPackageStatus, EngineerRow } from '@/types/engineering';
import type { ComparisonSummaryRow, ProjectRow, BoqSheetRow } from '@/types/database';

interface PackageComparisonData {
  project: ProjectRow;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  boqSheets: BoqSheetRow[];
  summaries: Record<string, ComparisonSummaryRow>;
  brickQuantities: Record<string, number>;
  roofAreas: Record<string, number>;
  columnTotals: Record<string, { concrete: number; steel: number; types: string[] }>;
  footingTotals: Record<string, { count: number; excavation: number; concrete: number; steel: number; types: string[] }>;
  slabTotals: Record<string, { count: number; area: number; concrete: number; steel: number; types: string[] }>;
  rebarTotals: Record<string, { count: number; weight: number }>;
}

interface SlabAgg {
  design_id: string;
  count: number;
  types: Set<string>;
  concrete: number;
  steel: number;
  area: number;
}

interface FootingAgg {
  design_id: string;
  count: number;
  types: Set<string>;
  concrete: number;
  steel: number;
  excavation: number;
}

interface DesignAgg {
  id: string;
  slot: string;
  engineer_name: string;
}

interface RegisterAgg {
  design_id: string;
  count: number;
  types: Set<string>;
  concrete: number;
  steel: number;
}

interface BoqAgg {
  design_id: string;
  total_bdt: number;
}

const CONCRETE_RATE = STRUCTURAL_RATES.concrete;
const STEEL_RATE = STRUCTURAL_RATES.steel;

async function aggregateRegister(table: string, designIds: string[]): Promise<RegisterAgg[]> {
  if (designIds.length === 0) return [];
  const { data, error } = await supabase.from(table).select('*').in('design_id', designIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const map = new Map<string, RegisterAgg>();
  for (const row of rows) {
    const did = row.design_id as string;
    const existing = map.get(did) ?? { design_id: did, count: 0, types: new Set<string>(), concrete: 0, steel: 0 };
    existing.count += Number(row.quantity ?? 1);
    existing.concrete += Number(row.concrete_volume_cum ?? 0);
    existing.steel += Number(row.steel_weight_kg ?? 0);
    const type = (row.column_type ?? row.beam_type ?? '') as string;
    if (type) existing.types.add(type);
    map.set(did, existing);
  }
  return Array.from(map.values());
}

async function aggregateFootingRegister(designIds: string[]): Promise<FootingAgg[]> {
  if (designIds.length === 0) return [];
  const { data, error } = await supabase.from('footing_registers').select('*').in('design_id', designIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const map = new Map<string, FootingAgg>();
  for (const row of rows) {
    const did = row.design_id as string;
    const existing = map.get(did) ?? { design_id: did, count: 0, types: new Set<string>(), concrete: 0, steel: 0, excavation: 0 };
    existing.count += Number(row.quantity ?? 1);
    existing.concrete += Number(row.concrete_volume_cum ?? 0);
    existing.steel += Number(row.steel_weight_kg ?? 0);
    existing.excavation += Number(row.excavation_volume_cum ?? 0);
    const type = String(row.footing_type ?? '').trim();
    if (type) existing.types.add(type);
    map.set(did, existing);
  }
  return Array.from(map.values());
}

async function aggregateSlabRegister(designIds: string[]): Promise<SlabAgg[]> {
  if (designIds.length === 0) return [];
  const { data, error } = await supabase.from('slab_registers').select('*').in('design_id', designIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const map = new Map<string, SlabAgg>();
  for (const row of rows) {
    const did = row.design_id as string;
    const existing = map.get(did) ?? { design_id: did, count: 0, types: new Set<string>(), concrete: 0, steel: 0, area: 0 };
    existing.count += Number(row.quantity ?? 1);
    existing.concrete += Number(row.concrete_volume_cum ?? 0);
    existing.steel += Number(row.steel_weight_kg ?? 0);
    existing.area += Number(row.area_sqm ?? 0) * Number(row.quantity ?? 1);
    const type = String(row.slab_type ?? '').trim();
    if (type) existing.types.add(type);
    map.set(did, existing);
  }
  return Array.from(map.values());
}

async function loadPackageComparison(): Promise<PackageComparisonData | null> {
  const project = await fetchPrimaryProject();
  if (!project) return null;
  const [eng, boqSheets] = await Promise.all([
    fetchEngineeringData(project.id),
    fetchBoqSheets(project.id),
  ]);

  const summaries: Record<string, ComparisonSummaryRow> = {};
  const brickQuantities: Record<string, number> = {};
  const roofAreas: Record<string, number> = {};
  const columnTotals: PackageComparisonData['columnTotals'] = {};
  const footingTotals: PackageComparisonData['footingTotals'] = {};
  const slabTotals: PackageComparisonData['slabTotals'] = {};
  const rebarTotals: PackageComparisonData['rebarTotals'] = {};

  for (const pkg of eng.packages) {
    const designs = unwrap<DesignAgg[]>(
      await supabase.from('designs').select('id, slot, engineer_name').eq('design_package_id', pkg.id),
    );
    if (designs.length === 0) continue;
    const designIds = designs.map((d) => d.id);

    const [cols, beams, footingAggs, slabAggs, rebars, boqs, brickItems, roofSlabs] = await Promise.all([
      aggregateRegister('column_registers', designIds),
      aggregateRegister('beam_registers', designIds),
      aggregateFootingRegister(designIds),
      aggregateSlabRegister(designIds),
      supabase.from('rebar_registers').select('design_id, total_weight_kg, weight_kg').in('design_id', designIds),
      supabase.from('design_boq_items').select('design_id, total_bdt').in('design_id', designIds),
      supabase.from('design_boq_items').select('quantity, design_id').in('design_id', designIds).ilike('item_description', '%brick%'),
      supabase.from('slab_registers').select('area_sqm, design_id').in('design_id', designIds).ilike('slab_type', '%roof%'),
    ]);

    const rebarRows = (rebars.data ?? []) as { design_id: string; total_weight_kg: number; weight_kg: number }[];
    const rebarWeight = rebarRows.reduce((s, r) => s + Number(r.total_weight_kg ?? r.weight_kg ?? 0), 0);
    const boqRows = (boqs.data ?? []) as BoqAgg[];
    const brickRows = (brickItems.data ?? []) as { quantity: number; design_id: string }[];
    const roofRows = (roofSlabs.data ?? []) as { area_sqm: number; design_id: string }[];

    const totalColumns = cols.reduce((s, r) => s + r.count, 0);
    const columnTypes = new Set(cols.flatMap((r) => Array.from(r.types)));
    const totalBeams = beams.reduce((s, r) => s + r.count, 0);
    const beamTypes = new Set(beams.flatMap((r) => Array.from(r.types)));
    const totalFootings = footingAggs.reduce((s, r) => s + r.count, 0);
    const footingTypes = new Set(footingAggs.flatMap((r) => Array.from(r.types)));
    const totalSlabs = slabAggs.reduce((s, r) => s + r.count, 0);
    const slabTypes = new Set(slabAggs.flatMap((r) => Array.from(r.types)));
    const slabArea = slabAggs.reduce((s, r) => s + r.area, 0);
    const slabConcrete = slabAggs.reduce((s, r) => s + r.concrete, 0);
    const slabSteel = slabAggs.reduce((s, r) => s + r.steel, 0);
    const totalRebar = rebarRows.length;
    const footingConcrete = footingAggs.reduce((s, r) => s + r.concrete, 0);
    const footingSteel = footingAggs.reduce((s, r) => s + r.steel, 0);
    const footingExcavation = footingAggs.reduce((s, r) => s + r.excavation, 0);
    const totalConcrete = cols.reduce((s, r) => s + r.concrete, 0) + beams.reduce((s, r) => s + r.concrete, 0) + footingConcrete + slabConcrete;
    const totalSteel = cols.reduce((s, r) => s + r.steel, 0) + beams.reduce((s, r) => s + r.steel, 0) + footingSteel + slabSteel + rebarWeight;
    rebarTotals[pkg.id] = {
      count: totalRebar,
      weight: rebarWeight,
    };
    footingTotals[pkg.id] = {
      count: totalFootings,
      excavation: footingExcavation,
      concrete: footingConcrete,
      steel: footingSteel,
      types: Array.from(footingTypes),
    };
    slabTotals[pkg.id] = {
      count: totalSlabs,
      area: slabArea,
      concrete: slabConcrete,
      steel: slabSteel,
      types: Array.from(slabTypes),
    };
    columnTotals[pkg.id] = {
      concrete: cols.reduce((s, r) => s + r.concrete, 0),
      steel: cols.reduce((s, r) => s + r.steel, 0),
      types: Array.from(columnTypes),
    };
    const boqTotal = boqRows.reduce((s, r) => s + Number(r.total_bdt ?? 0), 0);
    const estimatedCost = boqTotal > 0 ? boqTotal : (totalConcrete * CONCRETE_RATE + totalSteel * STEEL_RATE);

    const firstDesign = designs[0];
    summaries[pkg.id] = {
      design_id: firstDesign.id,
      comparison_id: '',
      slot: firstDesign.slot,
      engineer_name: firstDesign.engineer_name,
      total_columns: totalColumns,
      column_types: columnTypes.size,
      total_beams: totalBeams,
      beam_types: beamTypes.size,
      total_footings: totalFootings,
      total_slabs: totalSlabs,
      total_rebar_items: totalRebar,
      total_concrete_cum: totalConcrete,
      total_steel_kg: totalSteel,
      boq_total_bdt: boqTotal,
      estimated_structural_cost_bdt: estimatedCost,
    };

    brickQuantities[pkg.id] = brickRows.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    roofAreas[pkg.id] = roofRows.reduce((s, r) => s + Number(r.area_sqm ?? 0), 0) * 10.7639;
  }

  return { project, packages: eng.packages, engineers: eng.engineers, boqSheets, summaries, brickQuantities, roofAreas, columnTotals, footingTotals, slabTotals, rebarTotals };
}

const STATUS_TONE: Record<string, BadgeTone> = { approved: 'success', accepted: 'success', selected: 'primary', submitted: 'info', draft: 'warning', rejected: 'error', superseded: 'neutral' };
const PACKAGE_ACTION_LABELS: Record<PackageAction, string> = { select: 'Select', approve: 'Approve', accept: 'Accept', reject: 'Reject' };

export function PackageComparisonPanel() {
  const { data, error, loading, reload } = useAsyncData(loadPackageComparison);
  const [selectedIds, setSelectedIds] = useState<[string | null, string | null]>([null, null]);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runPackageAction(pkg: DesignPackageRow, action: PackageAction) {
    if (!data) return;
    setActionBusyKey(`${pkg.id}:${action}`);
    setActionError(null);
    try {
      await applyDesignPackageAction(data.project.id, pkg, action);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The package could not be updated.');
    } finally {
      setActionBusyKey(null);
    }
  }

  if (loading && !data) return <LoadingState label="Loading design packages..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState icon={GitCompare} title="No project" description="Create a project first to compare design packages." />;
  if (data.packages.length < 2) {
    return (
      <Card>
        <CardHeader title="Package-based comparison" description="Compare design packages side by side: constructability, risk, cost, and recommendations." />
        <div className="mt-6">
          <EmptyState icon={GitCompare} title="Need at least 2 design packages" description="Create multiple design packages with structural data to enable comparison." />
        </div>
      </Card>
    );
  }

  const results: PackageComparisonResult[] = [];
  for (const pkg of data.packages) {
    const summary = data.summaries[pkg.id];
    if (!summary) continue;
    const boqSheet = data.boqSheets.find((b) => b.design_package_id === pkg.id);
    results.push(scorePackage({
      packageId: pkg.id,
      packageName: pkg.name,
      revisionLabel: pkg.revision_label,
      status: pkg.status,
      engineerName: resolvePackageEngineer(pkg, data.engineers),
      summary,
      buildingAreaSft: boqSheet?.building_area_sft ?? 0,
      brickQty: data.brickQuantities[pkg.id] ?? 0,
      roofAreaSft: data.roofAreas[pkg.id] ?? 0,
    }));
  }

  const recs = generateRecommendations(results);
  const [selA, selB] = selectedIds;
  const resultA = results.find((r) => r.packageId === selA);
  const resultB = results.find((r) => r.packageId === selB);

  return (
    <Card>
      <CardHeader title="Package-based comparison" description="Compare design packages by constructability, risk, cost, and get recommendations." />
      <div className="mt-6 space-y-6">
        {results.length === 0 ? (
          <EmptyState icon={GitCompare} title="No structural data yet" description="Add structural registers to design packages to generate comparison scores." />
        ) : (
          <>
            {actionError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 font-medium">Engineer</th>
                    <th className="py-2 pr-4 font-medium">Revision</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete (cum)</th>
                    <th className="py-2 pr-4 text-right font-medium">Brick qty</th>
                    <th className="py-2 pr-4 text-right font-medium">Floor area (sft)</th>
                    <th className="py-2 pr-4 text-right font-medium">Roof area (sft)</th>
                    <th className="py-2 pr-4 text-right font-medium">Components</th>
                    <th className="py-2 pr-4 text-right font-medium">Est. cost</th>
                    <th className="py-2 pr-4 text-right font-medium">Cost/SFT</th>
                    <th className="py-2 pr-4 font-medium">Constructability</th>
                    <th className="py-2 pr-4 font-medium">Risk</th>
                    <th className="py-2 pr-4 font-medium">Assessment</th>
                    <th className="py-2 pr-4 font-medium">Workflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => (
                    <tr key={r.packageId} className="hover:bg-stone-50">
                      <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                      <td className="py-3 pr-4 text-stone-600">{r.engineerName}</td>
                      <td className="py-3 pr-4 text-stone-600">{r.revisionLabel}</td>
                      <td className="py-3 pr-4"><StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{DESIGN_PACKAGE_STATUS_LABELS[r.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? r.status}</StatusBadge></td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.steelKg.toFixed(0)}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.concreteCum.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.brickQty > 0 ? r.brickQty.toFixed(0) : '-'}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.floorAreaSft > 0 ? r.floorAreaSft.toFixed(0) : '-'}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.roofAreaSft > 0 ? r.roofAreaSft.toFixed(0) : '-'}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.totalComponents}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(r.estimatedCost)}</td>
                      <td className="py-3 pr-4 text-right text-stone-700">{r.costPerSft > 0 ? formatTaka(r.costPerSft) : '-'}</td>
                      <td className="py-3 pr-4"><span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${CONSTRUCTABILITY_TONE[r.constructability]}`}>{r.constructability}</span></td>
                      <td className="py-3 pr-4"><span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${RISK_TONE[r.risk]}`}>{r.risk}</span></td>
                      <td className="py-3 pr-4 text-xs text-stone-600">{r.overallAssessment}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          {getAvailablePackageActions(r.status as DesignPackageStatus).map((action) => {
                            const pkg = data.packages.find((p) => p.id === r.packageId);
                            return pkg ? (
                              <Button key={action} variant="secondary" className="px-2.5 py-1 text-xs" disabled={actionBusyKey !== null} onClick={() => runPackageAction(pkg, action)}>
                                {PACKAGE_ACTION_LABELS[action]}
                              </Button>
                            ) : null;
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-stone-900">Column register metrics</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 text-right font-medium">Columns</th>
                    <th className="py-2 pr-4 font-medium">Column types</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete (cum)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel per column (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel per SFT (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete per SFT (cum)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const summary = data.summaries[r.packageId];
                    const colTotals = data.columnTotals[r.packageId];
                    const steelPerColumn = summary.total_columns > 0 ? colTotals.steel / summary.total_columns : 0;
                    return (
                      <tr key={r.packageId} className="hover:bg-stone-50">
                        <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{summary.total_columns}</td>
                        <td className="py-3 pr-4 text-stone-700">{colTotals.types.length > 0 ? colTotals.types.join(', ') : '-'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{colTotals.concrete.toFixed(3)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{colTotals.steel.toFixed(0)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{steelPerColumn.toFixed(1)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{r.floorAreaSft > 0 ? (colTotals.steel / r.floorAreaSft).toFixed(3) : '-'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{r.floorAreaSft > 0 ? (colTotals.concrete / r.floorAreaSft).toFixed(4) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-stone-900">Footing register metrics</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 text-right font-medium">Footings</th>
                    <th className="py-2 pr-4 text-right font-medium">Excavation (cum)</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete (cum)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel per footing (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel per SFT (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const ft = data.footingTotals[r.packageId];
                    const steelPerFooting = ft && ft.count > 0 ? ft.steel / ft.count : 0;
                    return (
                      <tr key={r.packageId} className="hover:bg-stone-50">
                        <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{ft?.count ?? 0}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{ft ? ft.excavation.toFixed(3) : '0.000'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{ft ? ft.concrete.toFixed(3) : '0.000'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{ft ? ft.steel.toFixed(0) : '0'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{steelPerFooting.toFixed(1)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{ft && r.floorAreaSft > 0 ? (ft.steel / r.floorAreaSft).toFixed(3) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-stone-900">Slab register metrics</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 text-right font-medium">Slabs</th>
                    <th className="py-2 pr-4 text-right font-medium">Total area (sqm)</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete (cum)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel per SFT (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete per SFT (cum)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const st = data.slabTotals[r.packageId];
                    return (
                      <tr key={r.packageId} className="hover:bg-stone-50">
                        <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st?.count ?? 0}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st ? st.area.toFixed(2) : '0.00'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st ? st.concrete.toFixed(3) : '0.000'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st ? st.steel.toFixed(0) : '0'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st && r.floorAreaSft > 0 ? (st.steel / r.floorAreaSft).toFixed(3) : '-'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{st && r.floorAreaSft > 0 ? (st.concrete / r.floorAreaSft).toFixed(4) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-stone-900">Rebar register metrics</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 text-right font-medium">Rebar items</th>
                    <th className="py-2 pr-4 text-right font-medium">Total weight (kg)</th>
                    <th className="py-2 pr-4 text-right font-medium">Weight per SFT (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const rb = data.rebarTotals[r.packageId];
                    const weight = rb?.weight ?? 0;
                    return (
                      <tr key={r.packageId} className="hover:bg-stone-50">
                        <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{rb?.count ?? 0}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{weight.toFixed(0)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{r.floorAreaSft > 0 ? (weight / r.floorAreaSft).toFixed(3) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <p className="mb-2 text-sm font-semibold text-stone-900">Structural cost breakdown</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-4 font-medium">Package</th>
                    <th className="py-2 pr-4 text-right font-medium">Concrete cost</th>
                    <th className="py-2 pr-4 text-right font-medium">Steel cost</th>
                    <th className="py-2 pr-4 text-right font-medium">Excavation cost</th>
                    <th className="py-2 pr-4 text-right font-medium">Total cost</th>
                    <th className="py-2 pr-4 text-right font-medium">Cost/SFT</th>
                    <th className="py-2 pr-4 text-right font-medium">Rebar weight (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {results.map((r) => {
                    const summary = data.summaries[r.packageId];
                    const ft = data.footingTotals[r.packageId];
                    const rb = data.rebarTotals[r.packageId];
                    const excavation = ft?.excavation ?? 0;
                    const concreteCost = Number(summary.total_concrete_cum) * STRUCTURAL_RATES.concrete;
                    const steelCost = Number(summary.total_steel_kg) * STRUCTURAL_RATES.steel;
                    const excavationCost = excavation * STRUCTURAL_RATES.excavation;
                    const totalCost = calcStructuralCost(Number(summary.total_concrete_cum), Number(summary.total_steel_kg), excavation);
                    return (
                      <tr key={r.packageId} className="hover:bg-stone-50">
                        <td className="py-3 pr-4 font-medium text-stone-900">{r.packageName}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(concreteCost)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(steelCost)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(excavationCost)}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(totalCost)}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{r.floorAreaSft > 0 ? formatTaka(totalCost / r.floorAreaSft) : '-'}</td>
                        <td className="py-3 pr-4 text-right text-stone-700">{rb ? rb.weight.toFixed(0) : '0'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {recs.length > 0 && (
              <div className="rounded-xl bg-stone-50 p-5">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" aria-hidden />
                  <h3 className="text-sm font-semibold text-stone-900">Recommendations</h3>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {recs.map((rec: RecommendationResult) => (
                    <div key={rec.type} className="rounded-lg border border-stone-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        {rec.type === 'lowest_cost' && <Scale className="h-4 w-4 text-primary-700" aria-hidden />}
                        {rec.type === 'best_value' && <Trophy className="h-4 w-4 text-amber-600" aria-hidden />}
                        {rec.type === 'lowest_risk' && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />}
                        {rec.type === 'balanced' && <GitCompare className="h-4 w-4 text-blue-600" aria-hidden />}
                        <p className="text-sm font-semibold text-stone-900">{RECOMMENDATION_LABELS[rec.type]}</p>
                      </div>
                      <p className="mt-2 text-sm font-medium text-primary-800">{rec.packageName}</p>
                      <p className="mt-1 text-xs text-stone-500">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultA && resultB && (
              <div className="rounded-xl border border-stone-200 p-5">
                <div className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4 text-stone-400" aria-hidden />
                  <h3 className="text-sm font-semibold text-stone-900">Head-to-head: {resultA.packageName} vs {resultB.packageName}</h3>
                </div>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  {[resultA, resultB].map((r) => (
                    <div key={r.packageId} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">{r.packageName}</p>
                        <StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.revisionLabel}</StatusBadge>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs text-stone-500">Engineer</dt><dd className="text-stone-800">{r.engineerName}</dd></div>
                        <div><dt className="text-xs text-stone-500">Est. cost</dt><dd className="font-medium text-stone-900">{formatTaka(r.estimatedCost)}</dd></div>
                        <div><dt className="text-xs text-stone-500">Cost/SFT</dt><dd className="text-stone-800">{r.costPerSft > 0 ? formatTaka(r.costPerSft) : '-'}</dd></div>
                        <div><dt className="text-xs text-stone-500">Steel</dt><dd className="text-stone-800">{r.steelKg.toFixed(0)} kg</dd></div>
                        <div><dt className="text-xs text-stone-500">Concrete</dt><dd className="text-stone-800">{r.concreteCum.toFixed(2)} cum</dd></div>
                        <div><dt className="text-xs text-stone-500">Brick qty</dt><dd className="text-stone-800">{r.brickQty > 0 ? r.brickQty.toFixed(0) : '-'}</dd></div>
                        <div><dt className="text-xs text-stone-500">Floor area</dt><dd className="text-stone-800">{r.floorAreaSft > 0 ? `${r.floorAreaSft.toFixed(0)} sft` : '-'}</dd></div>
                        <div><dt className="text-xs text-stone-500">Roof area</dt><dd className="text-stone-800">{r.roofAreaSft > 0 ? `${r.roofAreaSft.toFixed(0)} sft` : '-'}</dd></div>
                        <div><dt className="text-xs text-stone-500">Components</dt><dd className="text-stone-800">{r.totalComponents}</dd></div>
                        <div><dt className="text-xs text-stone-500">Constructability</dt><dd><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${CONSTRUCTABILITY_TONE[r.constructability]}`}>{r.constructability}</span></dd></div>
                        <div><dt className="text-xs text-stone-500">Risk</dt><dd><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${RISK_TONE[r.risk]}`}>{r.risk}</span></dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-stone-700">Package A</span>
                <select className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={selA ?? ''} onChange={(e) => setSelectedIds([e.target.value || null, selB])}>
                  <option value="">Select package...</option>
                  {results.map((r) => <option key={r.packageId} value={r.packageId}>{r.packageName} ({r.revisionLabel})</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-sm font-medium text-stone-700">Package B</span>
                <select className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={selB ?? ''} onChange={(e) => setSelectedIds([selA, e.target.value || null])}>
                  <option value="">Select package...</option>
                  {results.map((r) => <option key={r.packageId} value={r.packageId}>{r.packageName} ({r.revisionLabel})</option>)}
                </select>
              </label>
            </div>
          </>
        )}
</div>
    </Card>
  );
}
