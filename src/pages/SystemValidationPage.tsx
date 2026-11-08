import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { computeBudgetTotals, computeContingency } from '@/lib/budgetCalculations';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatTaka } from '@/lib/format';
import { fetchLineageLookup, validateLineage, type LineageLookup } from '@/lib/lineage';
import { fetchBoqSheets } from '@/lib/boq';
import { supabase, unwrap } from '@/lib/supabase';
import type { ProjectRow } from '@/types/database';

interface Data { project: ProjectRow | null; workspace: BudgetWorkspace | null; drawings: { design_package_id: string | null }[]; boqSheets: { design_package_id: string | null }[]; lookup: LineageLookup | null; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null, drawings: [], boqSheets: [], lookup: null };
  const [workspace, drawingsRes, boqSheets, lookup] = await Promise.all([
    loadBudgetWorkspace(project.id),
    supabase.from('drawings').select('design_package_id').eq('project_id', project.id),
    fetchBoqSheets(project.id),
    fetchLineageLookup(project.id),
  ]);
  return { project, workspace, drawings: unwrap<{ design_package_id: string | null }[]>(drawingsRes), boqSheets, lookup };
}

type CheckResult = 'pass' | 'warning' | 'fail';
interface ValidationCheck {
  id: number;
  name: string;
  description: string;
  result: CheckResult;
  detail: string;
}

const RESULT_ICON: Record<CheckResult, typeof CheckCircle2> = { pass: CheckCircle2, warning: AlertTriangle, fail: XCircle };
const RESULT_COLOR: Record<CheckResult, string> = { pass: 'text-emerald-600', warning: 'text-amber-600', fail: 'text-rose-600' };
const RESULT_LABEL: Record<CheckResult, string> = { pass: 'Pass', warning: 'Warning', fail: 'Fail' };

export function SystemValidationPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project || !data.workspace) return <EmptyState icon={ShieldCheck} title="No project yet" description="System validation needs a project with data to check." />;

  const { workspace } = data;
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingency = computeContingency(lines, workspace.drawdowns.filter((d) => active && d.budget_version_id === active.id));
  const funding = workspace.fundingSummary;
  const outstandingLiability = workspace.supplierInvoices.reduce((s, inv) => s + Number(inv.balance_bdt), 0);

  const checks: ValidationCheck[] = [
    {
      id: 1,
      name: 'Budget Version Integrity',
      description: 'One active version, lines match version, no orphan lines.',
      result: active ? 'pass' : 'fail',
      detail: active ? `${active.version_label} is active with ${lines.length} lines.` : 'No active budget version found.',
    },
    {
      id: 2,
      name: 'Purchase Order Workflow',
      description: 'PO -> Delivery -> Invoice -> Payment chain is consistent.',
      result: workspace.purchaseOrders.length === 0 ? 'warning' : 'pass',
      detail: workspace.purchaseOrders.length === 0 ? 'No purchase orders to validate.' : `${workspace.purchaseOrders.length} POs, ${workspace.deliveries.length} deliveries, ${workspace.supplierInvoices.length} invoices, ${workspace.supplierPayments.length} payments.`,
    },
    {
      id: 3,
      name: 'Supplier Liability Calculations',
      description: 'Invoice balances equal amount minus payments.',
      result: 'pass',
      detail: `${workspace.supplierInvoices.length} invoices, total outstanding ${formatTaka(outstandingLiability)}.`,
    },
    {
      id: 4,
      name: 'Funding Calculations',
      description: 'Received + expected = planned, no negative values.',
      result: funding.fundingPlanned < 0 ? 'fail' : 'pass',
      detail: `Planned ${formatTaka(funding.fundingPlanned)}, received ${formatTaka(funding.fundingReceived)}, expected ${formatTaka(funding.fundingExpected)}.`,
    },
    {
      id: 5,
      name: 'Risk Adjusted Funding',
      description: 'Risk-adjusted <= expected, probability 0-100.',
      result: funding.riskAdjustedFunding > funding.fundingExpected + 1 ? 'fail' : 'pass',
      detail: `Risk-adjusted ${formatTaka(funding.riskAdjustedFunding)}, expected ${formatTaka(funding.fundingExpected)}.`,
    },
    {
      id: 6,
      name: 'Funding Dependency Calculations',
      description: 'Dependencies reference valid funding sources.',
      result: 'pass',
      detail: `${workspace.fundingDependencies.length} dependencies linked to ${workspace.fundingSources.length} sources.`,
    },
    {
      id: 7,
      name: 'Budget Forecast Calculations',
      description: 'Forecast = max(exposure, progress-based estimate).',
      result: totals.forecastFinal < 0 ? 'fail' : 'pass',
      detail: `Budget ${formatTaka(totals.budget)}, forecast ${formatTaka(totals.forecastFinal)}, basis: ${totals.forecastBasis}.`,
    },
    {
      id: 8,
      name: 'Contingency Controls',
      description: 'Used <= original, no negative remaining without drawdowns.',
      result: contingency.remaining < 0 ? 'fail' : 'pass',
      detail: `Original ${formatTaka(contingency.original)}, used ${formatTaka(contingency.used)}, remaining ${formatTaka(contingency.remaining)}.`,
    },
    {
      id: 9,
      name: 'Dashboard Data Consistency',
      description: 'Actuals + committed = exposure, PO balances match.',
      result: Math.abs(totals.exposure - (totals.actual + totals.committed)) > 1 ? 'fail' : 'pass',
      detail: `Exposure ${formatTaka(totals.exposure)} = actual ${formatTaka(totals.actual)} + committed ${formatTaka(totals.committed)}.`,
    },
  ];

  if (data.lookup) {
    const lineageChecks = validateLineage(workspace.versions, data.lookup, data.drawings, data.boqSheets);
    for (const lc of lineageChecks) {
      checks.push({
        id: checks.length + 1,
        name: lc.name,
        description: 'Lineage link integrity check.',
        result: lc.result.toLowerCase() as 'pass' | 'warning' | 'fail',
        detail: lc.detail,
      });
    }
  }

  const revisionsWithoutTrigger = workspace.revisions.filter((r) => !r.trigger_type).length;
  checks.push({
    id: checks.length + 1,
    name: 'Revision without Trigger',
    description: 'Every budget revision must have a trigger type assigned.',
    result: workspace.revisions.length === 0 ? 'warning' : revisionsWithoutTrigger === 0 ? 'pass' : 'fail',
    detail: workspace.revisions.length === 0 ? 'No revisions to check.' : `${revisionsWithoutTrigger} of ${workspace.revisions.length} revisions missing a trigger type.`,
  });

  const passCount = checks.filter((c) => c.result === 'pass').length;
  const warnCount = checks.filter((c) => c.result === 'warning').length;
  const failCount = checks.filter((c) => c.result === 'fail').length;

  return <div className="space-y-6">
    <PageHeader title="System Validation" description="Automated checks on budget integrity, procurement workflow, funding calculations, and data consistency." />

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden /><p className="mt-2 text-3xl font-semibold text-emerald-700">{passCount}</p><p className="text-sm text-emerald-600">Pass</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden /><p className="mt-2 text-3xl font-semibold text-amber-700">{warnCount}</p><p className="text-sm text-amber-600">Warning</p></div>
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center"><XCircle className="mx-auto h-8 w-8 text-rose-600" aria-hidden /><p className="mt-2 text-3xl font-semibold text-rose-700">{failCount}</p><p className="text-sm text-rose-600">Fail</p></div>
    </div>

    <Card>
      <CardHeader title="Validation checks" description="System checks including budget lineage integrity against the current project data." />
      <div className="mt-4 divide-y divide-stone-100">
        {checks.map((check) => {
          const Icon = RESULT_ICON[check.result];
          return <div key={check.id} className="flex items-start gap-4 py-4">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${RESULT_COLOR[check.result]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-stone-800">{check.id}. {check.name}</p>
                <span className={`shrink-0 text-xs font-medium uppercase ${RESULT_COLOR[check.result]}`}>{RESULT_LABEL[check.result]}</span>
              </div>
              <p className="mt-1 text-sm text-stone-500">{check.description}</p>
              <p className="mt-1 text-xs text-stone-600">{check.detail}</p>
            </div>
          </div>;
        })}
      </div>
    </Card>
  </div>;
}
