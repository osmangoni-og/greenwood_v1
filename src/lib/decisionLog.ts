import { supabase, unwrap } from '@/lib/supabase';
import type { DecisionCategory, DecisionStatus, ProjectDecisionRow } from '@/types/database';

export async function fetchDecisions(projectId: string): Promise<ProjectDecisionRow[]> {
  return unwrap<ProjectDecisionRow[]>(await supabase.from('project_decisions').select('*').eq('project_id', projectId).order('decision_date', { ascending: false }));
}

export interface DecisionInput {
  projectId: string;
  decisionDate: string;
  category: DecisionCategory;
  title: string;
  description: string | null;
  reason: string | null;
  alternatives: string | null;
  expectedImpact: string | null;
  costImpact: number;
  scheduleImpact: number;
  approvedBy: string | null;
  status: DecisionStatus;
  notes: string | null;
}

export async function createDecision(input: DecisionInput): Promise<void> {
  const { error } = await supabase.from('project_decisions').insert({
    project_id: input.projectId,
    decision_date: input.decisionDate,
    category: input.category,
    title: input.title,
    description: input.description,
    reason: input.reason,
    alternatives_considered: input.alternatives,
    expected_impact: input.expectedImpact,
    cost_impact_bdt: input.costImpact,
    schedule_impact_days: input.scheduleImpact,
    approved_by: input.approvedBy,
    status: input.status,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export async function updateDecision(id: string, input: DecisionInput): Promise<void> {
  const { error } = await supabase.from('project_decisions').update({
    decision_date: input.decisionDate,
    category: input.category,
    title: input.title,
    description: input.description,
    reason: input.reason,
    alternatives_considered: input.alternatives,
    expected_impact: input.expectedImpact,
    cost_impact_bdt: input.costImpact,
    schedule_impact_days: input.scheduleImpact,
    approved_by: input.approvedBy,
    status: input.status,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteDecision(id: string): Promise<void> {
  const { error } = await supabase.from('project_decisions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
