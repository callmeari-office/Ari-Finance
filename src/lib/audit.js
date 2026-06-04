import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { logger } from './logger';

// Ghi 1 dòng nhật ký thao tác. TỰ BẮT LỖI, KHÔNG throw —
// việc ghi nhật ký thất bại tuyệt đối không được làm hỏng nghiệp vụ chính.
// Dùng raw SQL (không phụ thuộc prisma generate) cho chắc chắn trên Windows/Supabase.
export async function ghiNhatKy({ user, hanhDong, doiTuong = null, maDoiTuong = null, moTa = null }) {
  try {
    const tenNguoiDung = user ? (user.tenNgan || user.hoTen || user.username || null) : null;
    await prisma.$executeRaw`
      INSERT INTO "LichSuThaoTac"
        ("id", "thoiGian", "nguoiDungId", "tenNguoiDung", "vaiTro", "hanhDong", "doiTuong", "maDoiTuong", "moTa")
      VALUES
        (${randomUUID()}, NOW(), ${user?.id ?? null}, ${tenNguoiDung}, ${user?.role ?? null}, ${hanhDong}, ${doiTuong}, ${maDoiTuong}, ${moTa})
    `;
  } catch (error) {
    logger.error('ghiNhatKy', error);
  }
}
