import { AlertTriangle, ArrowDownCircle, Landmark, Receipt, Stethoscope, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { computePurchaseOrderBalance } from '@/lib/budgetCalculations';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatTaka } from '@/lib/format';
import type { ProjectRow } from '@/types/database';

interface Data { project: ProjectRow | null; workspace: BudgetWorkspace | null; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null };
  return { project, workspace: await loadBudgetWorkspace(project.id) };
}

type HealthLevel = 'healthy' | 'monitor' | 'risk' | 'critical';
const HEALTH_TONE: Record<HealthLevel, BadgeTone> = { healthy: 'success', monitor: 'info', risk: 'warning', critical: 'error' };
const HEALTH_LABEL: Record<HealthLevel, string> = { healthy: 'Healthy', monitor: 'Monitor Closely', risk: 'Funding Risk', critical: 'Critical' };

export function ProcurementHealthPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project || !data.workspace) return <EmptyState icon={Stethoscope} title="No project yet" description="Procurement health needs a project with purchase orders and deliveries." />;

  const { workspace } = data;
  const issuedPOs = workspace.purchaseOrders.filter((po) => po.status === 'issued');
  const openPOAmount = issuedPOs.reduce((s, po) => s + computePurchaseOrderBalance(po, workspace.deliveries).open, 0);
  const deliveredAmount = workspace.deliveries.reduce((s, d) => s + Number(d.total_amount_bdt), 0);
  const outstandingCommitments = workspace.commitments.filter((c) => c.status === 'active').reduce((s, c) => s + Number(c.outstanding_amount_bdt), 0);
  const supplierLiabilities = workspace.supplierInvoices.reduce((s, inv) => s + Number(inv.balance_bdt), 0);
  const vendorBalances = workspace.vendors.length;

  const topCostRisks = issuedPOs.map((po) => ({ po, balance: computePurchaseOrderBalance(po, workspace.deliveries) }))
    .filter((r) => r.balance.open > 0)
    .sort((a, b) => b.balance.open - a.balance.open)
    .slice(0, 5);

  const poChart: BarDatum[] = issuedPOs.map((po) => {
    const bal = computePurchaseOrderBalance(po, workspace.deliveries);
    return { label: po.po_number, primary: bal.amount, secondary: bal.delivered };
  });

  const overallHealth: HealthLevel = openPOAmount > 0 && supplierLiabilities > 0 ? 'monitor' : openPOAmount > 0 ? 'healthy' : 'healthy';

  return <div className="space-y-6">
    <PageHeader title="Procurement Health" description="Open commitments, supplier liabilities, delivery progress, and top cost risks across the procurement pipeline." />

    <div className="flex items-center gap-3">
      <StatusBadge tone={HEALTH_TONE[overallHealth]}>{HEALTH_LABEL[overallHealth]}</StatusBadge>
      <span className="text-sm text-stone-500">{issuedPOs.length} open purchase orders</span>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Open purchase orders" value={String(issuedPOs.length)} hint={formatTaka(openPOAmount) + ' open balance'} icon={ArrowDownCircle} tone="primary" />
      <StatCard label="Delivered amount" value={formatTaka(deliveredAmount)} hint="Total material deliveries" icon={Receipt} tone="accent" />
      <StatCard label="Outstanding commitments" value={formatTaka(outstandingCommitments)} hint="Active contract balances" icon={Landmark} tone={outstandingCommitments > 0 ? 'error' : 'accent'} />
      <StatCard label="Supplier liabilities" value={formatTaka(supplierLiabilities)} hint="Unpaid invoice balances" icon={Receipt} tone={supplierLiabilities > 0 ? 'error' : 'accent'} />
      <StatCard label="Vendor count" value={String(vendorBalances)} hint="Vendors on record" icon={Wallet} tone="primary" />
      <StatCard label="Top cost risk" value={topCostRisks.length > 0 ? formatTaka(topCostRisks[0].balance.open) : 'None'} hint={topCostRisks[0]?.po.po_number ?? 'No open POs'} icon={AlertTriangle} tone={topCostRisks.length > 0 ? 'error' : 'accent'} />
    </div>

    {poChart.length > 0 && (
      <Card>
        <CardHeader title="Purchase order amounts vs deliveries" description="PO amount compared to delivered amount for each open order." />
        <div className="mt-4 h-56"><BarChart data={poChart} primaryLabel="PO amount" secondaryLabel="Delivered" formatValue={formatTaka} /></div>
      </Card>
    )}

    {topCostRisks.length > 0 && (
      <Card>
        <CardHeader title="Top 5 cost risks" description="Open purchase orders with the largest undelivered balance." />
        <div className="mt-4 divide-y divide-stone-100">
          {topCostRisks.map((risk) => <div key={risk.po.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div><p className="font-medium text-stone-800">{risk.po.po_number}</p><p className="text-xs text-stone-500">{risk.po.description ?? 'No description'}</p></div>
            <div className="text-right"><p className="font-semibold text-stone-900">{formatTaka(risk.balance.open)}</p><p className="text-xs text-stone-500">of {formatTaka(risk.balance.amount)}</p></div>
          </div>)}
        </div>
      </Card>
    )}
  </div>;
}
