import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import type { BoqCategory, BoqEntryRow, BoqSheetRow, ProjectRow } from '@/types/database';

const CATEGORY_OPTIONS: { value: BoqCategory; label: string }[] = [
  { value: 'Foundation', label: 'Foundation' },
  { value: 'RCC', label: 'RCC' },
  { value: 'Brick Work', label: 'Brick Work' },
  { value: 'Plaster', label: 'Plaster' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Tiles', label: 'Tiles' },
  { value: 'Paint', label: 'Paint' },
  { value: 'Other', label: 'Other' },
];

interface BoqEntryFormModalProps {
  project: ProjectRow;
  sheet: BoqSheetRow;
  entry: BoqEntryRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function recalc(
  quantity: number,
  unitRate: number,
  materialPct: number,
  laborPct: number,
): { material: number; labor: number; total: number } {
  const total = Math.max(0, quantity * unitRate);
  const material = (total * Math.min(100, Math.max(0, materialPct))) / 100;
  const labor = (total * Math.min(100, Math.max(0, laborPct))) / 100;
  return { material, labor, total };
}

export function BoqEntryFormModal({ project, sheet, entry, onClose, onSaved }: BoqEntryFormModalProps) {
  const [category, setCategory] = useState<BoqCategory>(entry?.category ?? 'Foundation');
  const [description, setDescription] = useState(entry?.item_description ?? '');
  const [unit, setUnit] = useState(entry?.unit ?? 'item');
  const [quantity, setQuantity] = useState(entry?.quantity ?? 0);
  const [unitRate, setUnitRate] = useState(entry?.unit_rate_bdt ?? 0);
  const [materialPct, setMaterialPct] = useState(
    entry && entry.total_cost_bdt > 0 ? Math.round((entry.material_cost_bdt / entry.total_cost_bdt) * 100) : 70,
  );
  const [laborPct, setLaborPct] = useState(
    entry && entry.total_cost_bdt > 0 ? Math.round((entry.labor_cost_bdt / entry.total_cost_bdt) * 100) : 30,
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setCategory(entry.category);
    setDescription(entry.item_description);
    setUnit(entry.unit);
    setQuantity(entry.quantity);
    setUnitRate(entry.unit_rate_bdt);
    setMaterialPct(entry.total_cost_bdt > 0 ? Math.round((entry.material_cost_bdt / entry.total_cost_bdt) * 100) : 70);
    setLaborPct(entry.total_cost_bdt > 0 ? Math.round((entry.labor_cost_bdt / entry.total_cost_bdt) * 100) : 30);
    setNotes(entry.notes ?? '');
  }, [entry]);

  const { material, labor, total } = recalc(quantity, unitRate, materialPct, laborPct);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError('Item description is required.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        boq_sheet_id: sheet.id,
        category,
        item_description: description.trim(),
        unit: unit.trim() || 'item',
        quantity: Number(quantity) || 0,
        unit_rate_bdt: Number(unitRate) || 0,
        material_cost_bdt: Math.round(material * 100) / 100,
        labor_cost_bdt: Math.round(labor * 100) / 100,
        total_cost_bdt: Math.round(total * 100) / 100,
        notes: notes.trim() || null,
      };
      if (entry) {
        const { error: updateErr } = await supabase
          .from('boq_entries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('boq_entries').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: entry ? 'update' : 'create',
        entityType: 'boq_entry',
        entityId: entry?.id,
        summary: `${entry ? 'Updated' : 'Added'} BOQ item: ${description.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save BOQ entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={entry ? 'Edit BOQ item' : 'Add BOQ item'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving...' : 'Save item'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" htmlFor="boq-entry-category">
            <select
              id="boq-entry-category"
              className={inputClassName}
              value={category}
              onChange={(e) => setCategory(e.target.value as BoqCategory)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Unit" htmlFor="boq-entry-unit">
            <input
              id="boq-entry-unit"
              className={inputClassName}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="cft, sft, nos, etc."
            />
          </FormField>
        </div>
        <FormField label="Item description" htmlFor="boq-entry-description">
          <input
            id="boq-entry-description"
            className={inputClassName}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. PCC 1:3:6 in foundation"
            required
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Quantity" htmlFor="boq-entry-quantity">
            <input
              id="boq-entry-quantity"
              type="number"
              min={0}
              step="any"
              className={inputClassName}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Unit rate (Tk)" htmlFor="boq-entry-rate">
            <input
              id="boq-entry-rate"
              type="number"
              min={0}
              step="any"
              className={inputClassName}
              value={unitRate}
              onChange={(e) => setUnitRate(Number(e.target.value))}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Material share %" htmlFor="boq-entry-material">
            <input
              id="boq-entry-material"
              type="number"
              min={0}
              max={100}
              className={inputClassName}
              value={materialPct}
              onChange={(e) => setMaterialPct(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Labor share %" htmlFor="boq-entry-labor">
            <input
              id="boq-entry-labor"
              type="number"
              min={0}
              max={100}
              className={inputClassName}
              value={laborPct}
              onChange={(e) => setLaborPct(Number(e.target.value))}
            />
          </FormField>
        </div>
        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <div className="flex justify-between"><span>Total cost</span><span className="font-semibold">Tk {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
          <div className="mt-1 flex justify-between text-xs text-stone-500"><span>Material</span><span>Tk {material.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between text-xs text-stone-500"><span>Labor</span><span>Tk {labor.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
        </div>
        <FormField label="Notes" htmlFor="boq-entry-notes">
          <textarea
            id="boq-entry-notes"
            rows={2}
            className={inputClassName}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
