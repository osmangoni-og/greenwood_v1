import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import type { ProjectRow, VendorDepositRow, VendorRow } from '@/types/database';

interface VendorDepositFormModalProps {
  project: ProjectRow;
  deposit: VendorDepositRow | null;
  vendors: VendorRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function VendorDepositFormModal({ project, deposit, vendors, onClose, onSaved }: VendorDepositFormModalProps) {
  const [vendorId, setVendorId] = useState(deposit?.vendor_id ?? '');
  const [depositDate, setDepositDate] = useState(deposit?.deposit_date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(deposit?.amount_bdt ?? 0);
  const [paymentMethod, setPaymentMethod] = useState(deposit?.payment_method ?? '');
  const [referenceNumber, setReferenceNumber] = useState(deposit?.reference_number ?? '');
  const [notes, setNotes] = useState(deposit?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deposit) return;
    setVendorId(deposit.vendor_id ?? '');
    setDepositDate(deposit.deposit_date);
    setAmount(deposit.amount_bdt);
    setPaymentMethod(deposit.payment_method ?? '');
    setReferenceNumber(deposit.reference_number ?? '');
    setNotes(deposit.notes ?? '');
  }, [deposit]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (Number(amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        vendor_id: vendorId || null,
        deposit_date: depositDate,
        amount_bdt: Number(amount),
        payment_method: paymentMethod.trim() || null,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      };
      if (deposit) {
        const { error: updateErr } = await supabase
          .from('vendor_deposits')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', deposit.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('vendor_deposits').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: deposit ? 'update' : 'create',
        entityType: 'vendor_deposit',
        entityId: deposit?.id,
        summary: `${deposit ? 'Updated' : 'Added'} vendor deposit: Tk ${amount}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vendor deposit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={deposit ? 'Edit vendor deposit' : 'Add vendor deposit'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save deposit'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Vendor" htmlFor="vendor-deposit-vendor">
          <select id="vendor-deposit-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">General (no specific vendor)</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" htmlFor="vendor-deposit-date">
            <input id="vendor-deposit-date" type="date" className={inputClassName} value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
          </FormField>
          <FormField label="Amount (Tk)" htmlFor="vendor-deposit-amount">
            <input id="vendor-deposit-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" htmlFor="vendor-deposit-method">
            <input id="vendor-deposit-method" className={inputClassName} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Bank transfer / cash / cheque" />
          </FormField>
          <FormField label="Reference number" htmlFor="vendor-deposit-ref">
            <input id="vendor-deposit-ref" className={inputClassName} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="vendor-deposit-notes">
          <textarea id="vendor-deposit-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
