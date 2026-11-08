import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { updateBudgetRevision } from '@/lib/budget';
import { recordActivity } from '@/lib/activity';
import { BUDGET_REVISION_TRIGGERS, BUDGET_REVISION_TRIGGER_LABELS, type BudgetRevisionRow, type BudgetRevisionTrigger } from '@/types/database';

interface Props {
  projectId: string;
  revision: BudgetRevisionRow;
  onClose: () => void;
  onSaved: () => void;
}

export function EditRevisionModal({ projectId, revision, onClose, onSaved }: Props) {
  const [reason, setReason] = useState(revision.reason);
  const [triggerType, setTriggerType] = useState<BudgetRevisionTrigger>(revision.trigger_type ?? 'other');
  const [revisionNote, setRevisionNote] = useState(revision.revision_note ?? '');
  const [impactDescription, setImpactDescription] = useState(revision.impact_description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim() === '') {
      setError('Reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateBudgetRevision(revision.id, {
        reason,
        trigger_type: triggerType,
        revision_note: revisionNote,
        impact_description: impactDescription,
      });
      await recordActivity({
        projectId,
        action: 'update',
        entityType: 'budget_revision',
        entityId: revision.id,
        summary: `Edited revision R${revision.revision_number} notes`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the revision.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Edit Revision R${revision.revision_number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-revision-form" disabled={busy}>
            {busy ? 'Saving...' : 'Save revision'}
          </Button>
        </>
      }
    >
      <form id="edit-revision-form" onSubmit={save} className="space-y-4">
        <FormField label="Reason" htmlFor="revision-reason">
          <textarea id="revision-reason" className={inputClassName} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <FormField label="Trigger type" htmlFor="revision-trigger">
          <select id="revision-trigger" className={inputClassName} value={triggerType} onChange={(e) => setTriggerType(e.target.value as BudgetRevisionTrigger)}>
            {BUDGET_REVISION_TRIGGERS.map((t) => (
              <option key={t} value={t}>{BUDGET_REVISION_TRIGGER_LABELS[t]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Revision note" htmlFor="revision-note" hint="Internal note about this revision.">
          <textarea id="revision-note" className={inputClassName} rows={3} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} />
        </FormField>
        <FormField label="Impact description" htmlFor="impact-description" hint="What changed and why it matters.">
          <textarea id="impact-description" className={inputClassName} rows={3} value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
