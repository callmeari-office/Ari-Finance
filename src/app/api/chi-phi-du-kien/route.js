import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getChiPhiDuKienThang } from '@/lib/dashboardQueries';

// GET /api/chi-phi-du-kien — OWNER/MANAGER: chi phí dự kiến cả tháng hiện tại (gộp danh mục).
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const data = await getChiPhiDuKienThang(prisma);
    return NextResponse.json(data);
  } catch (error) {
    logger.error('GET /api/chi-phi-du-kien', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
