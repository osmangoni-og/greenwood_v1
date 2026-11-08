import { useCallback, useState } from 'react';
import { History, PenLine, Pencil, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { fetchContractVersions } from '@/lib/contracts';
import { getActiveUserId } from '@/lib/activeUser';
import { getContractDocument } from '@/lib/contractTemplates';
import {
  fetchAuditEvents,
  fetchSignatories,
  indexSignatories,
  recordAuditEvent,
} from '@/lib/contractSignatures';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatDate } from '@/lib/format';
import type { ContractLanguage, ContractRow } from '@/types/database';
import { AuditTrailPanel } from '@/pages/contracts/AuditTrailPanel';
import { SignatureBlock } from '@/pages/contracts/SignatureBlock';
import { SignatoriesModal } from '@/pages/contracts/SignatoriesModal';

type SidePanel = 'versions' | 'audit';

interface ContractViewerProps {
  contract: ContractRow;
  onClose: () => void;
  onEdit: () => void;
}

export function ContractViewer({ contract, onClose, onEdit }: ContractViewerProps) {
  const [language, setLanguage] = useState<ContractLanguage>(contract.language);
  const [panel, setPanel] = useState<SidePanel | null>(null);
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  const loadVersions = useCallback(() => fetchContractVersions(contract.id), [contract.id]);
  const loadSignatories = useCallback(async () => indexSignatories(contract.id, await fetchSignatories(contract.id)), [contract.id]);
  const loadAudit = useCallback(() => fetchAuditEvents(contract.id), [contract.id]);

  const versions = useAsyncData(loadVersions);
  const signatures = useAsyncData(loadSignatories);
  const audit = useAsyncData(loadAudit);

  const document = getContractDocument(contract, language);
  const signatoryMap = signatures.data ?? indexSignatories(contract.id, []);

  function togglePanel(target: SidePanel) {
    setPanel((current) => (current === target ? null : target));
  }

  function print() {
    void recordAuditEvent({
      contractId: contract.id,
      action: 'contract_printed',
      summary: `Printed the ${language} version`,
      details: { language },
      createdBy: getActiveUserId(),
    });
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/50 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl rounded-2xl bg-stone-100 shadow-2xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-6 py-4 print:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Contract preview</p>
            <h2 className="text-lg font-semibold text-stone-900">{contract.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Contract language"
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContractLanguage)}
            >
              <option value="english">English</option>
              <option value="bangla">Bangla</option>
              <option value="bilingual">Bilingual</option>
            </select>
            <Button variant="secondary" onClick={() => togglePanel('versions')}>
              <History className="h-4 w-4" aria-hidden /> Versions
            </Button>
            <Button variant="secondary" onClick={() => togglePanel('audit')}>
              <ShieldCheck className="h-4 w-4" aria-hidden /> Audit trail
            </Button>
            <Button variant="secondary" onClick={() => setSignaturesOpen(true)}>
              <PenLine className="h-4 w-4" aria-hidden /> Signatures
            </Button>
            <Button variant="secondary" onClick={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
            <Button variant="secondary" onClick={print}>
              <Printer className="h-4 w-4" aria-hidden /> Print / PDF
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
          <article className="min-h-[760px] bg-white p-10 shadow-sm print:min-h-0 print:p-12 print:shadow-none">
            <div className="mb-10 border-b-2 border-stone-900 pb-5 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Greenwood Residence</p>
              <h1 className="mt-4 text-2xl font-bold uppercase tracking-wide text-stone-900">{document.heading}</h1>
              <p className="mt-2 text-xs text-stone-500">{contract.contract_number ?? 'Controlled document'}</p>
            </div>
            {document.blocks.map((block) => (
              <section key={block.heading} className="mb-7">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-800">{block.heading}</h3>
                <p className="whitespace-pre-line text-sm leading-7 text-stone-700">{block.content}</p>
              </section>
            ))}
            <SignatureBlock signatories={signatoryMap} />
            <p className="mt-16 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">{document.footer}</p>
          </article>

          {panel && (
            <aside className="print:hidden">
              <Card>
                {panel === 'versions' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary-700" aria-hidden />
                      <h3 className="font-semibold text-stone-900">Version history</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      {versions.error && <p className="text-sm text-rose-700">{versions.error}</p>}
                      {(versions.data ?? []).map((version) => (
                        <div key={version.id} className="rounded-xl border border-stone-200 p-3">
                          <p className="text-sm font-semibold text-stone-800">Version {version.version_number}</p>
                          <p className="mt-1 text-xs text-stone-500">{formatDate(version.created_at)}</p>
                          {version.change_summary && <p className="mt-2 text-xs text-stone-600">{version.change_summary}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary-700" aria-hidden />
                      <h3 className="font-semibold text-stone-900">Digital audit trail</h3>
                    </div>
                    <div className="mt-4">
                      {audit.error ? <p className="text-sm text-rose-700">{audit.error}</p> : <AuditTrailPanel events={audit.data ?? []} />}
                    </div>
                  </>
                )}
              </Card>
            </aside>
          )}
        </div>
      </div>

      {signaturesOpen && (
        <SignatoriesModal
          signatories={signatoryMap}
          onClose={() => setSignaturesOpen(false)}
          onChanged={() => {
            signatures.reload();
            audit.reload();
          }}
        />
      )}
    </div>
  );
}
