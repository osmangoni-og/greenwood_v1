import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { CONTINGENCY_CATEGORIES, type BudgetContingencyDrawdownRow, type BudgetVersionLineRow, type ConstructionFundingSourceRow, type ContingencyCategory, type MaterialDeliveryLinkRow, type ProjectCostActualRow, type ProjectCostCommittedRow, type PurchaseOrderRow } from '@/types/database';

export interface PurchaseOrderBalance {
  amount: number;
  delivered: number;
  open: number;
}

export function computePurchaseOrderBalance(order: PurchaseOrderRow, deliveries: MaterialDeliveryLinkRow[]): PurchaseOrderBalance {
  const amount = Number(order.amount_bdt);
  const delivered = sum(deliveries.filter((row) => row.purchase_order_id === order.id).map((row) => Number(row.total_amount_bdt)));
  return { amount, delivered, open: Math.max(0, amount - delivered) };
}

export interface BudgetTotals {
  budget: number;
  actual: number;
  committed: number;
  exposure: number;
  remaining: number;
  percentComplete: number;
  forecastFinal: number;
  forecastBasis: 'progress' | 'exposure' | 'budget';
  expectedSaving: number;
  expectedOverrun: number;
}

export interface PhaseProgressInput {
  phase_key: string;
  progress_percent: number;
}

export interface CategoryRow {
  category: string;
  budget: number;
  actual: number;
  committed: number;
  variance: number;
}

export interface PhaseRow {
  phaseKey: string;
  phaseName: string;
  budget: number;
  actual: number;
  committed: number;
  variance: number;
}

export interface ContingencyTotals {
  original: number;
  used: number;
  remaining: number;
}

export interface ContingencyCategoryRow extends ContingencyTotals {
  category: ContingencyCategory;
  label: string;
}

export interface FundingVsBudget {
  budget: number;
  received: number;
  expected: number;
  gap: number;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function computeBudgetTotals(
  lines: BudgetVersionLineRow[],
  actuals: ProjectCostActualRow[],
  committed: ProjectCostCommittedRow[],
  phaseProgress: PhaseProgressInput[],
): BudgetTotals {
  const budget = sum(lines.filter((line) => line.level === 'project' || line.level === 'construction' || line.level === 'contingency').map((line) => Number(line.budget_amount_bdt)));
  const actual = sum(actuals.map((row) => Number(row.amount_bdt)));
  const committedTotal = sum(committed.map((row) => Number(row.amount_bdt)));
  const exposure = actual + committedTotal;

  const progressByPhase = new Map(phaseProgress.map((row) => [row.phase_key, Number(row.progress_percent) / 100]));
  const phaseLines = lines.filter((line) => line.level === 'phase');
  const phaseBudget = sum(phaseLines.map((line) => Number(line.budget_amount_bdt)));
  const earned = sum(phaseLines.map((line) => Number(line.budget_amount_bdt) * (progressByPhase.get(line.phase_key ?? '') ?? 0)));
  const percentComplete = phaseBudget > 0 ? earned / phaseBudget : 0;

  const estimate = percentComplete > 0 ? actual / percentComplete : budget;
  const forecastFinal = Math.max(exposure, estimate);
  let forecastBasis: BudgetTotals['forecastBasis'] = 'budget';
  if (percentComplete > 0) forecastBasis = estimate >= exposure ? 'progress' : 'exposure';

  return {
    budget,
    actual,
    committed: committedTotal,
    exposure,
    remaining: budget - exposure,
    percentComplete,
    forecastFinal,
    forecastBasis,
    expectedSaving: Math.max(0, budget - forecastFinal),
    expectedOverrun: Math.max(0, forecastFinal - budget),
  };
}

export interface RiskAdjustedFunding {
  planned: number;
  received: number;
  expected: number;
  riskAdjusted: number;
  gap: number;
}

export function computeRiskAdjustedFunding(budget: number, sources: ConstructionFundingSourceRow[]): RiskAdjustedFunding {
  const active = sources.filter((row) => row.status !== 'cancelled');
  const planned = sum(active.map((row) => Number(row.planned_amount_bdt)));
  const received = sum(active.map((row) => Number(row.received_amount_bdt)));
  const expected = sum(active.map((row) => Math.max(0, Number(row.planned_amount_bdt) - Number(row.received_amount_bdt))));
  const riskAdjusted = sum(active.map((row) => Math.max(0, Number(row.planned_amount_bdt) - Number(row.received_amount_bdt)) * (Number(row.probability_pct) / 100)));
  return { planned, received, expected, riskAdjusted, gap: Math.max(0, budget - received - riskAdjusted) };
}

export function computeFundingVsBudget(budget: number, received: number, planned: number): FundingVsBudget {
  const expected = Math.max(0, planned - received);
  return { budget, received, expected, gap: Math.max(0, budget - received - expected) };
}

export function computeContingency(lines: BudgetVersionLineRow[], drawdowns: BudgetContingencyDrawdownRow[]): ContingencyTotals {
  const original = sum(lines.filter((line) => line.level === 'contingency').map((line) => Number(line.budget_amount_bdt)));
  const used = sum(drawdowns.map((row) => Number(row.amount_bdt)));
  return { original, used, remaining: original - used };
}

export function computeContingencyByCategory(lines: BudgetVersionLineRow[], drawdowns: BudgetContingencyDrawdownRow[]): ContingencyCategoryRow[] {
  return CONTINGENCY_CATEGORIES.map(([category, label]) => {
    const original = sum(lines.filter((line) => line.level === 'contingency' && line.category === category).map((line) => Number(line.budget_amount_bdt)));
    const used = sum(drawdowns.filter((row) => row.category === category).map((row) => Number(row.amount_bdt)));
    return { category, label, original, used, remaining: original - used };
  });
}

export function buildCategoryRows(lines: BudgetVersionLineRow[], actuals: ProjectCostActualRow[], committed: ProjectCostCommittedRow[]): CategoryRow[] {
  const categories = new Map<string, CategoryRow>();
  const ensure = (category: string) => {
    const existing = categories.get(category);
    if (existing) return existing;
    const row: CategoryRow = { category, budget: 0, actual: 0, committed: 0, variance: 0 };
    categories.set(category, row);
    return row;
  };
  lines.filter((line) => line.level === 'construction').forEach((line) => { ensure(line.category).budget += Number(line.budget_amount_bdt); });
  actuals.forEach((row) => { ensure(row.category).actual += Number(row.amount_bdt); });
  committed.forEach((row) => { ensure(row.category).committed += Number(row.amount_bdt); });
  return [...categories.values()]
    .map((row) => ({ ...row, variance: row.budget - (row.actual + row.committed) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function buildPhaseRows(lines: BudgetVersionLineRow[], actuals: ProjectCostActualRow[], committed: ProjectCostCommittedRow[]): PhaseRow[] {
  const phaseNames = new Map<string, string>([...CONSTRUCTION_PHASES.map(([key, name]) => [key, name] as [string, string]), ['unassigned', 'Unassigned']]);
  const phaseKeys = [...CONSTRUCTION_PHASES.map(([key]) => key), 'unassigned'];
  return phaseKeys.map((phaseKey) => {
    const budget = sum(lines.filter((line) => line.level === 'phase' && line.phase_key === phaseKey).map((line) => Number(line.budget_amount_bdt)));
    const actual = sum(actuals.filter((row) => row.phase_key === phaseKey).map((row) => Number(row.amount_bdt)));
    const committedAmount = sum(committed.filter((row) => row.phase_key === phaseKey).map((row) => Number(row.amount_bdt)));
    return { phaseKey, phaseName: phaseNames.get(phaseKey) ?? phaseKey, budget, actual, committed: committedAmount, variance: budget - (actual + committedAmount) };
  }).filter((row) => row.budget > 0 || row.actual > 0 || row.committed > 0);
}
