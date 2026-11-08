import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, CheckCircle2, Copy, FilePlus2, History, Link2 as Link2Icon, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/StatePanel';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { createBudgetDraft, type BudgetWorkspace } from '@/lib/budget';
import { buildLineageDisplay, fetchLineageLookup, getLineageStatus, type LineageLookup } from '@/lib/lineage';
import { computeRevisionImpact } from '@/lib/comparisonScoring';
import { recordActivity } from '@/lib/activity';
import { formatDate, formatTaka } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { BUDGET_REVISION_TRIGGER_LABELS } from '@/types/database';
import type { BudgetRevisionRow, BudgetVersionRow } from '@/types/database';
import { BudgetLinesModal } from '@/pages/budget/BudgetLinesModal';
import { ApproveVersionModal } from '@/pages/budget/ApproveVersionModal';
import { DeleteBudgetVersionModal, type BudgetVersionDeleteSummary } from '@/pages/budget/DeleteBudgetVersionModal';
import { BudgetLineageModal } from '@/pages/budget/BudgetLineageModal';
import { EditVersionModal } from '@/pages/budget/EditVersionModal';
import { EditRevisionModal } from '@/pages/budget/EditRevisionModal';

interface Props {
  projectId: string;
  workspace: BudgetWorkspace;
  onChanged: () => void;
}

const STATUS_TONE: Record<BudgetVersionRow['status'], BadgeTone> = { draft: 'warning', approved: 'success', archived: 'neutral', superseded: 'neutral' };

export function BudgetVersionsPanel({ projectId, workspace, onChanged }: Props) {
  const [editing, setEditing] = useState<BudgetVersionRow | null>(null);
  const [editingMeta, setEditingMeta] = useState<BudgetVersionRow | null>(null);
  const [editingRevision, setEditingRevision] = useState<BudgetRevisionRow | null>(null);
  const [approving, setApproving] = useState<BudgetVersionRow | null>(null);
  const [linking, setLinking] = useState<BudgetVersionRow | null>(null);
  const [deleting, setDeleting] = useState<BudgetVersionRow | null>(null);
  const [archiving, setArchiving] = useState<BudgetVersionRow | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<BudgetVersionRow | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LineageLookup | null>(null);

  useEffect(() => { fetchLineageLookup(projectId).then(setLookup).catch(() => {}); }, [projectId]);
  const active = workspace.versions.find((version) => version.is_active) ?? null;
  const totalFor = (versionId: string) => workspace.lines
    .filter((line) => line.budget_version_id === versionId && ['project', 'construction', 'contingency'].includes(line.level))
    .reduce((sum, line) => sum + Number(line.budget_amount_bdt), 0);

  async function startDraft(copyFrom: BudgetVersionRow | null, summary: string) {
    setBusy(true);
    setError(null);
    try {
      const id = await createBudgetDraft(projectId, copyFrom?.id ?? null);
      await recordActivity({ projectId, action: 'create', entityType: 'budget_version', entityId: id, summary });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the draft.');
    } finally {
      setBusy(false);
    }
  }

  function startRevision() {
    return startDraft(active, `Created a draft budget${active ? ` from ${active.version_label}` : ''}`);
  }

  function duplicate(version: BudgetVersionRow) {
    return startDraft(version, `Duplicated ${version.version_label} into a new draft`);
  }

  function openDelete(version: BudgetVersionRow) {
    setDeleting(version);
  }

  function deleteSummaryFor(version: BudgetVersionRow): BudgetVersionDeleteSummary {
    const lineCount = workspace.lines.filter((line) => line.budget_version_id === version.id).length;
    const versionRevisions = workspace.revisions.filter((r) => r.budget_version_id === version.id);
    const revisionCount = versionRevisions.length;
    const total = totalFor(version.id);
    const latest = versionRevisions.length > 0 ? versionRevisions[0] : null;
    const latestImpact = latest
      ? `R${latest.revision_number}: ${formatTaka(Number(latest.new_total_bdt))} (${(Number(latest.new_total_bdt) > Number(latest.previous_total_bdt) ? '+' : '')}${((Number(latest.new_total_bdt) - Number(latest.previous_total_bdt)) / Math.max(Number(latest.previous_total_bdt), 1) * 100).toFixed(1)}%)`
      : null;
    return { lineCount, revisionCount, total, latestImpact };
  }

  async function updateVersionStatus(version: BudgetVersionRow, patch: Partial<Pick<BudgetVersionRow, 'status' | 'is_active'>>, summary: string) {
    const { data: updated, error: updateErr } = await supabase
      .from('budget_versions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', version.id)
      .select('id');
    if (updateErr || !updated || updated.length === 0) throw new Error(updateErr?.message ?? `${version.version_label} could not be updated.`);
    await recordActivity({ projectId, action: 'update', entityType: 'budget_version', entityId: version.id, summary });
  }

  async function confirmArchive() {
    if (!archiving) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await updateVersionStatus(archiving, { status: 'archived', is_active: false }, `Archived ${archiving.version_label}`);
      setArchiveBusy(false);
      setArchiving(null);
      onChanged();
    } catch (err) {
      setArchiveBusy(false);
      setArchiveError(err instanceof Error ? err.message : 'This budget could not be archived.');
    }
  }

  function startRestore(version: BudgetVersionRow) {
    setRestoreError(null);
    setRestoring(version);
  }

  async function confirmRestore() {
    if (!restoring) return;
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      await updateVersionStatus(restoring, { status: 'approved', is_active: true }, `Restored ${restoring.version_label} from archive`);
      setRestoreBusy(false);
      setRestoring(null);
      onChanged();
    } catch (err) {
      setRestoreBusy(false);
      setRestoreError(err instanceof Error ? err.message : 'This budget could not be restored.');
    }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader title="Budget versions" description="Only one version is active at a time. Approved versions are locked; changes start a new draft." action={<Button onClick={startRevision} disabled={busy}><FilePlus2 className="h-4 w-4" aria-hidden /> {busy ? 'Creating...' : active ? 'Revise budget' : 'Create Budget V1'}</Button>} />
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {workspace.versions.length === 0 ? (
        <div className="mt-4"><EmptyState icon={FilePlus2} title="No budget versions" description="Create Budget V1 to start the project budget." /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {workspace.versions.map((version) => {
            const lineage = lookup ? buildLineageDisplay(version, lookup) : null;
            const lineageStatus = getLineageStatus(version);
            const lineageTone: BadgeTone = lineageStatus === 'COMPLETE' ? 'success' : lineageStatus === 'PARTIAL' ? 'warning' : 'error';
            return (
            <div key={version.id} className="flex flex-col gap-3 rounded-xl border border-stone-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-stone-900">{version.version_label}</p>
                    <StatusBadge tone={STATUS_TONE[version.status]}>{version.status === 'approved' ? 'Frozen' : version.status}</StatusBadge>
                    {version.is_active && <StatusBadge tone="primary">active</StatusBadge>}
                    <StatusBadge tone={lineageTone}>Lineage: {lineageStatus}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    Total {formatTaka(totalFor(version.id))}
                    {version.approved_by ? ` | Approved by ${version.approved_by}` : ''}
                    {` | Created ${formatDate(version.created_at)}`}
                    {` | Updated ${formatDate(version.updated_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setLinking(version)}><Link2Icon className="h-4 w-4" aria-hidden /> Link lineage</Button>
                  <Button variant="secondary" onClick={() => duplicate(version)} disabled={busy}><Copy className="h-4 w-4" aria-hidden /> Duplicate</Button>
                  <Button variant="secondary" onClick={() => setEditingMeta(version)}><Pencil className="h-4 w-4" aria-hidden /> Edit details</Button>
                  {(version.status === 'approved' || version.status === 'superseded') && (
                    <Button variant="secondary" onClick={() => { setArchiveError(null); setArchiving(version); }}><Archive className="h-4 w-4" aria-hidden /> Archive</Button>
                  )}
                  {version.status === 'archived' && (
                    <Button variant="secondary" onClick={() => startRestore(version)} disabled={busy}><ArchiveRestore className="h-4 w-4" aria-hidden /> Restore</Button>
                  )}
                  {version.status === 'draft' && (
                    <>
                      <Button variant="secondary" onClick={() => setEditing(version)}><Pencil className="h-4 w-4" aria-hidden /> Edit lines</Button>
                      <Button onClick={() => setApproving(version)}><CheckCircle2 className="h-4 w-4" aria-hidden /> Approve</Button>
                    </>
                  )}
                  <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => openDelete(version)}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
                </div>
              </div>
              {lineage && (
                <div className="grid gap-2 rounded-lg bg-stone-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div><span className="font-medium text-stone-700">Engineer:</span> <span className="text-stone-600">{lineage.engineerName ?? 'Not assigned'}</span></div>
                  <div><span className="font-medium text-stone-700">Design Package:</span> <span className="text-stone-600">{lineage.packageName ? `${lineage.packageName}${lineage.revisionLabel ? ` (${lineage.revisionLabel})` : ''}` : 'Not assigned'}</span></div>
                  <div><span className="font-medium text-stone-700">BOQ:</span> <span className="text-stone-600">{lineage.boqName ?? 'Not assigned'}</span></div>
                  <div><span className="font-medium text-stone-700">Budget contractor:</span> <span className="text-stone-600">{lineage.contractorName ?? 'Not assigned'}</span></div>
                  <div><span className="font-medium text-stone-700">Selected contractor:</span> <span className="text-stone-600">{lineage.selectedContractorName ?? 'Not selected'}</span></div>
                  <div><span className="font-medium text-stone-700">Vendor:</span> <span className="text-stone-600">{lineage.vendorName ?? 'Not assigned'}</span></div>
                  <div><span className="font-medium text-stone-700">Lineage status:</span> <span className="text-stone-600">{lineage.status}</span></div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </Card>

    <Card>
      <CardHeader title="Revision history" description="Every approved version is recorded with trigger type, reason, impact, and totals. Notes and impact can be edited after the fact." />
      {workspace.revisions.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No revisions recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">No.</th><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Trigger</th><th className="py-2 pr-4 font-medium">Reason</th><th className="py-2 pr-4 font-medium">Approved by</th><th className="py-2 pr-4 text-right font-medium">Previous</th><th className="py-2 pr-4 text-right font-medium">New total</th><th className="py-2 pr-4 text-right font-medium">Variance</th><th className="py-2 pr-4 text-right font-medium">Impact %</th><th className="py-2 pr-4 font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.revisions.map((revision: BudgetRevisionRow) => {
                const change = Number(revision.new_total_bdt) - Number(revision.previous_total_bdt);
                const impactPct = revision.previous_total_bdt > 0 ? (change / Number(revision.previous_total_bdt)) * 100 : 0;
                const triggerLabel = revision.trigger_type ? BUDGET_REVISION_TRIGGER_LABELS[revision.trigger_type] ?? revision.trigger_type : 'Other';
                return <tr key={revision.id}>
                  <td className="py-3 pr-4 font-medium text-stone-800"><span className="inline-flex items-center gap-1"><History className="h-3.5 w-3.5 text-stone-400" aria-hidden />R{revision.revision_number}</span></td>
                  <td className="py-3 pr-4 text-stone-600">{formatDate(revision.revision_date)}</td>
                  <td className="py-3 pr-4"><StatusBadge tone="neutral">{triggerLabel}</StatusBadge></td>
                  <td className="py-3 pr-4 text-stone-800 max-w-xs truncate">{revision.reason}</td>
                  <td className="py-3 pr-4 text-stone-600">{revision.approved_by}</td>
                  <td className="py-3 pr-4 text-right text-stone-600">{formatTaka(Number(revision.previous_total_bdt))}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(Number(revision.new_total_bdt))}</td>
                  <td className={change > 0 ? 'py-3 pr-4 text-right text-rose-700' : 'py-3 pr-4 text-right text-emerald-700'}>{change > 0 ? '+' : ''}{formatTaka(change)}</td>
                  <td className={impactPct > 0 ? 'py-3 pr-4 text-right text-rose-700 font-medium' : 'py-3 pr-4 text-right text-emerald-700 font-medium'}>{impactPct > 0 ? '+' : ''}{impactPct.toFixed(1)}%</td>
                  <td className="py-3 pr-4"><Button variant="ghost" className="text-stone-600 hover:bg-stone-100" onClick={() => setEditingRevision(revision)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {workspace.revisions.length > 0 && (
      <Card>
        <CardHeader title="Budget impact analysis" description="Impact amount, growth percentage, and cost driver for each revision." />
        <div className="mt-4 space-y-3">
          {computeRevisionImpact(workspace.revisions).map((impact) => (
            <div key={impact.revisionId} className="rounded-xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-900">R{impact.revisionNumber}</span>
                  <StatusBadge tone="neutral">{impact.triggerType ? BUDGET_REVISION_TRIGGER_LABELS[impact.triggerType as keyof typeof BUDGET_REVISION_TRIGGER_LABELS] ?? impact.triggerType : 'Other'}</StatusBadge>
                  <span className="text-xs text-stone-500">{formatDate(impact.date)}</span>
                </div>
                <span className={impact.impactAmount > 0 ? 'text-sm font-semibold text-rose-700' : 'text-sm font-semibold text-emerald-700'}>
                  {impact.impactAmount > 0 ? '+' : ''}{formatTaka(impact.impactAmount)} ({impact.impactPct > 0 ? '+' : ''}{impact.impactPct.toFixed(1)}%)
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{impact.reason}</p>
              {impact.largestCostDriver && (
                <p className="mt-1 text-xs text-stone-500">Largest cost driver: <span className="font-medium text-stone-700">{impact.largestCostDriver}</span></p>
              )}
              {impact.budgetGrowthPct !== 0 && (
                <p className="mt-1 text-xs text-stone-500">Budget growth: {impact.budgetGrowthPct > 0 ? '+' : ''}{impact.budgetGrowthPct.toFixed(1)}%</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    )}

    {editingMeta && <EditVersionModal projectId={projectId} version={editingMeta} onClose={() => setEditingMeta(null)} onSaved={() => { setEditingMeta(null); onChanged(); }} />}
    {editingRevision && <EditRevisionModal projectId={projectId} revision={editingRevision} onClose={() => setEditingRevision(null)} onSaved={() => { setEditingRevision(null); onChanged(); }} />}
    {editing && <BudgetLinesModal projectId={projectId} version={editing} lines={workspace.lines.filter((line) => line.budget_version_id === editing.id)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    {approving && <ApproveVersionModal version={approving} totalBudget={totalFor(approving.id)} previousTotal={active ? totalFor(active.id) : 0} isFirst={!active} onClose={() => setApproving(null)} onSaved={() => { setApproving(null); onChanged(); }} />}
    {linking && <BudgetLineageModal projectId={projectId} version={linking} onClose={() => setLinking(null)} onSaved={() => { setLinking(null); onChanged(); }} />}
    <ConfirmDialog open={archiving !== null} title="Archive budget" message={archiving?.is_active ? `"${archiving.version_label}" is the active budget. Archiving it leaves the project without an active budget until another budget is approved. Continue?` : `Archive "${archiving?.version_label ?? ''}"? You can restore it later from the archived budget.`} confirmLabel="Archive budget" busy={archiveBusy} error={archiveError} onConfirm={confirmArchive} onCancel={() => setArchiving(null)} />
    <ConfirmDialog open={restoring !== null} title="Restore budget" message={active && active.id !== restoring?.id ? `Restoring "${restoring?.version_label ?? ''}" will replace "${active.version_label}" as the active budget. Continue?` : `Restore "${restoring?.version_label ?? ''}" to approved and make it the active budget?`} confirmLabel="Restore budget" busy={restoreBusy} error={restoreError} onConfirm={confirmRestore} onCancel={() => setRestoring(null)} />
    {deleting && (
      <DeleteBudgetVersionModal
        projectId={projectId}
        version={deleting}
        summary={deleteSummaryFor(deleting)}
        onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); onChanged(); }}
      />
    )}
  </div>;
}
