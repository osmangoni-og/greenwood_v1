import { supabase, unwrap } from '@/lib/supabase';
import type { ProjectRow } from '@/types/database';

export interface DailySiteDiaryRow { id: string; created_at: string; updated_at: string; created_by: string | null; project_id: string; diary_date: string; work_performed: string; labor_count: number; material_usage: string | null; weather: string | null; photo_urls: string[]; issues: string | null; engineer_notes: string | null; }
export async function fetchDiaryProject(): Promise<ProjectRow | null> { const result = await supabase.from('projects').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle(); if (result.error) throw new Error(result.error.message); return result.data as ProjectRow | null; }
export async function fetchSiteDiaries(projectId: string): Promise<DailySiteDiaryRow[]> { return unwrap<DailySiteDiaryRow[]>(await supabase.from('daily_site_diaries').select('*').eq('project_id', projectId).order('diary_date', { ascending: false })); }
export async function saveSiteDiary(payload: Omit<DailySiteDiaryRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>, id?: string): Promise<void> { const result = id ? await supabase.from('daily_site_diaries').update(payload).eq('id', id) : await supabase.from('daily_site_diaries').insert(payload); if (result.error) throw new Error(result.error.message); }
