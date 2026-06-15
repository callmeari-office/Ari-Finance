// src/app/de-xuat/helpers.js
// Helper THUẦN cho trang Đề xuất — tách khỏi page.js để gọn + test được.

/** Định dạng số nguyên (chuỗi chỉ-chữ-số) thành "1.500.000" để hiển thị. */
export function formatSoTienDisplay(raw) {
  if (!raw) return '';
  const num = parseInt(raw, 10);
  return isNaN(num) ? '' : num.toLocaleString('vi-VN');
}

/**
 * Chuẩn hóa 1 ô ngày từ Excel/chuỗi về 'yyyy-mm-dd' (hoặc null nếu không hợp lệ).
 * Nhận: Date object, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd.
 */
export function parseDateCell(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy hoặc dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return null;
}
