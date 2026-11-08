import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { FileUp, UploadCloud } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { getActiveUserId } from '@/lib/activeUser';
import { cx } from '@/lib/cx';
import { supabase } from '@/lib/supabase';
import { uploadDrawingFile, validateDrawingFile } from '@/lib/drawings';
import type { DrawingRow } from '@/types/database';

interface VersionUploadModalProps {
  projectId: string;
  drawing: DrawingRow;
  nextVersionNumber: number;
  onClose: () => void;
  onSaved: () => void;
}

const FORM_ID = 'version-upload-form';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VersionUploadModal({ projectId, drawing, nextVersionNumber, onClose, onSaved }: VersionUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [revisionLabel, setRevisionLabel] = useState(`Rev ${String.fromCharCode(64 + nextVersionNumber)}`);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  function handleFile(selected: File | null) {
    if (!selected) {
      setFile(null);
      return;
    }
    const result = validateDrawingFile(selected);
    if (!result.ok) {
      setError(result.error);
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    const result = validateDrawingFile(file);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const label = revisionLabel.trim();
    if (!label) {
      setError('Enter a revision label.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const upload = await uploadDrawingFile({ drawingId: drawing.id, versionNumber: nextVersionNumber, file, fileType: result.fileType });

      const { error: clearError } = await supabase
        .from('drawing_versions')
        .update({ is_current: false })
        .eq('drawing_id', drawing.id)
        .eq('is_current', true);
      if (clearError) throw new Error(clearError.message);

      const { error: insertError } = await supabase.from('drawing_versions').insert({
        drawing_id: drawing.id,
        version_number: nextVersionNumber,
        revision_label: label,
        file_name: file.name,
        file_size_bytes: file.size,
        file_type: upload.fileType,
        storage_path: upload.storagePath,
        revision_notes: revisionNotes.trim() || null,
        is_current: true,
        created_by: getActiveUserId(),
      });
      if (insertError) throw new Error(insertError.message);

      await recordActivity({
        projectId,
        action: 'create',
        entityType: 'drawing_version',
        entityId: drawing.id,
        summary: `New version ${label} uploaded for ${drawing.drawing_number} ${drawing.title}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Upload new version — ${drawing.drawing_number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving || !file}>
            {saving ? 'Uploading...' : `Upload as version ${nextVersionNumber}`}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragging ? 'border-primary-500 bg-primary-50' : 'border-stone-300 bg-stone-50',
          )}
        >
          <UploadCloud className="h-8 w-8 text-stone-400" aria-hidden />
          <p className="text-sm text-stone-600">Drag a file here, or</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-sm ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50">
            <FileUp className="h-4 w-4" aria-hidden />
            Browse files
            <input type="file" className="sr-only" accept=".pdf,.dwg,.jpg,.jpeg,.png" onChange={onInputChange} />
          </label>
          <p className="text-xs text-stone-500">PDF, DWG, JPG, or PNG — up to 50 MB</p>
        </div>

        {file && (
          <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <FileUp className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
              <p className="text-xs text-stone-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="ml-auto text-xs font-medium text-stone-500 hover:text-rose-700"
            >
              Remove
            </button>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Revision label" htmlFor="revision-label">
            <input
              id="revision-label"
              className={inputClassName}
              value={revisionLabel}
              onChange={(e) => setRevisionLabel(e.target.value)}
              placeholder="e.g. Rev B"
            />
          </FormField>
          <div className="flex items-end text-sm text-stone-500">Version number {nextVersionNumber}</div>
        </div>
        <FormField label="Revision notes" htmlFor="revision-notes" hint="What changed in this version.">
          <textarea
            id="revision-notes"
            rows={3}
            className={inputClassName}
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
