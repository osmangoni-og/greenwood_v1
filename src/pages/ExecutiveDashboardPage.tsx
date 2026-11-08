import { useState } from 'react';
import { Activity, Building2, Coins, Landmark, PiggyBank, Receipt, Scale, Users, Wallet } from 'lucide-react';
import { ErrorState, EmptyState, LoadingState } from '@/components/StatePanel';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { Tabs } from '@/components/Tabs';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatPercent, formatTaka } from '@/lib/format';
import { loadExecutiveDashboard, type ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { ExecutiveFinanceSection } from '@/pages/executive/ExecutiveFinanceSection';
import { ExecutiveOperationsSection } from '@/pages/executive/ExecutiveOperationsSection';
import { ExecutiveSalesSection } from '@/pages/executive/ExecutiveSalesSection';
import { ExecutiveRevisionSection } from '@/pages/executive/ExecutiveRevisionSection';
import { GreenwoodWidgetsPanel } from '@/pages/executive/GreenwoodWidgetsPanel';
import { GreenwoodSummaryPage } from '@/pages/GreenwoodSummaryPage';
import { FundingReadinessPage } from '@/pages/FundingReadinessPage';
import { ReadinessPage } from '@/pages/ReadinessPage';
import { ProcurementHealthPage } from '@/pages/ProcurementHealthPage';
import { FinancialHealthPage } from '@/pages/FinancialHealthPage';
import { SystemValidationPage } from '@/pages/SystemValidationPage';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'greenwood', label: 'Greenwood Summary' },
  { id: 'funding', label: 'Funding Readiness' },
  { id: 'readiness', label: 'Project Readiness' },
  { id: 'procurement', label: 'Procurement Health' },
  { id: 'financial', label: 'Financial Health' },
  { id: 'validation', label: 'System Validation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ExecutiveDashboardPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const { data, error, loading, reload } = useAsyncData(loadExecutiveDashboard);

  return (
    <div className="space-y-6">
      <Tabs items={TABS} activeId={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'overview' && (
        <>
          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !data ? (
            <EmptyState
              icon={Building2}
              title="No project yet"
              description="The executive view reads from your project records. Set up the project to see its figures here."
            />
          ) : (
            <>
              <Hero data={data} />
              <KpiGrid data={data} />
              <ExecutiveFinanceSection data={data} />
              <GreenwoodWidgetsPanel data={data} />
              <ExecutiveOperationsSection data={data} />
              <ExecutiveSalesSection data={data} />
              <ExecutiveRevisionSection data={data} />
            </>
          )}
        </>
      )}
      {tab === 'greenwood' && <GreenwoodSummaryPage />}
      {tab === 'funding' && <FundingReadinessPage />}
      {tab === 'readiness' && <ReadinessPage />}
      {tab === 'procurement' && <ProcurementHealthPage />}
      {tab === 'financial' && <FinancialHealthPage />}
      {tab === 'validation' && <SystemValidationPage />}
    </div>
  );
}

function Hero({ data }: { data: ExecutiveDashboardData }) {
  const { project, phases } = data;
  const completed = phases.filter((phase) => phase.actual_date !== null).length;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-stone-900 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-700/30" aria-hidden />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-200">Executive dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
          <p className="mt-2 text-sm text-stone-300">{project.location}</p>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Overall progress</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{project.construction_progress_pct}%</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Phases handed over</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {completed}
              <span className="text-lg text-stone-400">/{phases.length}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="relative mt-6">
        <ProgressBar value={project.construction_progress_pct} label="Overall construction progress" tone="accent" />
      </div>
    </section>
  );
}

function KpiGrid({ data }: { data: ExecutiveDashboardData }) {
  const { budget, funding, assetProgress, contractorCount } = data;
  const spent = budget.spent;
  const assetPct = assetProgress.totalCount > 0 ? (assetProgress.soldCount / assetProgress.totalCount) * 100 : 0;
  const gap = funding.fundingGap;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Budget used" value={formatPercent(budget.spentPct)} hint={`${formatTaka(spent)} of ${formatTaka(budget.budget)}`} icon={Receipt} tone={budget.isOverBudget ? 'error' : 'accent'} />
      <StatCard label="Funding received" value={formatTaka(funding.fundingReceived)} hint={`${formatTaka(funding.fundingPlanned)} planned`} icon={Landmark} />
      <StatCard label="Funding gap" value={formatTaka(gap)} hint={gap > 0 ? 'Still to be secured' : 'Fully covered'} icon={Scale} tone={gap > 0 ? 'error' : 'primary'} />
      <StatCard label="Cash available" value={formatTaka(funding.availableCash)} hint={`${formatTaka(funding.expectedCash)} expected`} icon={PiggyBank} />
      <StatCard label="Contractor balance" value={formatTaka(data.contractorCommitted)} hint={`${contractorCount} contract${contractorCount === 1 ? '' : 's'}, payments not tracked`} icon={Users} />
      <StatCard label="Vendor balance" value={formatTaka(data.vendorBalance)} hint={`${formatTaka(data.vendorDeposits)} deposited to vendors`} icon={Wallet} tone={data.vendorBalance < 0 ? 'error' : 'primary'} />
      <StatCard label="Asset sale progress" value={formatPercent(assetPct)} hint={`${assetProgress.soldCount} of ${assetProgress.totalCount} assets sold`} icon={Coins} />
      <StatCard label="Open issues" value={String(data.openDefects.length + data.delayedPhases.length)} hint={`${data.openDefects.length} defects, ${data.delayedPhases.length} delayed phases`} icon={Activity} tone={data.openDefects.length > 0 ? 'error' : 'primary'} />
    </div>
  );
}
