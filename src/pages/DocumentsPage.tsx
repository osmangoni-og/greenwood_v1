import { useMemo, useState } from 'react';
import { FileText, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { inputClassName } from '@/components/FormField';
import { DocumentFormModal } from '@/pages/documents/DocumentFormModal';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { cx } from '@/lib/cx';
import { formatDate, formatLabel } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase, unwrap } from '@/lib/supabase';
import { DOCUMENT_CATEGORIES, type DocumentCategory, type DocumentRow, type ProjectRow } from '@/types/database';

interface DocumentsData {
  project: ProjectRow | null;
  documents: DocumentRow[];
}

async function loadDocuments(): Promise<DocumentsData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, documents: [] };
  const documents = unwrap<DocumentRow[]>(
    await supabase
      .from('documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
  );
  return { project, documents };
}

type CategoryFilter = 'all' | DocumentCategory;

const CATEGORY_TONE: Record<DocumentCategory, 'primary' | 'accent' | 'info' | 'success' | 'warning' | 'neutral' | 'error'> = {
  legal: 'error',
  design: 'info',
  finance: 'accent',
  permits: 'warning',
  construction: 'primary',
  maintenance: 'success',
  other: 'neutral',
};

export function DocumentsPage() {
  const { data, error, loading, reload } = useAsyncData(loadDocuments);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const documents = useMemo(() => data?.documents ?? [], [data]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category !== 'all' && doc.category !== category) return false;
      if (!term) return true;
      return [doc.title, doc.file_name ?? '', doc.notes ?? ''].some((field) => field.toLowerCase().includes(term));
    });
  }, [documents, category, search]);

  if (!data) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;
  if (loading && !data.project) return <LoadingState />;
  if (!data.project) {
    return (
      <EmptyState icon={FileText} title="No project yet" description="Documents are stored against the project. Create the project first." />
    );
  }

  const projectId = data.project.id;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('documents').delete().eq('id', deleting.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId,
      action: 'delete',
      entityType: 'document',
      entityId: deleting.id,
      summary: `Document removed: ${deleting.title}`,
    });
    setDeleteBusy(false);
    setDeleting(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document repository"
        description="Keep track of legal papers, drawings, permits, receipts, and maintenance records."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add document
          </Button>
        }
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-xs">
          <span className="sr-only">Search documents</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or file name"
            className={cx(inputClassName, 'pl-9')}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {(['all', ...DOCUMENT_CATEGORIES] as CategoryFilter[]).map((option) => {
            const active = option === category;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(option)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                  active ? 'bg-primary-700 text-white ring-primary-700' : 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-50',
                )}
              >
                {option === 'all' ? 'All' : formatLabel(option)}
              </button>
            );
          })}
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Add your first document to start building the project record."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add document
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          No documents match the current filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((doc) => (
            <article
              key={doc.id}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <StatusBadge tone={CATEGORY_TONE[doc.category]}>{formatLabel(doc.category)}</StatusBadge>
                {doc.document_date && <span className="text-xs text-stone-500">{formatDate(doc.document_date)}</span>}
              </div>
              <h3 className="mt-4 text-base font-semibold leading-snug text-stone-900">{doc.title}</h3>
              {doc.file_name && <p className="mt-1 truncate text-xs text-stone-500">{doc.file_name}</p>}
              {doc.notes && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{doc.notes}</p>}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
                {doc.reference_url && /^https?:\/\//i.test(doc.reference_url) ? (
                  <a
                    href={doc.reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition-colors hover:text-primary-900"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Open file
                  </a>
                ) : (
                  <span className="text-sm text-stone-400">No link added</span>
                )}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" className="p-2" aria-label={`Edit ${doc.title}`} onClick={() => setEditing(doc)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" className="p-2 hover:text-rose-700" aria-label={`Delete ${doc.title}`} onClick={() => { setDeleteError(null); setDeleting(doc); }}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <DocumentFormModal
          projectId={projectId}
          document={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <DocumentFormModal
          projectId={projectId}
          document={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete document"
        message={`Remove "${deleting?.title ?? ''}" from the repository? The file itself is not affected, only this record.`}
        confirmLabel="Delete document"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
