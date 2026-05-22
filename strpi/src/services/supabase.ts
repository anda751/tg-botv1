import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL และ SUPABASE_SERVICE_KEY ยังไม่ได้ตั้งค่าใน .env');
    }

    _supabase = createClient(url, key, {
      realtime: { transport: ws as any },
    });
  }
  return _supabase;
}

export async function uploadProofImage(
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const safeFilename = sanitizeFilename(filename);
  const contentType = normalizeMimeType(mimeType, safeFilename);
  const path = `tasks/${Date.now()}_${safeFilename}`;
  const { error } = await getSupabase().storage
    .from(process.env.SUPABASE_BUCKET!)
    .upload(path, file, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from(process.env.SUPABASE_BUCKET!)
    .createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

function sanitizeFilename(filename: string): string {
  const base = (filename || 'proof')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_');
  return base || 'proof';
}

function normalizeMimeType(mimeType: string | undefined, filename: string): string {
  const raw = (mimeType || '').trim().toLowerCase();
  const cleaned = raw.split(';')[0].trim();
  if (/^[a-z0-9!#$&^_.+\-]+\/[a-z0-9!#$&^_.+\-]+$/.test(cleaned)) {
    return cleaned;
  }

  const ext = filename.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}
