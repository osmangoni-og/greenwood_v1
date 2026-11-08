import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { getActiveUserId } from '@/lib/activeUser';
import { supabase } from '@/lib/supabase';
import { type DesignSlot } from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';

interface DesignFormModalProps {
  comparisonId: string;
  slot: DesignSlot;
  existingId: string | null;
  existingDesignPackageId: string | null;
  existingNotes: string;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'design-form';
const DUPLICATE_KEY_CODE = '23505';

export function DesignFormModal({
  comparisonId,
  slot,
  existingId,
  existingDesignPackageId,
  existingNotes,
  packages,
  engineers,
  onClose,
  onSaved,
}: DesignFormModalProps) {
  const [designPackageId, setDesignPackageId] = useState(existingDesignPackageId ?? '');
  const [notes, setNotes] = useState(existingNotes);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = existingId !== null;

  const selectedPackage = packages.find((pkg) => pkg.id === designPackageId) ?? null;
  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedPackage?.engineer_id) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!designPackageId) {
      setError('Design Package is required.');
      return;
    }
    if (!selectedEngineer) {
      setError('Selected package has no engineer assigned.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      engineer_name: selectedEngineer.name,
      design_package_id: designPackageId,
      notes: notes.trim() || null,
    };
    if (isEdit) {
      const { error: updateError } = await supabase.from('designs').update(payload).eq('id', existingId);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from('designs').insert({
        ...payload,
        comparison_id: comparisonId,
        slot,
        created_by: getActiveUserId(),
      });
      setSaving(false);
      if (insertError) {
        setError(
          insertError.code === DUPLICATE_KEY_CODE
            ? `Package ${slot} already exists for this comparison.`
            : insertError.message,
        );
        return;
      }
    }
    onSaved();
  }

  return (
    <Modal
      open
      title={`${isEdit ? 'Edit' : 'Add'} Package ${slot}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        {packages.length === 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Create a design package under Engineers &amp; Packages before adding a comparison slot.</p>
        )}
        <FormField label="Design package" htmlFor="design-package">
          <select
            id="design-package"
            className={inputClassName}
            value={designPackageId}
            onChange={(e) => setDesignPackageId(e.target.value)}
          >
            <option value="">Select a design package</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {engineers.find((engineer) => engineer.id === pkg.engineer_id)?.name ?? 'Unknown engineer'} - {pkg.name} - {pkg.revision_label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Engineer" htmlFor="design-engineer">
          <input
            id="design-engineer"
            className={inputClassName}
            readOnly
            value={selectedEngineer?.name ?? ''}
            placeholder="Set by the design package"
          />
        </FormField>
        <FormField label="Firm" htmlFor="design-firm">
          <input
            id="design-firm"
            className={inputClassName}
            readOnly
            value={selectedEngineer?.firm ?? ''}
            placeholder="Set by the design package"
          />
        </FormField>
        <FormField label="Package revision" htmlFor="design-revision">
          <input
            id="design-revision"
            className={inputClassName}
            readOnly
            value={selectedPackage?.revision_label ?? ''}
            placeholder="Set by the design package"
          />
        </FormField>
        <FormField label="Notes" htmlFor="design-notes">
          <textarea id="design-notes" rows={3} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
