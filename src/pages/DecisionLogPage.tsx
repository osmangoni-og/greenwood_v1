import { useState } from 'react';
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { deleteDecision, fetchDecisions } from '@/lib/decisionLog';
import { recordActivity } from '@/lib/activity';
import { fetchPrimaryProject } from '@/lib/projects';
import { formatDate, formatTaka } from '@/lib/format';
import type { ProjectDecisionRow, ProjectRow } from '@/types/database';
import { DECISION_CATEGORIES, type DecisionCategory } from '@/types/database';
import { DecisionModal } from '@/pages/decision/DecisionModal';

interface Data { project: ProjectRow | null; decisions: ProjectDecisionRow[]; }
async function loadData(): Promise<Data> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, decisions: [] };
  return { project, decisions: await fetchDecisions(project.id) };
}

const STATUS_TONE: Record<string, BadgeTone> = { approved: 'success', proposed: 'info', rejected: 'error', superseded: 'neutral' };
const CAT_LABEL: Record<DecisionCategory, string> = Object.fromEntries(DECISION_CATEGORIES.map((c) => [c.value, c.label])) as Record<DecisionCategory, string>;

export function DecisionLogPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDecisionRow | null>(null);
  const [deleting, setDeleting] = useState<ProjectDecisionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !data.project) return <EmptyState icon={ClipboardList} title="No project yet" description="The decision log belongs to the project. Create the project first." />;

  const { project, decisions } = data;
  const approved = decisions.filter((d) => d.status === 'approved');
  const totalCostImpact = approved.reduce((s, d) => s + Number(d.cost_impact_bdt), 0);
  const totalScheduleImpact = approved.reduce((s, d) => s + Number(d.schedule_impact_days), 0);
  const byCategory: BarDatum[] = DECISION_CATEGORIES.map((c) => ({ label: c.label, primary: decisions.filter((d) => d.category === c.value).length }));

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteDecision(deleting.id);
      await recordActivity({ projectId: project.id, action: 'delete', entityType: 'decision', entityId: deleting.id, summary: `Deleted decision: ${deleting.title}` });
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this decision.');
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Decision Log" description="A permanent audit trail of every project decision, with reason, alternatives, and impact." action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" aria-hidden /> Log decision</Button>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total decisions" value={String(decisions.length)} hint={`${approved.length} approved`} icon={ClipboardList} tone="primary" />
      <StatCard label="Cost impact (approved)" value={formatTaka(totalCostImpact)} hint="Sum of cost impact for approved decisions" icon={ClipboardList} tone={totalCostImpact > 0 ? 'error' : 'accent'} />
      <StatCard label="Schedule impact (approved)" value={`${totalScheduleImpact} days`} hint="Sum of schedule delay for approved decisions" icon={ClipboardList} tone={totalScheduleImpact > 0 ? 'error' : 'accent'} />
      <StatCard label="Categories used" value={String(new Set(decisions.map((d) => d.category)).size)} hint={`of ${DECISION_CATEGORIES.length} available`} icon={ClipboardList} tone="accent" />
    </div>

    <Card>
      <CardHeader title="Decisions by category" description="How many decisions have been logged in each category." />
      {decisions.length > 0 ? <div className="mt-4 h-48"><BarChart data={byCategory} primaryLabel="Count" formatValue={(v) => String(v)} /></div> : <p className="mt-4 text-sm text-stone-500">No decisions logged yet.</p>}
    </Card>

    <Card>
      <CardHeader title="Decision register" description="Every logged decision, newest first." />
      {decisions.length === 0 ? <EmptyState icon={ClipboardList} title="No decisions logged" description="Log the first project decision to start the audit trail." /> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Category</th><th className="py-2 pr-4 font-medium">Title</th><th className="py-2 pr-4 font-medium">Approved by</th><th className="py-2 pr-4 text-right font-medium">Cost</th><th className="py-2 pr-4 text-right font-medium">Days</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 text-right font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {decisions.map((d) => <tr key={d.id}>
                <td className="py-3 pr-4 text-stone-600">{formatDate(d.decision_date)}</td>
                <td className="py-3 pr-4"><StatusBadge tone="neutral">{CAT_LABEL[d.category]}</StatusBadge></td>
                <td className="py-3 pr-4 font-medium text-stone-800">{d.title}{d.reason && <p className="text-xs font-normal text-stone-500">{d.reason}</p>}</td>
                <td className="py-3 pr-4 text-stone-600">{d.approved_by ?? '—'}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(d.cost_impact_bdt))}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{d.schedule_impact_days}</td>
                <td className="py-3 pr-4"><StatusBadge tone={STATUS_TONE[d.status]}>{d.status}</StatusBadge></td>
                <td className="py-3 pr-4"><div className="flex justify-end gap-1"><button type="button" aria-label="Edit" onClick={() => { setEditing(d); setModalOpen(true); }} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4" aria-hidden /></button><button type="button" aria-label="Delete" onClick={() => setDeleting(d)} className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden /></button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {modalOpen && <DecisionModal projectId={project.id} editing={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); reload(); }} />}
    <ConfirmDialog open={deleting !== null} title="Delete decision" message={`"${deleting?.title}" will be permanently removed from the audit trail.`} confirmLabel="Delete" busy={busy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
  </div>;
}
