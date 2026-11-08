import { HeartPulse } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { computeBudgetTotals, computeContingency } from '@/lib/budgetCalculations';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatTaka } from '@/lib/format';
import type { ProjectRow } from '@/types/database';

interface Data { project: ProjectRow | null; workspace: BudgetWorkspace | null; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null };
  return { project, workspace: await loadBudgetWorkspace(project.id) };
}

type HealthScore = 'healthy' | 'monitor' | 'funding_risk' | 'critical';
const SCORE_TONE: Record<HealthScore, BadgeTone> = { healthy: 'success', monitor: 'info', funding_risk: 'warning', critical: 'error' };
const SCORE_LABEL: Record<HealthScore, string> = { healthy: 'Healthy', monitor: 'Monitor Closely', funding_risk: 'Funding Risk', critical: 'Critical' };

interface MetricCheck {
  label: string;
  value: string;
  pct: number;
  status: 'good' | 'warn' | 'bad';
}

export function FinancialHealthPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project || !data.workspace) return <EmptyState icon={HeartPulse} title="No project yet" description="Financial health needs a project with a budget and funding." />;

  const { workspace } = data;
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingency = computeContingency(lines, workspace.drawdowns.filter((d) => active && d.budget_version_id === active.id));
  const funding = workspace.fundingSummary;
  const availableCash = funding.availableCash;
  const outstandingLiabilities = workspace.supplierInvoices.reduce((s, inv) => s + Number(inv.balance_bdt), 0);

  const budgetVariance = totals.budget - totals.exposure;
  const budgetVariancePct = totals.budget > 0 ? (budgetVariance / totals.budget) * 100 : 0;
  const fundingGapPct = totals.budget > 0 ? (funding.fundingGap / totals.budget) * 100 : 0;
  const liabilityToCashRatio = availableCash > 0 ? (outstandingLiabilities / availableCash) * 100 : outstandingLiabilities > 0 ? 100 : 0;
  const contingencyPct = contingency.original > 0 ? (contingency.remaining / contingency.original) * 100 : 100;

  const checks: MetricCheck[] = [
    { label: 'Budget variance', value: formatTaka(budgetVariance), pct: Math.max(0, budgetVariancePct), status: budgetVariance >= 0 ? 'good' : budgetVariancePct > -10 ? 'warn' : 'bad' },
    { label: 'Funding gap', value: formatTaka(funding.fundingGap), pct: Math.max(0, 100 - fundingGapPct), status: funding.fundingGap <= 0 ? 'good' : fundingGapPct < 20 ? 'warn' : 'bad' },
    { label: 'Risk-adjusted funding', value: formatTaka(funding.riskAdjustedFunding), pct: totals.budget > 0 ? Math.min(100, (funding.riskAdjustedFunding / totals.budget) * 100) : 0, status: funding.riskAdjustedFunding >= totals.budget * 0.8 ? 'good' : funding.riskAdjustedFunding >= totals.budget * 0.5 ? 'warn' : 'bad' },
    { label: 'Available cash', value: formatTaka(availableCash), pct: totals.budget > 0 ? Math.min(100, (availableCash / totals.budget) * 100) : 0, status: availableCash > outstandingLiabilities ? 'good' : availableCash > 0 ? 'warn' : 'bad' },
    { label: 'Outstanding liabilities', value: formatTaka(outstandingLiabilities), pct: Math.max(0, 100 - liabilityToCashRatio), status: liabilityToCashRatio < 50 ? 'good' : liabilityToCashRatio < 100 ? 'warn' : 'bad' },
    { label: 'Contingency remaining', value: formatTaka(contingency.remaining), pct: contingencyPct, status: contingencyPct > 50 ? 'good' : contingencyPct > 20 ? 'warn' : 'bad' },
  ];

  const goodCount = checks.filter((c) => c.status === 'good').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const badCount = checks.filter((c) => c.status === 'bad').length;
  const overallScore: HealthScore = badCount >= 3 ? 'critical' : badCount >= 1 || warnCount >= 3 ? 'funding_risk' : warnCount >= 1 ? 'monitor' : 'healthy';

  return <div className="space-y-6">
    <PageHeader title="Financial Health" description="A composite score from budget variance, funding gap, risk-adjusted funding, cash, liabilities, and contingency." />

    <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <HeartPulse className="h-10 w-10 text-stone-400" aria-hidden />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Financial Health Score</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-3xl font-semibold text-stone-900">{SCORE_LABEL[overallScore]}</span>
          <StatusBadge tone={SCORE_TONE[overallScore]}>{goodCount} good / {warnCount} monitor / {badCount} at risk</StatusBadge>
        </div>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {checks.map((check) => (
        <Card key={check.label}>
          <CardHeader title={check.label} />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xl font-semibold text-stone-900">{check.value}</span>
              <StatusBadge tone={check.status === 'good' ? 'success' : check.status === 'warn' ? 'warning' : 'error'}>
                {check.status === 'good' ? 'Good' : check.status === 'warn' ? 'Monitor' : 'At Risk'}
              </StatusBadge>
            </div>
            <ProgressBar value={check.pct} tone={check.status === 'good' ? 'primary' : check.status === 'warn' ? 'accent' : 'primary'} label={check.label} />
          </div>
        </Card>
      ))}
    </div>
  </div>;
}
