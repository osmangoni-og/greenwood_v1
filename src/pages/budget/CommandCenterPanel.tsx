import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, Banknote, CalendarDays, Coins, Gauge, HardHat, History, Landmark, Link2, Package, Percent, PiggyBank, Receipt, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { computeBudgetTotals, computeContingency, computePurchaseOrderBalance } from '@/lib/budgetCalculations';
import { buildLineageDisplay, computeLineageWarnings, fetchLineageLookup, type LineageLookup } from '@/lib/lineage';
import { fetchSelectedContractor, type SelectedContractorSummary } from '@/lib/projectProfile';
import type { BudgetWorkspace } from '@/lib/budget';
import { formatDate, formatLabel, formatTaka } from '@/lib/format';
import { BUDGET_REVISION_TRIGGER_LABELS } from '@/types/database';

interface Props {
  workspace: BudgetWorkspace;
}

export function CommandCenterPanel({ workspace }: Props) {
  const active = workspace.versions.find((v) => v.is_active) ?? null;
  const lines = active ? workspace.lines.filter((l) => l.budget_version_id === active.id) : [];
  const totals = computeBudgetTotals(lines, workspace.actuals, workspace.committed, workspace.phases);
  const contingency = computeContingency(lines, workspace.drawdowns.filter((d) => active && d.budget_version_id === active.id));
  const funding = workspace.fundingSummary;
  const [lookup, setLookup] = useState<LineageLookup | null>(null);
  const [contractor, setContractor] = useState<SelectedContractorSummary | null>(null);

  const projectId = active?.project_id ?? null;
  useEffect(() => {
    if (!projectId) return;
    fetchLineageLookup(projectId).then(setLookup).catch(() => {});
    fetchSelectedContractor(projectId).then(setContractor).catch(() => {});
  }, [projectId]);

  const lineage = active && lookup ? buildLineageDisplay(active, lookup) : null;
  const activeWarnings = lineage ? computeLineageWarnings(lineage).filter((w) => w.active) : [];
  const lineageTone = lineage?.status === 'COMPLETE' ? 'primary' : lineage?.status === 'PARTIAL' ? 'accent' : 'error';

  const outstandingLiability = workspace.supplierInvoices.reduce((s, inv) => s + Number(inv.balance_bdt), 0);
  const openPOBalance = workspace.purchaseOrders.filter((po) => po.status === 'issued').reduce((s, po) => s + computePurchaseOrderBalance(po, workspace.deliveries).open, 0);

  return <div className="space-y-6">
    <div className="rounded-2xl bg-stone-900 p-5 text-white">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-200">Owner Command Center</p>
      <h2 className="mt-1 text-2xl font-semibold">Greenwood Miazi Bari — Project Control</h2>
      <p className="mt-1 text-sm text-stone-300">15 key indicators computed live from budget, purchasing, funding, and supplier data.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <StatCard label="Budget" value={formatTaka(totals.budget)} hint="Approved total budget" icon={PiggyBank} tone="primary" />
      <StatCard label="Actual cost" value={formatTaka(totals.actual)} hint="Deliveries + contractor + labor payments" icon={Receipt} tone="accent" />
      <StatCard label="Committed cost" value={formatTaka(totals.committed)} hint="Open POs net of deliveries + contract balances" icon={ArrowDownCircle} tone="accent" />
      <StatCard label="Exposure" value={formatTaka(totals.exposure)} hint="Actual + committed" icon={Scale} tone={totals.exposure > totals.budget ? 'error' : 'primary'} />
      <StatCard label="Forecast final cost" value={formatTaka(totals.forecastFinal)} hint={totals.forecastBasis === 'progress' ? 'Based on phase progress' : totals.forecastBasis === 'exposure' ? 'Based on exposure' : 'Based on budget (no progress yet)'} icon={TrendingDown} tone={totals.expectedOverrun > 0 ? 'error' : 'primary'} />
      <StatCard label="Expected saving" value={formatTaka(totals.expectedSaving)} hint="Budget minus forecast" icon={TrendingUp} tone="primary" />
      <StatCard label="Expected overrun" value={formatTaka(totals.expectedOverrun)} hint="Forecast minus budget" icon={TrendingUp} tone={totals.expectedOverrun > 0 ? 'error' : 'accent'} />
      <StatCard label="Funding received" value={formatTaka(funding.fundingReceived)} hint="Confirmed receipts" icon={Banknote} tone="primary" />
      <StatCard label="Funding expected" value={formatTaka(funding.fundingExpected)} hint="Planned minus received" icon={Landmark} tone="accent" />
      <StatCard label="Risk-adjusted funding" value={formatTaka(funding.riskAdjustedFunding)} hint="Expected x probability" icon={Percent} tone="accent" />
      <StatCard label="Funding gap" value={formatTaka(funding.fundingGap)} hint="Budget minus received and risk-adjusted" icon={Landmark} tone={funding.fundingGap > 0 ? 'error' : 'primary'} />
      <StatCard label="Outstanding supplier liability" value={formatTaka(outstandingLiability)} hint="Unpaid invoice balances" icon={Receipt} tone={outstandingLiability > 0 ? 'error' : 'primary'} />
      <StatCard label="Open PO balance" value={formatTaka(openPOBalance)} hint="Issued POs not yet delivered" icon={ArrowDownCircle} tone={openPOBalance > 0 ? 'error' : 'accent'} />
      <StatCard label="Available cash" value={formatTaka(funding.availableCash)} hint="Current cash on hand" icon={Wallet} tone="primary" />
      <StatCard label="Contingency remaining" value={formatTaka(contingency.remaining)} hint={`${formatTaka(contingency.used)} of ${formatTaka(contingency.original)} used`} icon={Coins} tone={contingency.remaining < 0 ? 'error' : 'accent'} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Funding coverage" value={`${funding.fundingCoveragePercent.toFixed(1)}%`} hint="Received + risk-adjusted vs budget" icon={Percent} tone={funding.fundingCoveragePercent < 100 ? 'error' : 'accent'} />
      <StatCard label="Budget utilization" value={`${totals.budget > 0 ? ((totals.actual / totals.budget) * 100).toFixed(1) : '0.0'}%`} hint="Actual cost as share of budget" icon={Receipt} tone={totals.actual > totals.budget ? 'error' : 'accent'} />
      <StatCard label="Exposure vs budget" value={`${totals.budget > 0 ? ((totals.exposure / totals.budget) * 100).toFixed(1) : '0.0'}%`} hint="Actual + committed as share of budget" icon={AlertTriangle} tone={totals.exposure > totals.budget ? 'error' : 'accent'} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard label="Current Engineer" value={lineage?.engineerName ?? 'Not set'} hint="From active budget lineage" icon={HardHat} tone={lineage?.engineerName ? 'primary' : 'error'} />
      <StatCard label="Design Package" value={lineage?.packageName ?? 'Not set'} hint={lineage?.revisionLabel ?? 'No revision'} icon={Package} tone={lineage?.packageName ? 'primary' : 'error'} />
      <StatCard label="Current BOQ" value={lineage?.boqName ?? 'Not set'} hint="From active budget lineage" icon={Receipt} tone={lineage?.boqName ? 'primary' : 'error'} />
      <StatCard label="Current Contractor" value={contractor?.name ?? 'Not selected'} hint="Selected for this project" icon={HardHat} tone={contractor?.name ? 'primary' : 'error'} />
      <StatCard label="Primary Vendor" value={lineage?.vendorName ?? 'Not set'} hint="From active budget lineage" icon={Link2} tone={lineage?.vendorName ? 'primary' : 'error'} />
      <StatCard label="Lineage Status" value={lineage?.status ?? 'MISSING'} hint="Engineer + Package + BOQ + Contractor + Vendor" icon={Link2} tone={lineageTone as 'primary' | 'accent' | 'error'} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard label="Current Budget Version" value={active?.version_label ?? 'None'} hint={active ? (active.status === 'approved' ? 'Frozen' : active.status) : 'No active version'} icon={PiggyBank} tone={active ? 'primary' : 'error'} />
      <StatCard label="Last Revision Date" value={workspace.revisions.length > 0 ? formatDate(workspace.revisions[0].revision_date) : 'No revisions'} hint={workspace.revisions.length > 0 ? `R${workspace.revisions[0].revision_number}` : 'None yet'} icon={History} tone={workspace.revisions.length > 0 ? 'accent' : 'error'} />
      <StatCard label="Last Revision Trigger" value={workspace.revisions.length > 0 ? (workspace.revisions[0].trigger_type ? BUDGET_REVISION_TRIGGER_LABELS[workspace.revisions[0].trigger_type] ?? workspace.revisions[0].trigger_type : 'Other') : 'None'} hint="What caused the last budget change" icon={History} tone={workspace.revisions.length > 0 ? 'accent' : 'error'} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <StatCard label="Selection Date" value={contractor?.selectionDate ? formatDate(contractor.selectionDate) : 'Not set'} hint="When the contractor was selected" icon={CalendarDays} tone={contractor?.selectionDate ? 'primary' : 'error'} />
      <StatCard label="Contract Value" value={contractor && contractor.contractValue !== null ? formatTaka(contractor.contractValue) : 'Not set'} hint="Contract with the selected contractor" icon={Banknote} tone={contractor && contractor.contractValue !== null ? 'primary' : 'error'} />
      <StatCard label="Average Contractor Rate" value={contractor && contractor.averageRate !== null ? formatTaka(contractor.averageRate) : 'No rate schedule'} hint="Latest priced bid, per unit of area" icon={Gauge} tone={contractor && contractor.averageRate !== null ? 'primary' : 'accent'} />
      <StatCard label="Lowest Competing Bid" value={contractor && contractor.lowestCompetingBid !== null ? formatTaka(contractor.lowestCompetingBid) : 'No other bids'} hint="Lowest bid from other contractors" icon={TrendingDown} tone={contractor && contractor.lowestCompetingBid !== null ? 'accent' : 'error'} />
      <StatCard label="Selected Contractor Premium" value={contractor && contractor.potentialSaving !== null ? formatTaka(contractor.potentialSaving) : 'Not available'} hint="Lowest bid minus contract value" icon={TrendingUp} tone={contractor && contractor.potentialSaving !== null && contractor.potentialSaving < 0 ? 'error' : 'primary'} />
      <StatCard label="Contractor Status" value={contractor?.contractStatus ? formatLabel(contractor.contractStatus) : 'Not set'} hint="Status of the contract" icon={HardHat} tone={contractor?.contractStatus ? 'primary' : 'error'} />
      <StatCard label="Budget Contractor" value={lineage?.contractorName ?? 'Not linked'} hint="Contractor linked to the active budget" icon={Link2} tone={lineage?.contractorName ? 'primary' : 'error'} />
    </div>

    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm font-semibold text-stone-900">Lineage validation</p>
      {!lineage ? (
        <p className="mt-2 text-sm text-stone-500">No active budget version to check.</p>
      ) : activeWarnings.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">All lineage checks pass.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeWarnings.map((w) => <StatusBadge key={w.key} tone="warning">{w.label}</StatusBadge>)}
        </div>
      )}
    </div>
  </div>;
}
