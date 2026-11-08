import { Rocket } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { loadExecutiveDashboard, type ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatPercent } from '@/lib/format';

interface Data { workspace: BudgetWorkspace | null; exec: ExecutiveDashboardData | null; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { workspace: null, exec: null };
  const [workspace, exec] = await Promise.all([loadBudgetWorkspace(project.id), loadExecutiveDashboard()]);
  return { workspace, exec };
}

type ReadinessLevel = 'ready' | 'at_risk' | 'action_required';
const LEVEL_COLOR: Record<ReadinessLevel, string> = { ready: 'bg-emerald-50 text-emerald-700 border-emerald-200', at_risk: 'bg-amber-50 text-amber-700 border-amber-200', action_required: 'bg-rose-50 text-rose-700 border-rose-200' };
const LEVEL_LABEL: Record<ReadinessLevel, string> = { ready: 'Ready', at_risk: 'At Risk', action_required: 'Action Required' };

function scoreLevel(pct: number): ReadinessLevel {
  if (pct >= 80) return 'ready';
  if (pct >= 50) return 'at_risk';
  return 'action_required';
}

export function ReadinessPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.workspace || !data.exec) return <EmptyState icon={Rocket} title="No project yet" description="Readiness needs a project with budget and operational data." />;

  const { workspace, exec } = data;
  const funding = workspace.fundingSummary;

  // Funding readiness
  const fundingCoverage = funding.fundingCoveragePercent;
  const fundingReadiness = Math.min(100, fundingCoverage);

  // Procurement readiness
  const totalPOs = workspace.purchaseOrders.length;
  const deliveredPOs = workspace.purchaseOrders.filter((po) => po.status === 'received').length;
  const procurementReadiness = totalPOs > 0 ? (deliveredPOs / totalPOs) * 100 : 50;

  // Construction readiness
  const constructionReadiness = exec.project.construction_progress_pct;

  // Document readiness
  const docCount = exec.recentDocuments.length;
  const documentReadiness = Math.min(100, docCount * 20);

  // Contract readiness
  const signedContracts = exec.phases.filter((p) => p.actual_date !== null).length;
  const totalPhases = exec.phases.length;
  const contractReadiness = totalPhases > 0 ? (signedContracts / totalPhases) * 100 : 0;

  // Quality readiness
  const openDefects = exec.openDefects.length;
  const totalInspections = Math.max(1, openDefects + 10);
  const qualityReadiness = Math.max(0, ((totalInspections - openDefects) / totalInspections) * 100);

  const scores = [
    { label: 'Funding Readiness', pct: fundingReadiness },
    { label: 'Procurement Readiness', pct: procurementReadiness },
    { label: 'Construction Readiness', pct: constructionReadiness },
    { label: 'Document Readiness', pct: documentReadiness },
    { label: 'Contract Readiness', pct: contractReadiness },
    { label: 'Quality Readiness', pct: qualityReadiness },
  ];
  const overall = scores.reduce((s, r) => s + r.pct, 0) / scores.length;
  const overallLevel = scoreLevel(overall);

  return <div className="space-y-6">
    <PageHeader title="Project Readiness" description="A composite readiness score across funding, procurement, construction, documents, contracts, and quality." />

    <div className={`rounded-2xl border p-6 text-center ${LEVEL_COLOR[overallLevel]}`}>
      <p className="text-xs font-medium uppercase tracking-wide">Overall Readiness</p>
      <p className="mt-2 text-5xl font-semibold tracking-tight">{formatPercent(overall)}</p>
      <p className="mt-2 text-sm font-medium">{LEVEL_LABEL[overallLevel]}</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scores.map((score) => {
        const level = scoreLevel(score.pct);
        return <Card key={score.label}>
          <CardHeader title={score.label} />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold text-stone-900">{formatPercent(score.pct)}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${LEVEL_COLOR[level]}`}>{LEVEL_LABEL[level]}</span>
            </div>
            <ProgressBar value={score.pct} tone={level === 'ready' ? 'primary' : level === 'at_risk' ? 'accent' : 'primary'} label={score.label} />
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
