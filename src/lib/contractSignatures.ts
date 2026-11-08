import { supabase, unwrap } from '@/lib/supabase';

export const SIGNATORY_ROLES = [
  { key: 'owner', label: 'Owner' },
  { key: 'contractor', label: 'Contractor' },
  { key: 'engineer', label: 'Engineer' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'witness_1', label: 'Witness 1' },
  { key: 'witness_2', label: 'Witness 2' },
] as const;
export type SignatoryRoleKey = (typeof SIGNATORY_ROLES)[number]['key'];
export type SignatureMethod = 'none' | 'electronic' | 'uploaded';
export type AuditAction = 'signatory_updated' | 'signature_captured' | 'signature_uploaded' | 'signature_cleared' | 'contract_printed';

export interface SignatoryRow {
  id: string;
  contract_id: string;
  role_key: SignatoryRoleKey;
  full_name: string | null;
  address: string | null;
  nid_number: string | null;
  mobile_number: string | null;
  signature_method: SignatureMethod;
  signature_image: string | null;
  signed_at: string | null;
  signature_hash: string | null;
}

export interface AuditEventRow {
  id: string;
  created_at: string;
  created_by: string | null;
  contract_id: string;
  role_key: string | null;
  action: AuditAction;
  summary: string;
  details: Record<string, unknown>;
}

export const SIGNATURE_IMAGE_MAX_CHARS = 400000;
export const SIGNATURE_UPLOAD_MAX_BYTES = 200 * 1024;
export const SIGNATURE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function emptySignatory(contractId: string, roleKey: SignatoryRoleKey): SignatoryRow {
  return { id: '', contract_id: contractId, role_key: roleKey, full_name: null, address: null, nid_number: null, mobile_number: null, signature_method: 'none', signature_image: null, signed_at: null, signature_hash: null };
}

export function validateNid(value: string): string | null {
  if (!value) return null;
  return /^(\d{10}|\d{13}|\d{17})$/.test(value) ? null : 'NID must be 10, 13, or 17 digits.';
}

export function validateMobile(value: string): string | null {
  if (!value) return null;
  return /^01[3-9]\d{8}$/.test(value) ? null : 'Mobile number must be 11 digits, for example 01712345678.';
}

export async function fetchSignatories(contractId: string): Promise<SignatoryRow[]> {
  return unwrap<SignatoryRow[]>(await supabase.from('contract_signatories').select('*').eq('contract_id', contractId));
}

export async function fetchAuditEvents(contractId: string): Promise<AuditEventRow[]> {
  return unwrap<AuditEventRow[]>(await supabase.from('contract_audit_events').select('*').eq('contract_id', contractId).order('created_at', { ascending: false }).limit(200));
}

export async function computeSignatureHash(record: Omit<SignatoryRow, 'id' | 'contract_id' | 'signature_hash'>): Promise<string> {
  const payload = JSON.stringify([record.role_key, record.full_name, record.address, record.nid_number, record.mobile_number, record.signature_method, record.signature_image, record.signed_at]);
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type SignatureStatus = 'empty' | 'pending' | 'signed';

export function getSignatureStatus(row: SignatoryRow): SignatureStatus {
  if (row.signature_method !== 'none' && row.signature_image) return 'signed';
  if (row.full_name) return 'pending';
  return 'empty';
}

export function indexSignatories(contractId: string, rows: SignatoryRow[]): Record<SignatoryRoleKey, SignatoryRow> {
  return Object.fromEntries(
    SIGNATORY_ROLES.map(({ key }) => [key, rows.find((row) => row.role_key === key) ?? emptySignatory(contractId, key)]),
  ) as Record<SignatoryRoleKey, SignatoryRow>;
}

export async function saveSignatory(record: Omit<SignatoryRow, 'id'>): Promise<void> {
  const result = await supabase.from('contract_signatories').upsert(
    {
      contract_id: record.contract_id,
      role_key: record.role_key,
      full_name: record.full_name,
      address: record.address,
      nid_number: record.nid_number,
      mobile_number: record.mobile_number,
      signature_method: record.signature_method,
      signature_image: record.signature_image,
      signed_at: record.signed_at,
      signature_hash: record.signature_hash,
    },
    { onConflict: 'contract_id,role_key' },
  );
  if (result.error) throw new Error(result.error.message);
}

export async function recordAuditEvent(input: { contractId: string; roleKey?: SignatoryRoleKey | null; action: AuditAction; summary: string; details?: Record<string, unknown>; createdBy: string | null }): Promise<void> {
  const result = await supabase.from('contract_audit_events').insert({
    contract_id: input.contractId,
    role_key: input.roleKey ?? null,
    action: input.action,
    summary: input.summary,
    details: input.details ?? {},
    created_by: input.createdBy,
  });
  if (result.error) console.warn('Audit event was not saved:', result.error.message);
}
