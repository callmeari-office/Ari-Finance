import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getThongKeThang } from '@/lib/dashboardQueries';

// GET /api/thu-chi/thong-ke-thang?soThang=6
// Trả mảng { thang: "YYYY-MM", thu, chi }[] đã gộp theo tháng. Quyền: OWNER + MANAGER.
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
    const result = await getThongKeThang(prisma, soThang);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/thu-chi/thong-ke-thang', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
