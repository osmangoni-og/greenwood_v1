import { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { fetchLineageLookup, updateBudgetVersionLineage, type LineageLookup } from '@/lib/lineage';
import type { BudgetVersionRow } from '@/types/database';

interface Props {
  projectId: string;
  version: BudgetVersionRow;
  onClose: () => void;
  onSaved: () => void;
}

export function BudgetLineageModal({ projectId, version, onClose, onSaved }: Props) {
  const [lookup, setLookup] = useState<LineageLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [packageId, setPackageId] = useState<string>(version.design_package_id ?? '');
  const [boqSheetId, setBoqSheetId] = useState<string>(version.boq_sheet_id ?? '');
  const [vendorId, setVendorId] = useState<string>(version.primary_vendor_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLineageLookup(projectId)
      .then((data) => {
        setLookup(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load lineage data.');
        setLoading(false);
      });
  }, [projectId]);

  const filteredBoqSheets = useMemo(
    () => (lookup ? lookup.boqSheets.filter((s) => !packageId || s.design_package_id === packageId) : []),
    [lookup, packageId],
  );

  const selectedPackage = useMemo(
    () => (lookup && packageId ? lookup.packages.find((p) => p.id === packageId) ?? null : null),
    [lookup, packageId],
  );
  const engineerName = useMemo(() => {
    if (!lookup) return null;
    if (selectedPackage) {
      const eng = lookup.engineers.find((e) => e.id === selectedPackage.engineer_id);
      return eng?.name ?? null;
    }
    if (version.engineer_id) {
      const eng = lookup.engineers.find((e) => e.id === version.engineer_id);
      return eng?.name ?? null;
    }
    return null;
  }, [lookup, selectedPackage, version.engineer_id]);
  const derivedEngineerId = selectedPackage?.engineer_id ?? version.engineer_id ?? '';

  useEffect(() => {
    if (boqSheetId && !filteredBoqSheets.some((s) => s.id === boqSheetId)) setBoqSheetId('');
  }, [filteredBoqSheets, boqSheetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const selectedContractor = lookup?.contractors.find((c) => c.selection_status === 'selected');
      await updateBudgetVersionLineage(version.id, {
        engineer_id: derivedEngineerId || null,
        design_package_id: packageId || null,
        boq_sheet_id: boqSheetId || null,
        contractor_id: selectedContractor?.id ?? null,
        primary_vendor_id: vendorId || null,
      });
      await recordActivity({
        projectId,
        action: 'update',
        entityType: 'budget_version',
        entityId: version.id,
        summary: `Updated lineage for ${version.version_label}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save lineage.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Link lineage — ${version.version_label}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || loading}>{busy ? 'Saving...' : 'Save lineage'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          <Link2 className="h-4 w-4" aria-hidden />
          Select the chain: Design Package &rarr; BOQ &rarr; Vendor. Engineer and Contractor are derived automatically.
        </div>
        {loading && <p className="text-sm text-stone-500">Loading options...</p>}
        {lookup && (
          <>
            <div className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Engineer</p>
              <p className="mt-0.5 font-medium text-stone-900">{engineerName ?? 'Not assigned'}</p>
              <p className="mt-0.5 text-xs text-stone-500">Derived from the selected Design Package</p>
            </div>
            <FormField label="Design Package" htmlFor="lineage-package">
              <select id="lineage-package" className={inputClassName} value={packageId} onChange={(e) => { setPackageId(e.target.value); setBoqSheetId(''); }}>
                <option value="">Not assigned</option>
                {lookup.packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.revision_label})</option>)}
              </select>
            </FormField>
            <FormField label="BOQ Sheet" htmlFor="lineage-boq">
              <select id="lineage-boq" className={inputClassName} value={boqSheetId} onChange={(e) => setBoqSheetId(e.target.value)}>
                <option value="">Not assigned</option>
                {filteredBoqSheets.map((s) => <option key={s.id} value={s.id}>{s.sheet_name}</option>)}
              </select>
            </FormField>
            <div className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Contractor</p>
              <p className="mt-0.5 font-medium text-stone-900">{(() => {
                const selected = lookup.contractors.find((c) => c.selection_status === 'selected');
                return selected?.name ?? 'No contractor selected';
              })()}</p>
              <p className="mt-0.5 text-xs text-stone-500">Selected through the Tender evaluation process</p>
            </div>
            <FormField label="Primary Vendor" htmlFor="lineage-vendor">
              <select id="lineage-vendor" className={inputClassName} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Not assigned</option>
                {lookup.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </FormField>
          </>
        )}
        <FormError message={error} />
      </form>
    </Modal>
  );
}
