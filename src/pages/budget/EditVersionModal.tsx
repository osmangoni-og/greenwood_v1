import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { updateBudgetVersionLabel } from '@/lib/budget';
import { recordActivity } from '@/lib/activity';
import type { BudgetVersionRow } from '@/types/database';

interface Props {
  projectId: string;
  version: BudgetVersionRow;
  onClose: () => void;
  onSaved: () => void;
}

export function EditVersionModal({ projectId, version, onClose, onSaved }: Props) {
  const [label, setLabel] = useState(version.version_label);
  const [notes, setNotes] = useState(version.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim() === '') {
      setError('Version label is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateBudgetVersionLabel(version.id, label, notes);
      await recordActivity({
        projectId,
        action: 'update',
        entityType: 'budget_version',
        entityId: version.id,
        summary: `Edited label/notes for ${version.version_label}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the version.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Edit ${version.version_label}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-version-form" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-version-form" onSubmit={save} className="space-y-4">
        <FormField label="Version label" htmlFor="version-label">
          <input id="version-label" className={inputClassName} value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        <FormField label="Notes" htmlFor="version-notes" hint="Optional context for this budget version.">
          <textarea id="version-notes" className={inputClassName} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
