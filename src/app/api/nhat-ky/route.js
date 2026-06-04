import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/nhat-ky — danh sách nhật ký thao tác (OWNER only).
// Tham số: ?limit (mặc định 200, tối đa 1000), ?hanhDong, ?doiTuong, ?q (tìm trong mô tả/tên).
// Dùng raw SQL để không phụ thuộc prisma generate (bảng tạo bằng migration thủ công).
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới được xem nhật ký hệ thống.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '200', 10)));
    const hanhDong = searchParams.get('hanhDong');
    const doiTuong = searchParams.get('doiTuong');
    const q = searchParams.get('q');

    const conditions = [];
    const values = [];
    let i = 1;
    if (hanhDong) { conditions.push(`"hanhDong" = $${i++}`); values.push(hanhDong); }
    if (doiTuong) { conditions.push(`"doiTuong" = $${i++}`); values.push(doiTuong); }
    if (q && q.trim()) {
      conditions.push(`("moTa" ILIKE $${i} OR "tenNguoiDung" ILIKE $${i} OR "maDoiTuong" ILIKE $${i})`);
      values.push(`%${q.trim()}%`);
      i++;
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const sql = `
      SELECT "id", "thoiGian", "nguoiDungId", "tenNguoiDung", "vaiTro", "hanhDong", "doiTuong", "maDoiTuong", "moTa"
      FROM "LichSuThaoTac"
      ${whereSql}
      ORDER BY "thoiGian" DESC
      LIMIT $${i}
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...values);

    return NextResponse.json({ data: rows });
  } catch (error) {
    logger.error('GET /api/nhat-ky', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
