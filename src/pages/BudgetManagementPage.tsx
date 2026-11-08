import { useState } from 'react';
import { PiggyBank } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { fetchPrimaryProject } from '@/lib/projects';
import type { ProjectRow } from '@/types/database';
import { BudgetOverview } from '@/pages/budget/BudgetOverview';
import { BudgetVersionsPanel } from '@/pages/budget/BudgetVersionsPanel';
import { ContingencyPanel } from '@/pages/budget/ContingencyPanel';
import { PurchasingPanel } from '@/pages/budget/PurchasingPanel';
import { SupplierLedgerPanel } from '@/pages/budget/SupplierLedgerPanel';
import { FundingPanel } from '@/pages/budget/FundingPanel';
import { CommandCenterPanel } from '@/pages/budget/CommandCenterPanel';
import { BudgetChartsPanel } from '@/pages/budget/BudgetChartsPanel';
import { CashFlowForecastPanel } from '@/pages/budget/CashFlowForecastPanel';

type BudgetTab = 'overview' | 'command' | 'versions' | 'contingency' | 'purchasing' | 'suppliers' | 'funding' | 'charts' | 'cashflow';

interface BudgetPageData {
  project: ProjectRow | null;
  workspace: BudgetWorkspace | null;
}

async function loadBudgetPage(): Promise<BudgetPageData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, workspace: null };
  return { project, workspace: await loadBudgetWorkspace(project.id) };
}

const TABS: { id: BudgetTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'command', label: 'Command Center' },
  { id: 'versions', label: 'Versions & Revisions' },
  { id: 'contingency', label: 'Contingency' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'suppliers', label: 'Supplier Ledger' },
  { id: 'funding', label: 'Funding' },
  { id: 'charts', label: 'Charts' },
  { id: 'cashflow', label: 'Cash Flow' },
];

export function BudgetManagementPage() {
  const { data, error, loading, reload } = useAsyncData(loadBudgetPage);
  const [tab, setTab] = useState<BudgetTab>('overview');

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project || !data.workspace) {
    return <EmptyState icon={PiggyBank} title="No project yet" description="The budget belongs to the project. Create the project first." />;
  }

  const { project, workspace } = data;

  return <div className="space-y-6">
    <PageHeader title="Budget Management" description="Versioned project budget with approvals, automatic actual costs, contingency tracking, and forecasts." />
    <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-px">
      {TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={tab === item.id ? 'shrink-0 border-b-2 border-primary-700 px-4 py-2.5 text-sm font-medium text-primary-800' : 'shrink-0 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-800'}>{item.label}</button>)}
    </div>
    {tab === 'overview' && <BudgetOverview workspace={workspace} />}
    {tab === 'command' && <CommandCenterPanel workspace={workspace} />}
    {tab === 'versions' && <BudgetVersionsPanel projectId={project.id} workspace={workspace} onChanged={reload} />}
    {tab === 'contingency' && <ContingencyPanel projectId={project.id} workspace={workspace} onChanged={reload} />}
    {tab === 'purchasing' && <PurchasingPanel projectId={project.id} workspace={workspace} onChanged={reload} />}
    {tab === 'suppliers' && <SupplierLedgerPanel projectId={project.id} workspace={workspace} onChanged={reload} />}
    {tab === 'funding' && <FundingPanel projectId={project.id} workspace={workspace} onChanged={reload} />}
    {tab === 'charts' && <BudgetChartsPanel workspace={workspace} />}
    {tab === 'cashflow' && <CashFlowForecastPanel workspace={workspace} />}
  </div>;
}
