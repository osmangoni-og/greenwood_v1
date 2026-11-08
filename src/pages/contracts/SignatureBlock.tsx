import { SIGNATORY_ROLES, type SignatoryRow, type SignatoryRoleKey } from '@/lib/contractSignatures';
import { formatDate } from '@/lib/format';

interface SignatureBlockProps {
  signatories: Record<SignatoryRoleKey, SignatoryRow>;
}

export function SignatureBlock({ signatories }: SignatureBlockProps) {
  return (
    <section className="mt-10">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-stone-800">Signatures</h3>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {SIGNATORY_ROLES.map(({ key, label }) => (
          <SignatureCard key={key} label={label} row={signatories[key]} />
        ))}
      </div>
    </section>
  );
}

function SignatureCard({ label, row }: { label: string; row: SignatoryRow }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-stone-200 p-4 print:border-stone-400">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-600">{label}</p>
      <div className="mt-3 flex h-16 items-end justify-center border-b border-stone-800">
        {row.signature_image ? (
          <img src={row.signature_image} alt={`${label} signature`} className="max-h-14 max-w-full object-contain" />
        ) : (
          <span className="pb-1 text-xs text-stone-300">Signature</span>
        )}
      </div>
      <dl className="mt-3 space-y-1 text-xs text-stone-700">
        <Line term="Name" value={row.full_name} />
        <Line term="Address" value={row.address} />
        <Line term="NID" value={row.nid_number} />
        <Line term="Mobile" value={row.mobile_number} />
        <Line term="Signed on" value={row.signed_at ? formatDate(row.signed_at) : null} />
      </dl>
    </div>
  );
}

function Line({ term, value }: { term: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-stone-500">{term}</dt>
      <dd className="min-w-0 break-words font-medium">{value || '—'}</dd>
    </div>
  );
}
