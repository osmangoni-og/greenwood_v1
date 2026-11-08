import { ArrowDownCircle, Landmark, PiggyBank, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { EmptyState } from '@/components/StatePanel';
import { buildCategoryRows, buildPhaseRows, computeBudgetTotals, computeContingency } from '@/lib/budgetCalculations';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatDate, formatPercent, formatTaka } from '@/lib/format';

interface Props {
  workspace: BudgetWorkspace;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
}

const FORECAST_NOTE: Record<'progress' | 'exposure' | 'budget', string> = {
  progress: 'Forecast = actual cost divided by physical progress recorded on the phases.',
  exposure: 'Forecast is held at actual plus committed cost, which is already higher than the progress-based estimate.',
  budget: 'No phase progress recorded yet, so the forecast assumes the full budget will be spent.',
};

export function BudgetOverview({ workspace }: Props) {
  const active = workspace.versions.find((version) => version.is_active) ?? null;
  if (!active) {
    return <EmptyState icon={PiggyBank} title="No active budget yet" description="Create Budget V1 in the Versions tab, add its lines, and approve it. Actual costs will start counting automatically." />;
  }

  const lines = workspace.lines.filter((line) => line.budget_version_id === active.id);
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingency = computeContingency(lines, workspace.drawdowns.filter((row) => row.budget_version_id === active.id));
  const categoryRows = buildCategoryRows(lines, workspace.actuals, workspace.committed);
  const phaseRows = buildPhaseRows(lines, workspace.actuals, workspace.committed);
  const categoryChart: BarDatum[] = categoryRows.map((row) => ({ label: row.category, primary: row.budget, secondary: row.actual + row.committed }));
  const cashChart: BarDatum[] = workspace.cashForecasts.map((row) => ({ label: formatDate(row.forecast_month), primary: row.expected_inflow_bdt, secondary: row.expected_outflow_bdt }));
  const overBudget = totals.exposure > totals.budget;
  const funding = workspace.fundingSummary;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
      <span className="rounded-full bg-primary-50 px-3 py-1 font-medium text-primary-800">{active.version_label} active</span>
      {active.approved_by && <span>Approved by {active.approved_by}{active.approved_at ? ` on ${formatDate(active.approved_at.slice(0, 10))}` : ''}</span>}
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Total budget" value={formatTaka(totals.budget)} hint="Project, construction and contingency lines" icon={PiggyBank} tone="primary" />
      <StatCard label="Actual cost" value={formatTaka(totals.actual)} hint="Deliveries and contractor and labor payments" icon={Receipt} tone="accent" />
      <StatCard label="Committed" value={formatTaka(totals.committed)} hint="Open purchase orders net of deliveries, and contract balances" icon={ArrowDownCircle} tone="accent" />
      <StatCard label="Forecast final cost" value={formatTaka(totals.forecastFinal)} hint={FORECAST_NOTE[totals.forecastBasis]} icon={TrendingDown} tone={overBudget ? 'error' : 'primary'} />
      <StatCard label="Expected saving" value={formatTaka(totals.expectedSaving)} hint="Budget minus forecast, when under budget" icon={Wallet} tone="primary" />
      <StatCard label="Expected overrun" value={formatTaka(totals.expectedOverrun)} hint="Forecast minus budget, when over budget" icon={TrendingUp} tone={totals.expectedOverrun > 0 ? 'error' : 'accent'} />
      <StatCard label="Contingency remaining" value={formatTaka(contingency.remaining)} hint={`${formatTaka(contingency.used)} of ${formatTaka(contingency.original)} used`} icon={Landmark} tone={contingency.remaining < 0 ? 'error' : 'accent'} />
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Forecast final cost" description={FORECAST_NOTE[totals.forecastBasis]} />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Mini label="Budget" value={formatTaka(totals.budget)} />
          <Mini label="Forecast final cost" value={formatTaka(totals.forecastFinal)} tone={overBudget ? 'error' : undefined} />
          <Mini label="Expected saving" value={formatTaka(totals.expectedSaving)} />
          <Mini label="Expected overrun" value={formatTaka(totals.expectedOverrun)} tone={totals.expectedOverrun > 0 ? 'error' : undefined} />
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm"><span className="font-medium text-stone-700">Physical progress</span><span className="text-stone-800">{formatPercent(totals.percentComplete * 100)}</span></div>
          <div className="mt-2"><ProgressBar value={totals.percentComplete * 100} tone="primary" label="Physical progress from phases" /></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Budget vs actual" description="Spend and commitments as a share of the total budget." />
        <div className="mt-5 space-y-5">
          <div>
            <div className="flex justify-between text-sm"><span className="font-medium text-stone-700">Actual</span><span className="text-stone-800">{formatTaka(totals.actual)} ({percentOf(totals.actual, totals.budget).toFixed(1)}%)</span></div>
            <div className="mt-2"><ProgressBar value={percentOf(totals.actual, totals.budget)} tone={overBudget ? 'error' : 'primary'} label="Actual cost share of budget" /></div>
          </div>
          <div>
            <div className="flex justify-between text-sm"><span className="font-medium text-stone-700">Actual + committed</span><span className="text-stone-800">{formatTaka(totals.exposure)} ({percentOf(totals.exposure, totals.budget).toFixed(1)}%)</span></div>
            <div className="mt-2"><ProgressBar value={percentOf(totals.exposure, totals.budget)} tone={overBudget ? 'error' : 'accent'} label="Exposure share of budget" /></div>
          </div>
        </div>
        {overBudget && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Actual and committed costs exceed the budget by {formatTaka(totals.exposure - totals.budget)}.</p>}
      </Card>
    </div>

    <Card>
      <CardHeader title="Funding vs budget" description="Whether received and expected funding cover the approved budget." />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Mini label="Budget" value={formatTaka(funding.approvedBudget)} />
        <Mini label="Funding received" value={formatTaka(funding.fundingReceived)} />
        <Mini label="Funding expected" value={formatTaka(funding.fundingExpected)} hint="Planned sources not yet received" />
        <Mini label="Funding gap" value={formatTaka(funding.fundingGap)} tone={funding.fundingGap > 0 ? 'error' : undefined} hint="Budget not covered by received or expected funding" />
      </div>
    </Card>

    <Card>
      <CardHeader title="Budget by category" description="Construction budget lines against actual and committed cost." />
      <div className="mt-5">{categoryChart.length ? <BarChart data={categoryChart} primaryLabel="Budget" secondaryLabel="Actual + committed" formatValue={formatTaka} /> : <p className="text-sm text-stone-500">No construction lines in this version.</p>}</div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Category</th><th className="py-2 pr-4 text-right font-medium">Budget</th><th className="py-2 pr-4 text-right font-medium">Actual</th><th className="py-2 pr-4 text-right font-medium">Committed</th><th className="py-2 pr-4 text-right font-medium">Variance</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{categoryRows.map((row) => <tr key={row.category} className={row.variance < 0 ? 'bg-rose-50/60' : undefined}><td className="py-3 pr-4 font-medium text-stone-800">{row.category}</td><td className="py-3 pr-4 text-right text-stone-700">{formatTaka(row.budget)}</td><td className="py-3 pr-4 text-right text-stone-900">{formatTaka(row.actual)}</td><td className="py-3 pr-4 text-right text-stone-700">{formatTaka(row.committed)}</td><td className={row.variance < 0 ? 'py-3 pr-4 text-right font-semibold text-rose-700' : 'py-3 pr-4 text-right text-emerald-700'}>{formatTaka(row.variance)}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>

    <Card>
      <CardHeader title="Budget by phase" description="Phase allocations against actual and committed cost. Unassigned spend is shown separately." />
      {phaseRows.length === 0 ? <p className="mt-4 text-sm text-stone-500">No phase budgets or phase costs yet.</p> : <div className="mt-4 space-y-4">{phaseRows.map((row) => <div key={row.phaseKey}><div className="flex justify-between text-sm"><span className="font-medium text-stone-800">{row.phaseName}</span><span className="text-stone-600">{formatTaka(row.actual + row.committed)} of {formatTaka(row.budget)}</span></div><div className="mt-2"><ProgressBar value={percentOf(row.actual + row.committed, row.budget)} tone={row.variance < 0 ? 'error' : 'primary'} label={`${row.phaseName} spend`} /></div></div>)}</div>}
    </Card>

    <Card>
      <CardHeader title="Cash flow forecast" description="Expected monthly inflow against outflow." />
      <div className="mt-5">{cashChart.length ? <BarChart data={cashChart} primaryLabel="Inflow" secondaryLabel="Outflow" formatValue={formatTaka} /> : <p className="text-sm text-stone-500">No cash-flow months recorded yet.</p>}</div>
    </Card>
  </div>;
}

function Mini({ label, value, tone, hint }: { label: string; value: string; tone?: 'error'; hint?: string }) {
  return <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">{label}</p><p className={tone === 'error' ? 'mt-1 text-sm font-semibold text-rose-700' : 'mt-1 text-sm font-semibold text-stone-900'}>{value}</p>{hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}</div>;
}
