// Tiện ích avatar chữ-cái-đầu cho hiển thị "theo người".
// Dùng được ở cả client lẫn server (không import gì nặng).
//
// Lưu ý theme: palette là cặp nền pastel + chữ đậm cùng tông màu — đây là
// ngoại lệ có chủ ý (giống chip), đọc tốt trên cả light/dark/pink.

const AVATAR_PALETTE = [
  { bg: '#FBEAF0', color: '#993556' }, // pink
  { bg: '#E6F1FB', color: '#185FA5' }, // blue
  { bg: '#E1F5EE', color: '#0F6E56' }, // teal
  { bg: '#FAEEDA', color: '#854F0B' }, // amber
  { bg: '#EEEDFE', color: '#3C3489' }, // purple
  { bg: '#FAECE7', color: '#993C1D' }, // coral
  { bg: '#EAF3DE', color: '#3B6D11' }, // green
];

const UNKNOWN_COLOR = { bg: 'rgba(var(--brand-brown-rgb), 0.12)', color: 'var(--text-muted)' };

/** Lấy 1-2 chữ cái đầu từ tên (ưu tiên 2 từ cuối: "Trúc Linh" → "TL"). */
export function getInitials(name) {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  return (secondLast[0] + last[0]).toUpperCase();
}

/** Màu avatar ổn định theo key (id/tên). isUnknown → màu trung tính. */
export function getAvatarColor(key, isUnknown = false) {
  if (isUnknown) return UNKNOWN_COLOR;
  const s = String(key || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
