import { TrendingDown, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatDate, formatTaka } from '@/lib/format';
import type { ConstructionCashFlowForecastRow } from '@/types/database';

export interface MonthlyCashFlow {
  month: string;
  openingCash: number;
  expectedFunding: number;
  expectedPayments: number;
  closingCash: number;
  hasDeficit: boolean;
}

export function computeMonthlyCashFlow(
  forecasts: ConstructionCashFlowForecastRow[],
  openingCash: number,
  riskAdjustedMonthly: number,
): MonthlyCashFlow[] {
  const sorted = [...forecasts].sort((a, b) => a.forecast_month.localeCompare(b.forecast_month));
  let runningCash = openingCash;
  return sorted.map((row) => {
    const inflow = Number(row.expected_inflow_bdt) + riskAdjustedMonthly;
    const outflow = Number(row.expected_outflow_bdt);
    const closingCash = runningCash + inflow - outflow;
    const hasDeficit = closingCash < 0;
    const result: MonthlyCashFlow = { month: row.forecast_month, openingCash: runningCash, expectedFunding: inflow, expectedPayments: outflow, closingCash, hasDeficit };
    runningCash = closingCash;
    return result;
  });
}

interface Props {
  workspace: BudgetWorkspace;
}

export function CashFlowForecastPanel({ workspace }: Props) {
  const { availableCash, riskAdjustedFunding } = workspace.fundingSummary;
  const monthlyFunding = riskAdjustedFunding / Math.max(1, workspace.cashForecasts.length);
  const months = computeMonthlyCashFlow(workspace.cashForecasts, availableCash, monthlyFunding);
  const deficitMonths = months.filter((m) => m.hasDeficit);
  const shortageRisk = deficitMonths.length > 0;

  const chartData: BarDatum[] = months.map((m) => ({ label: formatDate(m.month), primary: m.expectedFunding, secondary: m.expectedPayments }));

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Opening cash" value={formatTaka(availableCash)} hint="Available cash at start of period" icon={Wallet} tone="primary" />
      <StatCard label="Risk-adjusted monthly funding" value={formatTaka(monthlyFunding)} hint="Total risk-adjusted funding spread over forecast months" icon={Wallet} tone="accent" />
      <StatCard label="Deficit months" value={String(deficitMonths.length)} hint="Months where closing cash goes negative" icon={TrendingDown} tone={shortageRisk ? 'error' : 'accent'} />
      <StatCard label="Cash shortage risk" value={shortageRisk ? 'High' : 'Low'} hint={shortageRisk ? `${deficitMonths.length} month(s) with negative closing cash` : 'All months close positive'} icon={TrendingDown} tone={shortageRisk ? 'error' : 'accent'} />
    </div>

    <Card>
      <CardHeader title="Monthly cash flow forecast" description="Opening cash, expected funding (including risk-adjusted), expected payments, and closing cash per month." />
      {months.length === 0 ? <p className="mt-4 text-sm text-stone-500">No cash flow forecast months recorded. Add them on the Construction Finance page.</p> : (
        <div className="mt-4 h-56"><BarChart data={chartData} primaryLabel="Expected funding" secondaryLabel="Expected payments" formatValue={formatTaka} /></div>
      )}
    </Card>

    {months.length > 0 && (
      <Card>
        <CardHeader title="Monthly cash flow detail" description="Months with negative closing cash are highlighted in red." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Month</th><th className="py-2 pr-4 text-right font-medium">Opening cash</th><th className="py-2 pr-4 text-right font-medium">Expected funding</th><th className="py-2 pr-4 text-right font-medium">Expected payments</th><th className="py-2 pr-4 text-right font-medium">Closing cash</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {months.map((m) => <tr key={m.month} className={m.hasDeficit ? 'bg-rose-50/70' : undefined}>
                <td className="py-3 pr-4 font-medium text-stone-800">{formatDate(m.month)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(m.openingCash)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(m.expectedFunding)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(m.expectedPayments)}</td>
                <td className={`py-3 pr-4 text-right font-semibold ${m.hasDeficit ? 'text-rose-700' : 'text-stone-900'}`}>{formatTaka(m.closingCash)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>;
}
