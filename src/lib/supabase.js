import { createClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = 'hoa-don';

// Lazy — chỉ khởi tạo khi gọi, tránh crash khi env chưa set
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình trong .env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Tách đường dẫn file từ public URL để dùng khi xóa
export function getStoragePath(url) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// Xóa ảnh khỏi Storage (không throw — lỗi xóa không nên chặn nghiệp vụ)
export async function deleteStorageImage(url) {
  const path = getStoragePath(url);
  if (!path) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (_) {}
}
