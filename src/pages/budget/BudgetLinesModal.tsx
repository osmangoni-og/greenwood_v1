import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { replaceDraftLines, type DraftLineInput } from '@/lib/budget';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { BUDGET_LEVELS, CONTINGENCY_CATEGORIES, type BudgetLevel, type BudgetVersionLineRow, type BudgetVersionRow } from '@/types/database';

interface Props {
  projectId: string;
  version: BudgetVersionRow;
  lines: BudgetVersionLineRow[];
  onClose: () => void;
  onSaved: () => void;
}

interface DraftRow {
  key: number;
  level: BudgetLevel;
  category: string;
  phase_key: string;
  amount: string;
  notes: string;
}

const LEVEL_HINT: Record<BudgetLevel, string> = {
  project: 'Other project costs (approvals, land development, interest)',
  construction: 'Construction cost by category; counts toward the total',
  material: 'Allocation of construction cost to materials; not added to the total',
  phase: 'Allocation of construction cost to a phase; not added to the total',
  contingency: 'Reserve for unexpected costs; counts toward the total',
};

export function BudgetLinesModal({ projectId, version, lines, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => lines.length
    ? lines.map((line, index) => ({ key: index, level: line.level, category: line.category, phase_key: line.phase_key ?? '', amount: String(line.budget_amount_bdt), notes: line.notes ?? '' }))
    : [{ key: 0, level: 'construction', category: '', phase_key: '', amount: '', notes: '' }]);
  const [nextKey, setNextKey] = useState(rows.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: nextKey, level: 'construction', category: '', phase_key: '', amount: '', notes: '' }]);
    setNextKey((value) => value + 1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const payload: DraftLineInput[] = [];
    for (const row of rows) {
      const amount = Number(row.amount);
      if (!row.category.trim()) { setError('Every line needs a category or name.'); return; }
      if (!Number.isFinite(amount) || amount < 0) { setError(`Enter a valid amount for "${row.category.trim()}".`); return; }
      if (row.level === 'phase' && !row.phase_key) { setError(`Choose a phase for "${row.category.trim()}".`); return; }
      payload.push({ level: row.level, category: row.category.trim(), phase_key: row.level === 'phase' ? row.phase_key : null, budget_amount_bdt: amount, notes: row.notes.trim() || null });
    }
    setBusy(true);
    try {
      await replaceDraftLines(projectId, version.id, payload);
      await recordActivity({ projectId, action: 'update', entityType: 'budget_version', entityId: version.id, summary: `Updated lines of ${version.version_label}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the budget lines.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title={`Edit ${version.version_label} lines`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save lines'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-stone-500">Lines can be changed until this version is approved.</p>
      {rows.map((row) => (
        <div key={row.key} className="space-y-3 rounded-xl border border-stone-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Level" htmlFor={`level-${row.key}`} hint={LEVEL_HINT[row.level]}>
              <select id={`level-${row.key}`} className={inputClassName} value={row.level} onChange={(e) => update(row.key, { level: e.target.value as BudgetLevel })}>
                {BUDGET_LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
            <FormField label={row.level === 'contingency' ? 'Contingency category' : 'Category or name'} htmlFor={`category-${row.key}`}>
              {row.level === 'contingency' ? (
                <select id={`category-${row.key}`} className={inputClassName} value={row.category} onChange={(e) => update(row.key, { category: e.target.value })}>
                  <option value="">Choose a category</option>
                  {CONTINGENCY_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              ) : (
                <input id={`category-${row.key}`} className={inputClassName} value={row.category} onChange={(e) => update(row.key, { category: e.target.value })} placeholder="e.g. Foundation works, Steel" />
              )}
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Phase" htmlFor={`phase-${row.key}`} hint={row.level === 'phase' ? 'Required for phase lines' : 'Optional'}>
              <select id={`phase-${row.key}`} className={inputClassName} value={row.phase_key} onChange={(e) => update(row.key, { phase_key: e.target.value })}>
                <option value="">None</option>
                {CONSTRUCTION_PHASES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (Tk)" htmlFor={`amount-${row.key}`}>
              <input id={`amount-${row.key}`} type="number" min={0} step="any" className={inputClassName} value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} />
            </FormField>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Notes" htmlFor={`notes-${row.key}`}>
                <input id={`notes-${row.key}`} className={inputClassName} value={row.notes} onChange={(e) => update(row.key, { notes: e.target.value })} />
              </FormField>
            </div>
            <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="mb-1 rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-700" aria-label="Remove line"><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={addRow}><Plus className="h-4 w-4" aria-hidden /> Add line</Button>
      <FormError message={error} />
    </form>
  </Modal>;
}
