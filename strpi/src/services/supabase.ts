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
  const path = `tasks/${Date.now()}_${filename}`;
  const { error } = await getSupabase().storage
    .from(process.env.SUPABASE_BUCKET!)
    .upload(path, file, { contentType: mimeType });
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