import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { createDecision, updateDecision, type DecisionInput } from '@/lib/decisionLog';
import { recordActivity } from '@/lib/activity';
import { DECISION_CATEGORIES, type DecisionCategory, type DecisionStatus, type ProjectDecisionRow } from '@/types/database';

interface Props {
  projectId: string;
  editing?: ProjectDecisionRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DecisionModal({ projectId, editing = null, onClose, onSaved }: Props) {
  const [date, setDate] = useState(editing?.decision_date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<DecisionCategory>(editing?.category ?? 'budget');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [reason, setReason] = useState(editing?.reason ?? '');
  const [alternatives, setAlternatives] = useState(editing?.alternatives_considered ?? '');
  const [expectedImpact, setExpectedImpact] = useState(editing?.expected_impact ?? '');
  const [costImpact, setCostImpact] = useState(editing ? String(editing.cost_impact_bdt) : '0');
  const [scheduleImpact, setScheduleImpact] = useState(editing ? String(editing.schedule_impact_days) : '0');
  const [approvedBy, setApprovedBy] = useState(editing?.approved_by ?? '');
  const [status, setStatus] = useState<DecisionStatus>(editing?.status ?? 'approved');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Enter a decision title.'); return; }
    const input: DecisionInput = {
      projectId,
      decisionDate: date,
      category,
      title: title.trim(),
      description: description.trim() || null,
      reason: reason.trim() || null,
      alternatives: alternatives.trim() || null,
      expectedImpact: expectedImpact.trim() || null,
      costImpact: Number(costImpact) || 0,
      scheduleImpact: Number(scheduleImpact) || 0,
      approvedBy: approvedBy.trim() || null,
      status,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (editing) {
        await updateDecision(editing.id, input);
        await recordActivity({ projectId, action: 'update', entityType: 'decision', entityId: editing.id, summary: `Updated decision: ${input.title}` });
      } else {
        await createDecision(input);
        await recordActivity({ projectId, action: 'create', entityType: 'decision', summary: `Logged decision: ${input.title}` });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this decision.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal open title={editing ? 'Edit decision' : 'Log a decision'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save decision'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Decision date" htmlFor="dec-date"><input id="dec-date" type="date" className={inputClassName} value={date} onChange={(e) => setDate(e.target.value)} required /></FormField>
        <FormField label="Category" htmlFor="dec-cat"><select id="dec-cat" className={inputClassName} value={category} onChange={(e) => setCategory(e.target.value as DecisionCategory)}>{DECISION_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></FormField>
      </div>
      <FormField label="Title" htmlFor="dec-title"><input id="dec-title" className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Selected Main Contractor" required /></FormField>
      <FormField label="Description" htmlFor="dec-desc"><textarea id="dec-desc" rows={2} className={inputClassName} value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Reason" htmlFor="dec-reason"><textarea id="dec-reason" rows={2} className={inputClassName} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
        <FormField label="Alternatives considered" htmlFor="dec-alt"><textarea id="dec-alt" rows={2} className={inputClassName} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} /></FormField>
      </div>
      <FormField label="Expected impact" htmlFor="dec-impact"><textarea id="dec-impact" rows={2} className={inputClassName} value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} /></FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Cost impact (Tk)" htmlFor="dec-cost"><input id="dec-cost" type="number" step="any" className={inputClassName} value={costImpact} onChange={(e) => setCostImpact(e.target.value)} /></FormField>
        <FormField label="Schedule impact (days)" htmlFor="dec-sched"><input id="dec-sched" type="number" className={inputClassName} value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} /></FormField>
        <FormField label="Status" htmlFor="dec-status"><select id="dec-status" className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as DecisionStatus)}><option value="proposed">Proposed</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="superseded">Superseded</option></select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Approved by" htmlFor="dec-by"><input id="dec-by" className={inputClassName} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} /></FormField>
        <FormField label="Notes" htmlFor="dec-notes"><input id="dec-notes" className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      </div>
      <FormError message={error} />
    </form>
  </Modal>;
}
