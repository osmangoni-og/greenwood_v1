import { Building2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { loadExecutiveDashboard, type ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { fetchDecisions } from '@/lib/decisionLog';
import { computeBudgetTotals, computeContingency } from '@/lib/budgetCalculations';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatDate, formatTaka } from '@/lib/format';
import type { ProjectDecisionRow, ProjectRow } from '@/types/database';

interface Data {
  project: ProjectRow | null;
  workspace: BudgetWorkspace | null;
  exec: ExecutiveDashboardData | null;
  decisions: ProjectDecisionRow[];
}
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null, exec: null, decisions: [] };
  const [workspace, exec, decisions] = await Promise.all([loadBudgetWorkspace(project.id), loadExecutiveDashboard(), fetchDecisions(project.id)]);
  return { project, workspace, exec, decisions };
}

export function GreenwoodSummaryPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project || !data.workspace || !data.exec) return <EmptyState icon={Building2} title="No project yet" description="The Greenwood Summary needs a project with budget and operational data." />;

  const { project, workspace, exec, decisions } = data;
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingency = computeContingency(lines, workspace.drawdowns.filter((d) => active && d.budget_version_id === active.id));
  const funding = workspace.fundingSummary;
  const availableCash = funding.availableCash;
  const outstandingLiability = workspace.supplierInvoices.reduce((s, inv) => s + Number(inv.balance_bdt), 0);
  const fundingCoverage = funding.fundingCoveragePercent;
  const forecastCompletion = totals.actual + Math.max(0, totals.expectedOverrun);
  const recentDecisions = decisions.slice(0, 5);
  const openRisks = exec.delayedPhases.length + exec.openDefects.length;
  const upcomingMilestones = exec.milestones.slice(0, 5);

  return <div className="space-y-6">
    <PageHeader title="Greenwood Miazi Bari" description="A single-page executive summary of the entire project — budget, funding, construction, assets, and decisions." />

    {/* Hero */}
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 to-cyan-900 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-200">Greenwood Miazi Bari</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
          <p className="mt-1 text-sm text-teal-100">{project.location}</p>
        </div>
        <div className="flex items-end gap-6">
          <div><p className="text-xs uppercase tracking-wide text-teal-300">Progress</p><p className="mt-1 text-4xl font-semibold tabular-nums">{project.construction_progress_pct}%</p></div>
          <div><p className="text-xs uppercase tracking-wide text-teal-300">Funding coverage</p><p className="mt-1 text-4xl font-semibold tabular-nums">{fundingCoverage.toFixed(0)}%</p></div>
        </div>
      </div>
      <div className="relative mt-6 space-y-3">
        <ProgressBar value={project.construction_progress_pct} label="Construction progress" tone="accent" />
        <ProgressBar value={Math.min(100, fundingCoverage)} label="Funding coverage" tone="primary" />
      </div>
    </section>

    {/* Core KPIs — moved to Executive Dashboard Overview tab. This tab keeps the narrative cards that the Overview does not show. */}
    <Card>
      <CardHeader title="Key figures" description="Budget and funding KPIs are on the Overview tab. The cards below show details not covered there." />
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Budget: <strong className="text-stone-900">{formatTaka(totals.budget)}</strong></span>
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Forecast: <strong className="text-stone-900">{formatTaka(totals.forecastFinal)}</strong></span>
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Funding gap: <strong className={funding.fundingGap > 0 ? 'text-rose-700' : 'text-stone-900'}>{formatTaka(funding.fundingGap)}</strong></span>
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Available cash: <strong className="text-stone-900">{formatTaka(availableCash)}</strong></span>
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Supplier liability: <strong className={outstandingLiability > 0 ? 'text-rose-700' : 'text-stone-900'}>{formatTaka(outstandingLiability)}</strong></span>
        <span className="rounded-lg bg-stone-50 px-3 py-2 text-stone-600">Contingency left: <strong className="text-stone-900">{formatTaka(contingency.remaining)}</strong></span>
      </div>
    </Card>

    <div className="grid gap-6 lg:grid-cols-2">
      {/* Land Sale Rankings */}
      <Card>
        <CardHeader title="Land sale priority rankings" description="Top land assets by sell pressure." />
        {exec.landRanking.length > 0 ? <div className="mt-4 divide-y divide-stone-100">
          {exec.landRanking.slice(0, 5).map((row, i) => <div key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">{i + 1}</span><div><p className="font-medium text-stone-800">{row.asset_name}</p><p className="text-xs text-stone-500">{row.location ?? 'No location'}</p></div></div>
            <div className="flex items-center gap-2"><span className="font-semibold text-stone-900">{formatTaka(row.estimated_value_bdt ?? 0)}</span><StatusBadge tone={row.recommendation === 'sell_immediately' ? 'error' : row.recommendation === 'sell_if_needed' ? 'warning' : 'info'}>{row.recommendation.replace(/_/g, ' ')}</StatusBadge></div>
          </div>)}
        </div> : <p className="mt-4 text-sm text-stone-500">No land sale scores recorded.</p>}
      </Card>

      {/* Highest Offer + Forecast Completion */}
      <div className="space-y-6">
        <Card>
          <CardHeader title="Highest offer received" description="Best live offer across all assets." />
          {exec.highestOffer ? <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Amount</p><p className="mt-1 text-lg font-semibold text-stone-900">{formatTaka(exec.highestOffer.amount)}</p></div>
            <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Asset</p><p className="mt-1 text-sm font-semibold text-stone-900">{exec.highestOffer.assetName}</p></div>
            <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Buyer</p><p className="mt-1 text-sm font-semibold text-stone-900">{exec.highestOffer.buyerName}</p><StatusBadge tone={exec.highestOffer.status === 'accepted' ? 'success' : 'warning'}>{exec.highestOffer.status}</StatusBadge></div>
          </div> : <p className="mt-4 text-sm text-stone-500">No active offers.</p>}
        </Card>
        <Card>
          <CardHeader title="Forecast completion cost" description="Actual cost plus expected overrun." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Actual so far</p><p className="mt-1 text-lg font-semibold text-stone-900">{formatTaka(totals.actual)}</p></div>
            <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Forecast completion</p><p className="mt-1 text-lg font-semibold text-stone-900">{formatTaka(forecastCompletion)}</p></div>
          </div>
        </Card>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-3">
      {/* Open Risks */}
      <Card>
        <CardHeader title="Open risks" description={`${openRisks} items needing attention`} />
        <div className="mt-4 space-y-3 text-sm">
          {exec.delayedPhases.length > 0 && <div><p className="font-medium text-stone-800">Delayed phases ({exec.delayedPhases.length})</p>{exec.delayedPhases.slice(0, 3).map((p) => <p key={p.id} className="text-xs text-stone-500">{p.phase_name}: {p.delays}</p>)}</div>}
          {exec.openDefects.length > 0 && <div><p className="font-medium text-stone-800">Open defects ({exec.openDefects.length})</p>{exec.openDefects.slice(0, 3).map((d) => <p key={d.id} className="text-xs text-stone-500">{d.description}</p>)}</div>}
          {openRisks === 0 && <p className="text-stone-500">No open risks.</p>}
        </div>
      </Card>

      {/* Upcoming Milestones */}
      <Card>
        <CardHeader title="Upcoming milestones" description="Next phases without actual dates." />
        {upcomingMilestones.length > 0 ? <div className="mt-4 space-y-3 text-sm">{upcomingMilestones.map((p) => <div key={p.id}><p className="font-medium text-stone-800">{p.phase_name}</p><p className="text-xs text-stone-500">Planned: {p.planned_date ? formatDate(p.planned_date) : 'Not set'}</p></div>)}</div> : <p className="mt-4 text-sm text-stone-500">No upcoming milestones.</p>}
      </Card>

      {/* Recent Decisions */}
      <Card>
        <CardHeader title="Recent decisions" description="Latest entries in the decision log." />
        {recentDecisions.length > 0 ? <div className="mt-4 space-y-3 text-sm">{recentDecisions.map((d) => <div key={d.id}><p className="font-medium text-stone-800">{d.title}</p><p className="text-xs text-stone-500">{formatDate(d.decision_date)} - {d.category}</p></div>)}</div> : <p className="mt-4 text-sm text-stone-500">No decisions logged yet.</p>}
      </Card>
    </div>
  </div>;
}
