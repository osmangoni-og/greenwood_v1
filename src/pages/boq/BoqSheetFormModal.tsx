import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { detectBoqFileType, uploadBoqFile, validateBoqFile } from '@/lib/boq';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { fetchEngineeringData } from '@/lib/engineering';
import { supabase } from '@/lib/supabase';
import type { BoqSheetRow, BoqSheetStatus, ProjectRow } from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';

const STATUS_OPTIONS: { value: BoqSheetStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
];

interface BoqSheetFormModalProps {
  project: ProjectRow;
  sheet: BoqSheetRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BoqSheetFormModal({ project, sheet, onClose, onSaved }: BoqSheetFormModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheetName, setSheetName] = useState(sheet?.sheet_name ?? '');
  const [sourceName, setSourceName] = useState(sheet?.source_name ?? 'Manual entry');
  const [packageId, setPackageId] = useState(sheet?.design_package_id ?? '');
  const [engineering, setEngineering] = useState<{ engineers: EngineerRow[]; packages: DesignPackageRow[] } | null>(null);
  const [status, setStatus] = useState<BoqSheetStatus>(sheet?.status ?? 'draft');
  const [buildingArea, setBuildingArea] = useState(sheet?.building_area_sft ?? project.plot_area_sqft ?? 0);
  const [notes, setNotes] = useState(sheet?.notes ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPackage = engineering?.packages.find((pkg) => pkg.id === packageId) ?? null;
  const selectedEngineer = engineering?.engineers.find((engineer) => engineer.id === selectedPackage?.engineer_id) ?? null;

  useEffect(() => {
    fetchEngineeringData(project.id)
      .then(setEngineering)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load design packages.'));
  }, [project.id]);

  useEffect(() => {
    if (!sheet) return;
    setSheetName(sheet.sheet_name);
    setSourceName(sheet.source_name);
    setPackageId(sheet.design_package_id ?? '');
    setStatus(sheet.status);
    setBuildingArea(sheet.building_area_sft);
    setNotes(sheet.notes ?? '');
  }, [sheet]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!sheetName.trim()) {
      setError('Sheet name is required.');
      return;
    }
    if (!selectedPackage) {
      setError('Choose the design package this BOQ belongs to. The package sets the engineer.');
      return;
    }
    if (file) {
      const fileError = validateBoqFile(file);
      if (fileError) {
        setError(fileError);
        return;
      }
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: project.id,
        sheet_name: sheetName.trim(),
        source_name: sourceName.trim() || 'Manual entry',
        design_package_id: selectedPackage.id,
        engineer_name: selectedEngineer?.name ?? null,
        status,
        building_area_sft: Number(buildingArea) || 0,
        notes: notes.trim() || null,
      };
      let sheetId = sheet?.id;
      let storagePath = sheet?.storage_path ?? null;
      let fileName = sheet?.file_name ?? null;

      if (file) {
        if (!sheetId) {
          const tempId = crypto.randomUUID();
          const upload = await uploadBoqFile(tempId, file);
          storagePath = upload.path;
          fileName = upload.fileName;
          payload.storage_path = storagePath;
          payload.file_name = fileName;
        } else {
          const upload = await uploadBoqFile(sheetId, file);
          storagePath = upload.path;
          fileName = upload.fileName;
          payload.storage_path = storagePath;
          payload.file_name = fileName;
        }
      }

      if (sheetId) {
        const { error: updateErr } = await supabase
          .from('boq_sheets')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', sheetId);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        payload.created_by = getActiveUserId();
        const { data: inserted, error: insertErr } = await supabase
          .from('boq_sheets')
          .insert(payload)
          .select()
          .maybeSingle();
        if (insertErr) throw new Error(insertErr.message);
        sheetId = (inserted as BoqSheetRow)?.id;
      }

      await recordActivity({
        projectId: project.id,
        action: sheet ? 'update' : 'create',
        entityType: 'boq_sheet',
        entityId: sheetId,
        summary: `${sheet ? 'Updated' : 'Created'} BOQ sheet: ${sheetName.trim()}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save BOQ sheet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={sheet ? 'Edit BOQ sheet' : 'New BOQ sheet'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? 'Saving...' : 'Save sheet'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Sheet name" htmlFor="boq-sheet-name">
          <input
            id="boq-sheet-name"
            className={inputClassName}
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="e.g. Engineer A estimate"
            required
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Source" htmlFor="boq-source">
            <input
              id="boq-source"
              className={inputClassName}
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Manual entry / uploaded file"
            />
          </FormField>
          <FormField label="Design package" htmlFor="boq-package">
            <select
              id="boq-package"
              className={inputClassName}
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
            >
              <option value="">Select a design package</option>
              {engineering?.packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {engineering.engineers.find((engineer) => engineer.id === pkg.engineer_id)?.name ?? 'Unknown engineer'} - {pkg.name}
                </option>
              ))}
            </select>
            {selectedEngineer && <p className="mt-1 text-xs text-stone-500">Engineer: {selectedEngineer.name}</p>}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" htmlFor="boq-status">
            <select
              id="boq-status"
              className={inputClassName}
              value={status}
              onChange={(e) => setStatus(e.target.value as BoqSheetStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Built-up area (SFT)" htmlFor="boq-area">
            <input
              id="boq-area"
              type="number"
              min={0}
              className={inputClassName}
              value={buildingArea}
              onChange={(e) => setBuildingArea(Number(e.target.value))}
            />
          </FormField>
        </div>
        <FormField label="BOQ file (optional)" htmlFor="boq-file" hint="PDF, Excel, CSV, JPG, PNG. Up to 15 MB.">
          <input
            id="boq-file"
            ref={fileRef}
            type="file"
            accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && detectBoqFileType(file.name) && (
            <p className="mt-1 text-xs text-stone-500">Selected: {file.name}</p>
          )}
        </FormField>
        <FormField label="Notes" htmlFor="boq-notes">
          <textarea
            id="boq-notes"
            rows={3}
            className={inputClassName}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional remarks"
          />
        </FormField>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
