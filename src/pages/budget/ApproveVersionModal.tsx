import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { approveBudgetVersion } from '@/lib/budget';
import { formatTaka } from '@/lib/format';
import { BUDGET_REVISION_TRIGGERS, BUDGET_REVISION_TRIGGER_LABELS, type BudgetRevisionTrigger } from '@/types/database';
import type { BudgetVersionRow } from '@/types/database';

interface Props {
  version: BudgetVersionRow;
  totalBudget: number;
  previousTotal: number;
  isFirst: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ApproveVersionModal({ version, totalBudget, previousTotal, isFirst, onClose, onSaved }: Props) {
  const [reason, setReason] = useState(isFirst ? 'Initial project budget' : '');
  const [approver, setApprover] = useState('');
  const [triggerType, setTriggerType] = useState<BudgetRevisionTrigger>(isFirst ? 'other' : 'design_revision');
  const [revisionNote, setRevisionNote] = useState('');
  const [impactDescription, setImpactDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = totalBudget - previousTotal;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!reason.trim() || !approver.trim()) { setError('Enter the reason for the change and who approved it.'); return; }
    if (!triggerType) { setError('Select a trigger type for this revision.'); return; }
    if (totalBudget <= 0) { setError('Add budget lines before approving this version.'); return; }
    setBusy(true);
    try {
      await approveBudgetVersion(version.id, reason.trim(), approver.trim(), triggerType, revisionNote.trim() || undefined, impactDescription.trim() || undefined);
      await recordActivity({ projectId: version.project_id, action: 'status_change', entityType: 'budget_version', entityId: version.id, summary: `Approved ${version.version_label}: ${reason.trim()}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve this version.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title={`Approve ${version.version_label}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Approving...' : 'Approve and activate'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
        <p>New total: <span className="font-semibold text-stone-900">{formatTaka(totalBudget)}</span></p>
        {!isFirst && <p className="mt-1">Previous active total: {formatTaka(previousTotal)} ({change >= 0 ? '+' : ''}{formatTaka(change)})</p>}
        <p className="mt-2 text-xs text-stone-500">Approving makes this the active budget and marks the previous version as superseded.</p>
      </div>
      <FormField label="Trigger type" htmlFor="approve-trigger">
        <select id="approve-trigger" className={inputClassName} value={triggerType} onChange={(e) => setTriggerType(e.target.value as BudgetRevisionTrigger)} required>
          {BUDGET_REVISION_TRIGGERS.map((t) => <option key={t} value={t}>{BUDGET_REVISION_TRIGGER_LABELS[t]}</option>)}
        </select>
      </FormField>
      <FormField label="Reason for this version" htmlFor="approve-reason">
        <textarea id="approve-reason" rows={2} className={inputClassName} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Steel price increase, added parking floor" required />
      </FormField>
      <FormField label="Revision note" htmlFor="approve-note">
        <textarea id="approve-note" rows={2} className={inputClassName} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="Brief note about what changed in this revision" />
      </FormField>
      <FormField label="Impact description" htmlFor="approve-impact">
        <textarea id="approve-impact" rows={2} className={inputClassName} value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} placeholder="Describe the expected impact on budget, timeline, or scope" />
      </FormField>
      <FormField label="Approved by" htmlFor="approve-by">
        <input id="approve-by" className={inputClassName} value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Owner or approver name" required />
      </FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
