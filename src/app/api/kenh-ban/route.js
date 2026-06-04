import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/kenh-ban  -> danh sách kênh bán ACTIVE (sắp theo thuTu)
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const kenhBan = await prisma.kenhBan.findMany({
      where: { trangThai: 'ACTIVE' },
      orderBy: [{ thuTu: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ kenhBan });
  } catch (error) {
    logger.error('GET /api/kenh-ban', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/kenh-ban  -> thêm kênh bán mới (OWNER)
// Body: { tenKenh, mauSac? }
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền thêm kênh bán.' }, { status: 403 });
    }

    const body = await request.json();
    const tenKenh = (body.tenKenh || '').trim();
    if (!tenKenh) {
      return NextResponse.json({ error: 'Tên kênh bán không được để trống.' }, { status: 400 });
    }

    // thuTu = lớn nhất hiện có + 1
    const last = await prisma.kenhBan.findFirst({ orderBy: { thuTu: 'desc' } });
    const thuTu = (last?.thuTu || 0) + 1;

    const created = await prisma.kenhBan.create({
      data: {
        tenKenh,
        mauSac: body.mauSac || null,
        thuTu,
        trangThai: 'ACTIVE',
      },
    });

    return NextResponse.json({ ok: true, kenhBan: created });
  } catch (error) {
    logger.error('POST /api/kenh-ban', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
