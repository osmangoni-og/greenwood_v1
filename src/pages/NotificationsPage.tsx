import { useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, Plus, Trash2, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { NotificationFormModal } from '@/pages/notifications/NotificationFormModal';
import { useAsyncData } from '@/hooks/useAsyncData';
import { cx } from '@/lib/cx';
import { formatDate, formatDateTime, formatLabel } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase, unwrap } from '@/lib/supabase';
import type { NotificationRow, NotificationSeverity, ProjectRow } from '@/types/database';

interface NotificationsData {
  project: ProjectRow | null;
  notifications: NotificationRow[];
}

async function loadNotifications(): Promise<NotificationsData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, notifications: [] };
  const notifications = unwrap<NotificationRow[]>(
    await supabase
      .from('notifications')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(200),
  );
  return { project, notifications };
}

const SEVERITY_META: Record<NotificationSeverity, { icon: LucideIcon; tone: BadgeTone; iconClass: string }> = {
  info: { icon: Info, tone: 'info', iconClass: 'text-sky-600 bg-sky-50' },
  success: { icon: CheckCircle2, tone: 'success', iconClass: 'text-emerald-600 bg-emerald-50' },
  warning: { icon: AlertTriangle, tone: 'warning', iconClass: 'text-amber-600 bg-amber-50' },
  error: { icon: XCircle, tone: 'error', iconClass: 'text-rose-600 bg-rose-50' },
};

export function NotificationsPage() {
  const { data, error, loading, reload } = useAsyncData(loadNotifications);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;
  if (loading && !data.project) return <LoadingState />;
  if (!data.project) {
    return <EmptyState icon={Bell} title="No project yet" description="Notifications belong to the project. Create the project first." />;
  }

  const projectId = data.project.id;
  const { notifications } = data;
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const visible = unreadOnly ? notifications.filter((item) => !item.is_read) : notifications;

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setActionError(null);
    const { error: actionErr } = await action();
    setBusy(false);
    if (actionErr) {
      setActionError(actionErr.message);
      return;
    }
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Budget alerts and reminders for the project, newest first."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => run(() => supabase.from('notifications').update({ is_read: true }).eq('project_id', projectId).eq('is_read', false))} disabled={busy || unreadCount === 0}>
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark all as read
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New reminder
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter notifications">
        <button
          type="button"
          aria-pressed={!unreadOnly}
          onClick={() => setUnreadOnly(false)}
          className={cx('rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors', !unreadOnly ? 'bg-primary-700 text-white ring-primary-700' : 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-50')}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly(true)}
          className={cx('rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors', unreadOnly ? 'bg-primary-700 text-white ring-primary-700' : 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-50')}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {actionError && <ErrorState message={actionError} />}

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Budget alerts and reminders you create will appear here." />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          You have no unread notifications.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => {
            const meta = SEVERITY_META[item.severity];
            const Icon = meta.icon;
            return (
              <li
                key={item.id}
                className={cx(
                  'flex gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-colors',
                  item.is_read ? 'border-stone-200' : 'border-primary-200 ring-1 ring-primary-100',
                )}
              >
                <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.iconClass)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.is_read && <span className="h-2 w-2 rounded-full bg-primary-600" aria-label="Unread" />}
                    <h3 className={cx('text-sm', item.is_read ? 'font-medium text-stone-800' : 'font-semibold text-stone-900')}>{item.title}</h3>
                    <StatusBadge tone={meta.tone}>{formatLabel(item.severity)}</StatusBadge>
                  </div>
                  {item.message && <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{item.message}</p>}
                  <p className="mt-2 text-xs text-stone-500">
                    {formatDateTime(item.created_at)}
                    {item.due_date && <> &middot; Due {formatDate(item.due_date)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => run(() => supabase.from('notifications').update({ is_read: !item.is_read }).eq('id', item.id))}
                  >
                    {item.is_read ? 'Mark unread' : 'Mark read'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="p-2 hover:text-rose-700"
                    aria-label={`Delete ${item.title}`}
                    disabled={busy}
                    onClick={() => run(() => supabase.from('notifications').delete().eq('id', item.id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <NotificationFormModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
