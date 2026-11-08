import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { RATE_MATERIAL_LABELS, RATE_MATERIAL_TYPES, RATE_SOURCE_TYPES, type ProjectRow, type RateMaterialType, type RateSourceType, type VendorRow } from '@/types/database';

interface RateFormModalProps { project: ProjectRow; vendors: VendorRow[]; onClose: () => void; onSaved: () => void; }

export function RateFormModal({ project, vendors, onClose, onSaved }: RateFormModalProps) {
  const [materialType, setMaterialType] = useState<RateMaterialType>('rod');
  const [vendorId, setVendorId] = useState('');
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState(0);
  const [unit, setUnit] = useState('ton');
  const [sourceType, setSourceType] = useState<RateSourceType>('purchase');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (Number(rate) < 0 || !unit.trim()) { setError('Enter a valid rate and unit.'); return; }
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from('material_rate_history').insert({
        project_id: project.id,
        vendor_id: vendorId || null,
        material_type: materialType,
        rate_date: rateDate,
        rate_bdt: Number(rate),
        unit: unit.trim(),
        source_type: sourceType,
        purchase_reference: reference.trim() || null,
        notes: notes.trim() || null,
        created_by: getActiveUserId(),
      });
      if (insertError) throw new Error(insertError.message);
      await recordActivity({ projectId: project.id, action: 'create', entityType: 'rate_history', summary: `Added ${RATE_MATERIAL_LABELS[materialType]} rate: Tk ${rate}/${unit}` });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save rate.'); }
    finally { setBusy(false); }
  }

  return <Modal open title="Record new rate" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save rate'}</Button></>}>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Material" htmlFor="rate-material"><select id="rate-material" className={inputClassName} value={materialType} onChange={(e) => setMaterialType(e.target.value as RateMaterialType)}>{RATE_MATERIAL_TYPES.map((type) => <option key={type} value={type}>{RATE_MATERIAL_LABELS[type]}</option>)}</select></FormField>
        <FormField label="Vendor" htmlFor="rate-vendor"><select id="rate-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">No vendor / market rate</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Rate date" htmlFor="rate-date"><input id="rate-date" type="date" className={inputClassName} value={rateDate} onChange={(e) => setRateDate(e.target.value)} /></FormField>
        <FormField label="Rate (Tk)" htmlFor="rate-value"><input id="rate-value" type="number" min={0} step="any" className={inputClassName} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Unit" htmlFor="rate-unit"><input id="rate-unit" className={inputClassName} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ton, bag, piece, litre" /></FormField>
        <FormField label="Source" htmlFor="rate-source"><select id="rate-source" className={inputClassName} value={sourceType} onChange={(e) => setSourceType(e.target.value as RateSourceType)}>{RATE_SOURCE_TYPES.map((source) => <option key={source} value={source}>{source.charAt(0).toUpperCase() + source.slice(1)}</option>)}</select></FormField>
      </div>
      <FormField label="Purchase / invoice reference" htmlFor="rate-reference"><input id="rate-reference" className={inputClassName} value={reference} onChange={(e) => setReference(e.target.value)} /></FormField>
      <FormField label="Notes" htmlFor="rate-notes"><textarea id="rate-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
