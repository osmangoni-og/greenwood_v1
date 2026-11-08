import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar, type ProgressTone } from '@/components/ProgressBar';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadDataEntryReadiness, type DataEntryItem } from '@/lib/dataEntryReadiness';
import { fetchPrimaryProject } from '@/lib/projects';

async function loadData(): Promise<DataEntryItem[] | null> {
  const project = await fetchPrimaryProject();
  if (!project) return null;
  return loadDataEntryReadiness(project.id);
}

function statusFor(percent: number): { label: string; tone: BadgeTone; bar: ProgressTone } {
  if (percent >= 100) return { label: 'Complete', tone: 'success', bar: 'primary' };
  if (percent > 0) return { label: 'In progress', tone: 'warning', bar: 'warning' };
  return { label: 'Not started', tone: 'neutral', bar: 'error' };
}

export function DataEntryReadinessPage() {
  const { data, error, loading, reload } = useAsyncData(loadData);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState icon={ClipboardCheck} title="No project yet" description="Setup helpers appear once the project record exists." />;

  const overall = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.percent, 0) / data.length) : 0;
  const completed = data.filter((item) => item.percent >= 100).length;

  return <div className="space-y-6">
    <PageHeader title="Data Entry Readiness" description="Quick-start checklist for loading the project's first records. Each item completes when its records exist." />

    <Card>
      <CardHeader title="Setup completion" description={`${completed} of ${data.length} setup steps complete`} />
      <div className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold text-slate-900">{overall}%</span>
          <span className="text-sm text-slate-500">Overall completion</span>
        </div>
        <ProgressBar value={overall} tone="primary" label="Overall data entry completion" />
      </div>
    </Card>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.map((item, index) => {
        const status = statusFor(item.percent);
        return <Card key={item.key}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Step {index + 1}</p>
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
            </div>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          <div className="mt-4 space-y-2">
            <ProgressBar value={item.percent} tone={status.bar} label={`${item.title} completion`} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{item.count} of {item.target} recorded ({item.percent}%)</span>
              <a href={`#/${item.moduleId}`} className="inline-flex items-center gap-1 font-medium text-slate-900 transition-colors hover:text-slate-600">
                Open module <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
