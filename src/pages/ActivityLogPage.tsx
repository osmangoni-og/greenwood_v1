import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { inputClassName } from '@/components/FormField';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatDateTime, formatLabel } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase, unwrap } from '@/lib/supabase';
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityLogRow, type ProjectRow } from '@/types/database';

interface ActivityData {
  project: ProjectRow | null;
  logs: ActivityLogRow[];
  userNames: Record<string, string>;
}

async function loadActivity(): Promise<ActivityData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, logs: [], userNames: {} };

  const [logs, users] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('users').select('id, full_name'),
  ]);

  const userRows = unwrap<{ id: string; full_name: string }[]>(users);
  return {
    project,
    logs: unwrap<ActivityLogRow[]>(logs),
    userNames: Object.fromEntries(userRows.map((user) => [user.id, user.full_name])),
  };
}

const ACTION_TONE: Record<ActivityAction, BadgeTone> = {
  create: 'success',
  update: 'info',
  delete: 'error',
  status_change: 'accent',
  note: 'neutral',
};

export function ActivityLogPage() {
  const { data, error, loading, reload } = useAsyncData(loadActivity);
  const [actionFilter, setActionFilter] = useState<'all' | ActivityAction>('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const logs = useMemo(() => data?.logs ?? [], [data]);
  const moduleOptions = useMemo(() => [...new Set(logs.map((log) => log.entity_type))].sort(), [logs]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (moduleFilter !== 'all' && log.entity_type !== moduleFilter) return false;
      return !term || log.summary.toLowerCase().includes(term);
    });
  }, [logs, actionFilter, moduleFilter, search]);

  if (!data) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;
  if (loading && !data.project) return <LoadingState />;
  if (!data.project) {
    return <EmptyState icon={Activity} title="No project yet" description="Activity is recorded against the project. Create the project first." />;
  }

  const { userNames } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="A running record of every change made to the project, newest first."
      />

      <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search summaries" className={inputClassName} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Action</span>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as 'all' | ActivityAction)} className={inputClassName}>
            <option value="all">All actions</option>
            {ACTIVITY_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {formatLabel(action)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium uppercase tracking-wide text-stone-500">Module</span>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={inputClassName}>
            <option value="all">All modules</option>
            {moduleOptions.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Changes to the project, documents, team, and settings will be listed here." />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          No entries match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-5 py-3">When</th>
                <th scope="col" className="px-5 py-3">Action</th>
                <th scope="col" className="px-5 py-3">Module</th>
                <th scope="col" className="px-5 py-3">Summary</th>
                <th scope="col" className="px-5 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-stone-50">
                  <td className="whitespace-nowrap px-5 py-3.5 text-stone-600">{formatDateTime(log.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge tone={ACTION_TONE[log.action]}>{formatLabel(log.action)}</StatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-stone-700">{formatLabel(log.entity_type)}</td>
                  <td className="px-5 py-3.5 text-stone-900">{log.summary}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-stone-600">
                    {log.created_by ? (userNames[log.created_by] ?? 'Former member') : 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
