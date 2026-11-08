import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState } from '@/components/StatePanel';
import { AlertTriangle, Landmark, ReceiptText, Wallet } from 'lucide-react';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatDate, formatTaka } from '@/lib/format';
import type { SupplierInvoiceBalanceRow } from '@/types/database';
import { SupplierInvoiceModal, SupplierPaymentModal } from '@/pages/budget/SupplierEntryModals';
import { SupplierAgingPanel } from '@/pages/budget/SupplierAgingPanel';

interface Props {
  projectId: string;
  workspace: BudgetWorkspace;
  onChanged: () => void;
}

type InvoiceStatus = 'Paid' | 'Partly paid' | 'Overdue' | 'Unpaid';

const STATUS_TONE: Record<InvoiceStatus, BadgeTone> = { Paid: 'success', 'Partly paid': 'info', Overdue: 'error', Unpaid: 'warning' };

function invoiceStatus(row: SupplierInvoiceBalanceRow, today: string): InvoiceStatus {
  if (row.balance_bdt <= 0) return 'Paid';
  if (row.due_date && row.due_date < today) return 'Overdue';
  if (row.paid_bdt > 0) return 'Partly paid';
  return 'Unpaid';
}

export function SupplierLedgerPanel({ projectId, workspace, onChanged }: Props) {
  const [recordingInvoice, setRecordingInvoice] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const vendorName = (id: string | null) => workspace.vendors.find((vendor) => vendor.id === id)?.name ?? 'No vendor';
  const invoiceNumber = (id: string) => workspace.supplierInvoices.find((row) => row.supplier_invoice_id === id)?.invoice_number ?? '';
  const invoiced = workspace.supplierInvoices.reduce((total, row) => total + Number(row.amount_bdt), 0);
  const paid = workspace.supplierInvoices.reduce((total, row) => total + Number(row.paid_bdt), 0);
  const outstanding = workspace.supplierInvoices.reduce((total, row) => total + Number(row.balance_bdt), 0);
  const overdue = workspace.supplierInvoices.filter((row) => row.balance_bdt > 0 && row.due_date && row.due_date < today).reduce((total, row) => total + Number(row.balance_bdt), 0);
  const payable = workspace.supplierInvoices.filter((row) => row.balance_bdt > 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" onClick={() => setRecordingPayment(true)} disabled={payable.length === 0}><Wallet className="h-4 w-4" aria-hidden /> Record payment</Button>
      <Button onClick={() => setRecordingInvoice(true)}><Plus className="h-4 w-4" aria-hidden /> Record invoice</Button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Invoiced" value={formatTaka(invoiced)} hint="All supplier invoices" icon={ReceiptText} tone="primary" />
      <StatCard label="Paid to suppliers" value={formatTaka(paid)} hint="Cash outflow" icon={Wallet} tone="accent" />
      <StatCard label="Outstanding liability" value={formatTaka(outstanding)} hint="Invoices minus payments" icon={Landmark} tone={outstanding > 0 ? 'error' : 'primary'} />
      <StatCard label="Overdue liability" value={formatTaka(overdue)} hint="Unpaid balance past due date" icon={AlertTriangle} tone={overdue > 0 ? 'error' : 'accent'} />
    </div>

    <Card>
      <CardHeader title="Supplier invoice register" description="Invoices are liabilities. They do not add cost again; deliveries carry the actual cost." />
      {workspace.supplierInvoices.length === 0 ? <EmptyState icon={ReceiptText} title="No supplier invoices" description="Record an invoice when a supplier bills for materials." /> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Invoice</th><th className="py-2 pr-4 font-medium">Vendor</th><th className="py-2 pr-4 font-medium">Due</th><th className="py-2 pr-4 font-medium">PO</th><th className="py-2 pr-4 text-right font-medium">Amount</th><th className="py-2 pr-4 text-right font-medium">Paid</th><th className="py-2 pr-4 text-right font-medium">Balance</th><th className="py-2 pr-4 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.supplierInvoices.map((row) => {
                const status = invoiceStatus(row, today);
                const order = workspace.purchaseOrders.find((po) => po.id === row.purchase_order_id);
                return <tr key={row.supplier_invoice_id}>
                  <td className="py-3 pr-4"><p className="font-medium text-stone-800">{row.invoice_number}</p><p className="text-xs text-stone-500">{formatDate(row.invoice_date)}</p></td>
                  <td className="py-3 pr-4 text-stone-600">{vendorName(row.vendor_id)}</td>
                  <td className="py-3 pr-4 text-stone-600">{row.due_date ? formatDate(row.due_date) : '-'}</td>
                  <td className="py-3 pr-4 text-stone-600">{order?.po_number ?? '-'}</td>
                  <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.amount_bdt))}</td>
                  <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.paid_bdt))}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(Number(row.balance_bdt))}</td>
                  <td className="py-3 pr-4"><StatusBadge tone={STATUS_TONE[status]}>{status}</StatusBadge></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    <Card>
      <CardHeader title="Supplier payment register" description="Cash paid out against invoices. Append-only for audit." />
      {workspace.supplierPayments.length === 0 ? <p className="mt-4 text-sm text-stone-500">No supplier payments recorded.</p> : (
        <div className="mt-4 divide-y divide-stone-100">
          {workspace.supplierPayments.map((row) => {
            const invoice = workspace.supplierInvoices.find((item) => item.supplier_invoice_id === row.supplier_invoice_id);
            return <div key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div><p className="font-medium text-stone-800">{vendorName(invoice?.vendor_id ?? null)} | Invoice {invoiceNumber(row.supplier_invoice_id)}</p><p className="text-xs text-stone-500">{formatDate(row.payment_date)}{row.reference ? ` | Ref ${row.reference}` : ''}{row.notes ? ` | ${row.notes}` : ''}</p></div>
              <span className="font-semibold text-stone-900">{formatTaka(Number(row.amount_bdt))}</span>
            </div>;
          })}
        </div>
      )}
    </Card>

    {recordingInvoice && <SupplierInvoiceModal projectId={projectId} vendors={workspace.vendors} purchaseOrders={workspace.purchaseOrders} onClose={() => setRecordingInvoice(false)} onSaved={() => { setRecordingInvoice(false); onChanged(); }} />}
    {recordingPayment && <SupplierPaymentModal projectId={projectId} invoices={payable} vendors={workspace.vendors} onClose={() => setRecordingPayment(false)} onSaved={() => { setRecordingPayment(false); onChanged(); }} />}

    <SupplierAgingPanel workspace={workspace} today={today} vendorName={vendorName} />
  </div>;
}
