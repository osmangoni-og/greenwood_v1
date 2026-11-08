import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { recordSupplierInvoice, recordSupplierPayment } from '@/lib/budget';
import { formatTaka } from '@/lib/format';
import type { PurchaseOrderRow, SupplierInvoiceBalanceRow, VendorRow } from '@/types/database';

const today = () => new Date().toISOString().slice(0, 10);

const PAYMENT_METHODS = ['Bank transfer', 'bKash', 'Nagad', 'Cash', 'Cheque'];

interface InvoiceProps {
  projectId: string;
  vendors: VendorRow[];
  purchaseOrders: PurchaseOrderRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierInvoiceModal({ projectId, vendors, purchaseOrders, onClose, onSaved }: InvoiceProps) {
  const [vendorId, setVendorId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [number, setNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!number.trim()) { setError('Enter the invoice number.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (dueDate && dueDate < invoiceDate) { setError('The due date cannot be before the invoice date.'); return; }
    setBusy(true);
    try {
      await recordSupplierInvoice({ projectId, vendorId: vendorId || null, purchaseOrderId: orderId || null, invoiceNumber: number.trim(), invoiceDate, dueDate: dueDate || null, amount: value, notes: notes.trim() || null });
      await recordActivity({ projectId, action: 'create', entityType: 'supplier_invoice', summary: `Recorded supplier invoice ${number.trim()} for ${formatTaka(value)}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this invoice.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title="Record supplier invoice" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save invoice'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Invoice number" htmlFor="inv-number"><input id="inv-number" className={inputClassName} value={number} onChange={(e) => setNumber(e.target.value)} required /></FormField>
        <FormField label="Amount (Tk)" htmlFor="inv-amount"><input id="inv-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} required /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Vendor" htmlFor="inv-vendor"><select id="inv-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">No vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></FormField>
        <FormField label="PO reference" htmlFor="inv-po"><select id="inv-po" className={inputClassName} value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">No purchase order</option>{purchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}</select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Invoice date" htmlFor="inv-date"><input id="inv-date" type="date" className={inputClassName} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required /></FormField>
        <FormField label="Due date" htmlFor="inv-due"><input id="inv-due" type="date" className={inputClassName} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></FormField>
      </div>
      <FormField label="Notes" htmlFor="inv-notes"><textarea id="inv-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}

interface PaymentProps {
  projectId: string;
  invoices: SupplierInvoiceBalanceRow[];
  vendors: VendorRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierPaymentModal({ projectId, invoices, vendors, onClose, onSaved }: PaymentProps) {
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.supplier_invoice_id ?? '');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = invoices.find((row) => row.supplier_invoice_id === invoiceId) ?? null;
  const vendorName = (id: string | null) => vendors.find((vendor) => vendor.id === id)?.name ?? 'No vendor';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!selected) { setError('Choose the invoice being paid.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (value > Number(selected.balance_bdt)) { setError(`Only ${formatTaka(Number(selected.balance_bdt))} is unpaid on this invoice.`); return; }
    setBusy(true);
    try {
      await recordSupplierPayment({ projectId, supplierInvoiceId: selected.supplier_invoice_id, paymentDate: date, amount: value, method, reference: reference.trim() || null, notes: notes.trim() || null });
      await recordActivity({ projectId, action: 'create', entityType: 'supplier_payment', summary: `Paid ${formatTaka(value)} against invoice ${selected.invoice_number}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this payment.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title="Record supplier payment" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !selected}>{busy ? 'Saving...' : 'Save payment'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Invoice" htmlFor="pay-invoice" hint={selected ? `${vendorName(selected.vendor_id)} | ${formatTaka(Number(selected.balance_bdt))} unpaid` : undefined}>
        <select id="pay-invoice" className={inputClassName} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
          {invoices.map((row) => <option key={row.supplier_invoice_id} value={row.supplier_invoice_id}>{row.invoice_number} | {formatTaka(Number(row.balance_bdt))} unpaid</option>)}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Payment date" htmlFor="pay-date"><input id="pay-date" type="date" className={inputClassName} value={date} onChange={(e) => setDate(e.target.value)} required /></FormField>
        <FormField label="Amount (Tk)" htmlFor="pay-amount"><input id="pay-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} required /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Method" htmlFor="pay-method"><select id="pay-method" className={inputClassName} value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
        <FormField label="Reference number" htmlFor="pay-reference"><input id="pay-reference" className={inputClassName} value={reference} onChange={(e) => setReference(e.target.value)} /></FormField>
      </div>
      <FormField label="Notes" htmlFor="pay-notes"><textarea id="pay-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
