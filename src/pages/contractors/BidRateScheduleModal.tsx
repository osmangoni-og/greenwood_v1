import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { formatTaka } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { CONTRACTOR_RATE_ELEMENTS, type ContractorBidItemRow, type ContractorBidRow } from '@/types/database';

interface Props {
  projectId: string;
  bid: ContractorBidRow;
  contractorName: string;
  otherLowestBidTotal: number | null;
  referenceAreas: Map<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

interface DraftRow {
  element: string;
  unit: string;
  area: string;
  rate: string;
  remarks: string;
}

function toNumber(value: string): number {
  return value.trim() === '' ? 0 : Number(value);
}

export function BidRateScheduleModal({ projectId, bid, contractorName, otherLowestBidTotal, referenceAreas, onClose, onSaved }: Props) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const items = unwrap<ContractorBidItemRow[]>(
          await supabase.from('contractor_bid_items').select('*').eq('bid_id', bid.id),
        );
        if (cancelled) return;
        setDrafts(
          CONTRACTOR_RATE_ELEMENTS.map((element) => {
            const hit = items.find((i) => i.element === element);
            const refArea = referenceAreas.get(element);
            const areaValue = hit ? String(hit.area) : refArea ? String(refArea) : '';
            return {
              element,
              unit: hit?.unit ?? 'sft',
              area: areaValue,
              rate: hit ? String(hit.rate) : '',
              remarks: hit?.remarks ?? '',
            };
          }),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the rate schedule.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bid.id]);

  function updateDraft(index: number, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const lines = drafts.map((d) => {
    const area = toNumber(d.area);
    return { area, amount: area * toNumber(d.rate) };
  });
  const totalArea = lines.reduce((sum, l) => sum + l.area, 0);
  const totalAmount = lines.reduce((sum, l) => sum + l.amount, 0);
  const averageRate = totalArea > 0 ? totalAmount / totalArea : null;
  const rates = drafts.map((d) => toNumber(d.rate)).filter((r) => r > 0);
  const highestRate = rates.length > 0 ? Math.max(...rates) : null;
  const lowestRate = rates.length > 0 ? Math.min(...rates) : null;
  const representativeUnit = drafts.map((d) => d.unit).find((u) => u && u.trim()) || 'sft';
  const potentialSaving =
    otherLowestBidTotal !== null && totalAmount > otherLowestBidTotal ? totalAmount - otherLowestBidTotal : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const rows = drafts
      .map((d, sortOrder) => ({ d, sortOrder }))
      .filter(({ d }) => d.area.trim() !== '' || d.rate.trim() !== '' || d.remarks.trim() !== '');
    const invalid = rows.some(({ d }) => {
      const area = toNumber(d.area);
      const rate = toNumber(d.rate);
      return !Number.isFinite(area) || !Number.isFinite(rate) || area < 0 || rate < 0;
    });
    if (invalid) {
      setError('Area and rate must be numbers zero or greater.');
      return;
    }
    const missingUnit = rows.some(({ d }) => d.unit.trim() === '');
    if (missingUnit) {
      setError('Every priced element needs a unit (e.g. SFT, SQFT, KG).');
      return;
    }
    const areaWithoutUnit = rows.some(({ d }) => toNumber(d.area) > 0 && d.unit.trim() === '');
    if (areaWithoutUnit) {
      setError('A unit is required whenever an area is entered.');
      return;
    }
    const rateWithoutUnit = rows.some(({ d }) => toNumber(d.rate) > 0 && d.unit.trim() === '');
    if (rateWithoutUnit) {
      setError('A unit is required whenever a rate is entered.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const existing = unwrap<{ id: string }[]>(
        await supabase.from('contractor_bid_items').select('id').eq('bid_id', bid.id),
      );
      if (rows.length > 0) {
        const inserted = await supabase.from('contractor_bid_items').insert(
          rows.map(({ d, sortOrder }) => ({
            bid_id: bid.id,
            element: d.element,
            unit: d.unit.trim() || 'sft',
            area: toNumber(d.area),
            rate: toNumber(d.rate),
            remarks: d.remarks.trim() || null,
            sort_order: sortOrder,
          })),
        );
        if (inserted.error) throw new Error(inserted.error.message);
      }
      if (existing.length > 0) {
        const removed = await supabase
          .from('contractor_bid_items')
          .delete()
          .in('id', existing.map((r) => r.id));
        if (removed.error) throw new Error(removed.error.message);
      }
      const bidUpdate = await supabase
        .from('contractor_bids')
        .update({ quotation_amount_bdt: totalAmount, updated_at: new Date().toISOString() })
        .eq('id', bid.id);
      if (bidUpdate.error) throw new Error(bidUpdate.error.message);
      await recordActivity({
        projectId,
        action: 'update',
        entityType: 'contractor_bid',
        entityId: bid.id,
        summary: `Updated rate schedule for ${contractorName}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the rate schedule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Rate schedule: ${contractorName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="bid-rate-schedule-form" disabled={busy || loading}>
            {busy ? 'Saving...' : 'Save rate schedule'}
          </Button>
        </>
      }
    >
      <form id="bid-rate-schedule-form" onSubmit={save} className="space-y-4">
        <p className="text-sm text-stone-500">Enter the area and rate for each element. Amount is calculated as area x rate.</p>
        {referenceAreas.size > 0 && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || loading}
            onClick={() => {
              setDrafts((prev) =>
                prev.map((row) => {
                  if (row.area.trim() !== '') return row;
                  const ref = referenceAreas.get(row.element);
                  return ref ? { ...row, area: String(ref) } : row;
                }),
              );
            }}
          >
            Auto-fill areas from existing schedule
          </Button>
        )}
        {loading ? (
          <p className="text-sm text-stone-500">Loading rate schedule...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-3 font-medium">Element</th>
                  <th className="py-2 pr-3 font-medium">Unit</th>
                  <th className="py-2 pr-3 font-medium">Area</th>
                  <th className="py-2 pr-3 font-medium">Rate</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={d.element} className="border-t border-stone-100">
                    <td className="py-2 pr-3 font-medium text-stone-800">{d.element}</td>
                    <td className="py-2 pr-3">
                      <input className={inputClassName} placeholder="SFT" value={d.unit} aria-label={`${d.element} unit`} onChange={(e) => updateDraft(i, { unit: e.target.value })} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" step="0.01" className={inputClassName} value={d.area} aria-label={`${d.element} area`} onChange={(e) => updateDraft(i, { area: e.target.value })} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" step="0.01" className={inputClassName} value={d.rate} aria-label={`${d.element} rate`} onChange={(e) => updateDraft(i, { rate: e.target.value })} />
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-stone-900">{formatTaka(lines[i].amount)}</td>
                    <td className="py-2">
                      <input className={inputClassName} value={d.remarks} aria-label={`${d.element} remarks`} onChange={(e) => updateDraft(i, { remarks: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid gap-3 rounded-xl bg-stone-50 p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-xs text-stone-500">Total bid</p>
            <p className="font-semibold text-stone-900">{formatTaka(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Average rate</p>
            <p className="font-semibold text-stone-900">{averageRate !== null ? `${formatTaka(averageRate)} / ${representativeUnit}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Highest rate</p>
            <p className="font-semibold text-stone-900">{highestRate !== null ? `${formatTaka(highestRate)} / ${representativeUnit}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Lowest rate</p>
            <p className="font-semibold text-stone-900">{lowestRate !== null ? `${formatTaka(lowestRate)} / ${representativeUnit}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Potential saving</p>
            <p className="font-semibold text-stone-900">
              {otherLowestBidTotal === null ? '-' : formatTaka(potentialSaving)}
            </p>
            <p className="text-xs text-stone-500">vs lowest other bid</p>
          </div>
        </div>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
