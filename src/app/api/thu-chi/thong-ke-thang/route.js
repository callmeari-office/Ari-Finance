import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/thu-chi/thong-ke-thang?soThang=6
// Trả mảng { thang: "YYYY-MM", thu: number, chi: number }[] đã gộp theo tháng.
// Chỉ OWNER/MANAGER (giống /api/thu-chi).
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu Thu-Chi.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const soThang = Math.max(1, Math.min(24, parseInt(searchParams.get('soThang') || '6', 10)));

    // Raw SQL: GROUP BY tháng + loại giao dịch, lấy soThang tháng gần nhất
    const rows = await prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "ngayGiaoDich"), 'YYYY-MM') AS thang,
        "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "ThuChi"
      GROUP BY 1, 2
      ORDER BY 1 DESC
      LIMIT ${soThang * 2}
    `;

    // Gộp thu/chi theo tháng
    const map = {};
    for (const row of rows) {
      const t = row.thang;
      if (!map[t]) map[t] = { thang: t, thu: 0, chi: 0 };
      if (row.loaiGiaoDich === 'THU') map[t].thu = Number(row.total);
      else if (row.loaiGiaoDich === 'CHI') map[t].chi = Number(row.total);
    }

    // Trả về theo thứ tự tháng tăng dần (cũ → mới) để vẽ biểu đồ
    const result = Object.values(map).sort((a, b) => a.thang.localeCompare(b.thang));
    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/thu-chi/thong-ke-thang', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
