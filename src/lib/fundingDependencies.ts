import { supabase, unwrap } from '@/lib/supabase';
import type { FundingDependencyRow, FundingRiskLevel } from '@/types/database';

export async function fetchFundingDependencies(projectId: string): Promise<FundingDependencyRow[]> {
  return unwrap<FundingDependencyRow[]>(await supabase.from('funding_dependencies').select('*').eq('project_id', projectId).order('created_at'));
}

export interface FundingDependencyInput {
  projectId: string;
  phaseKey: string;
  fundingSourceId: string;
  requiredAmount: number;
  riskLevel: FundingRiskLevel;
  notes: string | null;
}

export async function createFundingDependency(input: FundingDependencyInput): Promise<void> {
  const { error } = await supabase.from('funding_dependencies').insert({
    project_id: input.projectId,
    phase_key: input.phaseKey,
    funding_source_id: input.fundingSourceId,
    required_amount_bdt: input.requiredAmount,
    risk_level: input.riskLevel,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export async function setFundingDependencyStatus(id: string, status: FundingDependencyRow['status']): Promise<void> {
  const { error } = await supabase.from('funding_dependencies').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteFundingDependency(id: string): Promise<void> {
  const { error } = await supabase.from('funding_dependencies').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface FundingDependencyUpdate {
  phaseKey?: string;
  fundingSourceId?: string;
  requiredAmount?: number;
  riskLevel?: FundingRiskLevel;
  notes?: string | null;
}

export async function updateFundingDependency(id: string, patch: FundingDependencyUpdate): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.phaseKey !== undefined) update.phase_key = patch.phaseKey;
  if (patch.fundingSourceId !== undefined) update.funding_source_id = patch.fundingSourceId;
  if (patch.requiredAmount !== undefined) update.required_amount_bdt = patch.requiredAmount;
  if (patch.riskLevel !== undefined) update.risk_level = patch.riskLevel;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { error } = await supabase.from('funding_dependencies').update(update).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface FundingSourcePatch {
  probability_pct?: number;
  expected_date?: string | null;
}

export async function updateFundingSource(id: string, patch: FundingSourcePatch): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.probability_pct !== undefined) update.probability_pct = patch.probability_pct;
  if (patch.expected_date !== undefined) update.expected_date = patch.expected_date;
  const { error } = await supabase.from('construction_funding_sources').update(update).eq('id', id);
  if (error) throw new Error(error.message);
}
