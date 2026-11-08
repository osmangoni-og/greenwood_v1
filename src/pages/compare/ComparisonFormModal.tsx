import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import type { ComparisonRow, ProjectRow } from '@/types/database';

interface ComparisonFormModalProps {
  project: ProjectRow;
  comparison: ComparisonRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'comparison-form';

interface ComparisonForm {
  name: string;
  description: string;
  design_a_label: string;
  design_b_label: string;
  design_c_label: string;
}

function toForm(comparison: ComparisonRow | null): ComparisonForm {
  return {
    name: comparison?.name ?? '',
    description: comparison?.description ?? '',
    design_a_label: comparison?.design_a_label ?? 'Package A',
    design_b_label: comparison?.design_b_label ?? 'Package B',
    design_c_label: comparison?.design_c_label ?? 'Package C',
  };
}

export function ComparisonFormModal({ project, comparison, onClose, onSaved }: ComparisonFormModalProps) {
  const [form, setForm] = useState<ComparisonForm>(() => toForm(comparison));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = comparison !== null;

  function update<K extends keyof ComparisonForm>(key: K, value: ComparisonForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Enter a comparison name.');
      return;
    }

    const payload = {
      name,
      description: form.description.trim() || null,
      design_a_label: form.design_a_label.trim() || 'Package A',
      design_b_label: form.design_b_label.trim() || 'Package B',
      design_c_label: form.design_c_label.trim() || 'Package C',
    };

    setSaving(true);
    setError(null);
    try {
      let comparisonId: string;
      if (comparison) {
        const { error: updateError } = await supabase.from('comparisons').update(payload).eq('id', comparison.id);
        if (updateError) throw new Error(updateError.message);
        comparisonId = comparison.id;
      } else {
        const { data, error: insertError } = await supabase
          .from('comparisons')
          .insert({ ...payload, project_id: project.id, created_by: getActiveUserId() })
          .select('id')
          .maybeSingle();
        if (insertError) throw new Error(insertError.message);
        if (!data) throw new Error('Comparison was not created.');
        comparisonId = (data as { id: string }).id;
      }

      await recordActivity({
        projectId: project.id,
        action: isEdit ? 'update' : 'create',
        entityType: 'comparison',
        entityId: comparisonId,
        summary: `${isEdit ? 'Comparison updated' : 'Comparison created'}: ${name}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The comparison could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit comparison' : 'New comparison'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create comparison'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <FormField label="Comparison name" htmlFor="comp-name">
          <input id="comp-name" className={inputClassName} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Ground floor structural comparison" />
        </FormField>
        <FormField label="Description" htmlFor="comp-desc">
          <textarea id="comp-desc" rows={3} className={inputClassName} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What is being compared and why" />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Package A label" htmlFor="comp-label-a">
            <input id="comp-label-a" className={inputClassName} value={form.design_a_label} onChange={(e) => update('design_a_label', e.target.value)} />
          </FormField>
          <FormField label="Package B label" htmlFor="comp-label-b">
            <input id="comp-label-b" className={inputClassName} value={form.design_b_label} onChange={(e) => update('design_b_label', e.target.value)} />
          </FormField>
          <FormField label="Package C label" htmlFor="comp-label-c">
            <input id="comp-label-c" className={inputClassName} value={form.design_c_label} onChange={(e) => update('design_c_label', e.target.value)} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
