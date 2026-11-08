import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  CONTRACTOR_TYPE_LABELS,
  CONTRACTOR_TYPES,
  type ContractorRow,
  type ContractorType,
  type ProjectRow,
} from '@/types/database';

const TYPE_OPTIONS = CONTRACTOR_TYPES.map((t) => ({ value: t, label: CONTRACTOR_TYPE_LABELS[t] }));

interface ContractorFormModalProps {
  project: ProjectRow;
  contractor: ContractorRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ContractorFormModal({ project, contractor, onClose, onSaved }: ContractorFormModalProps) {
  const [name, setName] = useState(contractor?.name ?? '');
  const [contractorType, setContractorType] = useState<ContractorType>(contractor?.contractor_type ?? 'main');
  const [contactPerson, setContactPerson] = useState(contractor?.contact_person ?? '');
  const [phone, setPhone] = useState(contractor?.phone ?? '');
  const [email, setEmail] = useState(contractor?.email ?? '');
  const [yearsExperience, setYearsExperience] = useState(contractor?.years_experience ?? 0);
  const [licenseNumber, setLicenseNumber] = useState(contractor?.license_number ?? '');
  const [notes, setNotes] = useState(contractor?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractor) return;
    setName(contractor.name);
    setContractorType(contractor.contractor_type);
    setContactPerson(contractor.contact_person ?? '');
    setPhone(contractor.phone ?? '');
    setEmail(contractor.email ?? '');
    setYearsExperience(contractor.years_experience);
    setLicenseNumber(contractor.license_number ?? '');
    setNotes(contractor.notes ?? '');
  }, [contractor]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Contractor name is required.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        name: name.trim(),
        contractor_type: contractorType,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        years_experience: Number(yearsExperience) || 0,
        license_number: licenseNumber.trim() || null,
        notes: notes.trim() || null,
      };
      if (contractor) {
        const { error: updateErr } = await supabase
          .from('contractors')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', contractor.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('contractors').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: contractor ? 'update' : 'create',
        entityType: 'contractor',
        entityId: contractor?.id,
        summary: `${contractor ? 'Updated' : 'Added'} contractor: ${name.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contractor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={contractor ? 'Edit contractor' : 'Add contractor'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save contractor'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" htmlFor="contractor-name">
          <input id="contractor-name" className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / firm name" required />
        </FormField>
        <FormField label="Type" htmlFor="contractor-type">
          <select id="contractor-type" className={inputClassName} value={contractorType} onChange={(e) => setContractorType(e.target.value as ContractorType)}>
            {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contact person" htmlFor="contractor-contact">
            <input id="contractor-contact" className={inputClassName} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="contractor-phone">
            <input id="contractor-phone" className={inputClassName} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="contractor-email">
            <input id="contractor-email" type="email" className={inputClassName} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Years of experience" htmlFor="contractor-years">
            <input id="contractor-years" type="number" min={0} className={inputClassName} value={yearsExperience} onChange={(e) => setYearsExperience(Number(e.target.value))} />
          </FormField>
        </div>
        <FormField label="License / registration number" htmlFor="contractor-license">
          <input id="contractor-license" className={inputClassName} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </FormField>
        <FormField label="Notes" htmlFor="contractor-notes">
          <textarea id="contractor-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
