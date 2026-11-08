import { useState } from 'react';
import { CheckCircle2, FileText, Mail, Pencil, Phone, Plus, Stamp, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { EngineerFormModal } from '@/pages/design/EngineerFormModal';
import { PackageFormModal } from '@/pages/design/PackageFormModal';
import { useAsyncData } from '@/hooks/useAsyncData';
import { applyDesignPackageAction, fetchEngineeringData, getAvailablePackageActions, type PackageAction } from '@/lib/engineering';
import { DESIGN_PACKAGE_STATUS_LABELS, type DesignPackageRow, type DesignPackageStatus, type EngineerRow } from '@/types/engineering';

interface EngineersPanelProps {
  projectId: string;
}

const PACKAGE_TONE: Record<DesignPackageStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  selected: 'primary',
  approved: 'success',
  accepted: 'success',
  rejected: 'error',
  superseded: 'warning',
};

const PACKAGE_ACTION_LABELS: Record<PackageAction, string> = { select: 'Select', approve: 'Approve', accept: 'Accept', reject: 'Reject' };

export function EngineersPanel({ projectId }: EngineersPanelProps) {
  const { data, error, loading, reload } = useAsyncData(() => fetchEngineeringData(projectId), [projectId]);
  const [engineerForm, setEngineerForm] = useState<EngineerRow | null | undefined>(undefined);
  const [packageForm, setPackageForm] = useState<{ pkg: DesignPackageRow | null; engineerId: string | null } | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runPackageAction(pkg: DesignPackageRow, action: PackageAction) {
    setActionBusyKey(`${pkg.id}:${action}`);
    setActionError(null);
    try {
      await applyDesignPackageAction(projectId, pkg, action);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The package could not be updated.');
    } finally {
      setActionBusyKey(null);
    }
  }

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { engineers, packages } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Every design package belongs to one engineer. Drawings and BOQs are grouped under a package.</p>
        <Button onClick={() => setEngineerForm(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add engineer
        </Button>
      </div>
      {actionError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}

      {engineers.length === 0 ? (
        <EmptyState
          icon={Stamp}
          title="No engineers yet"
          description="Add the engineer who prepares the design. Each design package is owned by an engineer."
          action={
            <Button onClick={() => setEngineerForm(null)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add engineer
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {engineers.map((engineer) => {
            const engineerPackages = packages.filter((pkg) => pkg.engineer_id === engineer.id);
            return (
              <section key={engineer.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-stone-900">{engineer.name}</h3>
                    <p className="text-sm text-stone-500">{engineer.firm ?? 'Firm not recorded'}</p>
                  </div>
                  <Button variant="ghost" className="p-2" aria-label={`Edit ${engineer.name}`} onClick={() => setEngineerForm(engineer)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500">
                  {engineer.license_number && <span>License {engineer.license_number}</span>}
                  {engineer.mobile && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {engineer.mobile}
                    </span>
                  )}
                  {engineer.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {engineer.email}
                    </span>
                  )}
                </div>

                <div className="mt-5 border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Design packages</p>
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setPackageForm({ pkg: null, engineerId: engineer.id })}>
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      New package
                    </Button>
                  </div>
                  {engineerPackages.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">No design packages for this engineer yet.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-stone-100">
                      {engineerPackages.map((pkg) => (
                        <li key={pkg.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                            <span className="truncate text-sm font-medium text-stone-800">{pkg.name}</span>
                            <span className="text-xs text-stone-500">{pkg.revision_label}</span>
                            <StatusBadge tone={PACKAGE_TONE[pkg.status]}>{DESIGN_PACKAGE_STATUS_LABELS[pkg.status]}</StatusBadge>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getAvailablePackageActions(pkg.status).map((action) => (
                              <Button
                                key={action}
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                disabled={actionBusyKey !== null}
                                onClick={() => runPackageAction(pkg, action)}
                              >
                                {action === 'reject' ? <XCircle className="h-3 w-3" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
                                {PACKAGE_ACTION_LABELS[action]}
                              </Button>
                            ))}
                            <Button variant="ghost" className="p-1.5" aria-label={`Edit ${pkg.name}`} onClick={() => setPackageForm({ pkg, engineerId: engineer.id })}>
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {engineerForm !== undefined && (
        <EngineerFormModal
          projectId={projectId}
          engineer={engineerForm}
          onClose={() => setEngineerForm(undefined)}
          onSaved={() => {
            setEngineerForm(undefined);
            reload();
          }}
        />
      )}
      {packageForm && (
        <PackageFormModal
          projectId={projectId}
          engineers={engineers}
          defaultEngineerId={packageForm.engineerId}
          pkg={packageForm.pkg}
          onClose={() => setPackageForm(null)}
          onSaved={() => {
            setPackageForm(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
