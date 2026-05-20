import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===== อัปโหลดรูปหลักฐาน =====
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

// ===== สร้าง Signed URL (หมดอายุใน 1 ชั่วโมง) =====
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET!)
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error) throw new Error(`Signed URL failed: ${error.message}`);

  return data.signedUrl;
}