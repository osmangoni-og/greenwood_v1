import { supabase } from '@/lib/supabase';
import type { ProjectRow } from '@/types/database';

export async function fetchPrimaryProject(): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProjectRow | null;
}
