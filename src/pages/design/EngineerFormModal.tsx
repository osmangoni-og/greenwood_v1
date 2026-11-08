import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { saveEngineer, type EngineerInput } from '@/lib/engineering';
import type { EngineerRow } from '@/types/engineering';

interface EngineerFormModalProps {
  projectId: string;
  engineer: EngineerRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'engineer-form';

function toForm(engineer: EngineerRow | null): Record<keyof EngineerInput, string> {
  return {
    name: engineer?.name ?? '',
    firm: engineer?.firm ?? '',
    license_number: engineer?.license_number ?? '',
    mobile: engineer?.mobile ?? '',
    email: engineer?.email ?? '',
    notes: engineer?.notes ?? '',
  };
}

export function EngineerFormModal({ projectId, engineer, onClose, onSaved }: EngineerFormModalProps) {
  const [form, setForm] = useState(() => toForm(engineer));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = engineer !== null;

  function update(key: keyof EngineerInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Enter the engineer name.');
      return;
    }
    const optional = (value: string) => value.trim() || null;
    setSaving(true);
    setError(null);
    try {
      await saveEngineer(
        projectId,
        {
          name,
          firm: optional(form.firm),
          license_number: optional(form.license_number),
          mobile: optional(form.mobile),
          email: optional(form.email),
          notes: optional(form.notes),
        },
        engineer?.id,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The engineer could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit engineer' : 'Add engineer'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add engineer'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Name" htmlFor="engineer-name">
            <input id="engineer-name" className={inputClassName} value={form.name} onChange={(e) => update('name', e.target.value)} />
          </FormField>
          <FormField label="Firm" htmlFor="engineer-firm">
            <input id="engineer-firm" className={inputClassName} value={form.firm} onChange={(e) => update('firm', e.target.value)} />
          </FormField>
          <FormField label="License number" htmlFor="engineer-license">
            <input id="engineer-license" className={inputClassName} value={form.license_number} onChange={(e) => update('license_number', e.target.value)} />
          </FormField>
          <FormField label="Mobile" htmlFor="engineer-mobile">
            <input id="engineer-mobile" className={inputClassName} value={form.mobile} onChange={(e) => update('mobile', e.target.value)} />
          </FormField>
          <FormField label="Email" htmlFor="engineer-email">
            <input id="engineer-email" type="email" className={inputClassName} value={form.email} onChange={(e) => update('email', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="engineer-notes">
          <textarea id="engineer-notes" rows={3} className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
