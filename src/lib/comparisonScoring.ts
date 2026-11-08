import type { ComparisonSummaryRow } from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';

export type ConstructabilityScore = 'Excellent' | 'Good' | 'Moderate' | 'Complex';
export type RiskScore = 'Low Risk' | 'Medium Risk' | 'High Risk';
export type RecommendationType = 'lowest_cost' | 'best_value' | 'lowest_risk' | 'balanced';

export interface PackageComparisonInput {
  packageId: string;
  packageName: string;
  revisionLabel: string;
  status: string;
  engineerName: string;
  summary: ComparisonSummaryRow;
  buildingAreaSft: number;
  brickQty: number;
  roofAreaSft: number;
}

export interface PackageComparisonResult {
  packageId: string;
  packageName: string;
  revisionLabel: string;
  status: string;
  engineerName: string;
  steelKg: number;
  concreteCum: number;
  brickQty: number;
  floorAreaSft: number;
  roofAreaSft: number;
  totalComponents: number;
  estimatedCost: number;
  costPerSft: number;
  constructability: ConstructabilityScore;
  constructabilityScore: number;
  risk: RiskScore;
  riskScore: number;
  overallAssessment: string;
}

export const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  lowest_cost: 'Lowest Cost',
  best_value: 'Best Value',
  lowest_risk: 'Lowest Risk',
  balanced: 'Balanced Option',
};

export const CONSTRUCTABILITY_TONE: Record<ConstructabilityScore, string> = {
  Excellent: 'text-emerald-700 bg-emerald-50',
  Good: 'text-primary-700 bg-primary-50',
  Moderate: 'text-amber-700 bg-amber-50',
  Complex: 'text-rose-700 bg-rose-50',
};

export const RISK_TONE: Record<RiskScore, string> = {
  'Low Risk': 'text-emerald-700 bg-emerald-50',
  'Medium Risk': 'text-amber-700 bg-amber-50',
  'High Risk': 'text-rose-700 bg-rose-50',
};

function computeConstructability(summary: ComparisonSummaryRow): { label: ConstructabilityScore; score: number } {
  const components = summary.total_columns + summary.total_beams + summary.total_footings + summary.total_slabs;
  const steelIntensity = components > 0 ? summary.total_steel_kg / components : 0;
  const concreteIntensity = components > 0 ? summary.total_concrete_cum / components : 0;
  const complexityRaw = (components * 0.3) + (steelIntensity * 0.02) + (concreteIntensity * 0.5);
  const score = Math.max(0, Math.min(100, 100 - complexityRaw));
  let label: ConstructabilityScore = 'Excellent';
  if (score < 40) label = 'Complex';
  else if (score < 60) label = 'Moderate';
  else if (score < 80) label = 'Good';
  return { label, score };
}

function computeRisk(summary: ComparisonSummaryRow, costPerSft: number): { label: RiskScore; score: number } {
  const components = summary.total_columns + summary.total_beams + summary.total_footings + summary.total_slabs;
  const materialIntensity = Math.min(100, (summary.total_steel_kg / 1000) + (summary.total_concrete_cum * 2));
  const structuralComplexity = Math.min(100, components * 1.5);
  const budgetSensitivity = Math.min(100, costPerSft / 50);
  const score = Math.round((materialIntensity * 0.4) + (structuralComplexity * 0.3) + (budgetSensitivity * 0.3));
  let label: RiskScore = 'Low Risk';
  if (score >= 60) label = 'High Risk';
  else if (score >= 30) label = 'Medium Risk';
  return { label, score };
}

export function scorePackage(input: PackageComparisonInput): PackageComparisonResult {
  const cost = Number(input.summary.estimated_structural_cost_bdt);
  const costPerSft = input.buildingAreaSft > 0 ? cost / input.buildingAreaSft : 0;
  const constructability = computeConstructability(input.summary);
  const risk = computeRisk(input.summary, costPerSft);
  const overallAssessment = `${constructability.label} design, ${risk.label.toLowerCase()}`;
  return {
    packageId: input.packageId,
    packageName: input.packageName,
    revisionLabel: input.revisionLabel,
    status: input.status,
    engineerName: input.engineerName,
    steelKg: Number(input.summary.total_steel_kg),
    concreteCum: Number(input.summary.total_concrete_cum),
    brickQty: input.brickQty,
    floorAreaSft: input.buildingAreaSft,
    roofAreaSft: input.roofAreaSft,
    totalComponents: input.summary.total_columns + input.summary.total_beams + input.summary.total_footings + input.summary.total_slabs,
    estimatedCost: cost,
    costPerSft,
    constructability: constructability.label,
    constructabilityScore: Math.round(constructability.score),
    risk: risk.label,
    riskScore: risk.score,
    overallAssessment,
  };
}

export interface RecommendationResult {
  type: RecommendationType;
  packageId: string;
  packageName: string;
  reason: string;
}

export function generateRecommendations(results: PackageComparisonResult[]): RecommendationResult[] {
  if (results.length === 0) return [];
  const valid = results.filter((r) => r.estimatedCost > 0);
  if (valid.length === 0) return [];

  const recs: RecommendationResult[] = [];

  const lowestCost = [...valid].sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
  recs.push({
    type: 'lowest_cost',
    packageId: lowestCost.packageId,
    packageName: lowestCost.packageName,
    reason: `Lowest estimated cost at ${lowestCost.estimatedCost.toLocaleString('en-IN')} BDT`,
  });

  const bestValue = [...valid].sort((a, b) => {
    const aScore = a.constructabilityScore + (100 - a.riskScore) + (100 - (a.costPerSft / Math.max(...valid.map((v) => v.costPerSft)) * 100));
    const bScore = b.constructabilityScore + (100 - b.riskScore) + (100 - (b.costPerSft / Math.max(...valid.map((v) => v.costPerSft)) * 100));
    return bScore - aScore;
  })[0];
  recs.push({
    type: 'best_value',
    packageId: bestValue.packageId,
    packageName: bestValue.packageName,
    reason: `Best balance of constructability (${bestValue.constructability}), risk (${bestValue.risk}), and cost`,
  });

  const lowestRisk = [...valid].sort((a, b) => a.riskScore - b.riskScore)[0];
  recs.push({
    type: 'lowest_risk',
    packageId: lowestRisk.packageId,
    packageName: lowestRisk.packageName,
    reason: `Lowest risk profile (${lowestRisk.risk}) with ${lowestRisk.constructability} constructability`,
  });

  const balanced = [...valid].sort((a, b) => {
    const aComposite = a.constructabilityScore + (100 - a.riskScore) - (a.costPerSft / 100);
    const bComposite = b.constructabilityScore + (100 - b.riskScore) - (b.costPerSft / 100);
    return bComposite - aComposite;
  })[0];
  recs.push({
    type: 'balanced',
    packageId: balanced.packageId,
    packageName: balanced.packageName,
    reason: `Balanced option: ${balanced.constructability} constructability, ${balanced.risk}, moderate cost`,
  });

  return recs;
}

export function resolvePackageEngineer(pkg: DesignPackageRow, engineers: EngineerRow[]): string {
  const eng = engineers.find((e) => e.id === pkg.engineer_id);
  return eng?.name ?? 'Unknown';
}

export interface RevisionImpact {
  revisionId: string;
  revisionNumber: number;
  triggerType: string | null;
  impactAmount: number;
  impactPct: number;
  budgetGrowthPct: number;
  largestCostDriver: string | null;
  date: string;
  approvedBy: string;
  reason: string;
}

interface SnapshotLine {
  category?: string;
  budget_amount_bdt?: number | string;
}

function extractLargestCostDriver(snapshot: unknown): string | null {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  let maxAmount = 0;
  let maxCategory: string | null = null;
  for (const entry of snapshot) {
    const line = entry as SnapshotLine;
    const amount = Number(line.budget_amount_bdt ?? 0);
    if (amount > maxAmount && line.category) {
      maxAmount = amount;
      maxCategory = line.category;
    }
  }
  return maxCategory;
}

export function computeRevisionImpact(
  revisions: { id: string; revision_number: number; trigger_type: string | null; previous_total_bdt: number; new_total_bdt: number; revision_date: string; approved_by: string; reason: string; snapshot?: unknown }[],
): RevisionImpact[] {
  return revisions.map((r) => {
    const prev = Number(r.previous_total_bdt);
    const next = Number(r.new_total_bdt);
    const impactAmount = next - prev;
    const impactPct = prev > 0 ? (impactAmount / prev) * 100 : 0;
    return {
      revisionId: r.id,
      revisionNumber: r.revision_number,
      triggerType: r.trigger_type,
      impactAmount,
      impactPct,
      budgetGrowthPct: impactPct,
      largestCostDriver: extractLargestCostDriver(r.snapshot),
      date: r.revision_date,
      approvedBy: r.approved_by,
      reason: r.reason,
    };
  });
}

export function getBudgetGrowthPct(
  revisions: { previous_total_bdt: number; new_total_bdt: number }[],
): number {
  if (revisions.length === 0) return 0;
  const first = revisions[revisions.length - 1];
  const last = revisions[0];
  const firstTotal = Number(first.previous_total_bdt);
  const lastTotal = Number(last.new_total_bdt);
  if (firstTotal === 0) return 0;
  return ((lastTotal - firstTotal) / firstTotal) * 100;
}

export function getTopBudgetDrivers(
  lines: { category: string; budget_amount_bdt: number }[],
): { category: string; amount: number; pct: number }[] {
  const grouped = new Map<string, number>();
  for (const line of lines) {
    grouped.set(line.category, (grouped.get(line.category) ?? 0) + Number(line.budget_amount_bdt));
  }
  const total = Array.from(grouped.values()).reduce((s, v) => s + v, 0);
  return Array.from(grouped.entries())
    .map(([category, amount]) => ({ category, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}
