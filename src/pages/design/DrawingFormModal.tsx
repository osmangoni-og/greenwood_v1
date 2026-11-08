import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { getActiveUserId } from '@/lib/activeUser';
import { formatLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  DRAWING_APPROVAL_STATUSES,
  DRAWING_DISCIPLINES,
  type DrawingApprovalStatus,
  type DrawingDiscipline,
  type DrawingRow,
} from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';

interface DrawingFormModalProps {
  projectId: string;
  drawing: DrawingRow | null;
  engineers: EngineerRow[];
  packages: DesignPackageRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'drawing-form';
const DUPLICATE_KEY_CODE = '23505';

interface DrawingForm {
  drawing_number: string;
  title: string;
  design_package_id: string;
  discipline: DrawingDiscipline;
  approval_status: DrawingApprovalStatus;
  description: string;
}

function toForm(drawing: DrawingRow | null): DrawingForm {
  return {
    drawing_number: drawing?.drawing_number ?? '',
    title: drawing?.title ?? '',
    design_package_id: drawing?.design_package_id ?? '',
    discipline: drawing?.discipline ?? 'architectural',
    approval_status: drawing?.approval_status ?? 'draft',
    description: drawing?.description ?? '',
  };
}

export function DrawingFormModal({ projectId, drawing, engineers, packages, onClose, onSaved }: DrawingFormModalProps) {
  const [form, setForm] = useState<DrawingForm>(() => toForm(drawing));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = drawing !== null;
  const selectedPackage = packages.find((pkg) => pkg.id === form.design_package_id) ?? null;
  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedPackage?.engineer_id) ?? null;

  function update<K extends keyof DrawingForm>(key: K, value: DrawingForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const drawingNumber = form.drawing_number.trim();
    const title = form.title.trim();
    if (!drawingNumber) {
      setError('Enter a drawing number.');
      return;
    }
    if (!title) {
      setError('Enter a drawing title.');
      return;
    }
    if (!form.design_package_id) {
      setError('Design Package is required.');
      return;
    }

    const payload = {
      drawing_number: drawingNumber,
      title,
      design_package_id: form.design_package_id,
      discipline: form.discipline,
      approval_status: form.approval_status,
      description: form.description.trim() || null,
    };

    setSaving(true);
    setError(null);
    const result = drawing
      ? await supabase.from('drawings').update(payload).eq('id', drawing.id)
      : await supabase.from('drawings').insert({ ...payload, project_id: projectId, created_by: getActiveUserId() });
    setSaving(false);

    if (result.error) {
      setError(
        result.error.code === DUPLICATE_KEY_CODE
          ? 'A drawing with this number already exists for this project.'
          : result.error.message,
      );
      return;
    }

    await recordActivity({
      projectId,
      action: isEdit ? 'update' : 'create',
      entityType: 'drawing',
      entityId: drawing?.id ?? null,
      summary: `${isEdit ? 'Drawing updated' : 'Drawing added'}: ${drawingNumber} ${title}`,
    });
    onSaved();
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit drawing' : 'Add drawing'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add drawing'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        {packages.length === 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Create a design package under Engineers & Packages before adding drawings.</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Design package" htmlFor="drawing-package">
            <select
              id="drawing-package"
              className={inputClassName}
              value={form.design_package_id}
              onChange={(e) => update('design_package_id', e.target.value)}
            >
              <option value="">Select a design package</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {engineers.find((engineer) => engineer.id === pkg.engineer_id)?.name ?? 'Unknown engineer'} - {pkg.name} - {pkg.revision_label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Engineer" htmlFor="drawing-engineer">
            <input
              id="drawing-engineer"
              className={inputClassName}
              readOnly
              value={selectedEngineer?.name ?? ''}
              placeholder="Set by the design package"
            />
          </FormField>
          <FormField label="Firm" htmlFor="drawing-firm">
            <input
              id="drawing-firm"
              className={inputClassName}
              readOnly
              value={selectedEngineer?.firm ?? ''}
              placeholder="Set by the design package"
            />
          </FormField>
          <FormField label="Package revision" htmlFor="drawing-revision">
            <input
              id="drawing-revision"
              className={inputClassName}
              readOnly
              value={selectedPackage?.revision_label ?? ''}
              placeholder="Set by the design package"
            />
          </FormField>
          <FormField label="Drawing number" htmlFor="drawing-number">
            <input
              id="drawing-number"
              className={inputClassName}
              value={form.drawing_number}
              onChange={(e) => update('drawing_number', e.target.value)}
              placeholder="e.g. A-101"
            />
          </FormField>
          <FormField label="Title" htmlFor="drawing-title">
            <input
              id="drawing-title"
              className={inputClassName}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Ground floor plan"
            />
          </FormField>
          <FormField label="Discipline" htmlFor="drawing-discipline">
            <select
              id="drawing-discipline"
              className={inputClassName}
              value={form.discipline}
              onChange={(e) => update('discipline', e.target.value as DrawingDiscipline)}
            >
              {DRAWING_DISCIPLINES.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Approval status" htmlFor="drawing-status">
            <select
              id="drawing-status"
              className={inputClassName}
              value={form.approval_status}
              onChange={(e) => update('approval_status', e.target.value as DrawingApprovalStatus)}
            >
              {DRAWING_APPROVAL_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {formatLabel(option)}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Description" htmlFor="drawing-description">
          <textarea
            id="drawing-description"
            rows={3}
            className={inputClassName}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
