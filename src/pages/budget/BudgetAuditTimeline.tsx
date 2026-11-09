import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/StatePanel';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime, formatLabel } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import type { ActivityLogRow } from '@/types/database';

interface Props {
  projectId: string;
}

const BUDGET_ENTITY_TYPES = ['budget_version', 'budget_revision', 'budget_cost', 'budget_contingency', 'funding_dependency'];

export function BudgetAuditTimeline({ projectId }: Props) {
  const [logs, setLogs] = useState<ActivityLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await supabase
          .from('activity_logs')
          .select('*')
          .eq('project_id', projectId)
          .in('entity_type', BUDGET_ENTITY_TYPES)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!cancelled) setLogs(unwrap<ActivityLogRow[]>(result));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the audit timeline.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  return <Card>
    <CardHeader title="Budget audit timeline" description="Every change to budget versions, revisions, costs, contingency and funding, newest first." />
    {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {!error && logs === null && <p className="mt-4 text-sm text-stone-500">Loading timeline...</p>}
    {logs !== null && logs.length === 0 && <div className="mt-4"><EmptyState icon={History} title="No budget activity yet" description="Changes to budget versions, costs and funding will appear here." /></div>}
    {logs !== null && logs.length > 0 && (
      <ol className="mt-4 divide-y divide-stone-100">
        {logs.map((log) => <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-medium text-stone-800">{log.summary}</p>
            <p className="text-xs text-stone-500">{formatDateTime(log.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge tone="neutral">{formatLabel(log.entity_type)}</StatusBadge>
            <StatusBadge tone="info">{log.action}</StatusBadge>
          </div>
        </li>)}
      </ol>
    )}
  </Card>;
}
