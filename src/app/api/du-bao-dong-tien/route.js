import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getDuBao } from '@/lib/dashboardQueries';

// GET /api/du-bao-dong-tien?days=thang|30|60|90
// Dự báo số dư quỹ từ hôm nay đến cuối kỳ. Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days') || 'thang';
    const result = await getDuBao(prisma, daysParam);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/du-bao-dong-tien', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
