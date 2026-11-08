import { supabase, unwrap } from '@/lib/supabase';
import type { BoqEntryRow, BoqSheetRow, BoqSummaryRow, BoqVarianceRow } from '@/types/database';

const BOQ_BUCKET = 'boq-files';
const ALLOWED_EXTENSIONS = ['pdf', 'xls', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'];
const MAX_BYTES = 15 * 1024 * 1024;

export function detectBoqFileType(fileName: string): string | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] ?? '';
  return ALLOWED_EXTENSIONS.includes(ext) ? ext : null;
}

export function validateBoqFile(file: File): string | null {
  const ext = detectBoqFileType(file.name);
  if (!ext) return 'Only PDF, Excel, CSV, JPG, or PNG files are allowed.';
  if (file.size > MAX_BYTES) return 'File is larger than 15 MB.';
  return null;
}

export async function uploadBoqFile(sheetId: string, file: File): Promise<{ path: string; fileName: string }> {
  const ext = detectBoqFileType(file.name);
  if (!ext) throw new Error('Unsupported file type.');
  const path = `${sheetId}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const { error } = await supabase.storage.from(BOQ_BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return { path, fileName: file.name };
}

export async function fetchBoqSheets(projectId: string): Promise<BoqSheetRow[]> {
  return unwrap<BoqSheetRow[]>(
    await supabase
      .from('boq_sheets')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchBoqEntries(sheetId: string): Promise<BoqEntryRow[]> {
  return unwrap<BoqEntryRow[]>(
    await supabase
      .from('boq_entries')
      .select('*')
      .eq('boq_sheet_id', sheetId)
      .order('category', { ascending: true })
      .order('item_description', { ascending: true }),
  );
}

export async function fetchBoqSummary(sheetId: string): Promise<BoqSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_boq_summary', { p_sheet_id: sheetId });
  if (error) throw new Error(error.message);
  return (data ?? []) as BoqSummaryRow[];
}

export async function fetchBoqVariance(baseId: string, compareId: string): Promise<BoqVarianceRow[]> {
  const { data, error } = await supabase.rpc('get_boq_variance', {
    p_base_sheet_id: baseId,
    p_compare_sheet_id: compareId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as BoqVarianceRow[];
}
