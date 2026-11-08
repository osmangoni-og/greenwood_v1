import { Activity, Bell, Building2, FileText, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { ProgressBar, type ProgressTone } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadBudgetWorkspace, type BudgetWorkspace } from '@/lib/budget';
import { daysUntil, formatDate, formatDateTime, formatLabel, formatPercent, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase, unwrap } from '@/lib/supabase';
import type { ActivityLogRow, NotificationRow, ProjectRow } from '@/types/database';

interface DashboardData {
  project: ProjectRow | null;
  activity: ActivityLogRow[];
  alerts: NotificationRow[];
  documentCount: number;
  workspace: BudgetWorkspace | null;
}

async function loadDashboard(): Promise<DashboardData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, activity: [], alerts: [], documentCount: 0, workspace: null };

  const [activity, alerts, documents, workspace] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('notifications')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('documents').select('id').eq('project_id', project.id),
    loadBudgetWorkspace(project.id),
  ]);

  return {
    project,
    activity: unwrap<ActivityLogRow[]>(activity),
    alerts: unwrap<NotificationRow[]>(alerts),
    documentCount: unwrap<{ id: string }[]>(documents).length,
    workspace,
  };
}

function scheduleText(project: ProjectRow): string {
  if (project.construction_progress_pct >= 100) return 'Construction complete';
  if (!project.target_completion_date) return 'No target date set';
  const days = daysUntil(project.target_completion_date);
  if (days < 0) return `Overdue by ${Math.abs(days)} days`;
  if (days === 0) return 'Target is today';
  return `${days} days to target`;
}

export function DashboardPage() {
  const { data, error, loading, reload } = useAsyncData(loadDashboard);

  if (!data) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;
  if (loading && !data.project) return <LoadingState />;
  if (!data.project || !data.workspace) {
    return (
      <EmptyState
        icon={Building2}
        title="No project yet"
        description="Your bungalow project has not been set up. Once it exists, its budget, progress, and activity will appear here."
      />
    );
  }

  const { project, activity, alerts, documentCount, workspace } = data;
  const funding = workspace.fundingSummary;
  const spent = Number(project.amount_spent_bdt);
  const finance = {
    budget: funding.approvedBudget,
    secured: funding.fundingReceived,
    securedPct: funding.fundingReceivedPercent,
    fundingGap: funding.fundingGap,
    spent,
    spentPct: funding.approvedBudget > 0 ? (spent / funding.approvedBudget) * 100 : 0,
    remaining: funding.approvedBudget - spent,
    isOverBudget: spent > funding.approvedBudget,
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-primary-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-700/40" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary-200">{project.location}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
            <p className="mt-2 text-sm text-primary-100">{project.project_type}</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-sm font-medium ring-1 ring-inset ring-white/25">
            {formatLabel(project.phase)} phase
          </span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total budget" value={formatTaka(finance.budget)} hint="Planned construction cost" icon={Wallet} />
        <StatCard
          label="Funds secured"
          value={formatTaka(finance.secured)}
          hint={`${formatPercent(finance.securedPct)} of budget`}
          icon={Landmark}
        />
        <StatCard
          label="Amount spent"
          value={formatTaka(finance.spent)}
          hint={`${formatPercent(finance.spentPct)} of budget used`}
          icon={Receipt}
          tone={finance.isOverBudget ? 'error' : 'accent'}
        />
        <StatCard
          label="Remaining balance"
          value={formatTaka(finance.remaining)}
          hint={finance.fundingGap > 0 ? `Funding gap ${formatTaka(finance.fundingGap)}` : 'Fully funded'}
          icon={PiggyBank}
          tone={finance.remaining < 0 ? 'error' : 'primary'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Construction progress" description="Overall completion of the bungalow." />
            <div className="mt-5 flex items-end justify-between gap-4">
              <p className="text-4xl font-semibold tracking-tight text-stone-900">
                {project.construction_progress_pct}%
              </p>
              <p className="text-sm font-medium text-stone-600">{scheduleText(project)}</p>
            </div>
            <div className="mt-4">
              <ProgressBar value={project.construction_progress_pct} label="Construction progress" />
            </div>
            <dl className="mt-6 grid gap-4 border-t border-stone-100 pt-6 sm:grid-cols-3">
              <Detail label="Start date" value={project.start_date ? formatDate(project.start_date) : 'Not set'} />
              <Detail
                label="Target completion"
                value={project.target_completion_date ? formatDate(project.target_completion_date) : 'Not set'}
              />
              <Detail label="Current phase" value={formatLabel(project.phase)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Funding and spending" description="How the budget is covered and how much has been used." />
            <div className="mt-5 space-y-5">
              <BudgetBar label="Funds secured" amount={finance.secured} pct={finance.securedPct} tone="primary" />
              <BudgetBar
                label="Amount spent"
                amount={finance.spent}
                pct={finance.spentPct}
                tone={finance.isOverBudget ? 'error' : 'accent'}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Open alerts"
              action={<LinkButton href="#/notifications">View all</LinkButton>}
            />
            <div className="mt-4 space-y-3">
              {alerts.length === 0 && <p className="text-sm text-stone-500">No unread notifications.</p>}
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">{alert.title}</p>
                      {alert.message && <p className="mt-1 text-xs text-stone-500">{alert.message}</p>}
                      {alert.due_date && (
                        <p className="mt-2">
                          <StatusBadge tone="warning">Due {formatDate(alert.due_date)}</StatusBadge>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent activity" action={<LinkButton href="#/activity">View log</LinkButton>} />
            <ol className="mt-4 space-y-4">
              {activity.length === 0 && <li className="text-sm text-stone-500">No activity recorded yet.</li>}
              {activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm text-stone-800">{entry.summary}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{formatDateTime(entry.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Document repository" description={`${documentCount} document${documentCount === 1 ? '' : 's'} on file`} action={<LinkButton href="#/documents">Open</LinkButton>} />
            <div className="mt-4 flex items-center gap-3 text-sm text-stone-600">
              <FileText className="h-4 w-4 text-primary-600" aria-hidden />
              Legal, design, finance, permit, and build records
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function BudgetBar({ label, amount, pct, tone }: { label: string; amount: number; pct: number; tone: ProgressTone }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="text-stone-900">
          {formatTaka(amount)} <span className="text-stone-500">({formatPercent(pct)})</span>
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={pct} tone={tone} label={label} />
      </div>
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-sm font-medium text-primary-700 transition-colors hover:text-primary-900">
      {children}
    </a>
  );
}
