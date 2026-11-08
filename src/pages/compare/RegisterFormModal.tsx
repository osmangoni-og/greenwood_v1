import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { getActiveUserId } from '@/lib/activeUser';
import { supabase } from '@/lib/supabase';
import type { RegisterConfig } from '@/lib/registers';

interface RegisterFormModalProps {
  config: RegisterConfig;
  designId: string;
  existingRow: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'register-form';

export function RegisterFormModal({ config, designId, existingRow, onClose, onSaved }: RegisterFormModalProps) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (existingRow) {
      const row: Record<string, string> = {};
      for (const field of config.fields) {
        const value = existingRow[field.name];
        row[field.name] = value === null || value === undefined ? '' : String(value);
      }
      return row;
    }
    const row: Record<string, string> = {};
    for (const field of config.fields) {
      row[field.name] = field.default ?? '';
    }
    return row;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mark = form.mark?.trim() ?? form.item_description?.trim() ?? '';
    if (!mark) {
      setError('Enter a value for the first field.');
      return;
    }

    const payload: Record<string, unknown> = { design_id: designId };
    for (const field of config.fields) {
      const value = form[field.name];
      if (field.type === 'number') {
        const num = value === '' ? 0 : Number(value);
        if (!Number.isFinite(num) || num < 0) {
          setError(`${field.label} must be a valid non-negative number.`);
          return;
        }
        payload[field.name] = num;
      } else {
        payload[field.name] = value.trim() === '' ? null : value.trim();
      }
    }
    if (payload.mark === null && payload.item_description === null) {
      payload.mark = mark;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from(config.table).update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from(config.table)
          .insert({ ...payload, created_by: getActiveUserId() });
        if (insertError) throw new Error(insertError.message);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The entry could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? `Edit ${config.label}` : `Add to ${config.label}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          {config.fields.map((field) => (
            <FormField key={field.name} label={field.label} htmlFor={`reg-${field.name}`}>
              {field.type === 'select' ? (
                <select
                  id={`reg-${field.name}`}
                  className={inputClassName}
                  value={form[field.name] ?? ''}
                  onChange={(e) => update(field.name, e.target.value)}
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === 'number' ? (
                <input
                  id={`reg-${field.name}`}
                  type="number"
                  step={field.step}
                  min={field.min}
                  className={inputClassName}
                  value={form[field.name] ?? ''}
                  onChange={(e) => update(field.name, e.target.value)}
                />
              ) : (
                <input
                  id={`reg-${field.name}`}
                  className={inputClassName}
                  value={form[field.name] ?? ''}
                  onChange={(e) => update(field.name, e.target.value)}
                />
              )}
            </FormField>
          ))}
        </div>
      </form>
    </Modal>
  );
}
