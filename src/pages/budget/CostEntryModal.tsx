import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { recordCostEntry, type CostEntryInput } from '@/lib/budget';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { formatTaka } from '@/lib/format';
import type { CostCommitmentType, VendorRow } from '@/types/database';

interface Props {
  projectId: string;
  vendors: VendorRow[];
  onClose: () => void;
  onSaved: () => void;
}

type EntryKind = CostEntryInput['kind'];

const KIND_LABELS: Record<EntryKind, string> = {
  contractor_payment: 'Contractor payment (actual)',
  labor_payment: 'Labor payment (actual)',
  purchase_order: 'Purchase order (commitment)',
  cost_commitment: 'Contract balance still owed (committed)',
};

const COMMITMENT_TYPES: [CostCommitmentType, string][] = [
  ['contractor_contract', 'Contractor contract'],
  ['vendor_contract', 'Vendor contract'],
  ['labor_agreement', 'Labor agreement'],
  ['other', 'Other'],
];

const today = () => new Date().toISOString().slice(0, 10);

export function CostEntryModal({ projectId, vendors, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<EntryKind>('contractor_payment');
  const [date, setDate] = useState(today);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [secondary, setSecondary] = useState('');
  const [phase, setPhase] = useState('');
  const [category, setCategory] = useState('Construction');
  const [reference, setReference] = useState('');
  const [commitmentType, setCommitmentType] = useState<CostCommitmentType>('contractor_contract');
  const [vendorId, setVendorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const value = Number(amount);
    const second = Number(secondary);
    if (!name.trim()) { setError('Enter a name, number, or party for this entry.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (kind === 'labor_payment' && (!Number.isInteger(second) || second < 0)) { setError('Enter a whole number of workers.'); return; }
    if (kind === 'cost_commitment' && (!Number.isFinite(second) || second < 0 || second > value)) { setError('Outstanding must be between zero and the contract value.'); return; }

    const phaseKey = phase || null;
    const categoryName = category.trim() || 'Construction';
    const input: CostEntryInput = kind === 'contractor_payment'
      ? { kind, projectId, payeeName: name.trim(), paymentDate: date, amount: value, phaseKey, category: categoryName, reference: reference.trim() || null }
      : kind === 'labor_payment'
        ? { kind, projectId, paymentDate: date, workerGroup: name.trim(), workersCount: second, amount: value, phaseKey, category: categoryName }
        : kind === 'purchase_order'
          ? { kind, projectId, vendorId: vendorId || null, poNumber: name.trim(), orderDate: date, amount: value, phaseKey, category: categoryName, description: reference.trim() || null }
          : { kind, projectId, commitmentType, partyName: name.trim(), contractValue: value, outstanding: second, phaseKey, category: categoryName };

    setBusy(true);
    try {
      await recordCostEntry(input);
      await recordActivity({ projectId, action: 'create', entityType: 'budget_cost', summary: `Recorded ${KIND_LABELS[kind].toLowerCase()}: ${name.trim()} ${formatTaka(value)}` });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record this entry.');
    } finally {
      setBusy(false);
    }
  }

  const nameLabel = kind === 'contractor_payment' ? 'Payee name' : kind === 'labor_payment' ? 'Worker group' : kind === 'purchase_order' ? 'PO number' : 'Party name';
  const amountLabel = kind === 'cost_commitment' ? 'Contract value (Tk)' : 'Amount (Tk)';
  const dateLabel = kind === 'purchase_order' ? 'Order date' : 'Date';

  return <Modal open title="Record cost" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save entry'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Entry type" htmlFor="cost-kind">
        <select id="cost-kind" className={inputClassName} value={kind} onChange={(e) => setKind(e.target.value as EntryKind)}>
          {(Object.keys(KIND_LABELS) as EntryKind[]).map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={nameLabel} htmlFor="cost-name"><input id="cost-name" className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} required /></FormField>
        <FormField label={dateLabel} htmlFor="cost-date"><input id="cost-date" type="date" className={inputClassName} value={date} onChange={(e) => setDate(e.target.value)} required /></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={amountLabel} htmlFor="cost-amount"><input id="cost-amount" type="number" min={0} step="any" className={inputClassName} value={amount} onChange={(e) => setAmount(e.target.value)} required /></FormField>
        {kind === 'labor_payment' && <FormField label="Workers" htmlFor="cost-workers"><input id="cost-workers" type="number" min={0} step={1} className={inputClassName} value={secondary} onChange={(e) => setSecondary(e.target.value)} /></FormField>}
        {kind === 'cost_commitment' && <FormField label="Still owed (Tk)" htmlFor="cost-outstanding"><input id="cost-outstanding" type="number" min={0} step="any" className={inputClassName} value={secondary} onChange={(e) => setSecondary(e.target.value)} /></FormField>}
      </div>
      {kind === 'purchase_order' && <FormField label="Vendor" htmlFor="cost-vendor"><select id="cost-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">No vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></FormField>}
      {kind === 'cost_commitment' && <FormField label="Agreement type" htmlFor="cost-type"><select id="cost-type" className={inputClassName} value={commitmentType} onChange={(e) => setCommitmentType(e.target.value as CostCommitmentType)}>{COMMITMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Phase" htmlFor="cost-phase"><select id="cost-phase" className={inputClassName} value={phase} onChange={(e) => setPhase(e.target.value)}><option value="">Unassigned</option>{CONSTRUCTION_PHASES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></FormField>
        <FormField label="Budget category" htmlFor="cost-category"><input id="cost-category" className={inputClassName} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Should match a budget category" /></FormField>
      </div>
      {(kind === 'contractor_payment' || kind === 'purchase_order') && <FormField label={kind === 'purchase_order' ? 'Description' : 'Reference'} htmlFor="cost-reference"><input id="cost-reference" className={inputClassName} value={reference} onChange={(e) => setReference(e.target.value)} /></FormField>}
      <FormError message={error} />
    </form>
  </Modal>;
}
