import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import type { ProjectRow, VendorPerformanceRow, VendorRow } from '@/types/database';

interface PerformanceFormModalProps {
  project: ProjectRow;
  vendor: VendorRow;
  entry: VendorPerformanceRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PerformanceFormModal({ project, vendor, entry, onClose, onSaved }: PerformanceFormModalProps) {
  const [reviewDate, setReviewDate] = useState(entry?.review_date ?? new Date().toISOString().slice(0, 10));
  const [quality, setQuality] = useState(entry?.quality_score ?? 5);
  const [delivery, setDelivery] = useState(entry?.delivery_score ?? 5);
  const [pricing, setPricing] = useState(entry?.pricing_score ?? 5);
  const [responsiveness, setResponsiveness] = useState(entry?.responsiveness_score ?? 5);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setReviewDate(entry.review_date);
    setQuality(entry.quality_score);
    setDelivery(entry.delivery_score);
    setPricing(entry.pricing_score);
    setResponsiveness(entry.responsiveness_score);
    setNotes(entry.notes ?? '');
  }, [entry]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        vendor_id: vendor.id,
        project_id: project.id,
        review_date: reviewDate,
        quality_score: Number(quality),
        delivery_score: Number(delivery),
        pricing_score: Number(pricing),
        responsiveness_score: Number(responsiveness),
        notes: notes.trim() || null,
      };
      if (entry) {
        const { error: updateErr } = await supabase
          .from('vendor_performance')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('vendor_performance').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: entry ? 'update' : 'create',
        entityType: 'vendor_performance',
        entityId: entry?.id,
        summary: `${entry ? 'Updated' : 'Added'} performance review for ${vendor.name}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save performance review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={entry ? 'Edit performance review' : 'New performance review'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save review'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Review date" htmlFor="perf-date">
          <input id="perf-date" type="date" className={inputClassName} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
        </FormField>
        <ScoreInput label="Quality (30%)" id="perf-quality" value={quality} onChange={setQuality} />
        <ScoreInput label="Delivery (25%)" id="perf-delivery" value={delivery} onChange={setDelivery} />
        <ScoreInput label="Pricing (25%)" id="perf-pricing" value={pricing} onChange={setPricing} />
        <ScoreInput label="Responsiveness (20%)" id="perf-responsiveness" value={responsiveness} onChange={setResponsiveness} />
        <FormField label="Notes" htmlFor="perf-notes">
          <textarea id="perf-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

function ScoreInput({ label, id, value, onChange }: { label: string; id: string; value: number; onChange: (v: number) => void }) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-stone-200 accent-primary-700"
        />
        <span className="w-12 text-right text-sm font-medium text-stone-800">{value}/10</span>
      </div>
    </FormField>
  );
}
