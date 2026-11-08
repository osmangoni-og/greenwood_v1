import { useState } from 'react';
import { History, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/StatePanel';
import { recordActivity } from '@/lib/activity';
import { recordContingencyDrawdown, type BudgetWorkspace } from '@/lib/budget';
import { computeContingency, computeContingencyByCategory, type ContingencyCategoryRow } from '@/lib/budgetCalculations';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { formatDate, formatTaka } from '@/lib/format';
import { CONTINGENCY_CATEGORIES, type ContingencyCategory } from '@/types/database';
import { BarChart } from '@/components/charts/BarChart';

interface Props {
  projectId: string;
  workspace: BudgetWorkspace;
  onChanged: () => void;
}

export function ContingencyPanel({ projectId, workspace, onChanged }: Props) {
  const [drawing, setDrawing] = useState(false);
  const active = workspace.versions.find((version) => version.is_active) ?? null;
  const activeLines = active ? workspace.lines.filter((line) => line.budget_version_id === active.id) : [];
  const activeDrawdowns = active ? workspace.drawdowns.filter((row) => row.budget_version_id === active.id) : [];
  const totals = computeContingency(activeLines, activeDrawdowns);
  const categoryRows = computeContingencyByCategory(activeLines, activeDrawdowns);
  const versionLabel = (id: string) => workspace.versions.find((version) => version.id === id)?.version_label ?? '';

  if (!active) {
    return <EmptyState icon={ShieldCheck} title="No active budget" description="Approve a budget version with a contingency line before recording drawdowns." />;
  }

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Original contingency" value={formatTaka(totals.original)} hint={`From ${active.version_label}`} icon={ShieldCheck} tone="primary" />
      <StatCard label="Used" value={formatTaka(totals.used)} hint="Sum of all drawdowns" icon={History} tone="accent" />
      <StatCard label="Remaining" value={formatTaka(totals.remaining)} hint="Original minus used" icon={ShieldCheck} tone={totals.remaining < 0 ? 'error' : 'primary'} />
    </div>

    <Card>
      <CardHeader title="Contingency by category" description="Budgeted, used and remaining amount for each category." />
      <div className="mt-5"><BarChart data={categoryRows.map((row) => ({ label: row.label, primary: row.original, secondary: row.used }))} primaryLabel="Budgeted" secondaryLabel="Used" formatValue={formatTaka} /></div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Category</th><th className="py-2 pr-4 text-right font-medium">Budgeted</th><th className="py-2 pr-4 text-right font-medium">Used</th><th className="py-2 pr-4 text-right font-medium">Remaining</th></tr></thead>
          <tbody className="divide-y divide-stone-100">{categoryRows.map((row) => <tr key={row.category}><td className="py-3 pr-4 font-medium text-stone-800">{row.label}</td><td className="py-3 pr-4 text-right text-stone-700">{formatTaka(row.original)}</td><td className="py-3 pr-4 text-right text-stone-700">{formatTaka(row.used)}</td><td className={row.remaining < 0 ? 'py-3 pr-4 text-right font-semibold text-rose-700' : 'py-3 pr-4 text-right font-semibold text-stone-900'}>{formatTaka(row.remaining)}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>

    <Card>
      <CardHeader title="Drawdown audit trail" description="Every drawdown is recorded permanently with its purpose and approver." action={<Button onClick={() => setDrawing(true)} disabled={totals.remaining <= 0 || totals.original <= 0}><Plus className="h-4 w-4" aria-hidden /> Record drawdown</Button>} />
      {totals.original <= 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">The active budget has no contingency line. Add one in the Versions tab for a new version.</p>}
      {activeDrawdowns.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No drawdowns recorded against {active.version_label}.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Category</th><th className="py-2 pr-4 font-medium">Purpose</th><th className="py-2 pr-4 font-medium">Phase</th><th className="py-2 pr-4 font-medium">Approved by</th><th className="py-2 pr-4 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {activeDrawdowns.map((row) => <tr key={row.id}>
                <td className="py-3 pr-4 text-stone-600">{formatDate(row.drawdown_date)}</td>
                <td className="py-3 pr-4 text-stone-600">{CONTINGENCY_CATEGORIES.find(([key]) => key === row.category)?.[1] ?? row.category}</td>
                <td className="py-3 pr-4 text-stone-800">{row.purpose}{row.notes ? <span className="block text-xs text-stone-500">{row.notes}</span> : null}</td>
                <td className="py-3 pr-4 text-stone-600">{CONSTRUCTION_PHASES.find(([key]) => key === row.phase_key)?.[1] ?? '-'}</td>
                <td className="py-3 pr-4 text-stone-600">{row.approved_by}</td>
                <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(Number(row.amount_bdt))}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {drawing && <ContingencyDrawdownModal projectId={projectId} versionId={active.id} versionLabel={versionLabel(active.id)} remaining={totals.remaining} categoryRows={categoryRows} onClose={() => setDrawing(false)} onSaved={() => { setDrawing(false); onChanged(); }} />}
  </div>;
}

function ContingencyDrawdownModal({ projectId, versionId, versionLabel, remaining, categoryRows, onClose, onSaved }: { projectId: string; versionId: string; versionLabel: string; remaining: number; categoryRows: ContingencyCategoryRow[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ContingencyCategory>('other');
  const [phase, setPhase] = useState('');
  const [purpose, setPurpose] = useState('');
  const [approver, setApprover] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (value > remaining) { setError(`Only ${formatTaka(remaining)} of contingency remains.`); return; }
    const categoryRemaining = categoryRows.find((row) => row.category === category)?.remaining ?? 0;
    if (value > categoryRemaining) { setError(`Only ${formatTaka(categoryRemaining)} remains in this category.`); return; }
    if (!purpose.trim() || !approver.trim()) { setError('Enter the purpose and who approved the drawdown.'); return; }
    setBusy(true);
    try {
      await recordContingencyDrawdown({ projectId, budgetVersionId: versionId, drawdownDate: date, amount: value, category, phaseKey: phase || null, purpose: purpose.trim(), approvedBy: approver.trim(), notes: notes.trim() || null });
      await recordActivity({ projectId, action: 'create', entityType: 'budget_contingency', summary: `Drew ${formatTaka(value)} from contingency: ${purpose.trim()}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the drawdown.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title="Record contingency drawdown" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Recording...' : 'Record drawdown'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-stone-500">Remaining in {versionLabel}: {formatTaka(remaining)}. Drawdowns are permanent and cannot be edited.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" htmlFor="draw-date"><input id="draw-date" type="date" className={inputClassName} value={date} onChange={(e) => setDate(e.target.value)} required /></FormField>
        <FormField label="Amount (Tk)" htmlFor="draw-amount"><input id="draw-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} required /></FormField>
      </div>
        <FormField label="Category" htmlFor="draw-category"><select id="draw-category" className={inputClassName} value={category} onChange={(e) => setCategory(e.target.value as ContingencyCategory)}>{CONTINGENCY_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></FormField>
      <FormField label="Phase" htmlFor="draw-phase"><select id="draw-phase" className={inputClassName} value={phase} onChange={(e) => setPhase(e.target.value)}><option value="">Not phase specific</option>{CONSTRUCTION_PHASES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></FormField>
      <FormField label="Purpose" htmlFor="draw-purpose"><input id="draw-purpose" className={inputClassName} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Extra rebar after soil test" required /></FormField>
      <FormField label="Approved by" htmlFor="draw-approver"><input id="draw-approver" className={inputClassName} value={approver} onChange={(e) => setApprover(e.target.value)} required /></FormField>
      <FormField label="Notes" htmlFor="draw-notes"><textarea id="draw-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
