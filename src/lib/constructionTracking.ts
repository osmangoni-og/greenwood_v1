import { supabase, unwrap } from '@/lib/supabase';
import type { ProjectRow } from '@/types/database';

export const CONSTRUCTION_PHASES = [
  ['site_preparation', 'Site Preparation'], ['foundation', 'Foundation'], ['ground_floor_rcc', 'Ground Floor RCC'], ['first_floor_rcc', 'First Floor RCC'], ['roof', 'Roof'], ['brick_work', 'Brick Work'], ['electrical', 'Electrical'], ['plumbing', 'Plumbing'], ['tiles', 'Tiles'], ['paint', 'Paint'], ['finishing', 'Finishing'], ['handover', 'Handover'],
] as const;
export interface ConstructionPhaseRow { id: string; created_at: string; updated_at: string; project_id: string; phase_key: string; phase_name: string; sequence_number: number; planned_date: string | null; actual_date: string | null; progress_percent: number; photo_urls: string[]; engineer_comments: string | null; issues: string | null; delays: string | null; }
export async function fetchConstructionPhases(projectId: string): Promise<ConstructionPhaseRow[]> {
  const rows = unwrap<ConstructionPhaseRow[]>(await supabase.from('construction_phases').select('*').eq('project_id', projectId).order('sequence_number'));
  if (rows.length) return rows;
  const seeds = CONSTRUCTION_PHASES.map(([phaseKey, phaseName], index) => ({ project_id: projectId, phase_key: phaseKey, phase_name: phaseName, sequence_number: index + 1 }));
  return unwrap<ConstructionPhaseRow[]>(await supabase.from('construction_phases').upsert(seeds, { onConflict: 'project_id,phase_key' }).select('*').order('sequence_number'));
}
export async function saveConstructionPhase(phase: ConstructionPhaseRow): Promise<void> {
  const { error } = await supabase.from('construction_phases').update({ planned_date: phase.planned_date || null, actual_date: phase.actual_date || null, progress_percent: Math.min(100, Math.max(0, Number(phase.progress_percent) || 0)), photo_urls: phase.photo_urls, engineer_comments: phase.engineer_comments || null, issues: phase.issues || null, delays: phase.delays || null }).eq('id', phase.id);
  if (error) throw new Error(error.message);
}
export async function fetchTrackingProject(): Promise<ProjectRow | null> {
  const result = await supabase.from('projects').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data as ProjectRow | null;
}
