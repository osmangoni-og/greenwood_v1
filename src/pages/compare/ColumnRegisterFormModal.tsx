import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { FeetInchesInput } from '@/components/FeetInchesInput';
import { getActiveUserId } from '@/lib/activeUser';
import {
  STOREY_RANGE_OPTIONS,
  calcConcreteVolume,
  calcSteelWeight,
  formatBarGroups,
  parseBarGroups,
  parseTieDiameter,
  parseTieSpacingMm,
  type BarGroup,
} from '@/lib/columnCalculations';
import { supabase } from '@/lib/supabase';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';

interface ColumnRegisterFormModalProps {
  designId: string;
  designPackageId: string | null;
  existingRow: Record<string, unknown> | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'column-register-form';
const CUSTOM_STOREY = 'Custom';

interface GroupDraft {
  key: string;
  count: string;
  diameter: string;
}

function newGroupDraft(count = '4', diameter = '16'): GroupDraft {
  return { key: crypto.randomUUID(), count, diameter };
}

function draftsFromGroups(groups: BarGroup[]): GroupDraft[] {
  return groups.map((g) => newGroupDraft(String(g.bar_count), String(g.diameter_mm)));
}

function initialStorey(existing: unknown): { storey: string; custom: string } {
  const value = typeof existing === 'string' ? existing : '';
  if (!value) return { storey: 'Ground Floor', custom: '' };
  if ((STOREY_RANGE_OPTIONS as readonly string[]).includes(value)) return { storey: value, custom: '' };
  return { storey: CUSTOM_STOREY, custom: value };
}

export function ColumnRegisterFormModal({
  designId,
  designPackageId,
  existingRow,
  packages,
  engineers,
  onClose,
  onSaved,
}: ColumnRegisterFormModalProps) {
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;
  const storeyInitial = initialStorey(existingRow?.storey_range);

  const [form, setForm] = useState<Record<string, string>>(() => ({
    mark: String(existingRow?.mark ?? ''),
    column_type: String(existingRow?.column_type ?? 'Rectangular'),
    width_mm: String(existingRow?.width_mm ?? '300'),
    depth_mm: String(existingRow?.depth_mm ?? '450'),
    quantity: String(existingRow?.quantity ?? '1'),
    concrete_grade: String(existingRow?.concrete_grade ?? 'C25'),
    height_m: String(existingRow?.height_m ?? ''),
    clear_cover_mm: String(existingRow?.clear_cover_mm ?? '25'),
    tie_diameter_mm: String(parseTieDiameter(String(existingRow?.tie_reinforcement ?? '')) ?? '10'),
    tie_spacing_notation: String(existingRow?.tie_spacing_notation ?? ''),
    storey: storeyInitial.storey,
    storey_custom: storeyInitial.custom,
    notes: String(existingRow?.notes ?? ''),
  }));
  const [groups, setGroups] = useState<GroupDraft[]>(() => [newGroupDraft()]);
  const [groupsReady, setGroupsReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rowId) return;
    let cancelled = false;
    supabase
      .from('column_reinforcement_groups')
      .select('bar_count, diameter_mm')
      .eq('column_register_id', rowId)
      .order('sort_order')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError(loadError.message);
          return;
        }
        const stored = (data ?? []) as BarGroup[];
        const fallback = parseBarGroups(String(existingRow?.main_reinforcement ?? ''));
        const source = stored.length > 0 ? stored : fallback;
        setGroups(source.length > 0 ? draftsFromGroups(source) : [newGroupDraft()]);
        setGroupsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rowId, existingRow]);

  const widthMm = Number(form.width_mm) || 0;
  const depthMm = Number(form.depth_mm) || 0;
  const heightM = Number(form.height_m) || 0;
  const quantity = Number(form.quantity) || 0;
  const clearCoverMm = Number(form.clear_cover_mm) || 0;
  const tieDiameterMm = Number(form.tie_diameter_mm) || null;
  const tieSpacingMm = parseTieSpacingMm(form.tie_spacing_notation);

  const parsedGroups: BarGroup[] = useMemo(
    () => groups.map((g) => ({ bar_count: Number(g.count) || 0, diameter_mm: Number(g.diameter) || 0 })),
    [groups],
  );
  const totalBars = parsedGroups.reduce((sum, g) => sum + g.bar_count, 0);

  const concreteVolume = useMemo(
    () => calcConcreteVolume(widthMm, depthMm, heightM, quantity),
    [widthMm, depthMm, heightM, quantity],
  );
  const steelWeight = useMemo(
    () => calcSteelWeight({
      groups: parsedGroups,
      tieDiameterMm,
      tieSpacingMm,
      widthMm,
      depthMm,
      heightM,
      quantity,
      clearCoverMm,
    }),
    [parsedGroups, tieDiameterMm, tieSpacingMm, widthMm, depthMm, heightM, quantity, clearCoverMm],
  );

  const activePackage = packages.find((p) => p.id === designPackageId) ?? null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateGroup(key: string, field: 'count' | 'diameter', value: string) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  }

  function removeGroup(key: string) {
    setGroups((prev) => prev.filter((g) => g.key !== key));
  }

  function validate(): string | null {
    if (!form.mark.trim()) return 'Mark is required.';
    if (widthMm <= 0) return 'Width must be greater than zero.';
    if (depthMm <= 0) return 'Depth must be greater than zero.';
    if (heightM <= 0) return 'Height must be greater than zero.';
    if (quantity <= 0) return 'Quantity must be greater than zero.';
    if (clearCoverMm < 0 || 2 * clearCoverMm >= Math.min(widthMm, depthMm)) {
      return 'Clear cover must be zero or more and leave room for the bars inside the column.';
    }
    if (form.storey === CUSTOM_STOREY && !form.storey_custom.trim()) return 'Enter the custom storey range.';
    if (parsedGroups.length === 0) return 'Add at least one main reinforcement group.';
    if (parsedGroups.some((g) => !Number.isInteger(g.bar_count) || g.bar_count <= 0)) {
      return 'Every reinforcement group needs a bar count greater than zero.';
    }
    if (parsedGroups.some((g) => g.diameter_mm <= 0)) return 'Every reinforcement group needs a bar diameter greater than zero.';
    if (!tieDiameterMm) return 'Tie diameter must be greater than zero.';
    if (tieSpacingMm === null) return 'Tie spacing must be written like 100/150/100 or 4"/6"/4".';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const storeyRange = form.storey === CUSTOM_STOREY ? form.storey_custom.trim() : form.storey;
    const payload = {
      design_id: designId,
      mark: form.mark.trim(),
      column_type: form.column_type.trim() || 'Rectangular',
      dimensions_mm: `${widthMm}x${depthMm}`,
      width_mm: widthMm,
      depth_mm: depthMm,
      quantity,
      concrete_grade: form.concrete_grade.trim() || 'C25',
      height_m: heightM,
      storey_range: storeyRange,
      clear_cover_mm: clearCoverMm,
      main_reinforcement: formatBarGroups(parsedGroups),
      tie_reinforcement: `Ø${tieDiameterMm}`,
      tie_spacing_notation: form.tie_spacing_notation.trim(),
      tie_spacing_mm: tieSpacingMm ?? 0,
      concrete_volume_cum: Math.round(concreteVolume * 1000) / 1000,
      steel_weight_kg: steelWeight,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      let savedId = rowId ?? null;
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from('column_registers').update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
        const { error: clearError } = await supabase.from('column_reinforcement_groups').delete().eq('column_register_id', rowId);
        if (clearError) throw new Error(clearError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('column_registers')
          .insert({ ...payload, created_by: getActiveUserId() })
          .select('id')
          .single();
        if (insertError) throw new Error(insertError.message);
        savedId = (inserted as { id: string }).id;
      }

      const { error: groupsError } = await supabase.from('column_reinforcement_groups').insert(
        parsedGroups.map((g, index) => ({
          column_register_id: savedId,
          bar_count: g.bar_count,
          diameter_mm: g.diameter_mm,
          sort_order: index,
        })),
      );
      if (groupsError) throw new Error(groupsError.message);
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
      title={isEdit ? 'Edit Column Register' : 'Add to Column Register'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving || !groupsReady}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Mark" htmlFor="col-mark">
            <input id="col-mark" className={inputClassName} value={form.mark} onChange={(e) => update('mark', e.target.value)} placeholder="C1" />
          </FormField>
          <FormField label="Column type" htmlFor="col-type">
            <input id="col-type" className={inputClassName} value={form.column_type} onChange={(e) => update('column_type', e.target.value)} placeholder="Rectangular" />
          </FormField>
          <FeetInchesInput id="col-width" label="Width" valueMm={Number(form.width_mm) || 0} onChangeMm={(mm) => update('width_mm', String(mm))} />
          <FeetInchesInput id="col-depth" label="Depth" valueMm={Number(form.depth_mm) || 0} onChangeMm={(mm) => update('depth_mm', String(mm))} />
          <FormField label="Quantity" htmlFor="col-qty">
            <input id="col-qty" type="number" step="1" min="1" className={inputClassName} value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
          </FormField>
          <FormField label="Concrete grade" htmlFor="col-grade">
            <input id="col-grade" className={inputClassName} value={form.concrete_grade} onChange={(e) => update('concrete_grade', e.target.value)} placeholder="C25" />
          </FormField>
          <FeetInchesInput id="col-height" label="Height" valueMm={(Number(form.height_m) || 0) * 1000} onChangeMm={(mm) => update('height_m', String(mm / 1000))} />
          <FeetInchesInput id="col-cover" label="Clear cover" valueMm={Number(form.clear_cover_mm) || 0} onChangeMm={(mm) => update('clear_cover_mm', String(mm))} />
          <FormField label="Storey range" htmlFor="col-storey">
            <select id="col-storey" className={inputClassName} value={form.storey} onChange={(e) => update('storey', e.target.value)}>
              {STOREY_RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FormField>
          {form.storey === CUSTOM_STOREY && (
            <FormField label="Custom storey range" htmlFor="col-storey-custom">
              <input id="col-storey-custom" className={inputClassName} value={form.storey_custom} onChange={(e) => update('storey_custom', e.target.value)} placeholder="e.g. 1st to 2nd" />
            </FormField>
          )}
          <FormField label="Notes" htmlFor="col-notes">
            <input id="col-notes" className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </FormField>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-stone-900">Main reinforcement</p>
            <p className="text-xs text-stone-500">{totalBars} bars in total</p>
          </div>
          <div className="mt-3 space-y-3">
            {groups.map((group, index) => (
              <div key={group.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <FormField label={index === 0 ? 'Bar count' : ''} htmlFor={`col-group-count-${group.key}`}>
                  <input
                    id={`col-group-count-${group.key}`}
                    aria-label={`Group ${index + 1} bar count`}
                    type="number"
                    step="1"
                    min="1"
                    className={inputClassName}
                    value={group.count}
                    onChange={(e) => updateGroup(group.key, 'count', e.target.value)}
                  />
                </FormField>
                <FormField label={index === 0 ? 'Diameter (mm)' : ''} htmlFor={`col-group-dia-${group.key}`}>
                  <input
                    id={`col-group-dia-${group.key}`}
                    aria-label={`Group ${index + 1} diameter`}
                    type="number"
                    step="1"
                    min="1"
                    className={inputClassName}
                    value={group.diameter}
                    onChange={(e) => updateGroup(group.key, 'diameter', e.target.value)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => removeGroup(group.key)}
                  disabled={groups.length === 1}
                  aria-label={`Remove group ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setGroups((prev) => [...prev, newGroupDraft()])}>
            <Plus className="h-4 w-4" aria-hidden />
            Add group
          </Button>
          <p className="mt-2 text-xs text-stone-400">Example: 6 bars of 20 mm plus 2 bars of 16 mm.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Tie diameter (mm)" htmlFor="col-tie-dia">
            <input id="col-tie-dia" type="number" step="1" min="1" className={inputClassName} value={form.tie_diameter_mm} onChange={(e) => update('tie_diameter_mm', e.target.value)} />
          </FormField>
          <FormField label="Tie spacing (as drawn)" htmlFor="col-tie-spacing" hint={'e.g. 100/150/100 or 4"/6"/4"'}>
            <input id="col-tie-spacing" className={inputClassName} value={form.tie_spacing_notation} onChange={(e) => update('tie_spacing_notation', e.target.value)} placeholder='4"/6"/4"' />
          </FormField>
          <FormField label="Spacing used for steel (mm)" htmlFor="col-tie-mm">
            <input id="col-tie-mm" className={readOnlyInput} readOnly value={tieSpacingMm === null ? 'Enter a valid spacing' : String(tieSpacingMm)} />
          </FormField>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Auto-calculated</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-500">Concrete volume (cum)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{concreteVolume.toFixed(3)}</p>
              <p className="mt-0.5 text-xs text-stone-400">(W/1000) x (D/1000) x H x Qty</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Steel weight (kg)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{steelWeight.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-stone-400">All main groups plus ties inside the clear cover</p>
            </div>
          </div>
        </div>

        {activePackage && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Design package</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <FormField label="Engineer" htmlFor="col-engineer">
                <input id="col-engineer" className={readOnlyInput} readOnly value={activeEngineer?.name ?? 'Unknown'} />
              </FormField>
              <FormField label="Package revision" htmlFor="col-revision">
                <input id="col-revision" className={readOnlyInput} readOnly value={activePackage.revision_label} />
              </FormField>
              <FormField label="Package status" htmlFor="col-status">
                <input id="col-status" className={readOnlyInput} readOnly value={DESIGN_PACKAGE_STATUS_LABELS[activePackage.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? activePackage.status} />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-stone-400">Engineer is auto-derived from the selected design package.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
