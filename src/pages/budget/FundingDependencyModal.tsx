import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { createFundingDependency, updateFundingDependency } from '@/lib/fundingDependencies';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import type { ConstructionFundingSourceRow, FundingDependencyRow, FundingRiskLevel } from '@/types/database';

interface Props {
  projectId: string;
  sources: ConstructionFundingSourceRow[];
  editing?: FundingDependencyRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FundingDependencyModal({ projectId, sources, editing = null, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState(editing?.phase_key ?? CONSTRUCTION_PHASES[0][0]);
  const [sourceId, setSourceId] = useState(editing?.funding_source_id ?? sources[0]?.id ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.required_amount_bdt) : '');
  const [risk, setRisk] = useState<FundingRiskLevel>(editing?.risk_level ?? 'medium');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!sourceId) { setError('Choose the funding source this phase depends on.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a required amount greater than zero.'); return; }
    setBusy(true);
    try {
      if (editing) {
        await updateFundingDependency(editing.id, { phaseKey: phase, fundingSourceId: sourceId, requiredAmount: value, riskLevel: risk, notes: notes.trim() || null });
        await recordActivity({ projectId, action: 'update', entityType: 'funding_dependency', entityId: editing.id, summary: `Updated funding dependency for ${CONSTRUCTION_PHASES.find(([key]) => key === phase)?.[1] ?? phase}` });
      } else {
        await createFundingDependency({ projectId, phaseKey: phase, fundingSourceId: sourceId, requiredAmount: value, riskLevel: risk, notes: notes.trim() || null });
        await recordActivity({ projectId, action: 'create', entityType: 'funding_dependency', summary: `Linked ${CONSTRUCTION_PHASES.find(([key]) => key === phase)?.[1] ?? phase} to a funding source` });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this dependency.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title={editing ? 'Edit funding dependency' : 'Add funding dependency'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save dependency'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Construction phase" htmlFor="dep-phase"><select id="dep-phase" className={inputClassName} value={phase} onChange={(e) => setPhase(e.target.value)}>{CONSTRUCTION_PHASES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></FormField>
        <FormField label="Funding source" htmlFor="dep-source"><select id="dep-source" className={inputClassName} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>{sources.map((row) => <option key={row.id} value={row.id}>{row.source_name}</option>)}</select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Required amount (Tk)" htmlFor="dep-amount"><input id="dep-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} required /></FormField>
        <FormField label="Risk level" htmlFor="dep-risk"><select id="dep-risk" className={inputClassName} value={risk} onChange={(e) => setRisk(e.target.value as FundingRiskLevel)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></FormField>
      </div>
      <FormField label="Notes" htmlFor="dep-notes"><textarea id="dep-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
