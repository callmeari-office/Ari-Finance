// Tiện ích đọc/ghi localStorage an toàn cho tính năng "gợi ý phiếu gần nhất".
// - Guard window/localStorage (an toàn khi SSR & khi trình duyệt chặn storage).
// - Key có version (v1) để dễ nâng cấp/bỏ dữ liệu cũ sau này.
// - CHỈ lưu id lựa chọn ít đổi (quỹ/danh mục/nguồn tiền) + nội dung ngắn — KHÔNG lưu số tiền, KHÔNG dữ liệu nhạy cảm.

const PREFIX = 'ari.formMemory.v1.';

// Đọc giá trị đã lưu; trả null nếu không có / lỗi / JSON hỏng.
export function readFormMemory(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Ghi giá trị "gần nhất"; nuốt mọi lỗi (quota, private mode...).
export function writeFormMemory(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* bỏ qua: không được để lỗi storage làm hỏng luồng tạo phiếu */
  }
}
