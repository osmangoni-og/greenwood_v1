import { Card, CardHeader } from '@/components/Card';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { computeBudgetTotals, computeContingencyByCategory, computePurchaseOrderBalance } from '@/lib/budgetCalculations';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatTaka } from '@/lib/format';

interface Props {
  workspace: BudgetWorkspace;
}

const CATEGORY_COLORS = ['#0f766e', '#0891b2', '#ca8a04', '#c2410c', '#9333ea'];

export function BudgetChartsPanel({ workspace }: Props) {
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingencyByCat = computeContingencyByCategory(lines, workspace.drawdowns.filter((d) => active && d.budget_version_id === active.id));

  // 1. Budget vs Actual
  const budgetVsActual: BarDatum[] = [{ label: 'Budget', primary: totals.budget, secondary: undefined }, { label: 'Actual', primary: totals.actual, secondary: undefined }, { label: 'Committed', primary: totals.committed, secondary: undefined }, { label: 'Exposure', primary: totals.exposure, secondary: undefined }];

  // 2. Forecast vs Budget
  const forecastVsBudget: BarDatum[] = [{ label: 'Budget', primary: totals.budget, secondary: undefined }, { label: 'Forecast', primary: totals.forecastFinal, secondary: undefined }, { label: 'Saving', primary: totals.expectedSaving, secondary: undefined }, { label: 'Overrun', primary: totals.expectedOverrun, secondary: undefined }];

  // 3. Supplier Liability Trend (monthly from invoice dates)
  const liabilityByMonth = new Map<string, number>();
  for (const inv of workspace.supplierInvoices) {
    const month = inv.invoice_date.slice(0, 7);
    liabilityByMonth.set(month, (liabilityByMonth.get(month) ?? 0) + Number(inv.balance_bdt));
  }
  const liabilityTrend: BarDatum[] = [...liabilityByMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, value]) => ({ label: month, primary: value }));

  // 4. PO Exposure
  const poExposure: BarDatum[] = workspace.purchaseOrders.filter((po) => po.status === 'issued').map((po) => {
    const balance = computePurchaseOrderBalance(po, workspace.deliveries);
    return { label: po.po_number, primary: balance.amount, secondary: balance.open };
  });

  // 5. Contingency by Category
  const contingencyChart: BarDatum[] = contingencyByCat.map((row) => ({ label: row.label, primary: row.original, secondary: row.used }));
  const contingencyDonut = contingencyByCat.filter((r) => r.original > 0).map((row, i) => ({ label: row.label, value: row.original, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));

  // 6. Material Commitments vs Deliveries
  const commitmentVsDelivery: BarDatum[] = workspace.purchaseOrders.filter((po) => po.status !== 'cancelled').map((po) => {
    const balance = computePurchaseOrderBalance(po, workspace.deliveries);
    return { label: po.po_number, primary: balance.amount, secondary: balance.delivered };
  });

  return <div className="grid gap-6 lg:grid-cols-2">
    <Card>
      <CardHeader title="Budget vs actual" description="Total budget compared to actual, committed, and exposure." />
      <div className="mt-4 h-56"><BarChart data={budgetVsActual} primaryLabel="Amount" formatValue={formatTaka} /></div>
    </Card>

    <Card>
      <CardHeader title="Forecast vs budget" description="Forecast final cost against budget, with saving or overrun." />
      <div className="mt-4 h-56"><BarChart data={forecastVsBudget} primaryLabel="Amount" formatValue={formatTaka} /></div>
    </Card>

    <Card>
      <CardHeader title="Supplier liability trend" description="Outstanding invoice balance by invoice month." />
      {liabilityTrend.length > 0 ? <div className="mt-4 h-56"><BarChart data={liabilityTrend} primaryLabel="Outstanding" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No supplier invoices recorded.</p>}
    </Card>

    <Card>
      <CardHeader title="Purchase order exposure" description="PO amount vs open (undelivered) balance per order." />
      {poExposure.length > 0 ? <div className="mt-4 h-56"><BarChart data={poExposure} primaryLabel="PO amount" secondaryLabel="Open balance" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No issued purchase orders.</p>}
    </Card>

    <Card>
      <CardHeader title="Contingency by category" description="Budgeted vs used contingency for each category." />
      {contingencyChart.length > 0 ? <div className="mt-4 h-56"><BarChart data={contingencyChart} primaryLabel="Budgeted" secondaryLabel="Used" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No contingency budget lines.</p>}
    </Card>

    <Card>
      <CardHeader title="Contingency allocation" description="Share of contingency budget by category." />
      {contingencyDonut.length > 0 ? <div className="mt-4"><DonutChart segments={contingencyDonut} centerLabel="Budgeted" centerValue={formatTaka(contingencyByCat.reduce((s, r) => s + r.original, 0))} /></div> : <p className="mt-4 text-sm text-stone-500">No contingency budget to chart.</p>}
    </Card>

    <Card>
      <CardHeader title="Material commitments vs deliveries" description="PO amount vs delivered amount per order. The gap is the open balance." />
      {commitmentVsDelivery.length > 0 ? <div className="mt-4 h-56"><BarChart data={commitmentVsDelivery} primaryLabel="PO amount" secondaryLabel="Delivered" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No purchase orders with deliveries.</p>}
    </Card>
  </div>;
}
