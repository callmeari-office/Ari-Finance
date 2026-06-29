import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getSoNgaySapToiHan, setSoNgaySapToiHan } from '@/lib/cauHinh';

// GET /api/cau-hinh/tham-so — đọc tham số hệ thống (OWNER/MANAGER).
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const soNgaySapToiHan = await getSoNgaySapToiHan(prisma);
    return NextResponse.json({ soNgaySapToiHan });
  } catch (error) {
    logger.error('GET /api/cau-hinh/tham-so', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// PUT /api/cau-hinh/tham-so — ghi tham số (OWNER/MANAGER). Body: { soNgaySapToiHan }
export async function PUT(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }
    const body = await request.json();
    const n = parseInt(body?.soNgaySapToiHan, 10);
    if (!Number.isFinite(n) || n < 1 || n > 28) {
      return NextResponse.json({ error: 'Số ngày phải từ 1 đến 28.' }, { status: 400 });
    }
    const saved = await setSoNgaySapToiHan(prisma, n);
    return NextResponse.json({ ok: true, soNgaySapToiHan: saved });
  } catch (error) {
    logger.error('PUT /api/cau-hinh/tham-so', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
