import { useState } from 'react';
import { Landmark, Percent, Plus, Pencil, Trash2, Wallet, TrendingDown } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { recordActivity } from '@/lib/activity';
import type { BudgetWorkspace } from '@/lib/budget';
import { CONSTRUCTION_PHASES } from '@/lib/constructionTracking';
import { deleteFundingDependency, setFundingDependencyStatus, updateFundingSource } from '@/lib/fundingDependencies';
import { sourceRiskAdjustedFunding } from '@/lib/fundingSummary';
import { formatDate, formatTaka } from '@/lib/format';
import type { ConstructionFundingSourceRow, FundingDependencyRow, FundingRiskLevel } from '@/types/database';
import { FundingDependencyModal } from '@/pages/budget/FundingDependencyModal';

interface Props {
  projectId: string;
  workspace: BudgetWorkspace;
  onChanged: () => void;
}

const RISK_TONE: Record<FundingRiskLevel, BadgeTone> = { low: 'success', medium: 'warning', high: 'error' };
const STATUS_LABEL: Record<FundingDependencyRow['status'], string> = { pending: 'Pending', partially_funded: 'Partly funded', funded: 'Funded', cancelled: 'Cancelled' };

const FUNDING_COLORS = ['#0f766e', '#0891b2', '#ca8a04', '#c2410c', '#9333ea', '#4f46e5', '#db2777', '#16a34a'];

export function FundingPanel({ projectId, workspace, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FundingDependencyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const funding = workspace.fundingSummary;
  const budget = funding.approvedBudget;
  const coverage = funding.fundingCoveragePercent;

  const sourceName = (id: string) => workspace.fundingSources.find((source) => source.id === id)?.source_name ?? 'Unknown source';
  const phaseName = (key: string) => CONSTRUCTION_PHASES.find(([phase]) => phase === key)?.[1] ?? key;
  const expectedDate = (sourceId: string) => workspace.fundingSources.find((s) => s.id === sourceId)?.expected_date ?? null;

  const activeSources = workspace.fundingSources.filter((row) => row.status !== 'cancelled');
  const riskChart: BarDatum[] = activeSources.map((row) => ({ label: row.source_name, primary: Number(row.planned_amount_bdt), secondary: sourceRiskAdjustedFunding(row) }));
  const fundingVsBudget: BarDatum[] = [{ label: 'Budget', primary: budget, secondary: undefined }, { label: 'Received', primary: funding.fundingReceived, secondary: undefined }, { label: 'Risk-adjusted', primary: funding.riskAdjustedFunding, secondary: undefined }, { label: 'Gap', primary: funding.fundingGap, secondary: undefined }];
  const donutSegments = activeSources.map((row, index) => ({ label: row.source_name, value: Number(row.planned_amount_bdt), color: FUNDING_COLORS[index % FUNDING_COLORS.length] }));

  const dependencyRiskChart: BarDatum[] = workspace.fundingDependencies.map((row) => ({ label: phaseName(row.phase_key), primary: Number(row.required_amount_bdt), secondary: row.risk_level === 'high' ? 3 : row.risk_level === 'medium' ? 2 : 1 }));

  async function run<T>(id: string, label: string, action: () => Promise<T>): Promise<T | void> {
    setBusyId(id);
    setError(null);
    try {
      const result = await action();
      await recordActivity({ projectId, action: 'update', entityType: 'funding_dependency', entityId: id, summary: label });
      onChanged();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this funding item.');
    } finally {
      setBusyId(null);
    }
  }

  return <div className="space-y-6">
    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

    {/* Funding Summary */}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Expected funding" value={formatTaka(funding.fundingExpected)} hint="Planned minus received" icon={Landmark} tone="primary" />
      <StatCard label="Risk-adjusted funding" value={formatTaka(funding.riskAdjustedFunding)} hint="Expected x probability" icon={Percent} tone="accent" />
      <StatCard label="Funding received" value={formatTaka(funding.fundingReceived)} hint="Confirmed receipts" icon={Wallet} tone="primary" />
      <StatCard label="Funding gap" value={formatTaka(funding.fundingGap)} hint="Budget minus received and risk-adjusted" icon={TrendingDown} tone={funding.fundingGap > 0 ? 'error' : 'primary'} />
      <StatCard label="Coverage" value={`${coverage.toFixed(1)}%`} hint="Received + risk-adjusted vs budget" icon={Percent} tone={coverage < 100 ? 'error' : 'accent'} />
    </div>

    {/* Risk Adjusted Funding Table */}
    <Card>
      <CardHeader title="Risk-adjusted funding" description="Set probability and expected date for each source. Risk-adjusted amount = expected amount x probability." />
      {workspace.fundingSources.length === 0 ? <p className="mt-4 text-sm text-stone-500">No funding sources yet. Add them on the Construction Finance page first.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Source</th><th className="py-2 pr-4 text-right font-medium">Planned</th><th className="py-2 pr-4 text-right font-medium">Received</th><th className="py-2 pr-4 text-right font-medium">Probability</th><th className="py-2 pr-4 text-right font-medium">Risk-adjusted</th><th className="py-2 pr-4 font-medium">Expected date</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.fundingSources.map((row) => <SourceRow key={row.id} row={row} disabled={busyId === row.id} onProbability={(value) => run(row.id, `Set probability of ${row.source_name} to ${value}%`, () => updateFundingSource(row.id, { probability_pct: value }))} onDate={(value) => run(row.id, `Set expected date of ${row.source_name}`, () => updateFundingSource(row.id, { expected_date: value }))} />)}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {/* Funding Dependency Tracker */}
    <Card>
      <CardHeader title="Funding dependency tracker" description="Which construction phase relies on which funding source, and how much risk that carries." action={<Button onClick={() => setAdding(true)} disabled={workspace.fundingSources.length === 0}><Plus className="h-4 w-4" aria-hidden /> Add dependency</Button>} />
      {workspace.fundingDependencies.length === 0 ? <p className="mt-4 text-sm text-stone-500">No phase-to-funding dependencies yet. Click "Add dependency" to link a construction phase to a funding source.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-2 pr-4 font-medium">Construction phase</th><th className="py-2 pr-4 font-medium">Funding source</th><th className="py-2 pr-4 text-right font-medium">Required</th><th className="py-2 pr-4 font-medium">Expected date</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Risk</th><th className="py-2 pr-4 text-right font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {workspace.fundingDependencies.map((row) => <tr key={row.id}>
                <td className="py-3 pr-4 font-medium text-stone-800">{phaseName(row.phase_key)}</td>
                <td className="py-3 pr-4 text-stone-700">{sourceName(row.funding_source_id)}</td>
                <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.required_amount_bdt))}</td>
                <td className="py-3 pr-4 text-stone-600">{expectedDate(row.funding_source_id) ? formatDate(expectedDate(row.funding_source_id)!) : '—'}</td>
                <td className="py-3 pr-4">
                  <select aria-label="Dependency status" className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs" value={row.status} disabled={busyId === row.id} onChange={(e) => run(row.id, `Set ${phaseName(row.phase_key)} funding to ${STATUS_LABEL[e.target.value as FundingDependencyRow['status']]}`, () => setFundingDependencyStatus(row.id, e.target.value as FundingDependencyRow['status']))}>
                    {(Object.keys(STATUS_LABEL) as FundingDependencyRow['status'][]).map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
                  </select>
                </td>
                <td className="py-3 pr-4"><StatusBadge tone={RISK_TONE[row.risk_level]}>{row.risk_level}</StatusBadge></td>
                <td className="py-3 pr-4">
                  <div className="flex justify-end gap-1">
                    <button type="button" aria-label="Edit dependency" disabled={busyId === row.id} onClick={() => setEditing(row)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4" aria-hidden /></button>
                    <button type="button" aria-label="Remove dependency" disabled={busyId === row.id} onClick={() => run(row.id, `Removed funding dependency for ${phaseName(row.phase_key)}`, () => deleteFundingDependency(row.id))} className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </Card>

    {/* Funding Dashboard */}
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Funding vs budget" description="Planned budget compared to received, risk-adjusted, and the remaining gap." />
        <div className="mt-4 h-56"><BarChart data={fundingVsBudget} primaryLabel="Amount" formatValue={formatTaka} /></div>
      </Card>
      <Card>
        <CardHeader title="Funding source breakdown" description="Share of planned funding by source." />
        {donutSegments.length > 0 ? <div className="mt-4"><DonutChart segments={donutSegments} centerLabel="Planned" centerValue={formatTaka(funding.fundingPlanned)} /></div> : <p className="mt-4 text-sm text-stone-500">No funding sources to chart.</p>}
      </Card>
      <Card>
        <CardHeader title="Expected vs risk-adjusted funding" description="Planned amount and risk-adjusted amount per source." />
        {riskChart.length > 0 ? <div className="mt-4 h-56"><BarChart data={riskChart} primaryLabel="Planned" secondaryLabel="Risk-adjusted" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No funding sources to chart.</p>}
      </Card>
      <Card>
        <CardHeader title="Funding dependency risk" description="Required amount per phase. Secondary bar height reflects risk level (low=1, medium=2, high=3)." />
        {dependencyRiskChart.length > 0 ? <div className="mt-4 h-56"><BarChart data={dependencyRiskChart} primaryLabel="Required amount" secondaryLabel="Risk score" formatValue={formatTaka} /></div> : <p className="mt-4 text-sm text-stone-500">No dependencies to chart.</p>}
      </Card>
    </div>

    {(adding || editing) && <FundingDependencyModal projectId={projectId} sources={workspace.fundingSources} editing={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); onChanged(); }} />}
  </div>;
}

interface SourceRowProps {
  row: ConstructionFundingSourceRow;
  disabled: boolean;
  onProbability: (value: number) => void;
  onDate: (value: string | null) => void;
}

function SourceRow({ row, disabled, onProbability, onDate }: SourceRowProps) {
  const riskAdjusted = Math.max(0, Number(row.planned_amount_bdt) - Number(row.received_amount_bdt)) * (Number(row.probability_pct) / 100);
  return <tr>
    <td className="py-3 pr-4 font-medium text-stone-800">{row.source_name}</td>
    <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.planned_amount_bdt))}</td>
    <td className="py-3 pr-4 text-right text-stone-700">{formatTaka(Number(row.received_amount_bdt))}</td>
    <td className="py-3 pr-4 text-right">
      <input aria-label={`Probability for ${row.source_name}`} type="number" min={0} max={100} step={1} className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-right text-sm" defaultValue={Number(row.probability_pct)} disabled={disabled} onBlur={(e) => { const value = Number(e.target.value); if (Number.isFinite(value) && value !== Number(row.probability_pct)) onProbability(value); }} />
    </td>
    <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(riskAdjusted)}</td>
    <td className="py-3 pr-4">
      <input aria-label={`Expected date for ${row.source_name}`} type="date" className="rounded-lg border border-stone-300 px-2 py-1 text-sm" defaultValue={row.expected_date ?? ''} disabled={disabled} onBlur={(e) => { const value = e.target.value || null; if (value !== (row.expected_date ?? null)) onDate(value); }} />
    </td>
  </tr>;
}
