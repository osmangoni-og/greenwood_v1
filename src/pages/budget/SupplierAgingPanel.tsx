import { AlertTriangle, Landmark, ReceiptText, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatTaka } from '@/lib/format';
import type { SupplierInvoiceBalanceRow } from '@/types/database';

export interface AgingBuckets {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

export interface VendorLiabilityRow {
  vendorId: string | null;
  vendorName: string;
  invoiceCount: number;
  paid: number;
  outstanding: number;
}

export function computeAgingBuckets(invoices: SupplierInvoiceBalanceRow[], today: string): AgingBuckets {
  const buckets: AgingBuckets = { current: 0, days30: 0, days60: 0, days90Plus: 0 };
  const todayMs = new Date(today + 'T00:00:00').getTime();
  for (const inv of invoices) {
    if (inv.balance_bdt <= 0 || !inv.due_date) { buckets.current += inv.balance_bdt > 0 ? Number(inv.balance_bdt) : 0; continue; }
    const dueMs = new Date(inv.due_date + 'T00:00:00').getTime();
    const overdueDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
    const balance = Number(inv.balance_bdt);
    if (overdueDays <= 0) buckets.current += balance;
    else if (overdueDays <= 30) buckets.days30 += balance;
    else if (overdueDays <= 60) buckets.days60 += balance;
    else buckets.days90Plus += balance;
  }
  return buckets;
}

export function computeVendorLiability(invoices: SupplierInvoiceBalanceRow[], vendorName: (id: string | null) => string): VendorLiabilityRow[] {
  const map = new Map<string, VendorLiabilityRow>();
  for (const inv of invoices) {
    const key = inv.vendor_id ?? 'none';
    const existing = map.get(key) ?? { vendorId: inv.vendor_id, vendorName: vendorName(inv.vendor_id), invoiceCount: 0, paid: 0, outstanding: 0 };
    existing.invoiceCount += 1;
    existing.paid += Number(inv.paid_bdt);
    existing.outstanding += Number(inv.balance_bdt);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
}

interface Props {
  workspace: BudgetWorkspace;
  today: string;
  vendorName: (id: string | null) => string;
}

export function SupplierAgingPanel({ workspace, today, vendorName }: Props) {
  const buckets = computeAgingBuckets(workspace.supplierInvoices, today);
  const vendorRows = computeVendorLiability(workspace.supplierInvoices, vendorName);
  const totalOutstanding = buckets.current + buckets.days30 + buckets.days60 + buckets.days90Plus;

  const chartData: BarDatum[] = [
    { label: 'Current', primary: buckets.current },
    { label: '1–30 days', primary: buckets.days30 },
    { label: '31–60 days', primary: buckets.days60 },
    { label: '90+ days', primary: buckets.days90Plus },
  ];

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Current" value={formatTaka(buckets.current)} hint="Not yet due or paid early" icon={Wallet} tone="primary" />
      <StatCard label="1–30 days overdue" value={formatTaka(buckets.days30)} hint="Recently overdue" icon={ReceiptText} tone={buckets.days30 > 0 ? 'error' : 'accent'} />
      <StatCard label="31–60 days overdue" value={formatTaka(buckets.days60)} hint="Growing risk" icon={Landmark} tone={buckets.days60 > 0 ? 'error' : 'accent'} />
      <StatCard label="90+ days overdue" value={formatTaka(buckets.days90Plus)} hint="Critical — likely bad debt" icon={AlertTriangle} tone={buckets.days90Plus > 0 ? 'error' : 'accent'} />
    </div>

    <Card>
      <CardHeader title="Outstanding by aging bucket" description={`Total outstanding: ${formatTaka(totalOutstanding)}`} />
      {totalOutstanding > 0 ? <div className="mt-4 h-48"><BarChart data={chartData} primaryLabel="Outstanding" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No outstanding supplier balance.</p>}
    </Card>

    <Card>
      <CardHeader title="Vendor liability breakdown" description="Outstanding balance per vendor, sorted highest first." />
      {vendorRows.length === 0 ? <p className="mt-4 text-sm text-stone-500">No supplier invoices recorded.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Vendor</th><th className="py-2 pr-4 text-right font-medium">Invoices</th><th className="py-2 pr-4 text-right font-medium">Paid</th><th className="py-2 pr-4 text-right font-medium">Outstanding</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {vendorRows.map((row) => <tr key={row.vendorId ?? 'none'}>
                <td className="py-3 pr-4 font-medium text-stone-800">{row.vendorName}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{row.invoiceCount}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(row.paid)}</td>
                <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(row.outstanding)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  </div>;
}
