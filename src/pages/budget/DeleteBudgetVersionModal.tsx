import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { recordActivity } from '@/lib/activity';
import { formatTaka } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { BudgetVersionRow } from '@/types/database';

export interface BudgetVersionDeleteSummary {
  lineCount: number;
  revisionCount: number;
  total: number;
  latestImpact: string | null;
}

interface Props {
  projectId: string;
  version: BudgetVersionRow;
  summary: BudgetVersionDeleteSummary;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteBudgetVersionModal({ projectId, version, summary, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('delete_budget_version', { p_version_id: version.id });
      if (rpcError) throw new Error(rpcError.message);
      await recordActivity({
        projectId,
        action: 'delete',
        entityType: 'budget_version',
        entityId: version.id,
        summary: `Deleted ${version.version_label} (${version.status}, total ${formatTaka(summary.total)}) with ${summary.lineCount} budget lines and ${summary.revisionCount} revision records`,
      });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This budget version could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Version number', value: `${version.version_number} (${version.version_label})` },
    { label: 'Status', value: version.is_active ? `${version.status} (active)` : version.status },
    { label: 'Budget lines', value: String(summary.lineCount) },
    { label: 'Total budget', value: formatTaka(summary.total) },
    { label: 'Revision records', value: String(summary.revisionCount) },
    { label: 'Impact summary', value: summary.latestImpact ?? 'No impact recorded' },
  ];

  return (
    <Modal
      open
      title="Delete Budget Version"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={confirmDelete} disabled={busy} className="bg-rose-700 hover:bg-rose-800">
            {busy ? 'Deleting...' : 'Delete budget version'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          This permanently removes this budget version, its budget lines, its revision history and its impact records. This cannot be undone.
        </p>
        {version.is_active && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            This is the active budget. The project will have no active budget until another budget is approved.
          </p>
        )}
        <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="text-stone-500">{row.label}</dt>
              <dd className="text-right font-medium text-stone-900">{row.value}</dd>
            </div>
          ))}
        </dl>
        <FormError message={error} />
      </div>
    </Modal>
  );
}
