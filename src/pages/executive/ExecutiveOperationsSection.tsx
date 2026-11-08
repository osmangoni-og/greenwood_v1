import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/format';
import type { ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { SectionCard } from '@/pages/executive/SectionCard';

export function ExecutiveOperationsSection({ data }: { data: ExecutiveDashboardData }) {
  const { phases, milestones, delayedPhases, openDefects, recentDocuments } = data;
  const criticalDefects = openDefects.filter((defect) => defect.severity === 'high' || defect.severity === 'critical');
  const issuePhases = phases.filter((phase) => phase.issues && phase.issues.trim().length > 0);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <SectionCard title="Construction timeline" description="Planned and actual dates with progress for each phase.">
          <ol className="space-y-4">
            {phases.map((phase) => (
              <li key={phase.id} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {phase.sequence_number}. {phase.phase_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    Plan {phase.planned_date ? formatDate(phase.planned_date) : '—'} · Actual {phase.actual_date ? formatDate(phase.actual_date) : '—'}
                  </p>
                </div>
                <ProgressBar value={phase.progress_percent} label={`${phase.phase_name} progress`} tone={phase.actual_date ? 'primary' : 'accent'} />
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      <SectionCard title="Upcoming milestones" description="Phases not yet marked complete, in planned order.">
        {milestones.length === 0 ? (
          <p className="text-sm text-stone-500">No open milestones with a planned date.</p>
        ) : (
          <ul className="space-y-3">
            {milestones.map((phase) => (
              <li key={phase.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                <span className="min-w-0 truncate text-sm font-medium text-stone-900">{phase.phase_name}</span>
                <StatusBadge tone="neutral">{phase.planned_date ? formatDate(phase.planned_date) : 'No date'}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Open risks" description="Delayed phases and high or critical open defects.">
        <ul className="space-y-3">
          {delayedPhases.map((phase) => (
            <li key={phase.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-sm font-medium text-stone-900">Delay: {phase.phase_name}</p>
              <p className="mt-1 text-xs text-stone-600">{phase.delays}</p>
            </li>
          ))}
          {criticalDefects.map((defect) => (
            <li key={defect.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <p className="text-sm font-medium text-stone-900">{defect.description}</p>
              <p className="mt-1 text-xs text-stone-600">
                {defect.inspection_type} · {defect.location ?? 'No location'} · {defect.severity}
              </p>
            </li>
          ))}
          {delayedPhases.length === 0 && criticalDefects.length === 0 && <li className="text-sm text-stone-500">No open risks.</li>}
        </ul>
      </SectionCard>

      <SectionCard title="Open issues" description="Unresolved quality defects and phase issues.">
        <ul className="space-y-3">
          {openDefects.map((defect) => (
            <li key={defect.id} className="rounded-xl border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm text-stone-900">{defect.description}</p>
                <StatusBadge tone={defect.status === 'in_progress' ? 'warning' : 'error'}>{defect.status === 'in_progress' ? 'In progress' : 'Open'}</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {defect.inspection_type} inspection{defect.due_date ? ` · due ${formatDate(defect.due_date)}` : ''}
              </p>
            </li>
          ))}
          {issuePhases.map((phase) => (
            <li key={phase.id} className="rounded-xl border border-stone-200 p-3">
              <p className="text-sm font-medium text-stone-900">{phase.phase_name}</p>
              <p className="mt-1 text-xs text-stone-600">{phase.issues}</p>
            </li>
          ))}
          {openDefects.length === 0 && issuePhases.length === 0 && <li className="text-sm text-stone-500">No open issues.</li>}
        </ul>
      </SectionCard>

      <SectionCard title="Recent documents" description="The five most recently added project documents.">
        {recentDocuments.length === 0 ? (
          <p className="text-sm text-stone-500">No documents on file yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recentDocuments.map((doc) => (
              <li key={doc.id} className="py-3">
                <p className="truncate text-sm font-medium text-stone-900">{doc.title}</p>
                <p className="mt-0.5 text-xs capitalize text-stone-500">
                  {doc.category} · {formatDate(doc.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
