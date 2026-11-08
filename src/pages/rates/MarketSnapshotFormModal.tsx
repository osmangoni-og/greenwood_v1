import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { RATE_MATERIAL_LABELS, RATE_MATERIAL_TYPES, type ProjectRow, type RateMaterialType } from '@/types/database';

interface MarketSnapshotFormModalProps { project: ProjectRow; onClose: () => void; onSaved: () => void; }

export function MarketSnapshotFormModal({ project, onClose, onSaved }: MarketSnapshotFormModalProps) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [materialType, setMaterialType] = useState<RateMaterialType>('rod');
  const [rate, setRate] = useState(0);
  const [unit, setUnit] = useState('ton');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    if (Number(rate) < 0 || !unit.trim()) { setError('Enter a valid rate and unit.'); return; }
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from('monthly_market_snapshots').upsert({ project_id: project.id, snapshot_month: month, material_type: materialType, market_rate_bdt: Number(rate), unit: unit.trim(), source: source.trim() || null, notes: notes.trim() || null, created_by: getActiveUserId() }, { onConflict: 'project_id,snapshot_month,material_type' });
      if (insertError) throw new Error(insertError.message);
      await recordActivity({ projectId: project.id, action: 'create', entityType: 'market_snapshot', summary: `Saved ${RATE_MATERIAL_LABELS[materialType]} market snapshot` });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save snapshot.'); }
    finally { setBusy(false); }
  }

  return <Modal open title="Add monthly market snapshot" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save snapshot'}</Button></>}>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Month" htmlFor="snapshot-month"><input id="snapshot-month" type="date" className={inputClassName} value={month} onChange={(e) => setMonth(e.target.value)} /></FormField>
        <FormField label="Material" htmlFor="snapshot-material"><select id="snapshot-material" className={inputClassName} value={materialType} onChange={(e) => setMaterialType(e.target.value as RateMaterialType)}>{RATE_MATERIAL_TYPES.map((type) => <option key={type} value={type}>{RATE_MATERIAL_LABELS[type]}</option>)}</select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Market rate (Tk)" htmlFor="snapshot-rate"><input id="snapshot-rate" type="number" min={0} step="any" className={inputClassName} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></FormField>
        <FormField label="Unit" htmlFor="snapshot-unit"><input id="snapshot-unit" className={inputClassName} value={unit} onChange={(e) => setUnit(e.target.value)} /></FormField>
      </div>
      <FormField label="Source" htmlFor="snapshot-source"><input id="snapshot-source" className={inputClassName} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Market survey / supplier quotation" /></FormField>
      <FormField label="Notes" htmlFor="snapshot-notes"><textarea id="snapshot-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
