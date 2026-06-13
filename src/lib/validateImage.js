const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const STORAGE_BUCKET = 'hoa-don';

/**
 * Validate URL ảnh hóa đơn đã upload lên Supabase Storage.
 * @returns {string|null}
 */
export function validateStorageImageUrl(url) {
  if (typeof url !== 'string') return 'URL ảnh hóa đơn không hợp lệ.';
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null; // Không kiểm tra nếu chưa cấu hình (dev)
  const expected = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/`;
  if (!url.startsWith(expected)) {
    return 'Ảnh hóa đơn phải được upload qua hệ thống của shop.';
  }
  return null;
}

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Validate ảnh hóa đơn (data URL).
 * Kiểm tra: whitelist MIME, giới hạn 2MB, magic bytes thực khớp MIME.
 * @returns {string|null} Error message nếu invalid, null nếu OK.
 */
export function validateAnhHoaDon(dataUrl) {
  if (typeof dataUrl !== 'string') return 'Ảnh hóa đơn không hợp lệ.';

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return 'Định dạng ảnh hóa đơn không hợp lệ.';

  const mime = match[1];
  const base64Data = match[2];

  if (!ALLOWED_MIME.includes(mime)) {
    return 'Ảnh hóa đơn chỉ chấp nhận định dạng JPEG, PNG hoặc WebP.';
  }

  // Ước lượng size trước khi decode để tránh OOM với file cực lớn
  const approxBytes = Math.floor(base64Data.length * 0.75);
  if (approxBytes > MAX_BYTES) {
    return 'Ảnh hóa đơn quá lớn (tối đa 2 MB). Vui lòng nén ảnh trước khi tải lên.';
  }

  // Decode và kiểm tra magic bytes
  const buf = Buffer.from(base64Data, 'base64');

  if (mime === 'image/jpeg') {
    if (buf.length < 2 || buf[0] !== 0xFF || buf[1] !== 0xD8) {
      return 'Ảnh hóa đơn không hợp lệ (nội dung không khớp định dạng JPEG).';
    }
  } else if (mime === 'image/png') {
    if (buf.length < 4 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) {
      return 'Ảnh hóa đơn không hợp lệ (nội dung không khớp định dạng PNG).';
    }
  } else if (mime === 'image/webp') {
    // RIFF tại byte 0–3, WEBP tại byte 8–11
    if (
      buf.length < 12 ||
      buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46 ||
      buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50
    ) {
      return 'Ảnh hóa đơn không hợp lệ (nội dung không khớp định dạng WebP).';
    }
  }

  return null;
}
