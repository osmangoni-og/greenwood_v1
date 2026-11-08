import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { FeetInchesInput } from '@/components/FeetInchesInput';
import { getActiveUserId } from '@/lib/activeUser';
import {
  STOREY_RANGE_OPTIONS,
  calcFootingConcreteVolume,
  calcFootingExcavationVolume,
  calcFootingSteelWeight,
  formatBarGroups,
  parseBarGroups,
  type BarGroup,
  type FootingLayerGroups,
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

interface FootingRegisterFormModalProps {
  designId: string;
  designPackageId: string | null;
  existingRow: Record<string, unknown> | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'footing-register-form';
const CUSTOM_STOREY = 'Custom';
const LAYERS = ['bottom_x', 'bottom_y', 'top'] as const;
type LayerKey = (typeof LAYERS)[number];
const LAYER_LABELS: Record<LayerKey, string> = {
  bottom_x: 'Bottom reinforcement — X direction',
  bottom_y: 'Bottom reinforcement — Y direction',
  top: 'Top reinforcement (optional)',
};

interface StoredGroup {
  layer: LayerKey;
  bar_count: number;
  diameter_mm: number;
  sort_order: number;
}

function initialStorey(existing: unknown): { storey: string; custom: string } {
  const value = typeof existing === 'string' ? existing : '';
  if (!value) return { storey: 'Below GB', custom: '' };
  if ((STOREY_RANGE_OPTIONS as readonly string[]).includes(value)) return { storey: value, custom: '' };
  return { storey: CUSTOM_STOREY, custom: value };
}

function emptyLayerGroups(): Record<LayerKey, GroupDraft[]> {
  return {
    bottom_x: [newGroupDraft('6', '16')],
    bottom_y: [newGroupDraft('6', '16')],
    top: [],
  };
}

export function FootingRegisterFormModal({
  designId,
  designPackageId,
  existingRow,
  packages,
  engineers,
  onClose,
  onSaved,
}: FootingRegisterFormModalProps) {
  const isEdit = existingRow !== null;
  const rowId = existingRow?.id as string | undefined;
  const storeyInitial = initialStorey(existingRow?.storey_range);

  const dims = String(existingRow?.dimensions_mm ?? '1200x1200');
  const [form, setForm] = useState<Record<string, string>>(() => ({
    mark: String(existingRow?.mark ?? ''),
    footing_type: String(existingRow?.footing_type ?? 'Isolated'),
    footing_length_mm: String(existingRow?.footing_length_mm ?? dims.split('x')[0] ?? '1200'),
    footing_width_mm: String(existingRow?.footing_width_mm ?? dims.split('x')[1] ?? '1200'),
    thickness_mm: String(existingRow?.thickness_mm ?? '500'),
    quantity: String(existingRow?.quantity ?? '1'),
    concrete_grade: String(existingRow?.concrete_grade ?? 'C25'),
    foundation_depth_m: String(existingRow?.foundation_depth_m ?? String(existingRow?.depth_m ?? '1.5')),
    pedestal_length_mm: String(existingRow?.pedestal_length_mm ?? '300'),
    pedestal_width_mm: String(existingRow?.pedestal_width_mm ?? '300'),
    pedestal_height_mm: String(existingRow?.pedestal_height_mm ?? '0'),
    clear_cover_mm: String(existingRow?.clear_cover_mm ?? '50'),
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
      .from('footing_reinforcement_groups')
      .select('layer, bar_count, diameter_mm, sort_order')
      .eq('footing_register_id', rowId)
      .order('sort_order')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError(loadError.message); return; }
        const stored = (data ?? []) as StoredGroup[];
        const next = emptyLayerGroups();
        const fallback = parseBarGroups(String(existingRow?.main_reinforcement ?? ''));
        for (const layer of LAYERS) {
          const layerStored = stored.filter((g) => g.layer === layer);
          if (layerStored.length > 0) {
            next[layer] = draftsFromCountDiameter(layerStored);
          } else if (layer === 'bottom_x' && fallback.length > 0) {
            next[layer] = draftsFromCountDiameter(fallback);
          }
        }
        setLayerGroups(next);
        setGroupsReady(true);
      });
    return () => { cancelled = true; };
  }, [rowId, existingRow]);

  const lengthMm = Number(form.footing_length_mm) || 0;
  const widthMm = Number(form.footing_width_mm) || 0;
  const thicknessMm = Number(form.thickness_mm) || 0;
  const foundationDepthM = Number(form.foundation_depth_m) || 0;
  const quantity = Number(form.quantity) || 0;
  const clearCoverMm = Number(form.clear_cover_mm) || 0;
  const pedestalLengthMm = Number(form.pedestal_length_mm) || 0;
  const pedestalWidthMm = Number(form.pedestal_width_mm) || 0;
  const pedestalHeightMm = Number(form.pedestal_height_mm) || 0;

  function parsedGroups(drafts: GroupDraft[]): BarGroup[] {
    return drafts.map((g) => ({ bar_count: Number(g.count) || 0, diameter_mm: Number(g.diameter) || 0 }));
  }

  const layers: FootingLayerGroups = useMemo(
    () => ({
      bottomX: parsedGroups(layerGroups.bottom_x),
      bottomY: parsedGroups(layerGroups.bottom_y),
      top: parsedGroups(layerGroups.top),
    }),
    [layerGroups],
  );

  const concreteVolume = useMemo(
    () => calcFootingConcreteVolume(lengthMm, widthMm, thicknessMm, quantity, pedestalLengthMm, pedestalWidthMm, pedestalHeightMm),
    [lengthMm, widthMm, thicknessMm, quantity, pedestalLengthMm, pedestalWidthMm, pedestalHeightMm],
  );
  const excavationVolume = useMemo(
    () => calcFootingExcavationVolume(lengthMm, widthMm, foundationDepthM, quantity),
    [lengthMm, widthMm, foundationDepthM, quantity],
  );
  const steelWeight = useMemo(
    () => calcFootingSteelWeight({ layers, lengthMm, widthMm, clearCoverMm, quantity }),
    [layers, lengthMm, widthMm, clearCoverMm, quantity],
  );

  const activePackage = packages.find((p) => p.id === designPackageId) ?? null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!designPackageId) return 'A design package is required before adding footing entries.';
    if (!form.mark.trim()) return 'Mark is required.';
    if (lengthMm <= 0) return 'Footing length must be greater than zero.';
    if (widthMm <= 0) return 'Footing width must be greater than zero.';
    if (thicknessMm <= 0) return 'Thickness must be greater than zero.';
    if (foundationDepthM <= 0) return 'Foundation depth must be greater than zero.';
    if (quantity <= 0) return 'Quantity must be greater than zero.';
    if (clearCoverMm < 0 || 2 * clearCoverMm >= Math.min(lengthMm, widthMm)) {
      return 'Clear cover must be zero or more and leave room for the bars inside the footing.';
    }
    if (form.storey === CUSTOM_STOREY && !form.storey_custom.trim()) return 'Enter the custom storey range.';
    const allGroups = [...layers.bottomX, ...layers.bottomY];
    if (allGroups.length === 0) return 'Add at least one bottom reinforcement group (X or Y direction).';
    if (allGroups.some((g) => !Number.isInteger(g.bar_count) || g.bar_count <= 0)) return 'Every reinforcement group needs a bar count greater than zero.';
    if (allGroups.some((g) => g.diameter_mm <= 0)) return 'Every reinforcement group needs a bar diameter greater than zero.';
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const storeyRange = form.storey === CUSTOM_STOREY ? form.storey_custom.trim() : form.storey;
    const allParsed: { layer: LayerKey; groups: BarGroup[] }[] = LAYERS.map((layer) => ({ layer, groups: parsedGroups(layerGroups[layer]) }));
    const payload = {
      design_id: designId,
      mark: form.mark.trim(),
      footing_type: form.footing_type.trim() || 'Isolated',
      dimensions_mm: `${lengthMm}x${widthMm}`,
      footing_length_mm: lengthMm,
      footing_width_mm: widthMm,
      thickness_mm: thicknessMm,
      quantity,
      concrete_grade: form.concrete_grade.trim() || 'C25',
      foundation_depth_m: foundationDepthM,
      depth_m: foundationDepthM,
      pedestal_length_mm: Number(form.pedestal_length_mm) || 0,
      pedestal_width_mm: Number(form.pedestal_width_mm) || 0,
      pedestal_height_mm: pedestalHeightMm,
      storey_range: storeyRange,
      clear_cover_mm: clearCoverMm,
      main_reinforcement: formatBarGroups([...layers.bottomX, ...layers.bottomY]),
      concrete_volume_cum: Math.round(concreteVolume * 1000) / 1000,
      excavation_volume_cum: Math.round(excavationVolume * 1000) / 1000,
      steel_weight_kg: steelWeight,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    setError(null);
    try {
      let savedId = rowId ?? null;
      if (isEdit && rowId) {
        const { error: updateError } = await supabase.from('footing_registers').update(payload).eq('id', rowId);
        if (updateError) throw new Error(updateError.message);
        const { error: clearError } = await supabase.from('footing_reinforcement_groups').delete().eq('footing_register_id', rowId);
        if (clearError) throw new Error(clearError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('footing_registers')
          .insert({ ...payload, created_by: getActiveUserId() })
          .select('id')
          .single();
        if (insertError) throw new Error(insertError.message);
        savedId = (inserted as { id: string }).id;
      }

      const groupRows: { footing_register_id: string; layer: string; bar_count: number; diameter_mm: number; sort_order: number }[] = [];
      for (const { layer, groups } of allParsed) {
        groups.forEach((g, index) => {
          groupRows.push({ footing_register_id: savedId!, layer, bar_count: g.bar_count, diameter_mm: g.diameter_mm, sort_order: index });
        });
      }
      if (groupRows.length > 0) {
        const { error: groupsError } = await supabase.from('footing_reinforcement_groups').insert(groupRows);
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
      title={isEdit ? 'Edit Footing Register' : 'Add to Footing Register'}
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
          <FormField label="Mark" htmlFor="ftg-mark">
            <input id="ftg-mark" className={inputClassName} value={form.mark} onChange={(e) => update('mark', e.target.value)} placeholder="F1" />
          </FormField>
          <FormField label="Footing type" htmlFor="ftg-type">
            <input id="ftg-type" className={inputClassName} value={form.footing_type} onChange={(e) => update('footing_type', e.target.value)} placeholder="Isolated" />
          </FormField>
          <FeetInchesInput id="ftg-length" label="Length" valueMm={Number(form.footing_length_mm) || 0} onChangeMm={(mm) => update('footing_length_mm', String(Math.round(mm)))} />
          <FeetInchesInput id="ftg-width" label="Width" valueMm={Number(form.footing_width_mm) || 0} onChangeMm={(mm) => update('footing_width_mm', String(Math.round(mm)))} />
          <FeetInchesInput id="ftg-thickness" label="Thickness" valueMm={Number(form.thickness_mm) || 0} onChangeMm={(mm) => update('thickness_mm', String(Math.round(mm)))} />
          <FormField label="Quantity" htmlFor="ftg-qty">
            <input id="ftg-qty" type="number" step="1" min="1" className={inputClassName} value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
          </FormField>
          <FormField label="Concrete grade" htmlFor="ftg-grade">
            <input id="ftg-grade" className={inputClassName} value={form.concrete_grade} onChange={(e) => update('concrete_grade', e.target.value)} placeholder="C25" />
          </FormField>
          <FeetInchesInput id="ftg-fdepth" label="Foundation depth" valueMm={(Number(form.foundation_depth_m) || 0) * 1000} onChangeMm={(mm) => update('foundation_depth_m', String(mm / 1000))} />
          <FeetInchesInput id="ftg-plength" label="Pedestal length" valueMm={Number(form.pedestal_length_mm) || 0} onChangeMm={(mm) => update('pedestal_length_mm', String(Math.round(mm)))} />
          <FeetInchesInput id="ftg-pwidth" label="Pedestal width" valueMm={Number(form.pedestal_width_mm) || 0} onChangeMm={(mm) => update('pedestal_width_mm', String(Math.round(mm)))} />
          <FeetInchesInput id="ftg-pheight" label="Pedestal height" valueMm={Number(form.pedestal_height_mm) || 0} onChangeMm={(mm) => update('pedestal_height_mm', String(Math.round(mm)))} />
          <FeetInchesInput id="ftg-cover" label="Clear cover" valueMm={Number(form.clear_cover_mm) || 0} onChangeMm={(mm) => update('clear_cover_mm', String(Math.round(mm)))} />
          <FormField label="Storey range" htmlFor="ftg-storey">
            <select id="ftg-storey" className={inputClassName} value={form.storey} onChange={(e) => update('storey', e.target.value)}>
              {STOREY_RANGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FormField>
          {form.storey === CUSTOM_STOREY && (
            <FormField label="Custom storey range" htmlFor="ftg-storey-custom">
              <input id="ftg-storey-custom" className={inputClassName} value={form.storey_custom} onChange={(e) => update('storey_custom', e.target.value)} placeholder="e.g. Below GB" />
            </FormField>
          )}
          <FormField label="Notes" htmlFor="ftg-notes">
            <input id="ftg-notes" className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </FormField>
        </div>

        {LAYERS.map((layer) => (
          <ReinforcementGroupEditor
            key={layer}
            groups={layerGroups[layer]}
            onGroupsChange={(next) => setLayerGroups((prev) => ({ ...prev, [layer]: next }))}
            title={LAYER_LABELS[layer]}
            minGroups={layer === 'top' ? 0 : 1}
            hint={layer === 'bottom_x' ? 'Bars running along the length of the footing.' : layer === 'bottom_y' ? 'Bars running across the width of the footing.' : undefined}
          />
        ))}

        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Auto-calculated</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-stone-500">Concrete volume (cum)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{concreteVolume.toFixed(3)}</p>
              <p className="mt-0.5 text-xs text-stone-400">Slab + pedestal volume x Qty</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Excavation volume (cum)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{excavationVolume.toFixed(3)}</p>
              <p className="mt-0.5 text-xs text-stone-400">(L/1000) x (W/1000) x D x Qty</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Steel weight (kg)</p>
              <p className="mt-0.5 text-lg font-semibold text-primary-800">{steelWeight.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-stone-400">Bottom X + Y plus optional top</p>
            </div>
          </div>
        </div>

        {activePackage && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Design package</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <FormField label="Engineer" htmlFor="ftg-engineer">
                <input id="ftg-engineer" className={readOnlyInput} readOnly value={activeEngineer?.name ?? 'Unknown'} />
              </FormField>
              <FormField label="Package revision" htmlFor="ftg-revision">
                <input id="ftg-revision" className={readOnlyInput} readOnly value={activePackage.revision_label} />
              </FormField>
              <FormField label="Package status" htmlFor="ftg-status">
                <input id="ftg-status" className={readOnlyInput} readOnly value={DESIGN_PACKAGE_STATUS_LABELS[activePackage.status as keyof typeof DESIGN_PACKAGE_STATUS_LABELS] ?? activePackage.status} />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-stone-400">Engineer is auto-derived from the selected design package.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
