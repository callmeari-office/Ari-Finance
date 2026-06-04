import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/ke-hoach?nam=2026
// Trả về toàn bộ kế hoạch của năm, kèm thực tế từ ThuChi
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());

    // Lấy kế hoạch của năm
    const keHoachList = await prisma.keHoach.findMany({
      where: { nam },
      include: { danhMuc: { include: { nhomChiPhi: true } } },
    });

    // Lấy thực tế từ ThuChi trong năm (CHI only)
    const startOfYear = new Date(nam, 0, 1);
    const endOfYear = new Date(nam + 1, 0, 1);
    const thucTeRaw = await prisma.thuChi.groupBy({
      by: ['danhMucId', 'loaiGiaoDich'],
      where: {
        ngayGiaoDich: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { soTien: true },
    });

    // Thực tế theo tháng × danh mục
    const thucTeByMonth = await prisma.$queryRaw`
      SELECT
        EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang,
        "danhMucId",
        "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
      GROUP BY thang, "danhMucId", "loaiGiaoDich"
    `;

    return NextResponse.json({ keHoach: keHoachList, thucTeByMonth, nam });
  } catch (error) {
    logger.error('GET /api/ke-hoach', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/ke-hoach
// Body: { nam, items: [{ danhMucId, thang, soTien }] }
// Bulk upsert
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const body = await request.json();
    const { nam, items } = body;

    if (!nam || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
    }

    // Upsert từng item
    const ops = items.map((item) =>
      prisma.keHoach.upsert({
        where: {
          nam_thang_danhMucId: {
            nam: Number(nam),
            thang: Number(item.thang),
            danhMucId: item.danhMucId,
          },
        },
        update: { soTien: Number(item.soTien) || 0 },
        create: {
          nam: Number(nam),
          thang: Number(item.thang),
          danhMucId: item.danhMucId,
          soTien: Number(item.soTien) || 0,
        },
      })
    );

    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true, count: items.length });
  } catch (error) {
    logger.error('POST /api/ke-hoach', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
