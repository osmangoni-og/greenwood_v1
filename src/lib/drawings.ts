import { supabase } from '@/lib/supabase';
import type { DrawingFileType } from '@/types/database';

const BUCKET = 'drawings';
const ALLOWED_TYPES: Record<DrawingFileType, string[]> = {
  pdf: ['application/pdf'],
  dwg: ['application/acad', 'application/x-acad', 'image/vnd.dwg', 'application/octet-stream'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
};
const ALLOWED_EXTENSIONS = ['pdf', 'dwg', 'jpg', 'jpeg', 'png'];

export interface UploadResult {
  storagePath: string;
  publicUrl: string;
  fileType: DrawingFileType;
}

export function detectFileType(file: File): DrawingFileType | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'jpeg') return 'jpg';
  return (ALLOWED_EXTENSIONS.includes(extension) ? extension : null) as DrawingFileType | null;
}

export function validateDrawingFile(file: File): { ok: true; fileType: DrawingFileType } | { ok: false; error: string } {
  const fileType = detectFileType(file);
  if (!fileType) {
    return { ok: false, error: 'Only PDF, DWG, JPG, and PNG files are allowed.' };
  }
  const mimeOk = ALLOWED_TYPES[fileType].some((type) => file.type === type) || file.type === '';
  if (!mimeOk) {
    return { ok: false, error: `The file type ${file.type || 'unknown'} is not supported.` };
  }
  const MAX_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'File is larger than 50 MB.' };
  }
  return { ok: true, fileType };
}

interface UploadOptions {
  drawingId: string;
  versionNumber: number;
  file: File;
  fileType: DrawingFileType;
}

export async function uploadDrawingFile({ drawingId, versionNumber, file, fileType }: UploadOptions): Promise<UploadResult> {
  const extension = fileType === 'jpg' ? 'jpg' : fileType;
  const storagePath = `${drawingId}/v${versionNumber}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl, fileType };
}

export function getPublicDrawingUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deleteDrawingFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
