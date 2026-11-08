import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  CONTRACTOR_TYPE_LABELS,
  CONTRACTOR_TYPES,
  TENDER_STATUSES,
  type ContractorType,
  type ProjectRow,
  type TenderRow,
  type TenderStatus,
} from '@/types/database';

const TYPE_OPTIONS = CONTRACTOR_TYPES.map((t) => ({ value: t, label: CONTRACTOR_TYPE_LABELS[t] }));
const STATUS_OPTIONS: { value: TenderStatus; label: string }[] = TENDER_STATUSES.map((s) => ({
  value: s,
  label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

interface TenderFormModalProps {
  project: ProjectRow;
  tender: TenderRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TenderFormModal({ project, tender, onClose, onSaved }: TenderFormModalProps) {
  const [title, setTitle] = useState(tender?.title ?? '');
  const [tenderType, setTenderType] = useState<ContractorType>(tender?.tender_type ?? 'main');
  const [status, setStatus] = useState<TenderStatus>(tender?.status ?? 'open');
  const [scopeDescription, setScopeDescription] = useState(tender?.scope_description ?? '');
  const [closingDate, setClosingDate] = useState(tender?.closing_date ?? '');
  const [notes, setNotes] = useState(tender?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tender) return;
    setTitle(tender.title);
    setTenderType(tender.tender_type);
    setStatus(tender.status);
    setScopeDescription(tender.scope_description ?? '');
    setClosingDate(tender.closing_date ?? '');
    setNotes(tender.notes ?? '');
  }, [tender]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Tender title is required.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        title: title.trim(),
        tender_type: tenderType,
        status,
        scope_description: scopeDescription.trim() || null,
        closing_date: closingDate || null,
        notes: notes.trim() || null,
      };
      if (tender) {
        const { error: updateErr } = await supabase
          .from('tenders')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', tender.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('tenders').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: tender ? 'update' : 'create',
        entityType: 'tender',
        entityId: tender?.id,
        summary: `${tender ? 'Updated' : 'Created'} tender: ${title.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tender.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={tender ? 'Edit tender' : 'New tender'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save tender'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" htmlFor="tender-title">
          <input id="tender-title" className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Main civil works package" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contractor type" htmlFor="tender-type">
            <select id="tender-type" className={inputClassName} value={tenderType} onChange={(e) => setTenderType(e.target.value as ContractorType)}>
              {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
          <FormField label="Status" htmlFor="tender-status">
            <select id="tender-status" className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as TenderStatus)}>
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Scope description" htmlFor="tender-scope">
          <textarea id="tender-scope" rows={4} className={inputClassName} value={scopeDescription} onChange={(e) => setScopeDescription(e.target.value)} placeholder="Describe the work to be quoted" />
        </FormField>
        <FormField label="Closing date" htmlFor="tender-closing">
          <input id="tender-closing" type="date" className={inputClassName} value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
        </FormField>
        <FormField label="Notes" htmlFor="tender-notes">
          <textarea id="tender-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
