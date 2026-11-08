import { useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { inputClassName } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { PreferencesCard } from '@/pages/settings/PreferencesCard';
import { UserFormModal } from '@/pages/settings/UserFormModal';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getActiveUserId, setActiveUserId } from '@/lib/activeUser';
import { formatLabel, initialsOf } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchSettings, readBudgetAlertThreshold } from '@/lib/settings';
import { supabase, unwrap } from '@/lib/supabase';
import type { ProjectRow, UserRow } from '@/types/database';

interface UserSettingsData {
  project: ProjectRow | null;
  users: UserRow[];
  threshold: number;
}

async function loadUserSettings(): Promise<UserSettingsData> {
  const [project, users, settings] = await Promise.all([
    fetchPrimaryProject(),
    supabase.from('users').select('*').order('created_at', { ascending: true }),
    fetchSettings(),
  ]);
  return {
    project,
    users: unwrap<UserRow[]>(users),
    threshold: readBudgetAlertThreshold(settings),
  };
}

export function UserSettingsPage() {
  const { data, error, reload } = useAsyncData(loadUserSettings);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveUserId());
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);

  if (!data) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;

  const { project, users, threshold } = data;
  const projectId = project?.id ?? null;
  const selectableUsers = users.filter((user) => user.is_active || user.id === activeId);

  function handleActiveUserChange(nextId: string) {
    const value = nextId || null;
    setActiveUserId(value);
    setActiveId(value);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="User settings" description="Manage who is using this device, your team, and budget preferences." />

      <Card>
        <CardHeader
          title="Acting as"
          description="Choose who you are on this device. Changes you make are recorded under this name in the activity log."
        />
        <div className="mt-6 max-w-sm">
          <label htmlFor="active-user" className="mb-1.5 block text-sm font-medium text-stone-700">
            Current user
          </label>
          <select
            id="active-user"
            className={inputClassName}
            value={activeId ?? ''}
            onChange={(e) => handleActiveUserChange(e.target.value)}
          >
            <option value="">Not set</option>
            {selectableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({formatLabel(user.role)})
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Team members"
          description="Owners, engineers, contractors, and others involved in the project."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add member
            </Button>
          }
        />
        {users.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={Users} title="No team members" description="Add the people who work on this project." />
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-stone-100">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800">
                  {initialsOf(user.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-stone-900">{user.full_name}</p>
                    <StatusBadge tone="primary">{formatLabel(user.role)}</StatusBadge>
                    {!user.is_active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {[user.email, user.phone].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                </div>
                <Button variant="ghost" className="p-2" aria-label={`Edit ${user.full_name}`} onClick={() => setEditing(user)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PreferencesCard
        key={threshold}
        projectId={projectId}
        threshold={threshold}
        onSaved={reload}
      />

      {creating && (
        <UserFormModal
          projectId={projectId}
          user={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {editing && (
        <UserFormModal
          projectId={projectId}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
