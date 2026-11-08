import { useState } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { recordActivity } from '@/lib/activity';
import { cancelPurchaseOrder, closeCostCommitment, linkDeliveryToPurchaseOrder, type BudgetWorkspace } from '@/lib/budget';
import { computePurchaseOrderBalance } from '@/lib/budgetCalculations';
import { formatDate, formatTaka } from '@/lib/format';
import type { PurchaseOrderRow } from '@/types/database';
import { CostEntryModal } from '@/pages/budget/CostEntryModal';

interface Props {
  projectId: string;
  workspace: BudgetWorkspace;
  onChanged: () => void;
}

const PO_TONE: Record<PurchaseOrderRow['status'], BadgeTone> = { issued: 'warning', received: 'success', cancelled: 'neutral' };

export function PurchasingPanel({ projectId, workspace, onChanged }: Props) {
  const [recording, setRecording] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, label: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await recordActivity({ projectId, action: 'update', entityType: 'budget_cost', entityId: id, summary: label });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this entry.');
    } finally {
      setBusyId(null);
    }
  }

  const vendorName = (id: string | null) => workspace.vendors.find((vendor) => vendor.id === id)?.name ?? 'No vendor';
  const issuedOrders = workspace.purchaseOrders.filter((po) => po.status === 'issued');
  const orderNumber = (id: string | null) => workspace.purchaseOrders.find((po) => po.id === id)?.po_number ?? '';

  return <div className="space-y-6">
    <div className="flex justify-end">
      <Button onClick={() => setRecording(true)}><Plus className="h-4 w-4" aria-hidden /> Record cost</Button>
    </div>
    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

    <Card>
      <CardHeader title="Purchase orders (commitments)" description="An open order is committed cost only for the part not yet delivered." />
      {workspace.purchaseOrders.length === 0 ? <p className="mt-4 text-sm text-stone-500">No purchase orders yet.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">PO</th><th className="py-2 pr-4 font-medium">Vendor</th><th className="py-2 pr-4 text-right font-medium">PO amount</th><th className="py-2 pr-4 text-right font-medium">Delivered</th><th className="py-2 pr-4 text-right font-medium">Open PO balance</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 text-right font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.purchaseOrders.map((po) => {
                const balance = computePurchaseOrderBalance(po, workspace.deliveries);
                return <tr key={po.id}>
                  <td className="py-3 pr-4"><p className="font-medium text-stone-800">{po.po_number}</p><p className="text-xs text-stone-500">{formatDate(po.order_date)}</p></td>
                  <td className="py-3 pr-4 text-stone-600">{vendorName(po.vendor_id)}</td>
                  <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(balance.amount)}</td>
                  <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(balance.delivered)}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-stone-900">{po.status === 'issued' ? formatTaka(balance.open) : formatTaka(0)}</td>
                  <td className="py-3 pr-4"><StatusBadge tone={PO_TONE[po.status]}>{po.status}</StatusBadge></td>
                  <td className="py-3 pr-4 text-right">{po.status === 'issued' && <Button variant="secondary" disabled={busyId === po.id} onClick={() => run(po.id, `Cancelled ${po.po_number}`, () => cancelPurchaseOrder(po.id))}><XCircle className="h-4 w-4" aria-hidden /> Cancel</Button>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    <Card>
      <CardHeader title="Material deliveries (actual cost)" description="Each delivery counts once as actual cost. Link it to its purchase order so the order's open balance drops." />
      {workspace.deliveries.length === 0 ? <p className="mt-4 text-sm text-stone-500">No material deliveries recorded.</p> : (
        <div className="mt-4 divide-y divide-stone-100">
          {workspace.deliveries.map((row) => <div key={row.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium text-stone-800">{row.material_type}</p><p className="text-xs text-stone-500">{formatDate(row.delivery_date)} | {formatTaka(Number(row.total_amount_bdt))}{row.purchase_order_id ? ` | PO ${orderNumber(row.purchase_order_id)}` : ' | Not linked to a PO'}</p></div>
            <select aria-label="Linked purchase order" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" value={row.purchase_order_id ?? ''} disabled={busyId === row.id} onChange={(e) => run(row.id, `Linked a delivery to a purchase order`, () => linkDeliveryToPurchaseOrder(row.id, e.target.value || null))}>
              <option value="">No purchase order</option>
              {issuedOrders.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}
            </select>
          </div>)}
        </div>
      )}
    </Card>

    <Card>
      <CardHeader title="Open contract commitments" description="Unpaid balances still owed under contracts and agreements." />
      {workspace.commitments.length === 0 ? <p className="mt-4 text-sm text-stone-500">No commitments recorded.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Party</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-4 text-right font-medium">Contract value</th><th className="py-2 pr-4 text-right font-medium">Outstanding</th><th className="py-2 pr-4 text-right font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.commitments.map((row) => <tr key={row.id}>
                <td className="py-3 pr-4 font-medium text-stone-800">{row.party_name}</td>
                <td className="py-3 pr-4 text-stone-600">{row.commitment_type.replace(/_/g, ' ')}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.contract_value_bdt))}</td>
                <td className="py-3 pr-4 text-right font-semibold text-stone-900">{row.status === 'active' ? formatTaka(Number(row.outstanding_amount_bdt)) : 'Closed'}</td>
                <td className="py-3 pr-4 text-right">{row.status === 'active' && <Button variant="secondary" disabled={busyId === row.id} onClick={() => run(row.id, `Closed commitment with ${row.party_name}`, () => closeCostCommitment(row.id))}>Close</Button>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {recording && <CostEntryModal projectId={projectId} vendors={workspace.vendors} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); onChanged(); }} />}
  </div>;
}
