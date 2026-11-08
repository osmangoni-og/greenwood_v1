import { formatDateTime } from '@/lib/format';
import { SIGNATORY_ROLES, type AuditAction, type AuditEventRow } from '@/lib/contractSignatures';

const ACTION_LABELS: Record<AuditAction, string> = {
  signatory_updated: 'Details updated',
  signature_captured: 'Signature captured',
  signature_uploaded: 'Signature uploaded',
  signature_cleared: 'Signature removed',
  contract_printed: 'Contract printed',
};

export function AuditTrailPanel({ events }: { events: AuditEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-stone-500">No activity recorded for this contract yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const roleLabel = SIGNATORY_ROLES.find((role) => role.key === event.role_key)?.label;
        const hash = typeof event.details.signature_hash === 'string' ? event.details.signature_hash : null;
        return (
          <li key={event.id} className="rounded-xl border border-stone-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-stone-800">{ACTION_LABELS[event.action]}</p>
              <time dateTime={event.created_at} className="shrink-0 text-xs text-stone-500">
                {formatDateTime(event.created_at)}
              </time>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              {roleLabel ? `${roleLabel}: ` : ''}
              {event.summary}
            </p>
            {hash && (
              <p className="mt-2 break-all font-mono text-[11px] text-stone-500" title="SHA-256 signature fingerprint">
                SHA-256 {hash}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
