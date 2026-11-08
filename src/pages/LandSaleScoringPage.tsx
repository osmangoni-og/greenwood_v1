import { useMemo, useState } from 'react';
import { ListOrdered, Pencil, Plus, ShieldCheck, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchLandAssets, fetchLandSaleScores } from '@/lib/landSaleScoring';
import { recordActivity } from '@/lib/activity';
import { formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import type { LandSaleRecommendation, LandSaleScoreRow, MonetizableAssetRow, ProjectRow } from '@/types/database';
import { LAND_SALE_FACTORS, LAND_SALE_RECOMMENDATION_LABELS } from '@/types/database';
import { LandSaleScoreFormModal } from '@/pages/land-sale/LandSaleScoreFormModal';

interface ScoringData { project: ProjectRow | null; scores: LandSaleScoreRow[]; assets: MonetizableAssetRow[]; }
async function loadScoring(): Promise<ScoringData> { const project = await fetchPrimaryProject(); if (!project) return { project: null, scores: [], assets: [] }; const [scores, assets] = await Promise.all([fetchLandSaleScores(project.id), fetchLandAssets(project.id)]); return { project, scores, assets }; }

const RECOMMENDATION_TONE: Record<LandSaleRecommendation, 'error' | 'warning' | 'accent' | 'primary'> = { sell_immediately: 'error', sell_if_needed: 'warning', hold: 'accent', protected_asset: 'primary' };

export function LandSaleScoringPage() {
  const { data, error, loading, reload } = useAsyncData(loadScoring);
  const [form, setForm] = useState<LandSaleScoreRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<LandSaleScoreRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null);
  const ranked = useMemo(() => data?.scores ?? [], [data]);
  const counts = useMemo(() => { const result: Record<LandSaleRecommendation, number> = { sell_immediately: 0, sell_if_needed: 0, hold: 0, protected_asset: 0 }; ranked.forEach((row) => { result[row.recommendation]++; }); return result; }, [ranked]);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) return <EmptyState icon={ListOrdered} title="No project yet" description="Land sale scoring belongs to the project. Create the project first." />;
  const { project, assets } = data;
  async function confirmDelete() { if (!deleting) return; setDeleteBusy(true); setDeleteError(null); const result = await supabase.from('land_sale_scores').delete().eq('id', deleting.id); if (result.error) { setDeleteError(result.error.message); setDeleteBusy(false); return; } await recordActivity({ projectId: project.id, action: 'delete', entityType: 'land_sale_score', entityId: deleting.id, summary: `Deleted land sale score for ${deleting.asset_name}` }); setDeleteBusy(false); setDeleting(null); reload(); }
  return <div className="space-y-6">
    <PageHeader title="Land Sale Priority Scoring" description="Score each land asset across eight factors to decide whether to sell, hold, or protect it." action={<Button onClick={() => setForm(null)}><Plus className="h-4 w-4" aria-hidden /> Score asset</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Sell Immediately" value={String(counts.sell_immediately)} hint="Highest sell pressure" icon={TrendingUp} tone="error" /><StatCard label="Sell If Needed" value={String(counts.sell_if_needed)} hint="Conditional sale" icon={TrendingUp} tone="accent" /><StatCard label="Hold" value={String(counts.hold)} hint="Balanced or holding" icon={TrendingDown} tone="primary" /><StatCard label="Protected Asset" value={String(counts.protected_asset)} hint="Keep at all costs" icon={ShieldCheck} tone="primary" /></div>
    {ranked.length === 0 ? <EmptyState icon={ListOrdered} title="No scored assets" description="Score your first land or property asset to build the priority ranking." action={<Button onClick={() => setForm(null)}><Plus className="h-4 w-4" aria-hidden /> Score asset</Button>} /> : <div className="space-y-4">{ranked.map((row, index) => <ScoreCard key={row.id} row={row} rank={index + 1} onEdit={() => setForm(row)} onDelete={() => setDeleting(row)} />)}</div>}
    {form !== undefined && <LandSaleScoreFormModal project={project} assets={assets} row={form} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); reload(); }} />}
    <ConfirmDialog open={deleting !== null} title="Delete score" message="This will remove the scoring record for this asset." confirmLabel="Delete" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
  </div>;
}

function ScoreCard({ row, rank, onEdit, onDelete }: { row: LandSaleScoreRow; rank: number; onEdit: () => void; onDelete: () => void }) {
  const sellFactors = LAND_SALE_FACTORS.filter((factor) => factor.group === 'sell');
  const holdFactors = LAND_SALE_FACTORS.filter((factor) => factor.group === 'hold');
  const tone = RECOMMENDATION_TONE[row.recommendation];
  return <Card>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-base font-bold text-primary-800">{rank}</span>
        <div>
          <h3 className="text-lg font-semibold text-stone-900">{row.asset_name}</h3>
          {row.location && <p className="text-sm text-stone-500">{row.location}</p>}
          {row.estimated_value_bdt != null && <p className="mt-1 text-sm font-medium text-stone-700">{formatTaka(Number(row.estimated_value_bdt))}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge tone={tone}>{LAND_SALE_RECOMMENDATION_LABELS[row.recommendation]}</StatusBadge>
        <div className="inline-flex gap-1"><button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Edit score"><Pencil className="h-4 w-4" aria-hidden /></button><button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete score"><Trash2 className="h-4 w-4" aria-hidden /></button></div>
      </div>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600">Sell pressure: {Number(row.sell_pressure).toFixed(2)}</p>
        <ProgressBar value={Number(row.sell_pressure) * 10} tone="error" label="Sell pressure" />
        <div className="mt-3 space-y-1.5">{sellFactors.map((factor) => <FactorBar key={factor.key} label={factor.label} value={row[factor.key]} tone="error" />)}</div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Hold pressure: {Number(row.hold_pressure).toFixed(2)}</p>
        <ProgressBar value={Number(row.hold_pressure) * 10} tone="primary" label="Hold pressure" />
        <div className="mt-3 space-y-1.5">{holdFactors.map((factor) => <FactorBar key={factor.key} label={factor.label} value={row[factor.key]} tone="primary" />)}</div>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-sm">
      <span className="font-medium text-stone-600">Net signal</span>
      <span className={Number(row.net_signal) >= 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{Number(row.net_signal) >= 0 ? '+' : ''}{Number(row.net_signal).toFixed(2)}</span>
    </div>
    {row.notes && <p className="mt-3 text-xs text-stone-500">{row.notes}</p>}
  </Card>;
}

function FactorBar({ label, value, tone }: { label: string; value: number; tone: 'error' | 'primary' }) { return <div className="flex items-center gap-2"><span className="w-32 shrink-0 text-xs text-stone-600">{label}</span><div className="flex-1"><ProgressBar value={value * 10} tone={tone} label={label} /></div><span className="w-6 shrink-0 text-right text-xs font-semibold text-stone-700">{value}</span></div>; }
