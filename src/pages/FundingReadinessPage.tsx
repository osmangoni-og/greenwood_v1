import { Landmark } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { buildPhaseFunding, type PhaseFundingRow } from '@/lib/fundingSummary';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatPercent, formatTaka } from '@/lib/format';
import type { ProjectRow } from '@/types/database';

interface Data { project: ProjectRow | null; workspace: BudgetWorkspace | null; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null };
  return { project, workspace: await loadBudgetWorkspace(project.id) };
}

type ReadinessStatus = 'READY' | 'AT RISK' | 'NOT FUNDED';
const STATUS_TONE: Record<ReadinessStatus, BadgeTone> = { READY: 'success', 'AT RISK': 'warning', 'NOT FUNDED': 'error' };

interface PhaseFunding extends PhaseFundingRow {
  phaseName: string;
  status: ReadinessStatus;
}

function computePhaseFunding(workspace: BudgetWorkspace): PhaseFunding[] {
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  return buildPhaseFunding({
    budgetLines: lines,
    phaseKeys: CONSTRUCTION_PHASES.map(([key]) => key),
    dependencies: workspace.fundingDependencies,
    sources: workspace.fundingSources,
  }).map((row) => {
    const phaseName = CONSTRUCTION_PHASES.find(([key]) => key === row.phaseKey)?.[1] ?? row.phaseKey;
    const status: ReadinessStatus = row.coverage >= 100 ? 'READY' : row.coverage >= 50 ? 'AT RISK' : 'NOT FUNDED';
    return { ...row, phaseName, status };
  });
}

export function FundingReadinessPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project || !data.workspace) return <EmptyState icon={Landmark} title="No project yet" description="Funding readiness needs a project with a budget and funding sources." />;

  const phases = computePhaseFunding(data.workspace);
  const readyCount = phases.filter((p) => p.status === 'READY').length;
  const atRiskCount = phases.filter((p) => p.status === 'AT RISK').length;
  const notFundedCount = phases.filter((p) => p.status === 'NOT FUNDED').length;
  const avgCoverage = phases.length > 0 ? phases.reduce((s, p) => s + p.coverage, 0) / phases.length : 0;

  return <div className="space-y-6">
    <PageHeader title="Funding Readiness" description="Whether each construction phase has secured sufficient funding. Risk-adjusted coverage = risk-adjusted funding / required funding." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Ready" value={String(readyCount)} hint="Phases with >= 100% coverage" tone="success" />
      <SummaryCard label="At risk" value={String(atRiskCount)} hint="Phases with 50–99% coverage" tone="warning" />
      <SummaryCard label="Not funded" value={String(notFundedCount)} hint="Phases with < 50% coverage" tone="error" />
      <SummaryCard label="Avg coverage" value={formatPercent(avgCoverage)} hint="Across all phases with funding needs" tone="primary" />
    </div>

    {phases.length === 0 ? <EmptyState icon={Landmark} title="No phase funding data" description="Add budget phase lines and funding dependencies to see readiness." /> : (
      <Card>
        <CardHeader title="Phase funding readiness" description="Required funding, secured, expected, risk-adjusted, coverage %, and status for each phase. Funding is allocated to phases through funding dependencies." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Phase</th><th className="py-2 pr-4 text-right font-medium">Required</th><th className="py-2 pr-4 text-right font-medium">Secured</th><th className="py-2 pr-4 text-right font-medium">Expected</th><th className="py-2 pr-4 text-right font-medium">Risk-adjusted</th><th className="py-2 pr-4 font-medium">Coverage</th><th className="py-2 pr-4 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {phases.map((p) => <tr key={p.phaseKey}>
                <td className="py-3 pr-4 font-medium text-stone-800">{p.phaseName}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(p.required)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(p.secured)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(p.expected)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(p.riskAdjusted)}</td>
                <td className="py-3 pr-4"><div className="flex items-center gap-2"><span className="text-xs text-stone-600">{formatPercent(p.coverage)}</span><div className="w-20"><ProgressBar value={Math.min(100, p.coverage)} tone={p.coverage >= 100 ? 'primary' : p.coverage >= 50 ? 'accent' : 'primary'} label={`${p.phaseName} coverage`} /></div></div></td>
                <td className="py-3 pr-4"><StatusBadge tone={STATUS_TONE[p.status]}>{p.status}</StatusBadge></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>;
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: BadgeTone }) {
  const colorMap: Record<string, string> = { success: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', error: 'bg-rose-50 text-rose-700', primary: 'bg-primary-50 text-primary-700' };
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-stone-500">{label}</p><p className={`mt-1 text-2xl font-semibold tracking-tight ${colorMap[tone] ?? colorMap.primary}`}>{value}</p><p className="mt-1 text-xs text-stone-500">{hint}</p></div>;
}
