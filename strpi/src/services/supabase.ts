import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws as any,
  },
});

export async function uploadProofImage(
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const path = `tasks/${Date.now()}_${filename}`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET!)
    .upload(path, file, { contentType: mimeType });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return path;
}

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET!)
    .createSignedUrl(path, 60 * 60);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);

  return data.signedUrl;
}