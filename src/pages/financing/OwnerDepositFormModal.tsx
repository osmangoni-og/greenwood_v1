import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  OWNER_DEPOSIT_TYPES,
  OWNER_DEPOSIT_TYPE_LABELS,
  type OwnerDepositRow,
  type OwnerDepositType,
  type ProjectRow,
} from '@/types/database';

const TYPE_OPTIONS = OWNER_DEPOSIT_TYPES.map((t) => ({ value: t, label: OWNER_DEPOSIT_TYPE_LABELS[t] }));

interface OwnerDepositFormModalProps {
  project: ProjectRow;
  deposit: OwnerDepositRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OwnerDepositFormModal({ project, deposit, onClose, onSaved }: OwnerDepositFormModalProps) {
  const [depositDate, setDepositDate] = useState(deposit?.deposit_date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(deposit?.amount_bdt ?? 0);
  const [depositType, setDepositType] = useState<OwnerDepositType>(deposit?.deposit_type ?? 'monthly');
  const [paymentMethod, setPaymentMethod] = useState(deposit?.payment_method ?? '');
  const [referenceNumber, setReferenceNumber] = useState(deposit?.reference_number ?? '');
  const [notes, setNotes] = useState(deposit?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deposit) return;
    setDepositDate(deposit.deposit_date);
    setAmount(deposit.amount_bdt);
    setDepositType(deposit.deposit_type);
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
        deposit_date: depositDate,
        amount_bdt: Number(amount),
        deposit_type: depositType,
        payment_method: paymentMethod.trim() || null,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      };
      if (deposit) {
        const { error: updateErr } = await supabase
          .from('owner_deposits')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', deposit.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('owner_deposits').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: deposit ? 'update' : 'create',
        entityType: 'owner_deposit',
        entityId: deposit?.id,
        summary: `${deposit ? 'Updated' : 'Added'} owner deposit: Tk ${amount}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save deposit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={deposit ? 'Edit owner deposit' : 'Add owner deposit'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save deposit'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" htmlFor="owner-deposit-date">
            <input id="owner-deposit-date" type="date" className={inputClassName} value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
          </FormField>
          <FormField label="Amount (Tk)" htmlFor="owner-deposit-amount">
            <input id="owner-deposit-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </FormField>
        </div>
        <FormField label="Deposit type" htmlFor="owner-deposit-type">
          <select id="owner-deposit-type" className={inputClassName} value={depositType} onChange={(e) => setDepositType(e.target.value as OwnerDepositType)}>
            {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Payment method" htmlFor="owner-deposit-method">
            <input id="owner-deposit-method" className={inputClassName} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Bank transfer / cash / cheque" />
          </FormField>
          <FormField label="Reference number" htmlFor="owner-deposit-ref">
            <input id="owner-deposit-ref" className={inputClassName} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="owner-deposit-notes">
          <textarea id="owner-deposit-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
