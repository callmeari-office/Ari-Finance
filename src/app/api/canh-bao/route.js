import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getCanhBao } from '@/lib/dashboardQueries';

// GET /api/canh-bao?days=3
// Tổng hợp cảnh báo: nhắc hạn, vượt hạn mức, vượt kế hoạch. Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const days = Math.max(0, parseInt(searchParams.get('days') || '3', 10));
    const result = await getCanhBao(prisma, days);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/canh-bao', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
