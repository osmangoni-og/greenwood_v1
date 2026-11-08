import { useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { StatusBadge } from '@/components/StatusBadge';
import {
  SIGNATORY_ROLES,
  getSignatureStatus,
  type SignatoryRow,
  type SignatoryRoleKey,
  type SignatureStatus,
} from '@/lib/contractSignatures';
import { SignatoryEditor } from '@/pages/contracts/SignatoryEditor';

const STATUS_META: Record<SignatureStatus, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  empty: { label: 'Not added', tone: 'neutral' },
  pending: { label: 'Awaiting signature', tone: 'warning' },
  signed: { label: 'Signed', tone: 'success' },
};

interface SignatoriesModalProps {
  signatories: Record<SignatoryRoleKey, SignatoryRow>;
  onClose: () => void;
  onChanged: () => void;
}

export function SignatoriesModal({ signatories, onClose, onChanged }: SignatoriesModalProps) {
  const [editing, setEditing] = useState<SignatoryRoleKey | null>(null);

  if (editing) {
    const role = SIGNATORY_ROLES.find((item) => item.key === editing);
    if (!role) return null;
    return (
      <SignatoryEditor
        label={role.label}
        existing={signatories[editing]}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    );
  }

  return (
    <Modal open title="Signatures" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="mb-4 text-sm text-stone-600">
        Record each party's details and signature. Every change is written to the audit trail.
      </p>
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
        {SIGNATORY_ROLES.map(({ key, label }) => {
          const row = signatories[key];
          const meta = STATUS_META[getSignatureStatus(row)];
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">{label}</p>
                <p className="truncate text-xs text-stone-500">{row.full_name ?? 'No details added yet'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                <Button variant="secondary" onClick={() => setEditing(key)}>
                  {row.full_name ? 'Edit' : 'Add'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
