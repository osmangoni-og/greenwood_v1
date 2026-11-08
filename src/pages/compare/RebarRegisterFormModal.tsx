import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { getActiveUserId } from '@/lib/activeUser';
import { calcRebarWeight } from '@/lib/structuralCalculations';
import { supabase } from '@/lib/supabase';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';

interface RebarRegisterFormModalProps {
  designId: string;
  designPackageId: string | null;
  existingRow: Record<string, unknown> | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'rebar-register-form';
const SHAPE_CODES = ['L', 'U', 'C', 'S', 'Straight', 'Cranked', 'Stirrup', 'Other'] as const;

export function RebarRegisterFormModal({
  designId,
  designPackageId,
  existingRow,
  packages,
  engineers,
  onClose,
  onSaved,
}: RebarRegisterFormModalProps) {
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;

  const [form, setForm] = useState<Record<string, string>>(() => ({
    element_type: String(existingRow?.element_type ?? 'Column'),
    element_mark: String(existingRow?.element_mark ?? ''),
    bar_mark: String(existingRow?.bar_mark ?? ''),
    mark: String(existingRow?.mark ?? ''),
    diameter_mm: String(existingRow?.bar_diameter_mm ?? '12'),
    number_of_bars: String(existingRow?.number_of_bars ?? '1'),
    length_per_bar_m: String(existingRow?.length_per_bar_m ?? ''),
    shape_code: String(existingRow?.shape_code ?? 'Straight'),
    remarks: String(existingRow?.remarks ?? ''),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const diameterMm = Number(form.diameter_mm) || 0;
  const numberOfBars = Number(form.number_of_bars) || 0;
  const lengthPerBarM = Number(form.length_per_bar_m) || 0;

  const totalLength = useMemo(() => numberOfBars * lengthPerBarM, [numberOfBars, lengthPerBarM]);
  const unitWeight = useMemo(() => 0.00617 * diameterMm * diameterMm, [diameterMm]);
  const totalWeight = useMemo(() => calcRebarWeight(diameterMm, numberOfBars, lengthPerBarM), [diameterMm, numberOfBars, lengthPerBarM]);

  const activePackage = packages.find((p) => p.id === designPackageId) ?? null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!designPackageId) return 'A design package is required before adding rebar entries.';
    if (diameterMm <= 0) return 'Diameter must be greater than zero.';
    if (numberOfBars <= 0) return 'Number of bars must be greater than zero.';
    if (lengthPerBarM <= 0) return 'Length per bar must be greater than zero.';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const markValue = form.bar_mark.trim() || form.element_mark.trim() || form.mark.trim() || `Ø${diameterMm}`;
    const payload = {
      design_id: designId,
      mark: markValue,
      element_type: form.element_type.trim() || 'Column',
      element_mark: form.element_mark.trim() || null,
      bar_mark: form.bar_mark.trim() || null,
      bar_diameter_mm: diameterMm,
      number_of_bars: numberOfBars,
      length_per_bar_m: lengthPerBarM,
      total_length_m: Math.round(totalLength * 100) / 100,
      unit_weight_kg_per_m: Math.round(unitWeight * 10000) / 10000,
      total_weight_kg: totalWeight,
      weight_kg: totalWeight,
      shape_code: form.shape_code.trim() || null,
      remarks: form.remarks.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from('rebar_registers').update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('rebar_registers')
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

  const readOnlyInput = `${inputClassName} bg-stone-100 text-stone-500 cursor-not-allowed`;

  return (
    <Modal
      open
      title={isEdit ? 'Edit Rebar Register' : 'Add to Rebar Register'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Element type" htmlFor="rebar-elem-type">
            <input id="rebar-elem-type" className={inputClassName} value={form.element_type} onChange={(e) => update('element_type', e.target.value)} placeholder="Column" />
          </FormField>
          <FormField label="Element mark" htmlFor="rebar-elem-mark">
            <input id="rebar-elem-mark" className={inputClassName} value={form.element_mark} onChange={(e) => update('element_mark', e.target.value)} placeholder="C1" />
          </FormField>
          <FormField label="Bar mark" htmlFor="rebar-bar-mark">
            <input id="rebar-bar-mark" className={inputClassName} value={form.bar_mark} onChange={(e) => update('bar_mark', e.target.value)} placeholder="1" />
          </FormField>
          <FormField label="Diameter (mm)" htmlFor="rebar-dia">
            <input id="rebar-dia" type="number" step="1" min="1" className={inputClassName} value={form.diameter_mm} onChange={(e) => update('diameter_mm', e.target.value)} />
          </FormField>
          <FormField label="Number of bars" htmlFor="rebar-count">
            <input id="rebar-count" type="number" step="1" min="1" className={inputClassName} value={form.number_of_bars} onChange={(e) => update('number_of_bars', e.target.value)} />
          </FormField>
          <FormField label="Length per bar (m)" htmlFor="rebar-length">
            <input id="rebar-length" type="number" step="0.01" min="0" className={inputClassName} value={form.length_per_bar_m} onChange={(e) => update('length_per_bar_m', e.target.value)} />
          </FormField>
          <FormField label="Shape code" htmlFor="rebar-shape">
            <select id="rebar-shape" className={inputClassName} value={form.shape_code} onChange={(e) => update('shape_code', e.target.value)}>
              {SHAPE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </FormField>
          <FormField label="Remarks" htmlFor="rebar-remarks">
            <input id="rebar-remarks" className={inputClassName} value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
          </FormField>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Auto-calculated</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-stone-500">Total length (m)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{totalLength.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Unit weight (kg/m)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{unitWeight.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Total weight (kg)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{totalWeight.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {activePackage && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Design package</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <FormField label="Engineer" htmlFor="rebar-engineer">
                <input id="rebar-engineer" className={readOnlyInput} readOnly value={activeEngineer?.name ?? 'Unknown'} />
              </FormField>
              <FormField label="Package revision" htmlFor="rebar-revision">
                <input id="rebar-revision" className={readOnlyInput} readOnly value={activePackage.revision_label} />
              </FormField>
              <FormField label="Package status" htmlFor="rebar-status">
                <input id="rebar-status" className={readOnlyInput} readOnly value={DESIGN_PACKAGE_STATUS_LABELS[activePackage.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? activePackage.status} />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-stone-400">Engineer and package are auto-derived from the selected design package.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
