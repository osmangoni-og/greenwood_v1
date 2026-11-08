import { useMemo, useState } from 'react';
import { BarChart3, History, Plus, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { fetchMarketSnapshots, fetchRateHistory, fetchRateTrends, fetchRateVendors } from '@/lib/rates';
import { formatDate, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { RATE_MATERIAL_LABELS, RATE_MATERIAL_TYPES, type MaterialRateHistoryRow, type MonthlyMarketSnapshotRow, type ProjectRow, type RateMaterialType, type RateTrendSummaryRow, type VendorRow } from '@/types/database';
import { RateFormModal } from '@/pages/rates/RateFormModal';
import { MarketSnapshotFormModal } from '@/pages/rates/MarketSnapshotFormModal';
import { InflationSection } from '@/pages/rates/InflationSection';

interface PageData { project: ProjectRow | null; history: MaterialRateHistoryRow[]; snapshots: MonthlyMarketSnapshotRow[]; trends: RateTrendSummaryRow[]; vendors: VendorRow[]; }
async function loadPage(): Promise<PageData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, history: [], snapshots: [], trends: [], vendors: [] };
  const [history, snapshots, trends, vendors] = await Promise.all([fetchRateHistory(project.id), fetchMarketSnapshots(project.id), fetchRateTrends(project.id), fetchRateVendors(project.id)]);
  return { project, history, snapshots, trends, vendors };
}

export function RateHistoryPage() {
  const { data, error, loading, reload } = useAsyncData(loadPage);
  const [tab, setTab] = useState<'trends' | 'history' | 'snapshots' | 'compare' | 'inflation'>('trends');
  const [materialFilter, setMaterialFilter] = useState<RateMaterialType | 'all'>('all');
  const [creatingRate, setCreatingRate] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [deleting, setDeleting] = useState<MaterialRateHistoryRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredHistory = useMemo(() => data?.history.filter((row) => materialFilter === 'all' || row.material_type === materialFilter) ?? [], [data, materialFilter]);
  const filteredTrends = useMemo(() => data?.trends.filter((row) => materialFilter === 'all' || row.material_type === materialFilter) ?? [], [data, materialFilter]);
  const filteredSnapshots = useMemo(() => data?.snapshots.filter((row) => materialFilter === 'all' || row.material_type === materialFilter) ?? [], [data, materialFilter]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) return <EmptyState icon={BarChart3} title="No project yet" description="Rate history belongs to the project. Create the project first." />;
  const project = data.project;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError(null);
    const { error: removeError } = await supabase.from('material_rate_history').delete().eq('id', deleting.id);
    if (removeError) { setDeleteBusy(false); setDeleteError(removeError.message); return; }
    await recordActivity({ projectId: project.id, action: 'delete', entityType: 'rate_history', entityId: deleting.id, summary: `Removed ${RATE_MATERIAL_LABELS[deleting.material_type]} rate record` });
    setDeleteBusy(false); setDeleting(null); reload();
  }

  return <div className="space-y-6">
    <PageHeader title="Rate History" description="Preserve every purchase rate, compare vendors, and understand market price movement." action={<Button onClick={() => setCreatingRate(true)}><Plus className="h-4 w-4" aria-hidden /> Record rate</Button>} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-px">
        <TabButton active={tab === 'trends'} label="Price Trends" onClick={() => setTab('trends')} />
        <TabButton active={tab === 'history'} label="Historical Rates" onClick={() => setTab('history')} />
        <TabButton active={tab === 'snapshots'} label="Market Snapshots" onClick={() => setTab('snapshots')} />
        <TabButton active={tab === 'compare'} label="Rate Comparison" onClick={() => setTab('compare')} />
        <TabButton active={tab === 'inflation'} label="Inflation & Alerts" onClick={() => setTab('inflation')} />
      </div>
      <select aria-label="Filter material" className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700" value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value as RateMaterialType | 'all')}>
        <option value="all">All materials</option>
        {RATE_MATERIAL_TYPES.map((type) => <option key={type} value={type}>{RATE_MATERIAL_LABELS[type]}</option>)}
      </select>
    </div>

    {tab === 'trends' && <TrendsSection trends={filteredTrends} />}
    {tab === 'history' && <HistorySection rows={filteredHistory} vendors={data.vendors} onDelete={setDeleting} />}
    {tab === 'snapshots' && <SnapshotsSection rows={filteredSnapshots} onAdd={() => setCreatingSnapshot(true)} />}
    {tab === 'compare' && <ComparisonSection rows={filteredHistory} vendors={data.vendors} />}
    {tab === 'inflation' && <InflationSection rows={filteredHistory} />}

    {creatingRate && <RateFormModal project={data.project} vendors={data.vendors} onClose={() => setCreatingRate(false)} onSaved={() => { setCreatingRate(false); reload(); }} />}
    {creatingSnapshot && <MarketSnapshotFormModal project={data.project} onClose={() => setCreatingSnapshot(false)} onSaved={() => { setCreatingSnapshot(false); reload(); }} />}
    <ConfirmDialog open={deleting !== null} title="Delete rate record" message="This removes this historical record. Existing records are never overwritten by editing." confirmLabel="Delete record" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
  </div>;
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={active ? 'shrink-0 border-b-2 border-primary-700 px-4 py-2.5 text-sm font-medium text-primary-800' : 'shrink-0 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-800'}>{label}</button>; }

function TrendsSection({ trends }: { trends: RateTrendSummaryRow[] }) {
  if (!trends.length) return <EmptyState icon={TrendingUp} title="No rate trends yet" description="Record purchases or market rates to see price movement." />;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{trends.map((trend) => { const change = trend.change_percent ?? 0; const rising = change > 0; return <Card key={trend.material_type}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-stone-900">{RATE_MATERIAL_LABELS[trend.material_type]}</p><p className="mt-1 text-xs text-stone-500">Latest rate · {formatDate(trend.latest_date)}</p></div><div className={rising ? 'rounded-lg bg-rose-50 p-2 text-rose-700' : 'rounded-lg bg-emerald-50 p-2 text-emerald-700'}>{rising ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}</div></div><p className="mt-4 text-2xl font-bold text-stone-900">{formatTaka(Number(trend.latest_rate))}<span className="ml-1 text-sm font-normal text-stone-500">/ {trend.latest_unit}</span></p>{trend.previous_rate !== null ? <div className="mt-3 flex items-center justify-between text-xs"><span className="text-stone-500">Previous: {formatTaka(Number(trend.previous_rate))}</span><span className={rising ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</span></div> : <p className="mt-3 text-xs text-stone-500">First recorded rate</p>}<ProgressBar value={Math.min(100, Math.max(0, Number(trend.latest_rate) / Math.max(Number(trend.latest_rate), Number(trend.previous_rate ?? trend.latest_rate)) * 100))} label="Rate level" tone={rising ? 'error' : 'primary'} /></Card>; })}</div>;
}

function HistorySection({ rows, vendors, onDelete }: { rows: MaterialRateHistoryRow[]; vendors: VendorRow[]; onDelete: (row: MaterialRateHistoryRow) => void }) {
  if (!rows.length) return <EmptyState icon={History} title="No historical rates" description="Every purchase can be recorded as a new rate without changing older records." />;
  return <Card><CardHeader title="Historical rates" description={`${rows.length} immutable rate records`} /><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Material</th><th className="py-2 pr-4 font-medium">Vendor</th><th className="py-2 pr-4 font-medium">Source</th><th className="py-2 pr-4 text-right font-medium">Rate</th><th className="py-2 pr-4 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row) => <tr key={row.id} className="hover:bg-stone-50"><td className="py-3 pr-4 text-stone-600">{formatDate(row.rate_date)}</td><td className="py-3 pr-4"><StatusBadge tone="neutral">{RATE_MATERIAL_LABELS[row.material_type]}</StatusBadge></td><td className="py-3 pr-4 text-stone-600">{vendors.find((vendor) => vendor.id === row.vendor_id)?.name ?? 'Market / other'}</td><td className="py-3 pr-4 text-stone-500">{row.source_type}{row.purchase_reference ? ` · ${row.purchase_reference}` : ''}</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(row.rate_bdt)} / {row.unit}</td><td className="py-3 pr-4 text-right"><button type="button" onClick={() => onDelete(row)} className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete rate record"><Trash2 className="h-4 w-4" aria-hidden /></button></td></tr>)}</tbody></table></div></Card>;
}

function SnapshotsSection({ rows, onAdd }: { rows: MonthlyMarketSnapshotRow[]; onAdd: () => void }) { if (!rows.length) return <EmptyState icon={BarChart3} title="No market snapshots" description="Save one monthly market reference per material." action={<Button onClick={onAdd}><Plus className="h-4 w-4" aria-hidden /> Add snapshot</Button>} />; return <Card><CardHeader title="Monthly market snapshots" description="One reference rate per material for each month" action={<Button onClick={onAdd}><Plus className="h-4 w-4" aria-hidden /> Add snapshot</Button>} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <div key={row.id} className="rounded-xl border border-stone-200 p-4"><div className="flex justify-between"><StatusBadge tone="neutral">{RATE_MATERIAL_LABELS[row.material_type]}</StatusBadge><span className="text-xs text-stone-500">{formatDate(row.snapshot_month)}</span></div><p className="mt-3 text-lg font-semibold text-stone-900">{formatTaka(row.market_rate_bdt)} <span className="text-sm font-normal text-stone-500">/ {row.unit}</span></p>{row.source && <p className="mt-1 text-xs text-stone-500">Source: {row.source}</p>}</div>)}</div></Card>; }

function ComparisonSection({ rows, vendors }: { rows: MaterialRateHistoryRow[]; vendors: VendorRow[] }) { const groups = RATE_MATERIAL_TYPES.map((material) => { const materialRows = rows.filter((row) => row.material_type === material).sort((a, b) => a.rate_bdt - b.rate_bdt); return { material, rows: materialRows }; }).filter((group) => group.rows.length); if (!groups.length) return <EmptyState icon={BarChart3} title="Nothing to compare" description="Record vendor rates to compare suppliers by material." />; return <div className="grid gap-4 md:grid-cols-2">{groups.map((group) => <Card key={group.material}><CardHeader title={RATE_MATERIAL_LABELS[group.material]} description={`${group.rows.length} recorded rates`} /><div className="mt-3 space-y-2">{group.rows.slice(0, 5).map((row, index) => <div key={row.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5"><div><p className="text-sm font-medium text-stone-800">{vendors.find((vendor) => vendor.id === row.vendor_id)?.name ?? 'Market / other'}</p><p className="text-xs text-stone-500">{formatDate(row.rate_date)} · {row.unit}</p></div><div className="text-right"><p className="text-sm font-semibold text-stone-900">{formatTaka(row.rate_bdt)}</p>{index === 0 && <span className="text-[11px] font-medium text-emerald-700">Lowest recorded</span>}</div></div>)}</div></Card>)}</div>; }
