import { supabase, unwrap } from '@/lib/supabase';
import type { ContractRow, ContractVersionRow } from '@/types/database';

export async function fetchContracts(projectId: string): Promise<ContractRow[]> {
  return unwrap<ContractRow[]>(await supabase.from('contracts').select('*').eq('project_id', projectId).order('updated_at', { ascending: false }));
}
export async function fetchContractVersions(contractId: string): Promise<ContractVersionRow[]> {
  return unwrap<ContractVersionRow[]>(await supabase.from('contract_versions').select('*').eq('contract_id', contractId).order('version_number', { ascending: false }));
}
export async function createContractVersion(contractId: string, body: Record<string, unknown>, changeSummary: string, createdBy: string | null): Promise<void> {
  const latest = await supabase.from('contract_versions').select('version_number').eq('contract_id', contractId).order('version_number', { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw new Error(latest.error.message);
  const nextVersion = (latest.data?.version_number ?? 0) + 1;
  const result = await supabase.from('contract_versions').insert({ contract_id: contractId, version_number: nextVersion, body, change_summary: changeSummary || null, created_by: createdBy });
  if (result.error) throw new Error(result.error.message);
}
