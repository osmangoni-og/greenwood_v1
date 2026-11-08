import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Download,
  Eye,
  FileCode2,
  FileText,
  History,
  Image as ImageIcon,
  Pencil,
  PencilRuler,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { inputClassName } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { DrawingComments } from '@/pages/design/DrawingComments';
import { DrawingFormModal } from '@/pages/design/DrawingFormModal';
import { EngineersPanel } from '@/pages/design/EngineersPanel';
import { VersionUploadModal } from '@/pages/design/VersionUploadModal';
import { ComparePage } from '@/pages/ComparePage';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { cx } from '@/lib/cx';
import { deleteDrawingFile, getPublicDrawingUrl } from '@/lib/drawings';
import { fetchEngineeringData } from '@/lib/engineering';
import { formatBytes, formatDateTime, formatLabel } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase, unwrap } from '@/lib/supabase';
import {
  DRAWING_APPROVAL_STATUSES,
  DRAWING_DISCIPLINES,
  type DrawingApprovalStatus,
  type DrawingDiscipline,
  type DrawingFileType,
  type DrawingRow,
  type DrawingVersionRow,
  type ProjectRow,
} from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';

const SECTION_TABS = [
  { id: 'drawings', label: 'Drawing Register' },
  { id: 'compare', label: 'Design Comparison' },
  { id: 'engineers', label: 'Engineers & Packages' },
] as const;
type SectionId = (typeof SECTION_TABS)[number]['id'];

interface PackageInfo {
  pkg: DesignPackageRow;
  engineer: EngineerRow | null;
}

interface DesignData {
  project: ProjectRow | null;
  drawings: DrawingRow[];
  engineers: EngineerRow[];
  packages: DesignPackageRow[];
}

interface DetailData {
  drawing: DrawingRow;
  versions: DrawingVersionRow[];
}

async function loadDesign(): Promise<DesignData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, drawings: [], engineers: [], packages: [] };
  const [drawings, engineering] = await Promise.all([
    supabase
      .from('drawings')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .then((result) => unwrap<DrawingRow[]>(result)),
    fetchEngineeringData(project.id),
  ]);
  return { project, drawings, engineers: engineering.engineers, packages: engineering.packages };
}

async function loadDetail(drawingId: string): Promise<DetailData> {
  const [drawingResult, versionsResult] = await Promise.all([
    supabase.from('drawings').select('*').eq('id', drawingId).maybeSingle(),
    supabase
      .from('drawing_versions')
      .select('*')
      .eq('drawing_id', drawingId)
      .order('version_number', { ascending: false }),
  ]);
  if (drawingResult.error) throw new Error(drawingResult.error.message);
  if (!drawingResult.data) throw new Error('This drawing could not be found.');
  return {
    drawing: drawingResult.data as DrawingRow,
    versions: unwrap<DrawingVersionRow[]>(versionsResult),
  };
}

const DISCIPLINE_TONE: Record<DrawingDiscipline, BadgeTone> = {
  architectural: 'primary',
  structural: 'accent',
  electrical: 'info',
  plumbing: 'success',
};

const APPROVAL_TONE: Record<DrawingApprovalStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  revision_required: 'warning',
};

const FILE_ICON: Record<DrawingFileType, LucideIcon> = {
  pdf: FileText,
  dwg: FileCode2,
  jpg: ImageIcon,
  png: ImageIcon,
};

export function DesignPage() {
  const { data, error, loading, reload } = useAsyncData(loadDesign);
  const [disciplineFilter, setDisciplineFilter] = useState<'all' | DrawingDiscipline>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DrawingApprovalStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DrawingRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DrawingRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<DrawingRow | null>(null);
  const [section, setSection] = useState<SectionId>('drawings');

  const drawings = useMemo(() => data?.drawings ?? [], [data]);
  const packageById = useMemo(() => {
    const engineerById = new Map((data?.engineers ?? []).map((engineer) => [engineer.id, engineer]));
    return new Map((data?.packages ?? []).map((pkg) => [pkg.id, { pkg, engineer: engineerById.get(pkg.engineer_id) ?? null }]));
  }, [data]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return drawings.filter((drawing) => {
      if (disciplineFilter !== 'all' && drawing.discipline !== disciplineFilter) return false;
      if (statusFilter !== 'all' && drawing.approval_status !== statusFilter) return false;
      return !term || [drawing.drawing_number, drawing.title, drawing.description ?? ''].some((field) =>
        field.toLowerCase().includes(term),
      );
    });
  }, [drawings, disciplineFilter, statusFilter, search]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return (
      <EmptyState
        icon={Building2}
        title="No project yet"
        description="Drawings belong to the project. Create the project first to start the drawing register."
      />
    );
  }

  const projectId = data.project.id;

  if (selectedDrawingId) {
    return (
      <DrawingDetail
        drawingId={selectedDrawingId}
        projectId={projectId}
        onBack={() => setSelectedDrawingId(null)}
        onUpload={(drawing) => setUploadingFor(drawing)}
        onEdit={(drawing) => setEditing(drawing)}
        packageInfo={packageById.get(drawings.find((item) => item.id === selectedDrawingId)?.design_package_id ?? '') ?? null}
        onAskDelete={(drawing) => { setDeleteError(null); setDeleting(drawing); }}
        onChanged={reload}
      />
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const { data: pathRows, error: pathsError } = await supabase
        .from('drawing_versions')
        .select('storage_path')
        .eq('drawing_id', deleting.id);
      if (pathsError) throw new Error(pathsError.message);
      const paths = (pathRows ?? []) as unknown as { storage_path: string }[];
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from('drawings').remove(paths.map((v) => v.storage_path));
        if (removeError) {
          setDeleteBusy(false);
          setDeleteError(removeError.message);
          return;
        }
      }
      const { error: deleteErrorInner } = await supabase.from('drawings').delete().eq('id', deleting.id);
      if (deleteErrorInner) {
        setDeleteBusy(false);
        setDeleteError(deleteErrorInner.message);
        return;
      }
      await recordActivity({
        projectId,
        action: 'delete',
        entityType: 'drawing',
        entityId: deleting.id,
        summary: `Drawing removed: ${deleting.drawing_number} ${deleting.title}`,
      });
      setDeleteBusy(false);
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteBusy(false);
      setDeleteError(err instanceof Error ? err.message : 'The drawing could not be deleted.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design Management"
        description="Drawing register with version control, revision tracking, approvals, and review comments."
        action={
          section === 'drawings' ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add drawing
            </Button>
          ) : null
        }
      />
      <Tabs items={SECTION_TABS} activeId={section} onChange={(id) => setSection(id as SectionId)} />

      {section === 'compare' && <ComparePage />}
      {section === 'engineers' && <EngineersPanel projectId={projectId} />}

      {section === 'drawings' && (
      <>
      <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Number, title, or description"
            className={inputClassName}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Discipline</span>
          <select
            value={disciplineFilter}
            onChange={(event) => setDisciplineFilter(event.target.value as 'all' | DrawingDiscipline)}
            className={inputClassName}
          >
            <option value="all">All disciplines</option>
            {DRAWING_DISCIPLINES.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Approval</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | DrawingApprovalStatus)}
            className={inputClassName}
          >
            <option value="all">All statuses</option>
            {DRAWING_APPROVAL_STATUSES.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {drawings.length === 0 ? (
        <EmptyState
          icon={PencilRuler}
          title="No drawings yet"
          description="Start the register by adding your first architectural, structural, electrical, or plumbing drawing."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add drawing
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          No drawings match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-3">Drawing number</th>
                <th scope="col" className="px-5 py-3">Title</th>
                <th scope="col" className="px-5 py-3">Engineer</th>
                <th scope="col" className="px-5 py-3">Design package</th>
                <th scope="col" className="px-5 py-3">Discipline</th>
                <th scope="col" className="px-5 py-3">Approval</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((drawing) => (
                <tr
                  key={drawing.id}
                  className="cursor-pointer transition-colors hover:bg-stone-50"
                  onClick={() => setSelectedDrawingId(drawing.id)}
                >
                  <td className="px-5 py-3.5 font-medium text-stone-900">{drawing.drawing_number}</td>
                  <td className="px-5 py-3.5 text-stone-700">{drawing.title}</td>
                  <td className="px-5 py-3.5 text-stone-700">{packageById.get(drawing.design_package_id ?? '')?.engineer?.name ?? <span className="text-amber-700">Not assigned</span>}</td>
                  <td className="px-5 py-3.5 text-stone-700">{packageById.get(drawing.design_package_id ?? '')?.pkg.name ?? <span className="text-amber-700">Not assigned</span>}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge tone={DISCIPLINE_TONE[drawing.discipline]}>{formatLabel(drawing.discipline)}</StatusBadge>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge tone={APPROVAL_TONE[drawing.approval_status]}>{formatLabel(drawing.approval_status)}</StatusBadge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        className="p-2"
                        aria-label={`Upload new version for ${drawing.drawing_number}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setUploadingFor(drawing);
                        }}
                      >
                        <Upload className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        className="p-2"
                        aria-label={`Edit ${drawing.drawing_number}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditing(drawing);
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <DrawingFormModal
          projectId={projectId}
          drawing={null}
          engineers={data.engineers}
          packages={data.packages}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && !selectedDrawingId && (
        <DrawingFormModal
          projectId={projectId}
          drawing={editing}
          engineers={data.engineers}
          packages={data.packages}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {uploadingFor && (
        <VersionUploadModal
          projectId={projectId}
          drawing={uploadingFor}
          nextVersionNumber={1}
          onClose={() => setUploadingFor(null)}
          onSaved={() => {
            setUploadingFor(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete drawing"
        message={`Remove "${deleting?.drawing_number ?? ''} ${deleting?.title ?? ''}" and all its uploaded versions? This cannot be undone.`}
        confirmLabel="Delete drawing"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      </>
      )}
    </div>
  );
}

interface DrawingDetailProps {
  drawingId: string;
  projectId: string;
  packageInfo: PackageInfo | null;
  onBack: () => void;
  onUpload: (drawing: DrawingRow) => void;
  onEdit: (drawing: DrawingRow) => void;
  onAskDelete: (drawing: DrawingRow) => void;
  onChanged: () => void;
}

function DrawingDetail({ drawingId, projectId, packageInfo, onBack, onUpload, onEdit, onAskDelete, onChanged }: DrawingDetailProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadDetail(drawingId));
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [removingVersionId, setRemovingVersionId] = useState<string | null>(null);
  const [versionDeleteError, setVersionDeleteError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { drawing, versions } = data;
  const currentVersion = versions.find((version) => version.is_current) ?? null;
  const nextVersionNumber = versions.length === 0 ? 1 : Math.max(...versions.map((version) => version.version_number)) + 1;

  async function changeStatus(next: DrawingApprovalStatus) {
    if (next === drawing.approval_status) return;
    setStatusBusy(true);
    setStatusError(null);
    const { error } = await supabase.from('drawings').update({ approval_status: next }).eq('id', drawing.id);
    setStatusBusy(false);
    if (error) {
      setStatusError(error.message);
      return;
    }
    await recordActivity({
      projectId,
      action: 'status_change',
      entityType: 'drawing',
      entityId: drawing.id,
      summary: `Approval status for ${drawing.drawing_number} set to ${formatLabel(next)}`,
    });
    onChanged();
    reload();
  }

  async function makeCurrent(version: DrawingVersionRow) {
    setStatusBusy(true);
    setStatusError(null);
    const { error: clearError } = await supabase
      .from('drawing_versions')
      .update({ is_current: false })
      .eq('drawing_id', drawing.id)
      .eq('is_current', true)
      .neq('id', version.id);
    if (clearError) {
      setStatusBusy(false);
      setStatusError(clearError.message);
      return;
    }
    const { error: updateError } = await supabase
      .from('drawing_versions')
      .update({ is_current: true })
      .eq('id', version.id);
    setStatusBusy(false);
    if (updateError) {
      setStatusError(updateError.message);
      return;
    }
    await recordActivity({
      projectId,
      action: 'update',
      entityType: 'drawing_version',
      entityId: drawing.id,
      summary: `${version.revision_label} set as current for ${drawing.drawing_number}`,
    });
    onChanged();
    reload();
  }

  async function deleteVersion(version: DrawingVersionRow) {
    setVersionDeleteError(null);
    try {
      await deleteDrawingFile(version.storage_path);
      const { error } = await supabase.from('drawing_versions').delete().eq('id', version.id);
      if (error) throw new Error(error.message);
      if (version.is_current) {
        const remaining = versions.filter((entry) => entry.id !== version.id);
        if (remaining.length > 0) {
          const latest = remaining.reduce((acc, entry) => (entry.version_number > acc.version_number ? entry : acc));
          await supabase.from('drawing_versions').update({ is_current: true }).eq('id', latest.id);
        }
      }
      await recordActivity({
        projectId,
        action: 'delete',
        entityType: 'drawing_version',
        entityId: drawing.id,
        summary: `Version ${version.revision_label} removed from ${drawing.drawing_number}`,
      });
      setRemovingVersionId(null);
      reload();
    } catch (err) {
      setVersionDeleteError(err instanceof Error ? err.message : 'The version could not be deleted.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to register
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{drawing.title}</h1>
            <StatusBadge tone={DISCIPLINE_TONE[drawing.discipline]}>{formatLabel(drawing.discipline)}</StatusBadge>
            <StatusBadge tone={APPROVAL_TONE[drawing.approval_status]}>{formatLabel(drawing.approval_status)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Drawing number <span className="font-medium text-stone-700">{drawing.drawing_number}</span>
            {currentVersion && <> &middot; Current revision {currentVersion.revision_label}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onUpload(drawing)} disabled={uploadOpen}>
            <Upload className="h-4 w-4" aria-hidden />
            New version
          </Button>
          <Button variant="secondary" onClick={() => onEdit(drawing)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit details
          </Button>
          <Button variant="ghost" className="hover:text-rose-700" onClick={() => onAskDelete(drawing)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-2 sm:p-6">
        <p><span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Engineer</span><br />{packageInfo?.engineer?.name ?? <span className="text-amber-700">Not assigned</span>}</p>
        <p><span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Design package</span><br />{packageInfo?.pkg.name ?? <span className="text-amber-700">Not assigned</span>}</p>
      </div>
      {drawing.description && (
        <p className="rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-600">{drawing.description}</p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Approval status</h2>
        <p className="mt-1 text-sm text-stone-500">Move this drawing through the review workflow.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DRAWING_APPROVAL_STATUSES.map((option) => {
            const active = option === drawing.approval_status;
            return (
              <button
                key={option}
                type="button"
                disabled={statusBusy}
                onClick={() => changeStatus(option)}
                aria-pressed={active}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors disabled:opacity-50',
                  active ? 'bg-primary-700 text-white ring-primary-700' : 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-50',
                )}
              >
                {active && <Check className="h-3.5 w-3.5" aria-hidden />}
                {formatLabel(option)}
              </button>
            );
          })}
        </div>
        {statusError && <ErrorState message={statusError} />}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-stone-400" aria-hidden />
            <h2 className="text-base font-semibold text-stone-900">Version history</h2>
          </div>
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload version
          </Button>
        </div>

        {versions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Upload}
              title="No versions uploaded"
              description="Upload the first file for this drawing to start version control."
              action={
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4" aria-hidden />
                  Upload version
                </Button>
              }
            />
          </div>
        ) : (
          <ol className="mt-5 space-y-4">
            {versions.map((version) => {
              const Icon = FILE_ICON[version.file_type];
              return (
                <li
                  key={version.id}
                  className={cx(
                    'rounded-xl border p-4 transition-colors',
                    version.is_current ? 'border-primary-200 bg-primary-50/50' : 'border-stone-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">{version.revision_label}</p>
                          <span className="text-xs text-stone-500">v{version.version_number}</span>
                          {version.is_current && <StatusBadge tone="primary">Current</StatusBadge>}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {formatDateTime(version.created_at)} &middot; {formatLabel(version.file_type).toUpperCase()} &middot; {formatBytes(version.file_size_bytes)}
                        </p>
                        <p className="mt-1 break-all text-xs text-stone-500">{version.file_name}</p>
                        {version.revision_notes && (
                          <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{version.revision_notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={getPublicDrawingUrl(version.storage_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        View
                      </a>
                      <a
                        href={getPublicDrawingUrl(version.storage_path)}
                        download={version.file_name}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Download
                      </a>
                      {!version.is_current && (
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={statusBusy}
                          onClick={() => makeCurrent(version)}
                        >
                          Set current
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="p-2 hover:text-rose-700"
                        aria-label={`Delete ${version.revision_label}`}
                        onClick={() => {
                          setVersionDeleteError(null);
                          setRemovingVersionId(version.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {versionDeleteError && <div className="mt-4"><ErrorState message={versionDeleteError} /></div>}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Comments</h2>
        <p className="mt-1 text-sm text-stone-500">Review feedback for this drawing.</p>
        <div className="mt-5">
          <DrawingComments projectId={projectId} drawing={drawing} versions={versions} refresh={onChanged} />
        </div>
      </section>

      {uploadOpen && (
        <VersionUploadModal
          projectId={projectId}
          drawing={drawing}
          nextVersionNumber={nextVersionNumber}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false);
            onChanged();
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={removingVersionId !== null}
        title="Delete version"
        message="Delete this version and its uploaded file? Earlier versions will remain."
        confirmLabel="Delete version"
        busy={false}
        error={versionDeleteError}
        onConfirm={() => {
          const target = versions.find((version) => version.id === removingVersionId);
          if (target) void deleteVersion(target);
        }}
        onCancel={() => setRemovingVersionId(null)}
      />
    </div>
  );
}
