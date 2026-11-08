import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  VENDOR_CONTRACT_STATUSES,
  type ProjectRow,
  type VendorContractRow,
  type VendorContractStatus,
  type VendorRow,
} from '@/types/database';

const STATUS_OPTIONS: { value: VendorContractStatus; label: string }[] = VENDOR_CONTRACT_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

interface VendorContractFormModalProps {
  project: ProjectRow;
  vendor: VendorRow;
  contract: VendorContractRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VendorContractFormModal({ project, vendor, contract, onClose, onSaved }: VendorContractFormModalProps) {
  const [title, setTitle] = useState(contract?.contract_title ?? '');
  const [scope, setScope] = useState(contract?.scope ?? '');
  const [value, setValue] = useState(contract?.contract_value_bdt ?? 0);
  const [startDate, setStartDate] = useState(contract?.start_date ?? '');
  const [endDate, setEndDate] = useState(contract?.end_date ?? '');
  const [status, setStatus] = useState<VendorContractStatus>(contract?.status ?? 'active');
  const [notes, setNotes] = useState(contract?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contract) return;
    setTitle(contract.contract_title);
    setScope(contract.scope ?? '');
    setValue(contract.contract_value_bdt);
    setStartDate(contract.start_date ?? '');
    setEndDate(contract.end_date ?? '');
    setStatus(contract.status);
    setNotes(contract.notes ?? '');
  }, [contract]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Contract title is required.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        vendor_id: vendor.id,
        project_id: project.id,
        contract_title: title.trim(),
        scope: scope.trim() || null,
        contract_value_bdt: Number(value) || 0,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
        notes: notes.trim() || null,
      };
      if (contract) {
        const { error: updateErr } = await supabase
          .from('vendor_contracts')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', contract.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('vendor_contracts').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: contract ? 'update' : 'create',
        entityType: 'vendor_contract',
        entityId: contract?.id,
        summary: `${contract ? 'Updated' : 'Created'} vendor contract: ${title.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contract.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={contract ? 'Edit contract' : 'New contract'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save contract'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Contract title" htmlFor="contract-title">
          <input id="contract-title" className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rod supply - 50 tons" required />
        </FormField>
        <FormField label="Scope" htmlFor="contract-scope">
          <textarea id="contract-scope" rows={3} className={inputClassName} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Materials / quantities / terms" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contract value (Tk)" htmlFor="contract-value">
            <input id="contract-value" type="number" min={0} step="any" className={inputClassName} value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </FormField>
          <FormField label="Status" htmlFor="contract-status">
            <select id="contract-status" className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as VendorContractStatus)}>
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start date" htmlFor="contract-start">
            <input id="contract-start" type="date" className={inputClassName} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="End date" htmlFor="contract-end">
            <input id="contract-end" type="date" className={inputClassName} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="contract-notes">
          <textarea id="contract-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
