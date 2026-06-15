import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/doanh-thu?nam=2026
// Trả về danh sách kênh bán + dữ liệu kế hoạch doanh thu (chỉ tiêu + thực tế) của năm.
// Quyền xem: OWNER + MANAGER + STAFF.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());

    const [kenhBan, rows] = await Promise.all([
      prisma.kenhBan.findMany({
        where: { trangThai: 'ACTIVE' },
        orderBy: [{ thuTu: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.keHoachDoanhThu.findMany({ where: { nam } }),
    ]);

    const data = rows.map((r) => ({
      kenhBanId: r.kenhBanId,
      thang: r.thang,
      chiTieu: r.chiTieu,
      thucTe: r.thucTe,
    }));

    return NextResponse.json({ kenhBan, data, nam });
  } catch (error) {
    logger.error('GET /api/doanh-thu', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/doanh-thu
// Body: { nam, items: [{ kenhBanId, thang, chiTieu }] }
// Bulk upsert CHỈ TIÊU — chỉ OWNER.
// Lưu ý: thucTe KHÔNG cập nhật ở đây — nó được đồng bộ tự động từ
// bảng nhập doanh thu ngày (/api/doanh-thu/hang-ngay) để tránh ghi đè.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền nhập số doanh thu.' }, { status: 403 });
    }

    const body = await request.json();
    const { nam, items } = body;

    if (!nam || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
    }

    const ops = items.map((item) =>
      prisma.keHoachDoanhThu.upsert({
        where: {
          nam_thang_kenhBanId: {
            nam: Number(nam),
            thang: Number(item.thang),
            kenhBanId: item.kenhBanId,
          },
        },
        update: {
          chiTieu: lamTronTien(item.chiTieu),
        },
        create: {
          nam: Number(nam),
          thang: Number(item.thang),
          kenhBanId: item.kenhBanId,
          chiTieu: lamTronTien(item.chiTieu),
          thucTe: 0,
        },
      })
    );

    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true, count: items.length });
  } catch (error) {
    logger.error('POST /api/doanh-thu', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
