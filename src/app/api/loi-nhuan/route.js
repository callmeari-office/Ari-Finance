import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getLoiNhuanNam } from '@/lib/dashboardQueries';

// GET /api/loi-nhuan?nam=2026
// Tổng hợp Lãi/Lỗ theo tháng cho cả năm. Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());
    const result = await getLoiNhuanNam(prisma, nam);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/loi-nhuan', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
