import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { FormField, inputClassName } from '@/components/FormField';

export interface GroupDraft {
  key: string;
  count: string;
  diameter: string;
}

export function newGroupDraft(count = '4', diameter = '16'): GroupDraft {
  return { key: crypto.randomUUID(), count, diameter };
}

export function draftsFromCountDiameter(rows: { bar_count: number; diameter_mm: number }[]): GroupDraft[] {
  return rows.map((r) => newGroupDraft(String(r.bar_count), String(r.diameter_mm)));
}

interface ReinforcementGroupEditorProps {
  groups: GroupDraft[];
  onGroupsChange: (groups: GroupDraft[]) => void;
  title: string;
  hint?: string;
  minGroups?: number;
  countLabel?: string;
  diameterLabel?: string;
}

export function ReinforcementGroupEditor({
  groups,
  onGroupsChange,
  title,
  hint,
  minGroups = 1,
  countLabel = 'Bar count',
  diameterLabel = 'Diameter (mm)',
}: ReinforcementGroupEditorProps) {
  function updateGroup(key: string, field: 'count' | 'diameter', value: string) {
    onGroupsChange(groups.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  }
  function removeGroup(key: string) {
    onGroupsChange(groups.filter((g) => g.key !== key));
  }

  const totalBars = groups.reduce((sum, g) => sum + (Number(g.count) || 0), 0);

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <p className="text-xs text-stone-500">{totalBars} bars in total</p>
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((group, index) => (
          <div key={group.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <FormField label={index === 0 ? countLabel : ''} htmlFor={`grp-count-${group.key}`}>
              <input
                id={`grp-count-${group.key}`}
                aria-label={`${title} group ${index + 1} bar count`}
                type="number"
                step="1"
                min="1"
                className={inputClassName}
                value={group.count}
                onChange={(e) => updateGroup(group.key, 'count', e.target.value)}
              />
            </FormField>
            <FormField label={index === 0 ? diameterLabel : ''} htmlFor={`grp-dia-${group.key}`}>
              <input
                id={`grp-dia-${group.key}`}
                aria-label={`${title} group ${index + 1} diameter`}
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
              disabled={groups.length <= minGroups}
              aria-label={`Remove group ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => onGroupsChange([...groups, newGroupDraft()])}>
        <Plus className="h-4 w-4" aria-hidden />
        Add group
      </Button>
      {hint && <p className="mt-2 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

// Slab variant with an extra length field per group.
export interface SlabGroupDraft extends GroupDraft {
  length: string;
}

export function newSlabGroupDraft(count = '4', diameter = '12', length = '3'): SlabGroupDraft {
  return { key: crypto.randomUUID(), count, diameter, length };
}

interface SlabReinforcementGroupEditorProps {
  groups: SlabGroupDraft[];
  onGroupsChange: (groups: SlabGroupDraft[]) => void;
  title: string;
  hint?: string;
  directionLabel?: string;
}

export function SlabReinforcementGroupEditor({
  groups,
  onGroupsChange,
  title,
  hint,
  directionLabel,
}: SlabReinforcementGroupEditorProps) {
  function updateGroup(key: string, field: 'count' | 'diameter' | 'length', value: string) {
    onGroupsChange(groups.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  }
  function removeGroup(key: string) {
    onGroupsChange(groups.filter((g) => g.key !== key));
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      {directionLabel && <p className="mt-1 text-xs text-stone-500">{directionLabel}</p>}
      <div className="mt-3 space-y-3">
        {groups.map((group, index) => (
          <div key={group.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-3">
            <FormField label={index === 0 ? 'Bar count' : ''} htmlFor={`slab-count-${group.key}`}>
              <input
                id={`slab-count-${group.key}`}
                aria-label={`${title} group ${index + 1} bar count`}
                type="number"
                step="1"
                min="1"
                className={inputClassName}
                value={group.count}
                onChange={(e) => updateGroup(group.key, 'count', e.target.value)}
              />
            </FormField>
            <FormField label={index === 0 ? 'Diameter (mm)' : ''} htmlFor={`slab-dia-${group.key}`}>
              <input
                id={`slab-dia-${group.key}`}
                aria-label={`${title} group ${index + 1} diameter`}
                type="number"
                step="1"
                min="1"
                className={inputClassName}
                value={group.diameter}
                onChange={(e) => updateGroup(group.key, 'diameter', e.target.value)}
              />
            </FormField>
            <FormField label={index === 0 ? 'Length (m)' : ''} htmlFor={`slab-len-${group.key}`}>
              <input
                id={`slab-len-${group.key}`}
                aria-label={`${title} group ${index + 1} length`}
                type="number"
                step="0.01"
                min="0"
                className={inputClassName}
                value={group.length}
                onChange={(e) => updateGroup(group.key, 'length', e.target.value)}
              />
            </FormField>
            <Button type="button" variant="secondary" onClick={() => removeGroup(group.key)} aria-label={`Remove group ${index + 1}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => onGroupsChange([...groups, newSlabGroupDraft()])}>
        <Plus className="h-4 w-4" aria-hidden />
        Add group
      </Button>
      {hint && <p className="mt-2 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
