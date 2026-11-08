import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { getActiveUserId } from '@/lib/activeUser';
import { formatLabel } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { DOCUMENT_CATEGORIES, type DocumentCategory, type DocumentRow } from '@/types/database';

interface DocumentFormModalProps {
  projectId: string;
  document: DocumentRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface DocumentForm {
  title: string;
  category: DocumentCategory;
  document_date: string;
  file_name: string;
  reference_url: string;
  notes: string;
}

const FORM_ID = 'document-form';

function toForm(document: DocumentRow | null): DocumentForm {
  return {
    title: document?.title ?? '',
    category: document?.category ?? 'legal',
    document_date: document?.document_date ?? '',
    file_name: document?.file_name ?? '',
    reference_url: document?.reference_url ?? '',
    notes: document?.notes ?? '',
  };
}

function buildPayload(form: DocumentForm): { payload: Omit<DocumentRow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'project_id'> } | { error: string } {
  const title = form.title.trim();
  if (!title) return { error: 'Enter a title for the document.' };

  const referenceUrl = form.reference_url.trim();
  if (referenceUrl && !/^https?:\/\/\S+$/i.test(referenceUrl)) {
    return { error: 'The link must start with http:// or https://.' };
  }

  return {
    payload: {
      title,
      category: form.category,
      document_date: form.document_date || null,
      file_name: form.file_name.trim() || null,
      reference_url: referenceUrl || null,
      notes: form.notes.trim() || null,
    },
  };
}

export function DocumentFormModal({ projectId, document, onClose, onSaved }: DocumentFormModalProps) {
  const [form, setForm] = useState<DocumentForm>(() => toForm(document));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = document !== null;

  function update<K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildPayload(form);
    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (document) {
        const { error: updateError } = await supabase.from('documents').update(result.payload).eq('id', document.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('documents')
          .insert({ ...result.payload, project_id: projectId, created_by: getActiveUserId() });
        if (insertError) throw new Error(insertError.message);
      }

      await recordActivity({
        projectId,
        action: isEdit ? 'update' : 'create',
        entityType: 'document',
        entityId: document?.id ?? null,
        summary: `${isEdit ? 'Document updated' : 'Document added'}: ${result.payload.title}`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isEdit ? 'Edit document' : 'Add document'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add document'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <FormField label="Title" htmlFor="document-title">
          <input id="document-title" className={inputClassName} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Approved building plan" />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Category" htmlFor="document-category">
            <select id="document-category" className={inputClassName} value={form.category} onChange={(e) => update('category', e.target.value as DocumentCategory)}>
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {formatLabel(category)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Document date" htmlFor="document-date">
            <input id="document-date" type="date" className={inputClassName} value={form.document_date} onChange={(e) => update('document_date', e.target.value)} />
          </FormField>
        </div>
        <FormField label="File name" htmlFor="document-file" hint="The name of the file as stored in your records.">
          <input id="document-file" className={inputClassName} value={form.file_name} onChange={(e) => update('file_name', e.target.value)} />
        </FormField>
        <FormField label="Link to file" htmlFor="document-url" hint="Optional. Paste a shared link from Google Drive, Dropbox, or similar.">
          <input id="document-url" type="url" className={inputClassName} value={form.reference_url} onChange={(e) => update('reference_url', e.target.value)} placeholder="https://" />
        </FormField>
        <FormField label="Notes" htmlFor="document-notes">
          <textarea id="document-notes" rows={3} className={inputClassName} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
