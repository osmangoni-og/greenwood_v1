import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { calculateAdvanceAmount, DEFAULT_ADVANCE_PCT } from '@/lib/advancePayment';
import { formatTaka } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  BID_STATUSES,
  type BidStatus,
  type ContractorBidRow,
  type ContractorRow,
  type ProjectRow,
  type TenderRow,
} from '@/types/database';

const STATUS_OPTIONS: { value: BidStatus; label: string }[] = BID_STATUSES.map((s) => ({
  value: s,
  label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

interface BidFormModalProps {
  project: ProjectRow;
  tender: TenderRow;
  bid: ContractorBidRow | null;
  contractors: ContractorRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function BidFormModal({ project, tender, bid, contractors, onClose, onSaved }: BidFormModalProps) {
  const [contractorId, setContractorId] = useState(bid?.contractor_id ?? '');
  const [advancePct, setAdvancePct] = useState(bid?.advance_required_pct ?? DEFAULT_ADVANCE_PCT);
  const advanceAmount = calculateAdvanceAmount(bid?.quotation_amount_bdt ?? 0, Number(advancePct) || 0);
  const [paymentTerms, setPaymentTerms] = useState(bid?.payment_terms ?? '');
  const [timelineDays, setTimelineDays] = useState(bid?.timeline_days ?? 0);
  const [scopeNotes, setScopeNotes] = useState(bid?.scope_notes ?? '');
  const [status, setStatus] = useState<BidStatus>(bid?.status ?? 'submitted');
  const [notes, setNotes] = useState(bid?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bid) return;
    setContractorId(bid.contractor_id);
    setAdvancePct(bid.advance_required_pct);
    setPaymentTerms(bid.payment_terms ?? '');
    setTimelineDays(bid.timeline_days);
    setScopeNotes(bid.scope_notes ?? '');
    setStatus(bid.status);
    setNotes(bid.notes ?? '');
  }, [bid]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!contractorId) {
      setError('Select a contractor.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        tender_id: tender.id,
        contractor_id: contractorId,
        advance_required_pct: Number(advancePct) || 0,
        advance_amount_bdt: advanceAmount,
        payment_terms: paymentTerms.trim() || null,
        timeline_days: Number(timelineDays) || 0,
        scope_notes: scopeNotes.trim() || null,
        status,
        notes: notes.trim() || null,
      };
      if (bid) {
        const { error: updateErr } = await supabase
          .from('contractor_bids')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', bid.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('contractor_bids').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: bid ? 'update' : 'create',
        entityType: 'contractor_bid',
        entityId: bid?.id,
        summary: `${bid ? 'Updated' : 'Added'} bid for ${tender.title}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bid.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={bid ? 'Edit bid' : 'New bid'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save bid'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Contractor" htmlFor="bid-contractor">
          <select id="bid-contractor" className={inputClassName} value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">Select a contractor...</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">The bid total is calculated from the rate schedule. Use the Rate schedule action on the bid card to set it.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Advance required (%)" htmlFor="bid-advance-pct">
            <input id="bid-advance-pct" type="number" min={0} max={100} step="any" className={inputClassName} value={advancePct} onChange={(e) => setAdvancePct(Number(e.target.value))} />
          </FormField>
          <FormField label="Advance amount" htmlFor="bid-advance-amount">
            <input id="bid-advance-amount" type="text" readOnly className={inputClassName} value={formatTaka(advanceAmount)} />
          </FormField>
        </div>
        <p className="text-xs text-stone-500">Advance amount = advance % of the bid total ({formatTaka(bid?.quotation_amount_bdt ?? 0)}).</p>
        <FormField label="Payment terms" htmlFor="bid-payment">
          <textarea id="bid-payment" rows={2} className={inputClassName} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 20% advance, 60% progress, 20% on completion" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Timeline (days)" htmlFor="bid-timeline">
            <input id="bid-timeline" type="number" min={0} className={inputClassName} value={timelineDays} onChange={(e) => setTimelineDays(Number(e.target.value))} />
          </FormField>
          <FormField label="Status" htmlFor="bid-status">
            <select id="bid-status" className={inputClassName} value={status} onChange={(e) => setStatus(e.target.value as BidStatus)}>
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Scope notes" htmlFor="bid-scope">
          <textarea id="bid-scope" rows={2} className={inputClassName} value={scopeNotes} onChange={(e) => setScopeNotes(e.target.value)} placeholder="Inclusions / exclusions" />
        </FormField>
        <FormField label="Notes" htmlFor="bid-notes">
          <textarea id="bid-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
