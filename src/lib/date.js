/**
 * date.js — Tiện ích định dạng ngày tháng nhất quán trên toàn hệ thống.
 * Hỗ trợ cả Client Component và Server-side (API, Email).
 */

/**
 * Định dạng Date object hoặc Date string thành dạng dd/mm/yy.
 * Ví dụ: 2026-06-13 -> 13/06/26
 * 
 * @param {Date|string|number} date - Giá trị ngày tháng cần định dạng
 * @returns {string} Chuỗi ngày tháng dạng dd/mm/yy (hoặc '—' nếu không hợp lệ)
 */
export function formatDate(date) {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

/**
 * Định dạng Date object hoặc Date string thành dạng dd/mm/yy (trả về chuỗi rỗng nếu không hợp lệ).
 * Thích hợp dùng trong các ô nhập liệu, danh sách Excel, v.v.
 */
export function formatDateOrEmpty(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}
