import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { FeetInchesInput } from '@/components/FeetInchesInput';
import { getActiveUserId } from '@/lib/activeUser';
import {
  STOREY_RANGE_OPTIONS,
  calcBeamConcreteVolume,
  calcBeamSteelWeight,
  formatBarGroups,
  parseBarGroups,
  parseTieDiameter,
  parseTieSpacingMm,
  type BarGroup,
  type BeamLayerGroups,
} from '@/lib/structuralCalculations';
import {
  ReinforcementGroupEditor,
  draftsFromCountDiameter,
  newGroupDraft,
  type GroupDraft,
} from '@/pages/compare/ReinforcementGroupEditor';
import { supabase } from '@/lib/supabase';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';

interface BeamRegisterFormModalProps {
  designId: string;
  designPackageId: string | null;
  existingRow: Record<string, unknown> | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'beam-register-form';
const CUSTOM_STOREY = 'Custom';
const LAYERS = ['top', 'bottom', 'extra_left', 'extra_mid', 'extra_right'] as const;
type LayerKey = (typeof LAYERS)[number];
const LAYER_LABELS: Record<LayerKey, string> = {
  top: 'Top reinforcement',
  bottom: 'Bottom reinforcement',
  extra_left: 'Extra — left support',
  extra_mid: 'Extra — mid span',
  extra_right: 'Extra — right support',
};

interface StoredGroup {
  layer: LayerKey;
  bar_count: number;
  diameter_mm: number;
  sort_order: number;
}

function initialStorey(existing: unknown): { storey: string; custom: string } {
  const value = typeof existing === 'string' ? existing : '';
  if (!value) return { storey: 'Ground Floor', custom: '' };
  if ((STOREY_RANGE_OPTIONS as readonly string[]).includes(value)) return { storey: value, custom: '' };
  return { storey: CUSTOM_STOREY, custom: value };
}

function emptyLayerGroups(): Record<LayerKey, GroupDraft[]> {
  return {
    top: [newGroupDraft('2', '20')],
    bottom: [newGroupDraft('3', '20')],
    extra_left: [],
    extra_mid: [],
    extra_right: [],
  };
}

export function BeamRegisterFormModal({
  designId,
  designPackageId,
  existingRow,
  packages,
  engineers,
  onClose,
  onSaved,
}: BeamRegisterFormModalProps) {
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;
  const storeyInitial = initialStorey(existingRow?.storey_range);

  const [form, setForm] = useState<Record<string, string>>(() => ({
    mark: String(existingRow?.mark ?? ''),
    beam_type: String(existingRow?.beam_type ?? 'Rectangular'),
    width_mm: String(existingRow?.width_mm ?? ''),
    depth_mm: String(existingRow?.depth_mm ?? ''),
    quantity: String(existingRow?.quantity ?? '1'),
    concrete_grade: String(existingRow?.concrete_grade ?? 'C25'),
    length_m: String(existingRow?.length_m ?? ''),
    clear_cover_mm: String(existingRow?.clear_cover_mm ?? '25'),
    stirrup_diameter_mm: String(parseTieDiameter(String(existingRow?.tie_reinforcement ?? '')) ?? '10'),
    tie_spacing_notation: String(existingRow?.tie_spacing_notation ?? ''),
    storey: storeyInitial.storey,
    storey_custom: storeyInitial.custom,
    notes: String(existingRow?.notes ?? ''),
  }));
  const [layerGroups, setLayerGroups] = useState<Record<LayerKey, GroupDraft[]>>(emptyLayerGroups);
  const [groupsReady, setGroupsReady] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rowId) return;
    let cancelled = false;
    supabase
      .from('beam_reinforcement_groups')
      .select('layer, bar_count, diameter_mm, sort_order')
      .eq('beam_register_id', rowId)
      .order('sort_order')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError(loadError.message);
          return;
        }
        const stored = (data ?? []) as StoredGroup[];
        const next = emptyLayerGroups();
        const fallback = parseBarGroups(String(existingRow?.main_reinforcement ?? ''));
        for (const layer of LAYERS) {
          const layerStored = stored.filter((g) => g.layer === layer);
          if (layerStored.length > 0) {
            next[layer] = draftsFromCountDiameter(layerStored);
          } else if (layer === 'bottom' && fallback.length > 0) {
            next[layer] = draftsFromCountDiameter(fallback);
          }
        }
        setLayerGroups(next);
        setGroupsReady(true);
      });
    return () => { cancelled = true; };
  }, [rowId, existingRow]);

  const widthMm = Number(form.width_mm) || 0;
  const depthMm = Number(form.depth_mm) || 0;
  const lengthM = Number(form.length_m) || 0;
  const quantity = Number(form.quantity) || 0;
  const clearCoverMm = Number(form.clear_cover_mm) || 0;
  const stirrupDiameterMm = Number(form.stirrup_diameter_mm) || null;
  const stirrupSpacingMm = parseTieSpacingMm(form.tie_spacing_notation);

  function parsedGroups(drafts: GroupDraft[]): BarGroup[] {
    return drafts.map((g) => ({ bar_count: Number(g.count) || 0, diameter_mm: Number(g.diameter) || 0 }));
  }

  const layers: BeamLayerGroups = useMemo(
    () => ({
      top: parsedGroups(layerGroups.top),
      bottom: parsedGroups(layerGroups.bottom),
      extraLeft: parsedGroups(layerGroups.extra_left),
      extraMid: parsedGroups(layerGroups.extra_mid),
      extraRight: parsedGroups(layerGroups.extra_right),
    }),
    [layerGroups],
  );

  const concreteVolume = useMemo(
    () => calcBeamConcreteVolume(widthMm, depthMm, lengthM, quantity),
    [widthMm, depthMm, lengthM, quantity],
  );
  const steelWeight = useMemo(
    () => calcBeamSteelWeight({ layers, stirrupDiameterMm, stirrupSpacingMm, widthMm, depthMm, lengthM, quantity, clearCoverMm }),
    [layers, stirrupDiameterMm, stirrupSpacingMm, widthMm, depthMm, lengthM, quantity, clearCoverMm],
  );

  const activePackage = packages.find((p) => p.id === designPackageId) ?? null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.mark.trim()) return 'Mark is required.';
    if (widthMm <= 0) return 'Width must be greater than zero.';
    if (depthMm <= 0) return 'Depth must be greater than zero.';
    if (lengthM <= 0) return 'Length must be greater than zero.';
    if (quantity <= 0) return 'Quantity must be greater than zero.';
    if (clearCoverMm < 0 || 2 * clearCoverMm >= Math.min(widthMm, depthMm)) {
      return 'Clear cover must be zero or more and leave room for the bars inside the beam.';
    }
    if (form.storey === CUSTOM_STOREY && !form.storey_custom.trim()) return 'Enter the custom storey range.';
    const allGroups = [...layers.top, ...layers.bottom];
    if (allGroups.length === 0) return 'Add at least one top or bottom reinforcement group.';
    if (allGroups.some((g) => !Number.isInteger(g.bar_count) || g.bar_count <= 0)) return 'Every reinforcement group needs a bar count greater than zero.';
    if (allGroups.some((g) => g.diameter_mm <= 0)) return 'Every reinforcement group needs a bar diameter greater than zero.';
    if (!stirrupDiameterMm) return 'Stirrup diameter must be greater than zero.';
    if (stirrupSpacingMm === null) return 'Stirrup spacing must be written like 100/150/100 or 4"/6"/4".';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const storeyRange = form.storey === CUSTOM_STOREY ? form.storey_custom.trim() : form.storey;
    const allParsed: { layer: LayerKey; groups: BarGroup[] }[] = LAYERS.map((layer) => ({ layer, groups: layerKeyToField(layer) }));
    const payload = {
      design_id: designId,
      mark: form.mark.trim(),
      beam_type: form.beam_type.trim() || 'Rectangular',
      dimensions_mm: `${widthMm}x${depthMm}`,
      width_mm: widthMm,
      depth_mm: depthMm,
      quantity,
      concrete_grade: form.concrete_grade.trim() || 'C25',
      length_m: lengthM,
      storey_range: storeyRange,
      clear_cover_mm: clearCoverMm,
      main_reinforcement: formatBarGroups([...layers.top, ...layers.bottom]),
      tie_reinforcement: `Ø${stirrupDiameterMm}`,
      tie_spacing_notation: form.tie_spacing_notation.trim(),
      tie_spacing_mm: stirrupSpacingMm ?? 0,
      concrete_volume_cum: Math.round(concreteVolume * 1000) / 1000,
      steel_weight_kg: steelWeight,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      let savedId = rowId ?? null;
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from('beam_registers').update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
        const { error: clearError } = await supabase.from('beam_reinforcement_groups').delete().eq('beam_register_id', rowId);
        if (clearError) throw new Error(clearError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('beam_registers')
          .insert({ ...payload, created_by: getActiveUserId() })
          .select('id')
          .single();
        if (insertError) throw new Error(insertError.message);
        savedId = (inserted as { id: string }).id;
      }

      const groupRows: { beam_register_id: string; layer: string; bar_count: number; diameter_mm: number; sort_order: number }[] = [];
      for (const { layer, groups } of allParsed) {
        groups.forEach((g, index) => {
          groupRows.push({ beam_register_id: savedId!, layer, bar_count: g.bar_count, diameter_mm: g.diameter_mm, sort_order: index });
        });
      }
      if (groupRows.length > 0) {
        const { error: groupsError } = await supabase.from('beam_reinforcement_groups').insert(groupRows);
        if (groupsError) throw new Error(groupsError.message);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The entry could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function layerKeyToField(key: LayerKey): BarGroup[] {
    return key === 'top' ? layers.top
      : key === 'bottom' ? layers.bottom
      : key === 'extra_left' ? layers.extraLeft
      : key === 'extra_mid' ? layers.extraMid
      : layers.extraRight;
  }

  const readOnlyInput = `${inputClassName} bg-stone-100 text-stone-500 cursor-not-allowed`;

  return (
    <Modal
      open
      title={isEdit ? 'Edit Beam Register' : 'Add to Beam Register'}
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
          <FormField label="Mark" htmlFor="beam-mark">
            <input id="beam-mark" className={inputClassName} value={form.mark} onChange={(e) => update('mark', e.target.value)} placeholder="B1" />
          </FormField>
          <FormField label="Beam type" htmlFor="beam-type">
            <input id="beam-type" className={inputClassName} value={form.beam_type} onChange={(e) => update('beam_type', e.target.value)} placeholder="Rectangular" />
          </FormField>
          <FeetInchesInput id="beam-width" label="Width" valueMm={Number(form.width_mm) || 0} onChangeMm={(mm) => update('width_mm', String(mm))} />
          <FeetInchesInput id="beam-depth" label="Depth" valueMm={Number(form.depth_mm) || 0} onChangeMm={(mm) => update('depth_mm', String(mm))} />
          <FeetInchesInput id="beam-length" label="Length" valueMm={(Number(form.length_m) || 0) * 1000} onChangeMm={(mm) => update('length_m', String(mm / 1000))} />
          <FormField label="Quantity" htmlFor="beam-qty">
            <input id="beam-qty" type="number" step="1" min="1" className={inputClassName} value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
          </FormField>
          <FormField label="Concrete grade" htmlFor="beam-grade">
            <input id="beam-grade" className={inputClassName} value={form.concrete_grade} onChange={(e) => update('concrete_grade', e.target.value)} placeholder="C25" />
          </FormField>
          <FeetInchesInput id="beam-cover" label="Clear cover" valueMm={Number(form.clear_cover_mm) || 0} onChangeMm={(mm) => update('clear_cover_mm', String(mm))} />
          <FormField label="Storey range" htmlFor="beam-storey">
            <select id="beam-storey" className={inputClassName} value={form.storey} onChange={(e) => update('storey', e.target.value)}>
              {STOREY_RANGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FormField>
          {form.storey === CUSTOM_STOREY && (
            <FormField label="Custom storey range" htmlFor="beam-storey-custom">
              <input id="beam-storey-custom" className={inputClassName} value={form.storey_custom} onChange={(e) => update('storey_custom', e.target.value)} placeholder="e.g. 1st to 2nd" />
            </FormField>
          )}
          <FormField label="Notes" htmlFor="beam-notes">
            <input id="beam-notes" className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </FormField>
        </div>

        {LAYERS.map((layer) => (
          <ReinforcementGroupEditor
            key={layer}
            groups={layerGroups[layer]}
            onGroupsChange={(next) => setLayerGroups((prev) => ({ ...prev, [layer]: next }))}
            title={LAYER_LABELS[layer]}
            minGroups={layer === 'top' || layer === 'bottom' ? 1 : 0}
            hint={layer === 'top' ? 'Example: 2Ø20 + 2Ø16' : layer === 'bottom' ? 'Example: 3Ø20 or 2Ø20 + 2Ø16' : undefined}
          />
        ))}

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="Stirrup diameter (mm)" htmlFor="beam-stirrup-dia">
            <input id="beam-stirrup-dia" type="number" step="1" min="1" className={inputClassName} value={form.stirrup_diameter_mm} onChange={(e) => update('stirrup_diameter_mm', e.target.value)} />
          </FormField>
          <FormField label="Stirrup spacing (as drawn)" htmlFor="beam-stirrup-spacing" hint={'e.g. 100/150/100 or 4"/6"/4"'}>
            <input id="beam-stirrup-spacing" className={inputClassName} value={form.tie_spacing_notation} onChange={(e) => update('tie_spacing_notation', e.target.value)} placeholder='4"/6"/4"' />
          </FormField>
          <FormField label="Spacing used for steel (mm)" htmlFor="beam-stirrup-mm">
            <input id="beam-stirrup-mm" className={readOnlyInput} readOnly value={stirrupSpacingMm === null ? 'Enter a valid spacing' : String(stirrupSpacingMm)} />
          </FormField>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Auto-calculated</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-500">Concrete volume (cum)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{concreteVolume.toFixed(3)}</p>
              <p className="mt-0.5 text-xs text-stone-400">(W/1000) x (D/1000) x L x Qty</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Steel weight (kg)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{steelWeight.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-stone-400">All layers plus stirrups inside the clear cover</p>
            </div>
          </div>
        </div>

        {activePackage && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Design package</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <FormField label="Engineer" htmlFor="beam-engineer">
                <input id="beam-engineer" className={readOnlyInput} readOnly value={activeEngineer?.name ?? 'Unknown'} />
              </FormField>
              <FormField label="Package revision" htmlFor="beam-revision">
                <input id="beam-revision" className={readOnlyInput} readOnly value={activePackage.revision_label} />
              </FormField>
              <FormField label="Package status" htmlFor="beam-status">
                <input id="beam-status" className={readOnlyInput} readOnly value={DESIGN_PACKAGE_STATUS_LABELS[activePackage.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? activePackage.status} />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-stone-400">Engineer is auto-derived from the selected design package.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
