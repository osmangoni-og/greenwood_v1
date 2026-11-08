import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Coins,
  FileSpreadsheet,
  Layers,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchBoqEntries, fetchBoqSheets, fetchBoqSummary, fetchBoqVariance } from '@/lib/boq';
import { fetchEngineeringData } from '@/lib/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS } from '@/types/engineering';
import { recordActivity } from '@/lib/activity';
import { formatDateTime, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import type { BoqEntryRow, BoqSheetRow, BoqSheetStatus, BoqSummaryRow, BoqVarianceRow, ProjectRow } from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { BoqSheetFormModal } from '@/pages/boq/BoqSheetFormModal';
import { BoqEntryFormModal } from '@/pages/boq/BoqEntryFormModal';

interface ListData {
  project: ProjectRow | null;
  sheets: BoqSheetRow[];
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
}

const STATUS_TONE: Record<BoqSheetStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  archived: 'warning',
};

async function loadList(): Promise<ListData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, sheets: [], packages: [], engineers: [] };
  const [sheets, eng] = await Promise.all([
    fetchBoqSheets(project.id),
    fetchEngineeringData(project.id),
  ]);
  return { project, sheets, packages: eng.packages, engineers: eng.engineers };
}

export function BoqPage() {
  const { data, error, loading, reload } = useAsyncData(loadList);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BoqSheetRow | null>(null);
  const [deleting, setDeleting] = useState<BoqSheetRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return (
      <EmptyState
        icon={Calculator}
        title="No project yet"
        description="BOQ sheets belong to the project. Create the project first."
      />
    );
  }

  if (selectedId) {
    return (
      <BoqSheetDetail
        sheetId={selectedId}
        project={data.project}
        sheets={data.sheets}
        packages={data.packages}
        engineers={data.engineers}
        onBack={() => setSelectedId(null)}
        onChanged={reload}
      />
    );
  }

  const { project, sheets } = data;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('boq_sheets').delete().eq('id', deleting.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'boq_sheet',
      entityId: deleting.id,
      summary: `Removed BOQ sheet: ${deleting.sheet_name}`,
    });
    setDeleteBusy(false);
    setDeleting(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOQ Management"
        description="Upload, enter, and compare bill-of-quantities across engineers. Costs are calculated by the database."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New BOQ sheet
          </Button>
        }
      />

      {sheets.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No BOQ sheets yet"
          description="Create a BOQ sheet to start entering line items or uploading estimates."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New BOQ sheet
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sheets.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setSelectedId(sheet.id)}
              className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex items-center gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditing(sheet); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(sheet); } }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleting(sheet); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteError(null); setDeleting(sheet); } }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-stone-900 group-hover:text-primary-800">{sheet.sheet_name}</h3>
              <p className="mt-1 text-sm text-stone-500">{sheet.source_name}</p>
              {(() => {
                const pkg = sheet.design_package_id ? data.packages.find((p) => p.id === sheet.design_package_id) : null;
                const eng = pkg ? data.engineers.find((e) => e.id === pkg.engineer_id) : null;
                return (
                  <div className="mt-3 space-y-1.5">
                    {eng && <p className="text-xs text-stone-600"><span className="font-medium text-stone-700">Engineer:</span> {eng.name}</p>}
                    {pkg && <p className="text-xs text-stone-600"><span className="font-medium text-stone-700">Package:</span> {pkg.name}</p>}
                    {pkg && <p className="text-xs text-stone-600"><span className="font-medium text-stone-700">Revision:</span> {pkg.revision_label}</p>}
                  </div>
                );
              })()}
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone={STATUS_TONE[sheet.status]}>{sheet.status}</StatusBadge>
                {sheet.design_package_id && (() => {
                  const pkg = data.packages.find((p) => p.id === sheet.design_package_id);
                  if (!pkg) return null;
                  const tone: BadgeTone = pkg.status === 'approved' ? 'success' : pkg.status === 'submitted' ? 'info' : 'neutral';
                  return <StatusBadge tone={tone}>{DESIGN_PACKAGE_STATUS_LABELS[pkg.status]}</StatusBadge>;
                })()}
              </div>
              <p className="mt-auto pt-4 text-xs text-stone-400">{formatDateTime(sheet.created_at)}</p>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <BoqSheetFormModal
          project={project}
          sheet={null}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <BoqSheetFormModal
          project={project}
          sheet={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete BOQ sheet"
        message={`Remove "${deleting?.sheet_name ?? ''}" and all its line items? This cannot be undone.`}
        confirmLabel="Delete sheet"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

interface DetailData {
  sheet: BoqSheetRow;
  entries: BoqEntryRow[];
  summary: BoqSummaryRow[];
}

async function loadDetail(sheetId: string, projectId: string): Promise<DetailData> {
  const [sheetRes, entries, summary] = await Promise.all([
    supabase.from('boq_sheets').select('*').eq('id', sheetId).maybeSingle(),
    fetchBoqEntries(sheetId),
    fetchBoqSummary(sheetId),
  ]);
  if (sheetRes.error) throw new Error(sheetRes.error.message);
  if (!sheetRes.data) throw new Error('BOQ sheet could not be found.');
  await recordActivity({
    projectId,
    action: 'note',
    entityType: 'boq_sheet',
    entityId: sheetId,
    summary: 'Viewed BOQ sheet detail',
  });
  return { sheet: sheetRes.data as BoqSheetRow, entries, summary };
}

interface DetailProps {
  sheetId: string;
  project: ProjectRow;
  sheets: BoqSheetRow[];
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onBack: () => void;
  onChanged: () => void;
}

function BoqSheetDetail({ sheetId, project, sheets, packages, engineers, onBack, onChanged }: DetailProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadDetail(sheetId, project.id));
  const [addingEntry, setAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BoqEntryRow | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<BoqEntryRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totals = useMemo(() => {
    if (!data) return null;
    const head = data.summary.find((r) => r.category === null) ?? data.summary[0] ?? null;
    return head;
  }, [data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { sheet, entries, summary } = data;

  const categoryRows = summary.filter((r) => r.category !== null);
  const categoryRowsSorted = [...categoryRows].sort((a, b) => b.category_cost_bdt - a.category_cost_bdt);
  const totalCost = totals?.estimated_cost_bdt ?? 0;
  const costPerSft = totals?.cost_per_sft_bdt ?? 0;
  const materialShare = totals?.material_share_pct ?? 0;
  const laborShare = totals?.labor_share_pct ?? 0;

  async function confirmDeleteEntry() {
    if (!deletingEntry) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('boq_entries').delete().eq('id', deletingEntry.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'boq_entry',
      entityId: deletingEntry.id,
      summary: `Removed BOQ item: ${deletingEntry.item_description}`,
    });
    setDeleteBusy(false);
    setDeletingEntry(null);
    reload();
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
          Back to BOQ sheets
        </button>
      </div>

      <PageHeader
        title={sheet.sheet_name}
        description={(() => { const pkg = sheet.design_package_id ? packages.find((p) => p.id === sheet.design_package_id) : null; const eng = pkg ? engineers.find((e) => e.id === pkg.engineer_id) : null; return [sheet.source_name, eng?.name, pkg?.name, pkg?.revision_label].filter(Boolean).join(' - '); })()}
        action={
          <Button onClick={() => setAddingEntry(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add item
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={STATUS_TONE[sheet.status]}>{sheet.status}</StatusBadge>
        <StatusBadge tone="neutral">{sheet.building_area_sft.toLocaleString('en-IN')} SFT built-up</StatusBadge>
        {sheet.file_name && <StatusBadge tone="info">{sheet.file_name}</StatusBadge>}
        {sheet.design_package_id && (() => {
          const pkg = packages.find((p) => p.id === sheet.design_package_id);
          if (!pkg) return null;
          const tone: BadgeTone = pkg.status === 'approved' ? 'success' : pkg.status === 'submitted' ? 'info' : 'neutral';
          return <StatusBadge tone={tone}>{DESIGN_PACKAGE_STATUS_LABELS[pkg.status]}</StatusBadge>;
        })()}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Estimated cost" value={formatTaka(totalCost)} icon={Coins} tone="primary" />
        <StatCard label="Cost per SFT" value={formatTaka(costPerSft)} icon={Calculator} tone="accent" />
        <StatCard label="Material share" value={`${materialShare}%`} hint={formatTaka(totals?.material_cost_bdt ?? 0)} icon={Layers} tone="primary" />
        <StatCard label="Labor share" value={`${laborShare}%`} hint={formatTaka(totals?.labor_cost_bdt ?? 0)} icon={Layers} tone="accent" />
      </div>

      {totalCost > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Material vs labor" description="Share of total estimated cost" />
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm text-stone-600">
                  <span>Material</span><span>{materialShare}%</span>
                </div>
                <ProgressBar value={materialShare} tone="primary" label="Material share" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm text-stone-600">
                  <span>Labor</span><span>{laborShare}%</span>
                </div>
                <ProgressBar value={laborShare} tone="accent" label="Labor share" />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Cost breakdown by category" description="Share of total estimated cost" />
            <div className="mt-4 space-y-3">
              {categoryRowsSorted.length === 0 && (
                <p className="text-sm text-stone-500">No categories yet. Add BOQ items to see the breakdown.</p>
              )}
              {categoryRowsSorted.map((row) => (
                <div key={row.category}>
                  <div className="mb-1 flex justify-between text-sm text-stone-600">
                    <span>{row.category}</span>
                    <span>{formatTaka(row.category_cost_bdt)} - {row.category_variance_pct}%</span>
                  </div>
                  <ProgressBar value={row.category_variance_pct} tone="primary" label={`${row.category} share`} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          title="BOQ entries"
          description={`${entries.length} line item${entries.length === 1 ? '' : 's'}`}
          action={
            <Button onClick={() => setAddingEntry(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add item
            </Button>
          }
        />
        <div className="mt-4 overflow-x-auto">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">No items yet. Add your first BOQ line item.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Unit</th>
                  <th className="py-2 pr-4 text-right font-medium">Rate</th>
                  <th className="py-2 pr-4 text-right font-medium">Material</th>
                  <th className="py-2 pr-4 text-right font-medium">Labor</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 pr-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-stone-50">
                    <td className="py-2 pr-4"><StatusBadge tone="neutral">{entry.category}</StatusBadge></td>
                    <td className="py-2 pr-4 font-medium text-stone-800">{entry.item_description}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{entry.quantity.toLocaleString('en-IN')}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{entry.unit}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(entry.unit_rate_bdt)}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(entry.material_cost_bdt)}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(entry.labor_cost_bdt)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-stone-900">{formatTaka(entry.total_cost_bdt)}</td>
                    <td className="py-2 pr-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => setEditingEntry(entry)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEditingEntry(entry); }}
                          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => { setDeleteError(null); setDeletingEntry(entry); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { setDeleteError(null); setDeletingEntry(entry); } }}
                          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 font-semibold text-stone-900">
                  <td colSpan={7} className="py-3 pr-4 text-right">Total estimated cost</td>
                  <td className="py-3 pr-4 text-right">{formatTaka(totalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>

      {sheets.length > 1 && (
        <ComparisonSection project={project} sheets={sheets} currentSheetId={sheet.id} />
      )}

      {addingEntry && (
        <BoqEntryFormModal
          project={project}
          sheet={sheet}
          entry={null}
          onClose={() => setAddingEntry(false)}
          onSaved={() => { setAddingEntry(false); reload(); onChanged(); }}
        />
      )}
      {editingEntry && (
        <BoqEntryFormModal
          project={project}
          sheet={sheet}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => { setEditingEntry(null); reload(); onChanged(); }}
        />
      )}
      <ConfirmDialog
        open={deletingEntry !== null}
        title="Delete BOQ item"
        message={`Remove "${deletingEntry?.item_description ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete item"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDeleteEntry}
        onCancel={() => setDeletingEntry(null)}
      />
    </div>
  );
}

interface ComparisonSectionProps {
  project: ProjectRow;
  sheets: BoqSheetRow[];
  currentSheetId: string;
}

function ComparisonSection({ project, sheets, currentSheetId }: ComparisonSectionProps) {
  const [baseId, setBaseId] = useState(currentSheetId);
  const [compareId, setCompareId] = useState(sheets.find((s) => s.id !== currentSheetId)?.id ?? '');
  const [variance, setVariance] = useState<BoqVarianceRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runComparison() {
    if (!baseId || !compareId || baseId === compareId) {
      setError('Choose two different sheets to compare.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fetchBoqVariance(baseId, compareId);
      setVariance(result);
      await recordActivity({
        projectId: project.id,
        action: 'note',
        entityType: 'boq_comparison',
        summary: 'Compared BOQ sheets for variance',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compute variance.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="BOQ comparison & variance" description="Compare two sheets side by side. Calculations run in the database." />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-stone-700">Baseline sheet</span>
          <select
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
          >
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>{s.sheet_name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-stone-700">Compare against</span>
          <select
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
          >
            {sheets.map((s) => (
              <option key={s.id} value={s.id}>{s.sheet_name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <Button onClick={runComparison} disabled={busy}>
          {busy ? 'Calculating...' : 'Compare sheets'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
      {variance && variance.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 pr-4 text-right font-medium">Baseline</th>
                <th className="py-2 pr-4 text-right font-medium">Compare</th>
                <th className="py-2 pr-4 text-right font-medium">Variance</th>
                <th className="py-2 pr-4 text-right font-medium">%</th>
                <th className="py-2 pr-4 text-right font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {variance.map((row) => {
                const favorable = row.variance_value <= 0;
                return (
                  <tr key={row.metric} className="hover:bg-stone-50">
                    <td className="py-2 pr-4 font-medium text-stone-800">{row.metric}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(Number(row.base_value))}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(Number(row.compare_value))}</td>
                    <td className="py-2 pr-4 text-right text-stone-900">{formatTaka(Number(row.variance_value))}</td>
                    <td className="py-2 pr-4 text-right text-stone-600">{Number(row.variance_pct).toFixed(2)}%</td>
                    <td className="py-2 pr-4 text-right">
                      {favorable ? (
                        <TrendingDown className="inline h-4 w-4 text-emerald-600" aria-hidden />
                      ) : (
                        <TrendingUp className="inline h-4 w-4 text-rose-600" aria-hidden />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
