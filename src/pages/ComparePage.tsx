import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  GitCompare,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { cx } from '@/lib/cx';
import { formatDateTime, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchEngineeringData } from '@/lib/engineering';
import {
  deleteRegisterRow,
  fetchRegisterRows,
  REGISTER_CONFIGS,
  REGISTER_TABS,
  type RegisterConfig,
  type RegisterKey,
} from '@/lib/registers';
import { supabase, unwrap } from '@/lib/supabase';
import type {
  ComparisonRow,
  ComparisonSummaryRow,
  DesignRow,
  DesignSlot,
  ProjectRow,
} from '@/types/database';
import type { DesignPackageRow, EngineerRow } from '@/types/engineering';
import { ComparisonFormModal } from '@/pages/compare/ComparisonFormModal';
import { DesignFormModal } from '@/pages/compare/DesignFormModal';
import { RegisterFormModal } from '@/pages/compare/RegisterFormModal';
import { ColumnRegisterFormModal } from '@/pages/compare/ColumnRegisterFormModal';
import { ColumnRegisterTable } from '@/pages/compare/ColumnRegisterTable';
import { BeamRegisterFormModal } from '@/pages/compare/BeamRegisterFormModal';
import { BeamRegisterTable } from '@/pages/compare/BeamRegisterTable';
import { FootingRegisterFormModal } from '@/pages/compare/FootingRegisterFormModal';
import { FootingRegisterTable } from '@/pages/compare/FootingRegisterTable';
import { SlabRegisterFormModal } from '@/pages/compare/SlabRegisterFormModal';
import { SlabRegisterTable } from '@/pages/compare/SlabRegisterTable';
import { RebarRegisterFormModal } from '@/pages/compare/RebarRegisterFormModal';
import { RebarRegisterTable } from '@/pages/compare/RebarRegisterTable';
import { fetchColumnReinforcementGroups, fetchBeamReinforcementGroups, fetchFootingReinforcementGroups, fetchSlabReinforcementGroups } from '@/lib/registers';
import { PackageComparisonPanel } from '@/pages/compare/PackageComparisonPanel';


interface ListData {
  project: ProjectRow | null;
  comparisons: ComparisonRow[];
}

interface DetailData {
  comparison: ComparisonRow;
  designs: DesignRow[];
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
}

async function loadList(): Promise<ListData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, comparisons: [] };
  const comparisons = unwrap<ComparisonRow[]>(
    await supabase
      .from('comparisons')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
  );
  return { project, comparisons };
}

async function loadDetail(comparisonId: string): Promise<DetailData> {
  const [compResult, designsResult] = await Promise.all([
    supabase.from('comparisons').select('*').eq('id', comparisonId).maybeSingle(),
    supabase.from('designs').select('*').eq('comparison_id', comparisonId).order('slot', { ascending: true }),
  ]);
  if (compResult.error) throw new Error(compResult.error.message);
  if (!compResult.data) throw new Error('This comparison could not be found.');
  const comparison = compResult.data as ComparisonRow;
  const designs = unwrap<DesignRow[]>(designsResult);
  let packages: DesignPackageRow[] = [];
  let engineers: EngineerRow[] = [];
  if (comparison.project_id) {
    const eng = await fetchEngineeringData(comparison.project_id);
    packages = eng.packages;
    engineers = eng.engineers;
  }
  return { comparison, designs, packages, engineers };
}

async function loadSummary(comparisonId: string): Promise<ComparisonSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_design_comparison', { p_comparison_id: comparisonId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ComparisonSummaryRow[];
}

const SLOT_TONE: Record<DesignSlot, BadgeTone> = { A: 'primary', B: 'accent', C: 'info' };

function labelForSlot(comparison: ComparisonRow, slot: DesignSlot): string {
  if (slot === 'A') return comparison.design_a_label;
  if (slot === 'B') return comparison.design_b_label;
  return comparison.design_c_label;
}

export function ComparePage() {
  const { data, error, loading, reload } = useAsyncData(loadList);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ComparisonRow | null>(null);
  const [deleting, setDeleting] = useState<ComparisonRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return (
      <EmptyState
        icon={Building2}
        title="No project yet"
        description="Design comparisons belong to the project. Create the project first."
      />
    );
  }

  if (selectedId) {
    return (
      <ComparisonDetail
        comparisonId={selectedId}
        projectId={data.project.id}
        onBack={() => setSelectedId(null)}
        onEditComparison={(comp) => setEditing(comp)}
        onChanged={reload}
      />
    );
  }

  const { project, comparisons } = data;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('comparisons').delete().eq('id', deleting.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'comparison',
      entityId: deleting.id,
      summary: `Comparison removed: ${deleting.name}`,
    });
    setDeleteBusy(false);
    setDeleting(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design Comparison Engine"
        description="Compare design packages by constructability, risk, and cost. Side-by-side package comparisons with structural rankings."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New comparison
          </Button>
        }
      />

      <PackageComparisonPanel />

      <h2 className="pt-2 text-lg font-semibold text-stone-900">Package-level comparisons</h2>

      {comparisons.length === 0 ? (
        <EmptyState
          icon={GitCompare}
          title="No comparisons yet"
          description="Create a comparison to start evaluating structural designs from different packages."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New comparison
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {comparisons.map((comparison) => (
            <button
              key={comparison.id}
              type="button"
              onClick={() => setSelectedId(comparison.id)}
              className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <GitCompare className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex items-center gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setEditing(comparison); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(comparison); } }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleting(comparison); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteError(null); setDeleting(comparison); } }}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-stone-900 group-hover:text-primary-800">{comparison.name}</h3>
              {comparison.description && (
                <p className="mt-1 line-clamp-2 text-sm text-stone-500">{comparison.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge tone="primary">{comparison.design_a_label}</StatusBadge>
                <StatusBadge tone="accent">{comparison.design_b_label}</StatusBadge>
                <StatusBadge tone="info">{comparison.design_c_label}</StatusBadge>
              </div>
              <p className="mt-auto pt-4 text-xs text-stone-400">{formatDateTime(comparison.created_at)}</p>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <ComparisonFormModal
          project={project}
          comparison={null}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <ComparisonFormModal
          project={project}
          comparison={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete comparison"
        message={`Remove "${deleting?.name ?? ''}" and all its packages, registers, and BOQ items? This cannot be undone.`}
        confirmLabel="Delete comparison"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

interface ComparisonDetailProps {
  comparisonId: string;
  projectId: string;
  onBack: () => void;
  onEditComparison: (comp: ComparisonRow) => void;
  onChanged: () => void;
}

function ComparisonDetail({ comparisonId, onBack, onEditComparison }: ComparisonDetailProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadDetail(comparisonId), [comparisonId]);
  const [activeDesignSlot, setActiveDesignSlot] = useState<DesignSlot>('A');
  const [activeRegister, setActiveRegister] = useState<RegisterKey>('columns');
  const [editingDesignSlot, setEditingDesignSlot] = useState<DesignSlot | null>(null);
  const [clearingSlot, setClearingSlot] = useState<DesignSlot | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [deleteRowError, setDeleteRowError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { comparison, designs, packages, engineers } = data;
  const activeDesign = designs.find((d) => d.slot === activeDesignSlot) ?? null;
  const activeConfig = REGISTER_CONFIGS[activeRegister];

  async function deleteRow(row: Record<string, unknown>) {
    setDeleteRowError(null);
    try {
      await deleteRegisterRow(activeConfig, row.id as string);
      reload();
    } catch (err) {
      setDeleteRowError(err instanceof Error ? err.message : 'Could not delete entry.');
    }
  }

  async function confirmClearSlot() {
    if (!clearingSlot) return;
    const design = designs.find((d) => d.slot === clearingSlot);
    if (!design) { setClearingSlot(null); return; }
    setClearBusy(true);
    setClearError(null);
    const { error: clearErr } = await supabase.from('designs').delete().eq('id', design.id);
    if (clearErr) {
      setClearBusy(false);
      setClearError(clearErr.message);
      return;
    }
    if (activeDesignSlot === clearingSlot) {
      const remaining = (['A', 'B', 'C'] as DesignSlot[]).find((s) => s !== clearingSlot && designs.find((d) => d.slot === s));
      if (remaining) setActiveDesignSlot(remaining);
    }
    setClearBusy(false);
    setClearingSlot(null);
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
          Back to comparisons
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{comparison.name}</h1>
          {comparison.description && <p className="mt-1 text-sm text-stone-500">{comparison.description}</p>}
        </div>
        <Button variant="secondary" onClick={() => onEditComparison(comparison)}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit comparison
        </Button>
      </div>

      <RankingSummary comparisonId={comparisonId} />

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Packages</h2>
        <p className="mt-1 text-sm text-stone-500">Select a package to manage its structural registers.</p>

        <div className="mt-4 flex flex-wrap gap-3">
          {(['A', 'B', 'C'] as DesignSlot[]).map((slot) => {
            const design = designs.find((d) => d.slot === slot);
            const isActive = slot === activeDesignSlot;
            const label = labelForSlot(comparison, slot);
            const pkg = design?.design_package_id ? packages.find((p) => p.id === design.design_package_id) : null;
            const eng = pkg ? engineers.find((e) => e.id === pkg.engineer_id) : null;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveDesignSlot(slot)}
                className={cx(
                  'flex-1 rounded-xl border p-4 text-left transition-all',
                  isActive ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-200' : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <div className="flex items-center justify-between">
                  <StatusBadge tone={SLOT_TONE[slot]}>{label}</StatusBadge>
                  <span className="text-xs font-medium text-stone-400">Slot {slot}</span>
                </div>
                {design ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-stone-900">{pkg?.name ?? design.engineer_name}</p>
                    <p className="text-xs text-stone-500">{eng?.name ?? design.engineer_name}</p>
                    {pkg && <p className="text-xs text-stone-400">{pkg.revision_label}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingDesignSlot(slot); }}
                    className="mt-3 text-sm font-medium text-primary-700 hover:text-primary-900"
                  >
                    + Add package
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {activeDesign && (
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700">
                {(() => {
                  const pkg = activeDesign.design_package_id ? packages.find((p) => p.id === activeDesign.design_package_id) : null;
                  return pkg?.name ?? activeDesign.engineer_name;
                })()} — Package {activeDesign.slot}
              </p>
              {activeDesign.notes && <p className="mt-0.5 text-xs text-stone-500">{activeDesign.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-xs" onClick={() => setEditingDesignSlot(activeDesign.slot)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Button>
              <Button variant="ghost" className="text-xs text-rose-600 hover:text-rose-800" onClick={() => { setClearError(null); setClearingSlot(activeDesign.slot); }}>
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Clear
              </Button>
            </div>
          </div>
        )}
      </section>

      {activeDesign ? (
        <RegisterSection
          config={activeConfig}
          activeRegister={activeRegister}
          onTabChange={setActiveRegister}
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          packages={packages}
          engineers={engineers}
          onAdd={() => { setEditingRow(null); setRegisterModalOpen(true); }}
          onEditRow={(row) => { setEditingRow(row); setRegisterModalOpen(true); }}
          onDeleteRow={deleteRow}
          deleteError={deleteRowError}
          onClearError={() => setDeleteRowError(null)}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Add a package for Package {activeDesignSlot} to start entering structural data.
        </div>
      )}

      {editingDesignSlot && (
        <DesignFormModal
          comparisonId={comparisonId}
          slot={editingDesignSlot}
          existingId={activeDesign?.id ?? null}
          existingDesignPackageId={activeDesign?.design_package_id ?? null}
          existingNotes={activeDesign?.notes ?? ''}
          packages={packages}
          engineers={engineers}
          onClose={() => setEditingDesignSlot(null)}
          onSaved={() => { setEditingDesignSlot(null); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister === 'columns' && (
        <ColumnRegisterFormModal
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          existingRow={editingRow}
          packages={packages}
          engineers={engineers}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister === 'beams' && (
        <BeamRegisterFormModal
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          existingRow={editingRow}
          packages={packages}
          engineers={engineers}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister === 'footings' && (
        <FootingRegisterFormModal
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          existingRow={editingRow}
          packages={packages}
          engineers={engineers}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister === 'slabs' && (
        <SlabRegisterFormModal
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          existingRow={editingRow}
          packages={packages}
          engineers={engineers}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister === 'rebar' && (
        <RebarRegisterFormModal
          designId={activeDesign.id}
          designPackageId={activeDesign.design_package_id}
          existingRow={editingRow}
          packages={packages}
          engineers={engineers}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      {registerModalOpen && activeDesign && activeRegister !== 'columns' && activeRegister !== 'beams' && activeRegister !== 'footings' && activeRegister !== 'slabs' && activeRegister !== 'rebar' && (
        <RegisterFormModal
          config={activeConfig}
          designId={activeDesign.id}
          existingRow={editingRow}
          onClose={() => setRegisterModalOpen(false)}
          onSaved={() => { setRegisterModalOpen(false); reload(); }}
        />
      )}
      <ConfirmDialog
        open={clearingSlot !== null}
        title={`Clear Package ${clearingSlot ?? ''}`}
        message={`Remove the design assigned to Package ${clearingSlot ?? ''}? All structural registers and BOQ items for this slot will be deleted. Packages A, B, and C that are not cleared will remain unaffected.`}
        confirmLabel="Clear package"
        busy={clearBusy}
        error={clearError}
        onConfirm={confirmClearSlot}
        onCancel={() => setClearingSlot(null)}
      />
    </div>
  );
}

interface RankingSummaryProps {
  comparisonId: string;
}

function RankingSummary({ comparisonId }: RankingSummaryProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadSummary(comparisonId), [comparisonId]);

  if (loading && !data) return <LoadingState label="Calculating rankings..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader title="Comparison and rankings" description="Add packages and structural data to generate rankings." />
        <div className="mt-6">
          <EmptyState icon={Trophy} title="No data yet" description="Rankings appear once you add structural elements to your packages." />
        </div>
      </Card>
    );
  }

  const ranked = [...data].sort(
    (a, b) => Number(a.estimated_structural_cost_bdt) - Number(b.estimated_structural_cost_bdt),
  );
  const cheapest = Number(ranked[0].estimated_structural_cost_bdt);

  return (
    <Card>
      <CardHeader
        title="Comparison and rankings"
        description="Aggregated from all registers. Rankings are generated by database calculations — no AI."
      />
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3 text-right">Columns</th>
              <th className="px-4 py-3 text-right">Col types</th>
              <th className="px-4 py-3 text-right">Beams</th>
              <th className="px-4 py-3 text-right">Beam types</th>
              <th className="px-4 py-3 text-right">Footings</th>
              <th className="px-4 py-3 text-right">Slabs</th>
              <th className="px-4 py-3 text-right">Concrete (cum)</th>
              <th className="px-4 py-3 text-right">Steel (kg)</th>
              <th className="px-4 py-3 text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {ranked.map((row, index) => {
              const cost = Number(row.estimated_structural_cost_bdt);
              const isBest = index === 0 && cost > 0;
              return (
                <tr key={row.design_id} className={cx(isBest && 'bg-emerald-50/50')}>
                  <td className="px-4 py-3.5">
                    {isBest ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <Trophy className="h-4 w-4" aria-hidden />
                        #{index + 1}
                      </span>
                    ) : (
                      <span className="font-medium text-stone-600">#{index + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge tone={SLOT_TONE[row.slot as DesignSlot]}>{row.engineer_name}</StatusBadge>
                  </td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.total_columns}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.column_types}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.total_beams}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.beam_types}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.total_footings}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{row.total_slabs}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{Number(row.total_concrete_cum).toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right text-stone-700">{Number(row.total_steel_kg).toFixed(0)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-stone-900">
                    {formatTaka(cost)}
                    {isBest && cheapest > 0 && (
                      <span className="block text-xs font-normal text-emerald-600">Best value</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface RegisterSectionProps {
  config: RegisterConfig;
  activeRegister: RegisterKey;
  onTabChange: (key: RegisterKey) => void;
  designId: string;
  designPackageId: string | null;
  packages: DesignPackageRow[];
  engineers: EngineerRow[];
  onAdd: () => void;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
  deleteError: string | null;
  onClearError: () => void;
}

async function fetchPackageFloorArea(designPackageId: string | null): Promise<number> {
  if (!designPackageId) return 0;
  const { data, error } = await supabase
    .from('boq_sheets')
    .select('building_area_sft')
    .eq('design_package_id', designPackageId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as { building_area_sft: number } | null)?.building_area_sft ?? 0);
}

function RegisterSection({
  config,
  activeRegister,
  onTabChange,
  designId,
  designPackageId,
  packages,
  engineers,
  onAdd,
  onEditRow,
  onDeleteRow,
  deleteError,
  onClearError,
}: RegisterSectionProps) {
  const { data, error, loading, reload } = useAsyncData(() => fetchRegisterRows(config, designId), [config, designId]);
  const rows = useMemo(() => data ?? [], [data]);
  const isColumns = activeRegister === 'columns';
  const isBeams = activeRegister === 'beams';
  const isFootings = activeRegister === 'footings';
  const isSlabs = activeRegister === 'slabs';
  const isRebar = activeRegister === 'rebar';
  const columnGroupsQuery = useAsyncData(
    () => fetchColumnReinforcementGroups(isColumns ? rows.map((r) => r.id as string) : []),
    [rows, isColumns],
  );
  const beamGroupsQuery = useAsyncData(
    () => fetchBeamReinforcementGroups(isBeams ? rows.map((r) => r.id as string) : []),
    [rows, isBeams],
  );
  const footingGroupsQuery = useAsyncData(
    () => fetchFootingReinforcementGroups(isFootings ? rows.map((r) => r.id as string) : []),
    [rows, isFootings],
  );
  const slabGroupsQuery = useAsyncData(
    () => fetchSlabReinforcementGroups(isSlabs ? rows.map((r) => r.id as string) : []),
    [rows, isSlabs],
  );
  const groupsByRegister = columnGroupsQuery.data ?? {};
  const beamGroupsByRegister = beamGroupsQuery.data ?? {};
  const footingGroupsByRegister = footingGroupsQuery.data ?? {};
  const slabGroupsByRegister = slabGroupsQuery.data ?? {};
  const floorArea = useAsyncData(() => fetchPackageFloorArea(designPackageId), [designPackageId]);
  const floorAreaSft = floorArea.data ?? 0;

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const columnSummary = isColumns
    ? rows.reduce<{ count: number; concrete: number; steel: number; types: Set<string> }>(
        (acc, row) => {
          acc.count += Number(row.quantity ?? 1);
          acc.concrete += Number(row.concrete_volume_cum ?? 0);
          acc.steel += Number(row.steel_weight_kg ?? 0);
          const type = String(row.column_type ?? '').trim();
          if (type) acc.types.add(type);
          return acc;
        },
        { count: 0, concrete: 0, steel: 0, types: new Set<string>() },
      )
    : null;
  const beamSummary = isBeams
    ? rows.reduce<{ count: number; concrete: number; steel: number; types: Set<string> }>(
        (acc, row) => {
          acc.count += Number(row.quantity ?? 1);
          acc.concrete += Number(row.concrete_volume_cum ?? 0);
          acc.steel += Number(row.steel_weight_kg ?? 0);
          const type = String(row.beam_type ?? '').trim();
          if (type) acc.types.add(type);
          return acc;
        },
        { count: 0, concrete: 0, steel: 0, types: new Set<string>() },
      )
    : null;
  const footingSummary = isFootings
    ? rows.reduce<{ count: number; excavation: number; concrete: number; steel: number; types: Set<string> }>(
        (acc, row) => {
          acc.count += Number(row.quantity ?? 1);
          acc.excavation += Number(row.excavation_volume_cum ?? 0);
          acc.concrete += Number(row.concrete_volume_cum ?? 0);
          acc.steel += Number(row.steel_weight_kg ?? 0);
          const type = String(row.footing_type ?? '').trim();
          if (type) acc.types.add(type);
          return acc;
        },
        { count: 0, excavation: 0, concrete: 0, steel: 0, types: new Set<string>() },
      )
    : null;
  const slabSummary = isSlabs
    ? rows.reduce<{ count: number; area: number; concrete: number; steel: number; types: Set<string> }>(
        (acc, row) => {
          acc.count += Number(row.quantity ?? 1);
          acc.area += Number(row.area_sqm ?? 0) * Number(row.quantity ?? 1);
          acc.concrete += Number(row.concrete_volume_cum ?? 0);
          acc.steel += Number(row.steel_weight_kg ?? 0);
          const type = String(row.slab_type ?? '').trim();
          if (type) acc.types.add(type);
          return acc;
        },
        { count: 0, area: 0, concrete: 0, steel: 0, types: new Set<string>() },
      )
    : null;
  const rebarSummary = isRebar
    ? rows.reduce<{ count: number; weight: number; byElement: Map<string, number> }>(
        (acc, row) => {
          acc.count += 1;
          acc.weight += Number(row.total_weight_kg ?? row.weight_kg ?? 0);
          const elem = String(row.element_type ?? '').trim();
          if (elem) acc.byElement.set(elem, (acc.byElement.get(elem) ?? 0) + Number(row.total_weight_kg ?? row.weight_kg ?? 0));
          return acc;
        },
        { count: 0, weight: 0, byElement: new Map<string, number>() },
      )
    : null;
  const activePackage = designPackageId ? packages.find((p) => p.id === designPackageId) ?? null : null;
  const activeEngineer = activePackage ? engineers.find((e) => e.id === activePackage.engineer_id) ?? null : null;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {REGISTER_TABS.map((tab) => {
            const isActive = tab.key === activeRegister;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <Button onClick={onAdd} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Add entry
        </Button>
      </div>

      {isBeams && beamSummary && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-xs text-stone-500">
            {activePackage
              ? `${activePackage.name} · ${activePackage.revision_label} · ${activeEngineer?.name ?? 'Unknown engineer'}`
              : 'No design package assigned'}
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total beam quantity</dt>
              <dd className="text-lg font-semibold text-stone-900">{beamSummary.count}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Distinct beam types</dt>
              <dd className="text-lg font-semibold text-stone-900">{beamSummary.types.size}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total concrete volume</dt>
              <dd className="text-lg font-semibold text-stone-900">{beamSummary.concrete.toFixed(3)} cum</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total steel weight</dt>
              <dd className="text-lg font-semibold text-stone-900">{beamSummary.steel.toFixed(2)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per beam</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {beamSummary.count > 0 ? (beamSummary.steel / beamSummary.count).toFixed(2) : '0.00'} kg
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(beamSummary.steel / floorAreaSft).toFixed(3)} kg` : '-'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-stone-500">Beam types</dt>
              <dd className="mt-0.5 text-sm text-stone-800">{beamSummary.types.size > 0 ? Array.from(beamSummary.types).join(', ') : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {isColumns && columnSummary && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-xs text-stone-500">
            {activePackage
              ? `${activePackage.name} · ${activePackage.revision_label} · ${activeEngineer?.name ?? 'Unknown engineer'}`
              : 'No design package assigned'}
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total column quantity</dt>
              <dd className="text-lg font-semibold text-stone-900">{columnSummary.count}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Distinct column types</dt>
              <dd className="text-lg font-semibold text-stone-900">{columnSummary.types.size}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total concrete volume</dt>
              <dd className="text-lg font-semibold text-stone-900">{columnSummary.concrete.toFixed(3)} cum</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total steel weight</dt>
              <dd className="text-lg font-semibold text-stone-900">{columnSummary.steel.toFixed(2)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per column</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {columnSummary.count > 0 ? (columnSummary.steel / columnSummary.count).toFixed(2) : '0.00'} kg
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(columnSummary.steel / floorAreaSft).toFixed(3)} kg` : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Concrete per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(columnSummary.concrete / floorAreaSft).toFixed(4)} cum` : '-'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-stone-500">Column types</dt>
              <dd className="mt-0.5 text-sm text-stone-800">{columnSummary.types.size > 0 ? Array.from(columnSummary.types).join(', ') : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {isFootings && footingSummary && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-xs text-stone-500">
            {activePackage
              ? `${activePackage.name} · ${activePackage.revision_label} · ${activeEngineer?.name ?? 'Unknown engineer'}`
              : 'No design package assigned'}
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total footings</dt>
              <dd className="text-lg font-semibold text-stone-900">{footingSummary.count}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Distinct footing types</dt>
              <dd className="text-lg font-semibold text-stone-900">{footingSummary.types.size}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total excavation volume</dt>
              <dd className="text-lg font-semibold text-stone-900">{footingSummary.excavation.toFixed(3)} cum</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total concrete volume</dt>
              <dd className="text-lg font-semibold text-stone-900">{footingSummary.concrete.toFixed(3)} cum</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total steel weight</dt>
              <dd className="text-lg font-semibold text-stone-900">{footingSummary.steel.toFixed(2)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per footing</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {footingSummary.count > 0 ? (footingSummary.steel / footingSummary.count).toFixed(2) : '0.00'} kg
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(footingSummary.steel / floorAreaSft).toFixed(3)} kg` : '-'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-stone-500">Footing types</dt>
              <dd className="mt-0.5 text-sm text-stone-800">{footingSummary.types.size > 0 ? Array.from(footingSummary.types).join(', ') : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {isSlabs && slabSummary && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-xs text-stone-500">
            {activePackage
              ? `${activePackage.name} · ${activePackage.revision_label} · ${activeEngineer?.name ?? 'Unknown engineer'}`
              : 'No design package assigned'}
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total slabs</dt>
              <dd className="text-lg font-semibold text-stone-900">{slabSummary.count}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Distinct slab types</dt>
              <dd className="text-lg font-semibold text-stone-900">{slabSummary.types.size}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total area</dt>
              <dd className="text-lg font-semibold text-stone-900">{slabSummary.area.toFixed(2)} sqm</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total concrete volume</dt>
              <dd className="text-lg font-semibold text-stone-900">{slabSummary.concrete.toFixed(3)} cum</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total steel weight</dt>
              <dd className="text-lg font-semibold text-stone-900">{slabSummary.steel.toFixed(2)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per slab</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {slabSummary.count > 0 ? (slabSummary.steel / slabSummary.count).toFixed(2) : '0.00'} kg
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Steel per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(slabSummary.steel / floorAreaSft).toFixed(3)} kg` : '-'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-stone-500">Slab types</dt>
              <dd className="mt-0.5 text-sm text-stone-800">{slabSummary.types.size > 0 ? Array.from(slabSummary.types).join(', ') : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {isRebar && rebarSummary && (
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-4">
          <p className="text-xs text-stone-500">
            {activePackage
              ? `${activePackage.name} · ${activePackage.revision_label} · ${activeEngineer?.name ?? 'Unknown engineer'}`
              : 'No design package assigned'}
          </p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-stone-500">Total rebar items</dt>
              <dd className="text-lg font-semibold text-stone-900">{rebarSummary.count}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Total weight</dt>
              <dd className="text-lg font-semibold text-stone-900">{rebarSummary.weight.toFixed(2)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Weight per SFT</dt>
              <dd className="text-lg font-semibold text-stone-900">
                {floorAreaSft > 0 ? `${(rebarSummary.weight / floorAreaSft).toFixed(3)} kg` : '-'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-stone-500">Weight by element</dt>
              <dd className="mt-0.5 text-sm text-stone-800">{rebarSummary.byElement.size > 0 ? Array.from(rebarSummary.byElement.entries()).map(([elem, wt]) => `${elem}: ${wt.toFixed(1)} kg`).join(', ') : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {deleteError && (
        <div className="px-4 pt-3">
          <ErrorState message={deleteError} onRetry={onClearError} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="px-6 py-12">
          <EmptyState icon={Plus} title={`No ${config.label} entries`} description="Add the first entry to start building this register." />
        </div>
      ) : isColumns ? (
        <ColumnRegisterTable
          rows={rows}
          groupsByRegister={groupsByRegister}
          packageName={activePackage?.name ?? 'Not assigned'}
          engineerName={activeEngineer?.name ?? 'Not assigned'}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
        />
      ) : isBeams ? (
        <BeamRegisterTable
          rows={rows}
          groupsByRegister={beamGroupsByRegister}
          packageName={activePackage?.name ?? 'Not assigned'}
          engineerName={activeEngineer?.name ?? 'Not assigned'}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
        />
      ) : isFootings ? (
        <FootingRegisterTable
          rows={rows}
          groupsByRegister={footingGroupsByRegister}
          packageName={activePackage?.name ?? 'Not assigned'}
          engineerName={activeEngineer?.name ?? 'Not assigned'}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
        />
      ) : isSlabs ? (
        <SlabRegisterTable
          rows={rows}
          groupsByRegister={slabGroupsByRegister}
          packageName={activePackage?.name ?? 'Not assigned'}
          engineerName={activeEngineer?.name ?? 'Not assigned'}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
        />
      ) : isRebar ? (
        <RebarRegisterTable
          rows={rows}
          packageName={activePackage?.name ?? 'Not assigned'}
          engineerName={activeEngineer?.name ?? 'Not assigned'}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                {config.fields.map((field) => (
                  <th key={field.name} className="px-4 py-3 whitespace-nowrap">{field.label}</th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id as string} className="transition-colors hover:bg-stone-50">
                  {config.fields.map((field) => (
                    <td key={field.name} className="px-4 py-3 whitespace-nowrap text-stone-700">
                      {field.type === 'number' ? Number(row[field.name] ?? 0).toString() : String(row[field.name] ?? '')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" className="p-1.5" aria-label="Edit entry" onClick={() => onEditRow(row)}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        className="p-1.5 hover:text-rose-700"
                        aria-label="Delete entry"
                        onClick={() => onDeleteRow(row)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
