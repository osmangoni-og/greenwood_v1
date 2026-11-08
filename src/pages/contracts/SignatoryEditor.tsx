import { useState, type ChangeEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import {
  SIGNATURE_IMAGE_MAX_CHARS,
  SIGNATURE_UPLOAD_MAX_BYTES,
  SIGNATURE_UPLOAD_TYPES,
  computeSignatureHash,
  recordAuditEvent,
  saveSignatory,
  validateMobile,
  validateNid,
  type AuditAction,
  type SignatoryRow,
  type SignatureMethod,
} from '@/lib/contractSignatures';
import { SignaturePad } from '@/pages/contracts/SignaturePad';

interface SignatoryEditorProps {
  label: string;
  existing: SignatoryRow;
  onClose: () => void;
  onSaved: () => void;
}

interface PendingAudit {
  action: AuditAction;
  summary: string;
  details?: Record<string, unknown>;
}

function clean(value: string): string | null {
  return value.trim() || null;
}

export function SignatoryEditor({ label, existing, onClose, onSaved }: SignatoryEditorProps) {
  const [fullName, setFullName] = useState(existing.full_name ?? '');
  const [address, setAddress] = useState(existing.address ?? '');
  const [nid, setNid] = useState(existing.nid_number ?? '');
  const [mobile, setMobile] = useState(existing.mobile_number ?? '');
  const [mode, setMode] = useState<'draw' | 'upload'>(existing.signature_method === 'uploaded' ? 'upload' : 'draw');
  const [method, setMethod] = useState<SignatureMethod>(existing.signature_method);
  const [image, setImage] = useState<string | null>(existing.signature_image);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nidError = validateNid(nid.trim());
  const mobileError = validateMobile(mobile.trim());
  const detailsChanged =
    clean(fullName) !== existing.full_name ||
    clean(address) !== existing.address ||
    clean(nid) !== existing.nid_number ||
    clean(mobile) !== existing.mobile_number;
  const signatureChanged = image !== existing.signature_image || method !== existing.signature_method;
  const willResetSignature = detailsChanged && existing.signature_image !== null && !signatureChanged;

  function handleDrawChange(dataUrl: string | null) {
    if (!dataUrl) {
      setImage(null);
      setMethod('none');
      return;
    }
    if (dataUrl.length > SIGNATURE_IMAGE_MAX_CHARS) {
      setError('The drawn signature is too detailed to save. Try a simpler signature.');
      return;
    }
    setError(null);
    setImage(dataUrl);
    setMethod('electronic');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(SIGNATURE_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
      setError('Upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > SIGNATURE_UPLOAD_MAX_BYTES) {
      setError('The signature image must be 200 KB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result || result.length > SIGNATURE_IMAGE_MAX_CHARS) {
        setError('This image is too large to save. Use a smaller file.');
        return;
      }
      setError(null);
      setImage(result);
      setMethod('uploaded');
    };
    reader.onerror = () => setError('Could not read that file. Please try another image.');
    reader.readAsDataURL(file);
  }

  function clearSignature() {
    setError(null);
    setImage(null);
    setMethod('none');
  }

  async function save() {
    setError(null);
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (nidError || mobileError) {
      setError(nidError ?? mobileError);
      return;
    }

    const signatureReset = willResetSignature;
    const finalImage = signatureReset ? null : image;
    const finalMethod: SignatureMethod = finalImage ? method : 'none';
    const newSignature = finalImage !== null && finalImage !== existing.signature_image;
    const signedAt = finalImage === null ? null : newSignature ? new Date().toISOString() : existing.signed_at;

    if (finalImage && !window.crypto?.subtle) {
      setError('Signatures can only be saved on a secure connection (HTTPS or localhost).');
      return;
    }

    setBusy(true);
    try {
      const base = {
        contract_id: existing.contract_id,
        role_key: existing.role_key,
        full_name: clean(fullName),
        address: clean(address),
        nid_number: clean(nid),
        mobile_number: clean(mobile),
        signature_method: finalMethod,
        signature_image: finalImage,
        signed_at: signedAt,
      };
      const signatureHash = finalImage ? await computeSignatureHash(base) : null;
      await saveSignatory({ ...base, signature_hash: signatureHash });

      const events: PendingAudit[] = [];
      if (detailsChanged) events.push({ action: 'signatory_updated', summary: `${label} details updated` });
      if (signatureReset) {
        events.push({ action: 'signature_cleared', summary: `${label} signature removed because details changed` });
      } else if (existing.signature_image && !finalImage) {
        events.push({ action: 'signature_cleared', summary: `${label} signature cleared` });
      }
      if (newSignature && finalImage) {
        const uploaded = finalMethod === 'uploaded';
        events.push({
          action: uploaded ? 'signature_uploaded' : 'signature_captured',
          summary: uploaded ? `${label} signature uploaded` : `${label} electronic signature captured`,
          details: { signature_hash: signatureHash },
        });
      }

      const createdBy = getActiveUserId();
      for (const event of events) {
        await recordAuditEvent({ contractId: existing.contract_id, roleKey: existing.role_key, createdBy, ...event });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`${label} details`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving...' : 'Save signatory'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Full name" htmlFor="signatory-name">
              <input id="signatory-name" className={inputClassName} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Address" htmlFor="signatory-address">
              <textarea id="signatory-address" rows={2} className={inputClassName} value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormField>
          </div>
          <FormField label="NID number" htmlFor="signatory-nid" hint="10, 13, or 17 digits.">
            <input id="signatory-nid" inputMode="numeric" className={inputClassName} value={nid} onChange={(e) => setNid(e.target.value)} />
            {nidError && nid.trim() && <p className="text-xs text-rose-700">{nidError}</p>}
          </FormField>
          <FormField label="Mobile number" htmlFor="signatory-mobile" hint="Bangladesh format, for example 01712345678.">
            <input id="signatory-mobile" inputMode="tel" className={inputClassName} value={mobile} onChange={(e) => setMobile(e.target.value)} />
            {mobileError && mobile.trim() && <p className="text-xs text-rose-700">{mobileError}</p>}
          </FormField>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Signature</h3>
            <div role="group" aria-label="Signature method" className="mt-2 inline-flex rounded-lg bg-stone-100 p-1">
              {(['draw', 'upload'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === option ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {option === 'draw' ? 'Draw electronically' : 'Upload image'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'draw' ? (
            <SignaturePad initialImage={method === 'electronic' ? image : null} onChange={handleDrawChange} />
          ) : (
            <FormField label="Signature image" htmlFor="signatory-upload" hint="PNG, JPEG, or WebP, up to 200 KB.">
              <input
                id="signatory-upload"
                type="file"
                accept={SIGNATURE_UPLOAD_TYPES.join(',')}
                onChange={handleFileChange}
                className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-800 hover:file:bg-primary-100"
              />
            </FormField>
          )}

          {image && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex min-w-0 items-center gap-4">
                <img src={image} alt={`${label} signature preview`} className="h-14 w-40 shrink-0 object-contain" />
                <p className="text-xs text-stone-600">{method === 'uploaded' ? 'Uploaded signature' : 'Electronic signature'} ready to save</p>
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </button>
            </div>
          )}

          {willResetSignature && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Changing these details will remove the saved signature. Sign again after saving.
            </p>
          )}
        </section>

        <FormError message={error} />
      </div>
    </Modal>
  );
}
