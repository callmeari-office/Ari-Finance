// src/lib/cauHinh.js
// Đọc/ghi tham số hệ thống dạng key–value (bảng CauHinh).
// Thuần — không import prisma; caller luôn truyền instance vào.

export const KHOA_SO_NGAY_SAP_TOI_HAN = 'soNgaySapToiHan';
export const SO_NGAY_SAP_TOI_HAN_MAC_DINH = 7;

/** Kẹp số ngày về [1, 28]. */
export function clampSoNgay(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return SO_NGAY_SAP_TOI_HAN_MAC_DINH;
  return Math.min(28, Math.max(1, n));
}

/**
 * Cửa sổ "sắp tới hạn" (ngày). Thiếu bảng/khóa hoặc lỗi → trả mặc định 7.
 */
export async function getSoNgaySapToiHan(prisma) {
  try {
    const row = await prisma.cauHinh.findUnique({ where: { khoa: KHOA_SO_NGAY_SAP_TOI_HAN } });
    if (!row) return SO_NGAY_SAP_TOI_HAN_MAC_DINH;
    return clampSoNgay(row.giaTri);
  } catch {
    return SO_NGAY_SAP_TOI_HAN_MAC_DINH;
  }
}

/** Ghi cửa sổ "sắp tới hạn". Trả về giá trị đã kẹp. */
export async function setSoNgaySapToiHan(prisma, value) {
  const n = clampSoNgay(value);
  await prisma.cauHinh.upsert({
    where: { khoa: KHOA_SO_NGAY_SAP_TOI_HAN },
    update: { giaTri: String(n) },
    create: { khoa: KHOA_SO_NGAY_SAP_TOI_HAN, giaTri: String(n) },
  });
  return n;
}
