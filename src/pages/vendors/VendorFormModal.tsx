import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  type ProjectRow,
  type VendorCategory,
  type VendorRow,
} from '@/types/database';

const CATEGORY_OPTIONS = VENDOR_CATEGORIES.map((c) => ({ value: c, label: VENDOR_CATEGORY_LABELS[c] }));

interface VendorFormModalProps {
  project: ProjectRow;
  vendor: VendorRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VendorFormModal({ project, vendor, onClose, onSaved }: VendorFormModalProps) {
  const [name, setName] = useState(vendor?.name ?? '');
  const [category, setCategory] = useState<VendorCategory>(vendor?.vendor_category ?? 'material');
  const [contactPerson, setContactPerson] = useState(vendor?.contact_person ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [email, setEmail] = useState(vendor?.email ?? '');
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [tradeLicense, setTradeLicense] = useState(vendor?.trade_license_number ?? '');
  const [nidNumber, setNidNumber] = useState(vendor?.nid_number ?? '');
  const [bankAccountName, setBankAccountName] = useState(vendor?.bank_account_name ?? '');
  const [bankAccountNumber, setBankAccountNumber] = useState(vendor?.bank_account_number ?? '');
  const [bankName, setBankName] = useState(vendor?.bank_name ?? '');
  const [bankBranch, setBankBranch] = useState(vendor?.bank_branch ?? '');
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    setName(vendor.name);
    setCategory(vendor.vendor_category);
    setContactPerson(vendor.contact_person ?? '');
    setPhone(vendor.phone ?? '');
    setEmail(vendor.email ?? '');
    setAddress(vendor.address ?? '');
    setTradeLicense(vendor.trade_license_number ?? '');
    setNidNumber(vendor.nid_number ?? '');
    setBankAccountName(vendor.bank_account_name ?? '');
    setBankAccountNumber(vendor.bank_account_number ?? '');
    setBankName(vendor.bank_name ?? '');
    setBankBranch(vendor.bank_branch ?? '');
    setNotes(vendor.notes ?? '');
  }, [vendor]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        name: name.trim(),
        vendor_category: category,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        trade_license_number: tradeLicense.trim() || null,
        nid_number: nidNumber.trim() || null,
        bank_account_name: bankAccountName.trim() || null,
        bank_account_number: bankAccountNumber.trim() || null,
        bank_name: bankName.trim() || null,
        bank_branch: bankBranch.trim() || null,
        notes: notes.trim() || null,
      };
      if (vendor) {
        const { error: updateErr } = await supabase
          .from('vendors')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', vendor.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { error: insertErr } = await supabase.from('vendors').insert(payload);
        if (insertErr) throw new Error(insertErr.message);
      }
      await recordActivity({
        projectId: project.id,
        action: vendor ? 'update' : 'create',
        entityType: 'vendor',
        entityId: vendor?.id,
        summary: `${vendor ? 'Updated' : 'Added'} vendor: ${name.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vendor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={vendor ? 'Edit vendor' : 'Add vendor'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save vendor'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="vendor-name">
            <input id="vendor-name" className={inputClassName} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / firm name" required />
          </FormField>
          <FormField label="Category" htmlFor="vendor-category">
            <select id="vendor-category" className={inputClassName} value={category} onChange={(e) => setCategory(e.target.value as VendorCategory)}>
              {CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contact person" htmlFor="vendor-contact">
            <input id="vendor-contact" className={inputClassName} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="vendor-phone">
            <input id="vendor-phone" className={inputClassName} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="vendor-email">
            <input id="vendor-email" type="email" className={inputClassName} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Address" htmlFor="vendor-address">
            <input id="vendor-address" className={inputClassName} value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Trade license number" htmlFor="vendor-license">
            <input id="vendor-license" className={inputClassName} value={tradeLicense} onChange={(e) => setTradeLicense(e.target.value)} />
          </FormField>
          <FormField label="NID number" htmlFor="vendor-nid">
            <input id="vendor-nid" className={inputClassName} value={nidNumber} onChange={(e) => setNidNumber(e.target.value)} />
          </FormField>
        </div>
        <div className="rounded-lg bg-stone-50 p-4">
          <p className="mb-3 text-sm font-medium text-stone-700">Bank details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Account name" htmlFor="vendor-bank-name">
              <input id="vendor-bank-name" className={inputClassName} value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
            </FormField>
            <FormField label="Account number" htmlFor="vendor-bank-number">
              <input id="vendor-bank-number" className={inputClassName} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
            </FormField>
            <FormField label="Bank name" htmlFor="vendor-bank">
              <input id="vendor-bank" className={inputClassName} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </FormField>
            <FormField label="Branch" htmlFor="vendor-branch">
              <input id="vendor-branch" className={inputClassName} value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
            </FormField>
          </div>
        </div>
        <FormField label="Notes" htmlFor="vendor-notes">
          <textarea id="vendor-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
