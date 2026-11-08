import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { FeetInchesInput } from '@/components/FeetInchesInput';
import { getActiveUserId } from '@/lib/activeUser';
import {
  STOREY_RANGE_OPTIONS,
  calcSlabConcreteVolume,
  calcSlabSteelWeight,
  type SlabBarGroup,
  type SlabLayerGroups,
} from '@/lib/structuralCalculations';
import {
  SlabReinforcementGroupEditor,
  newSlabGroupDraft,
  type SlabGroupDraft,
} from '@/pages/compare/ReinforcementGroupEditor';
import { supabase } from '@/lib/supabase';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';

interface SlabRegisterFormModalProps {
  designId: string;
  designPackageId: string | null;
  existingRow: Record<string, unknown> | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'slab-register-form';
const CUSTOM_STOREY = 'Custom';

interface StoredGroup {
  layer: 'main' | 'distribution';
  direction: string | null;
  bar_count: number;
  diameter_mm: number;
  length_m: number;
  sort_order: number;
}

function initialStorey(existing: unknown): { storey: string; custom: string } {
  const value = typeof existing === 'string' ? existing : '';
  if (!value) return { storey: 'Ground to Roof', custom: '' };
  if ((STOREY_RANGE_OPTIONS as readonly string[]).includes(value)) return { storey: value, custom: '' };
  return { storey: CUSTOM_STOREY, custom: value };
}

export function SlabRegisterFormModal({
  designId,
  designPackageId,
  existingRow,
  packages,
  engineers,
  onClose,
  onSaved,
}: SlabRegisterFormModalProps) {
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;
  const storeyInitial = initialStorey(existingRow?.storey_range);

  const [form, setForm] = useState<Record<string, string>>(() => ({
    mark: String(existingRow?.mark ?? ''),
    slab_type: String(existingRow?.slab_type ?? 'One-way'),
    thickness_mm: String(existingRow?.thickness_mm ?? '125'),
    area_sqm: String(existingRow?.area_sqm ?? ''),
    quantity: String(existingRow?.quantity ?? '1'),
    concrete_grade: String(existingRow?.concrete_grade ?? 'C25'),
    clear_cover_mm: String(existingRow?.clear_cover_mm ?? '20'),
    main_direction: String(existingRow?.main_direction ?? 'Short span'),
    distribution_direction: String(existingRow?.distribution_direction ?? 'Long span'),
    storey: storeyInitial.storey,
    storey_custom: storeyInitial.custom,
    notes: String(existingRow?.notes ?? ''),
  }));
  const [mainGroups, setMainGroups] = useState<SlabGroupDraft[]>([newSlabGroupDraft('4', '12', '3')]);
  const [distGroups, setDistGroups] = useState<SlabGroupDraft[]>([newSlabGroupDraft('4', '10', '3')]);
  const [groupsReady, setGroupsReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rowId) return;
    let cancelled = false;
    supabase
      .from('slab_reinforcement_groups')
      .select('layer, direction, bar_count, diameter_mm, length_m, sort_order')
      .eq('slab_register_id', rowId)
      .order('sort_order')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError(loadError.message); return; }
        const stored = (data ?? []) as StoredGroup[];
        const mainStored = stored.filter((g) => g.layer === 'main');
        const distStored = stored.filter((g) => g.layer === 'distribution');
        if (mainStored.length > 0) setMainGroups(mainStored.map((g) => ({ key: crypto.randomUUID(), count: String(g.bar_count), diameter: String(g.diameter_mm), length: String(g.length_m) })));
        if (distStored.length > 0) setDistGroups(distStored.map((g) => ({ key: crypto.randomUUID(), count: String(g.bar_count), diameter: String(g.diameter_mm), length: String(g.length_m) })));
        if (mainStored.length === 0 && distStored.length === 0) {
          setMainGroups([newSlabGroupDraft()]);
          setDistGroups([newSlabGroupDraft()]);
        }
        setGroupsReady(true);
      });
    return () => { cancelled = true; };
  }, [rowId]);

  const thicknessMm = Number(form.thickness_mm) || 0;
  const areaSqm = Number(form.area_sqm) || 0;
  const quantity = Number(form.quantity) || 0;
  const clearCoverMm = Number(form.clear_cover_mm) || 0;

  function parsedSlabGroups(drafts: SlabGroupDraft[]): SlabBarGroup[] {
    return drafts.map((g) => ({ bar_count: Number(g.count) || 0, diameter_mm: Number(g.diameter) || 0, length_m: Number(g.length) || 0 }));
  }

  const layers: SlabLayerGroups = useMemo(
    () => ({ main: parsedSlabGroups(mainGroups), distribution: parsedSlabGroups(distGroups) }),
    [mainGroups, distGroups],
  );

  const concreteVolume = useMemo(
    () => calcSlabConcreteVolume(thicknessMm, areaSqm, quantity),
    [thicknessMm, areaSqm, quantity],
  );
  const steelWeight = useMemo(
    () => calcSlabSteelWeight({ layers, areaSqm, thicknessMm, clearCoverMm, quantity }),
    [layers, areaSqm, thicknessMm, clearCoverMm, quantity],
  );

  const activePackage = packages.find((p) => p.id === designPackageId) ?? null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!designPackageId) return 'A design package is required before adding slab entries.';
    if (!form.mark.trim()) return 'Mark is required.';
    if (thicknessMm <= 0) return 'Thickness must be greater than zero.';
    if (areaSqm <= 0) return 'Area must be greater than zero.';
    if (quantity <= 0) return 'Quantity must be greater than zero.';
    if (clearCoverMm < 0) return 'Clear cover must be zero or more.';
    if (form.storey === CUSTOM_STOREY && !form.storey_custom.trim()) return 'Enter the custom storey range.';
    const allGroups = [...layers.main, ...layers.distribution];
    if (allGroups.length === 0) return 'Add at least one main or distribution reinforcement group.';
    if (allGroups.some((g) => !Number.isInteger(g.bar_count) || g.bar_count <= 0)) return 'Every reinforcement group needs a bar count greater than zero.';
    if (allGroups.some((g) => g.diameter_mm <= 0)) return 'Every reinforcement group needs a bar diameter greater than zero.';
    if (allGroups.some((g) => g.length_m <= 0)) return 'Every reinforcement group needs a bar length greater than zero.';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const storeyRange = form.storey === CUSTOM_STOREY ? form.storey_custom.trim() : form.storey;
    const payload = {
      design_id: designId,
      mark: form.mark.trim(),
      slab_type: form.slab_type.trim() || 'One-way',
      thickness_mm: thicknessMm,
      area_sqm: areaSqm,
      quantity,
      concrete_grade: form.concrete_grade.trim() || 'C25',
      clear_cover_mm: clearCoverMm,
      storey_range: storeyRange,
      concrete_volume_cum: Math.round(concreteVolume * 1000) / 1000,
      steel_weight_kg: steelWeight,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      let savedId = rowId ?? null;
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from('slab_registers').update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
        const { error: clearError } = await supabase.from('slab_reinforcement_groups').delete().eq('slab_register_id', rowId);
        if (clearError) throw new Error(clearError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('slab_registers')
          .insert({ ...payload, created_by: getActiveUserId() })
          .select('id')
          .single();
        if (insertError) throw new Error(insertError.message);
        savedId = (inserted as { id: string }).id;
      }

      const groupRows: { slab_register_id: string; layer: string; direction: string | null; bar_count: number; diameter_mm: number; length_m: number; sort_order: number }[] = [];
      layers.main.forEach((g, index) => {
        groupRows.push({ slab_register_id: savedId!, layer: 'main', direction: form.main_direction.trim() || null, bar_count: g.bar_count, diameter_mm: g.diameter_mm, length_m: g.length_m, sort_order: index });
      });
      layers.distribution.forEach((g, index) => {
        groupRows.push({ slab_register_id: savedId!, layer: 'distribution', direction: form.distribution_direction.trim() || null, bar_count: g.bar_count, diameter_mm: g.diameter_mm, length_m: g.length_m, sort_order: index });
      });
      if (groupRows.length > 0) {
        const { error: groupsError } = await supabase.from('slab_reinforcement_groups').insert(groupRows);
        if (groupsError) throw new Error(groupsError.message);
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
      title={isEdit ? 'Edit Slab Register' : 'Add to Slab Register'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={saving || !groupsReady}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Mark" htmlFor="slab-mark">
            <input id="slab-mark" className={inputClassName} value={form.mark} onChange={(e) => update('mark', e.target.value)} placeholder="S1" />
          </FormField>
          <FormField label="Slab type" htmlFor="slab-type">
            <input id="slab-type" className={inputClassName} value={form.slab_type} onChange={(e) => update('slab_type', e.target.value)} placeholder="One-way" />
          </FormField>
          <FeetInchesInput id="slab-thickness" label="Thickness" valueMm={Number(form.thickness_mm) || 0} onChangeMm={(mm) => update('thickness_mm', String(Math.round(mm)))} />
          <FormField label="Area (sqm)" htmlFor="slab-area">
            <input id="slab-area" type="number" step="0.01" min="0" className={inputClassName} value={form.area_sqm} onChange={(e) => update('area_sqm', e.target.value)} />
          </FormField>
          <FormField label="Quantity" htmlFor="slab-qty">
            <input id="slab-qty" type="number" step="1" min="1" className={inputClassName} value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
          </FormField>
          <FormField label="Concrete grade" htmlFor="slab-grade">
            <input id="slab-grade" className={inputClassName} value={form.concrete_grade} onChange={(e) => update('concrete_grade', e.target.value)} placeholder="C25" />
          </FormField>
          <FeetInchesInput id="slab-cover" label="Clear cover" valueMm={Number(form.clear_cover_mm) || 0} onChangeMm={(mm) => update('clear_cover_mm', String(mm))} />
          <FormField label="Storey range" htmlFor="slab-storey">
            <select id="slab-storey" className={inputClassName} value={form.storey} onChange={(e) => update('storey', e.target.value)}>
              {STOREY_RANGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FormField>
          {form.storey === CUSTOM_STOREY && (
            <FormField label="Custom storey range" htmlFor="slab-storey-custom">
              <input id="slab-storey-custom" className={inputClassName} value={form.storey_custom} onChange={(e) => update('storey_custom', e.target.value)} placeholder="e.g. 1st to 2nd" />
            </FormField>
          )}
          <FormField label="Main direction" htmlFor="slab-main-dir">
            <input id="slab-main-dir" className={inputClassName} value={form.main_direction} onChange={(e) => update('main_direction', e.target.value)} placeholder="Short span" />
          </FormField>
          <FormField label="Distribution direction" htmlFor="slab-dist-dir">
            <input id="slab-dist-dir" className={inputClassName} value={form.distribution_direction} onChange={(e) => update('distribution_direction', e.target.value)} placeholder="Long span" />
          </FormField>
          <FormField label="Notes" htmlFor="slab-notes">
            <input id="slab-notes" className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </FormField>
        </div>

        <SlabReinforcementGroupEditor
          groups={mainGroups}
          onGroupsChange={setMainGroups}
          title="Main reinforcement"
          directionLabel={form.main_direction || 'Short span'}
          hint="Bars in the main direction of the slab."
        />
        <SlabReinforcementGroupEditor
          groups={distGroups}
          onGroupsChange={setDistGroups}
          title="Distribution reinforcement"
          directionLabel={form.distribution_direction || 'Long span'}
          hint="Bars distributed across the slab to tie the main bars."
        />

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Auto-calculated</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-500">Concrete volume (cum)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{concreteVolume.toFixed(3)}</p>
              <p className="mt-0.5 text-xs text-stone-400">(T/1000) x Area x Qty</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Steel weight (kg)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{steelWeight.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-stone-400">Main plus distribution groups</p>
            </div>
          </div>
        </div>

        {activePackage && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Design package</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <FormField label="Engineer" htmlFor="slab-engineer">
                <input id="slab-engineer" className={readOnlyInput} readOnly value={activeEngineer?.name ?? 'Unknown'} />
              </FormField>
              <FormField label="Package revision" htmlFor="slab-revision">
                <input id="slab-revision" className={readOnlyInput} readOnly value={activePackage.revision_label} />
              </FormField>
              <FormField label="Package status" htmlFor="slab-status">
                <input id="slab-status" className={readOnlyInput} readOnly value={DESIGN_PACKAGE_STATUS_LABELS[activePackage.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? activePackage.status} />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-stone-400">Engineer is auto-derived from the selected design package.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
