import { computeBudgetTotals } from '@/lib/budgetCalculations';
import type { BudgetVersionLineRow, ConstructionFinanceSummaryRow, ConstructionFundingSourceRow, FundingDependencyRow } from '@/types/database';

export interface FundingSummary {
  approvedBudget: number;
  fundingPlanned: number;
  fundingReceived: number;
  fundingExpected: number;
  riskAdjustedFunding: number;
  fundingGap: number;
  availableCash: number;
  expectedCash: number;
  fundingReceivedPercent: number;
  fundingCoveragePercent: number;
}

export interface FundingSummaryInput {
  budgetLines: BudgetVersionLineRow[];
  sources: ConstructionFundingSourceRow[];
  finance: ConstructionFinanceSummaryRow | null;
}

export function sourceRiskAdjustedFunding(row: ConstructionFundingSourceRow): number {
  return Math.max(0, Number(row.planned_amount_bdt) - Number(row.received_amount_bdt)) * (Number(row.probability_pct) / 100);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function buildFundingSummary({ budgetLines, sources, finance }: FundingSummaryInput): FundingSummary {
  const active = sources.filter((row) => row.status !== 'cancelled');
  const approvedBudget = computeBudgetTotals(budgetLines, [], [], []).budget;
  const fundingPlanned = sum(active.map((row) => Number(row.planned_amount_bdt)));
  const fundingReceived = sum(active.map((row) => Number(row.received_amount_bdt)));
  const fundingExpected = sum(active.map((row) => Math.max(0, Number(row.planned_amount_bdt) - Number(row.received_amount_bdt))));
  const riskAdjustedFunding = sum(active.map(sourceRiskAdjustedFunding));

  const summary: FundingSummary = {
    approvedBudget,
    fundingPlanned,
    fundingReceived,
    fundingExpected,
    riskAdjustedFunding,
    fundingGap: Math.max(0, approvedBudget - fundingReceived - riskAdjustedFunding),
    availableCash: Number(finance?.available_cash ?? 0),
    expectedCash: Number(finance?.expected_cash ?? 0),
    fundingReceivedPercent: approvedBudget > 0 ? (fundingReceived / approvedBudget) * 100 : 0,
    fundingCoveragePercent: approvedBudget > 0 ? ((fundingReceived + riskAdjustedFunding) / approvedBudget) * 100 : 0,
  };

  warnOnFundingInvariants(summary);
  if (finance) warnOnFundingDrift(summary, finance);
  return summary;
}

export interface PhaseFundingRow {
  phaseKey: string;
  required: number;
  secured: number;
  expected: number;
  riskAdjusted: number;
  coverage: number;
}

export interface PhaseFundingInput {
  budgetLines: BudgetVersionLineRow[];
  phaseKeys: string[];
  dependencies: FundingDependencyRow[];
  sources: ConstructionFundingSourceRow[];
}

export function buildPhaseFunding({ budgetLines, phaseKeys, dependencies, sources }: PhaseFundingInput): PhaseFundingRow[] {
  const depsByPhase = new Map<string, FundingDependencyRow[]>();
  for (const dep of dependencies) {
    const list = depsByPhase.get(dep.phase_key) ?? [];
    list.push(dep);
    depsByPhase.set(dep.phase_key, list);
  }
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return phaseKeys.map((key) => {
    const phaseBudget = budgetLines.filter((l) => l.level === 'phase' && l.phase_key === key).reduce((s, l) => s + Number(l.budget_amount_bdt), 0);
    const deps = depsByPhase.get(key) ?? [];
    const required = deps.length > 0 ? deps.reduce((s, d) => s + Number(d.required_amount_bdt), 0) : phaseBudget;
    let secured = 0, expected = 0, riskAdjusted = 0;
    for (const dep of deps) {
      const source = sourceById.get(dep.funding_source_id);
      if (!source || source.status === 'cancelled') continue;
      const planned = Number(source.planned_amount_bdt);
      const received = Number(source.received_amount_bdt);
      const remaining = Math.max(0, planned - received);
      const prob = Number(source.probability_pct) / 100;
      secured += Math.min(received, Number(dep.required_amount_bdt));
      expected += Math.min(remaining, Math.max(0, Number(dep.required_amount_bdt) - received));
      riskAdjusted += Math.min(remaining * prob, Math.max(0, Number(dep.required_amount_bdt) - received));
    }
    const coverage = required > 0 ? (riskAdjusted / required) * 100 : 0;
    return { phaseKey: key, required, secured, expected, riskAdjusted, coverage };
  }).filter((p) => p.required > 0);
}

function warnOnFundingInvariants(summary: FundingSummary): void {
  const violations: string[] = [];
  if (summary.fundingReceived > summary.fundingPlanned + 1) violations.push('received exceeds planned');
  if (summary.riskAdjustedFunding > summary.fundingExpected + 1) violations.push('risk-adjusted exceeds expected');
  if (summary.fundingGap < 0) violations.push('gap is negative');
  if (summary.fundingCoveragePercent < 0) violations.push('coverage is negative');
  for (const message of violations) console.warn(`[funding] invariant violated: ${message}`, summary);
}

function warnOnFundingDrift(summary: FundingSummary, finance: ConstructionFinanceSummaryRow): void {
  const checks: Array<[string, number, number]> = [
    ['funding received', summary.fundingReceived, Number(finance.received_funding)],
    ['funding planned', summary.fundingPlanned, Number(finance.planned_funding)],
    ['approved budget', summary.approvedBudget, Number(finance.total_budget)],
  ];
  for (const [label, appValue, dbValue] of checks) {
    if (Math.abs(appValue - dbValue) > 1) {
      console.warn(`[funding] ${label} differs: app ${appValue} vs database ${dbValue}`);
    }
  }
}
