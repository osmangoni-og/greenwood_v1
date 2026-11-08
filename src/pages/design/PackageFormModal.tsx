import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { saveDesignPackage, type DesignPackageInput } from '@/lib/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS, DESIGN_PACKAGE_STATUSES, type DesignPackageRow, type DesignPackageStatus, type EngineerRow } from '@/types/engineering';

interface PackageFormModalProps {
  projectId: string;
  engineers: EngineerRow[];
  defaultEngineerId: string | null;
  pkg: DesignPackageRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'design-package-form';

interface PackageForm {
  engineer_id: string;
  name: string;
  revision_label: string;
  status: DesignPackageStatus;
  notes: string;
}

function toForm(pkg: DesignPackageRow | null, defaultEngineerId: string | null): PackageForm {
  return {
    engineer_id: pkg?.engineer_id ?? defaultEngineerId ?? '',
    name: pkg?.name ?? '',
    revision_label: pkg?.revision_label ?? 'Original',
    status: pkg?.status ?? 'draft',
    notes: pkg?.notes ?? '',
  };
}

export function PackageFormModal({ projectId, engineers, defaultEngineerId, pkg, onClose, onSaved }: PackageFormModalProps) {
  const [form, setForm] = useState(() => toForm(pkg, defaultEngineerId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = pkg !== null;

  function update<K extends keyof PackageForm>(key: K, value: PackageForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.engineer_id) {
      setError('Choose the engineer who owns this design package.');
      return;
    }
    const name = form.name.trim();
    if (!name) {
      setError('Enter a package name, for example "Engineer A - Original".');
      return;
    }
    const input: DesignPackageInput = {
      engineer_id: form.engineer_id,
      name,
      revision_label: form.revision_label.trim() || 'Original',
      status: form.status,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    setError(null);
    try {
      await saveDesignPackage(projectId, input, pkg?.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The design package could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit design package' : 'New design package'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving || engineers.length === 0}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create package'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        {engineers.length === 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Add an engineer before creating a design package.</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Engineer" htmlFor="package-engineer">
            <select id="package-engineer" className={inputClassName} value={form.engineer_id} onChange={(e) => update('engineer_id', e.target.value)}>
              <option value="">Select an engineer</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Package name" htmlFor="package-name">
            <input id="package-name" className={inputClassName} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Engineer A - Original" />
          </FormField>
          <FormField label="Revision" htmlFor="package-revision">
            <input id="package-revision" className={inputClassName} value={form.revision_label} onChange={(e) => update('revision_label', e.target.value)} placeholder="Original, Rev 1..." />
          </FormField>
          <FormField label="Status" htmlFor="package-status">
            <select id="package-status" className={inputClassName} value={form.status} onChange={(e) => update('status', e.target.value as DesignPackageStatus)}>
              {DESIGN_PACKAGE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {DESIGN_PACKAGE_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="package-notes">
          <textarea id="package-notes" rows={3} className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
