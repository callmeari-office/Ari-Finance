import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Chuẩn hoá ngày về 00:00:00 UTC để khớp với @@unique([ngay, kenhBanId])
// và tránh lệch do múi giờ.
const utcDay = (nam, thang, day) => new Date(Date.UTC(nam, thang - 1, day, 0, 0, 0, 0));

// GET /api/doanh-thu/hang-ngay?nam=2026&thang=6
// Trả về doanh thu hàng ngày của tất cả kênh bán trong tháng/năm.
// Quyền xem: OWNER + MANAGER + STAFF.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());
    const thang = parseInt(searchParams.get('thang') || (new Date().getMonth() + 1));

    if (!nam || thang < 1 || thang > 12) {
      return NextResponse.json({ error: 'Tham số nam/thang không hợp lệ.' }, { status: 400 });
    }

    const start = utcDay(nam, thang, 1);
    const end = utcDay(nam, thang + 1, 1); // đầu tháng kế tiếp (exclusive)

    const rows = await prisma.doanhThuHangNgay.findMany({
      where: { ngay: { gte: start, lt: end } },
    });

    const data = rows.map((r) => ({
      kenhBanId: r.kenhBanId,
      day: new Date(r.ngay).getUTCDate(),
      soTien: r.soTien,
    }));

    return NextResponse.json({ data, nam, thang });
  } catch (error) {
    logger.error('GET /api/doanh-thu/hang-ngay', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/doanh-thu/hang-ngay
// Body: { nam, thang, items: [{ kenhBanId, day, soTien }] }
// Bulk upsert doanh thu hàng ngày — chỉ OWNER.
// Sau khi lưu: tự tính tổng doanh thu cả tháng theo từng kênh và đồng bộ
// vào KeHoachDoanhThu.thucTe để Dashboard Năm luôn khớp.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền nhập doanh thu ngày.' }, { status: 403 });
    }

    const { nam, thang, items } = await request.json();

    if (!nam || thang < 1 || thang > 12 || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
    }

    const lastDay = new Date(Date.UTC(nam, thang, 0)).getUTCDate();

    // 1) Bulk upsert doanh thu ngày bằng MỘT câu lệnh INSERT ... ON CONFLICT
    //    (thay vì N upsert tuần tự — tránh vượt timeout 5s của transaction).
    const valid = items.filter((it) => it.day >= 1 && it.day <= lastDay && it.kenhBanId);
    if (valid.length > 0) {
      const now = new Date();
      const rows = valid.map((it) =>
        Prisma.sql`(${randomUUID()}, ${utcDay(Number(nam), Number(thang), Number(it.day))}, ${it.kenhBanId}, ${lamTronTien(it.soTien)}, ${now})`
      );
      await prisma.$executeRaw`
        INSERT INTO "DoanhThuHangNgay" ("id", "ngay", "kenhBanId", "soTien", "updatedAt")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("ngay", "kenhBanId")
        DO UPDATE SET "soTien" = EXCLUDED."soTien", "updatedAt" = EXCLUDED."updatedAt"
      `;
    }

    // 2) Đồng bộ: tổng doanh thu cả tháng theo từng kênh -> KeHoachDoanhThu.thucTe
    const start = utcDay(nam, thang, 1);
    const end = utcDay(nam, thang + 1, 1);
    const grouped = await prisma.doanhThuHangNgay.groupBy({
      by: ['kenhBanId'],
      where: { ngay: { gte: start, lt: end } },
      _sum: { soTien: true },
    });

    const syncOps = grouped.map((g) =>
      prisma.keHoachDoanhThu.upsert({
        where: {
          nam_thang_kenhBanId: { nam: Number(nam), thang: Number(thang), kenhBanId: g.kenhBanId },
        },
        update: { thucTe: g._sum.soTien || 0 },
        create: {
          nam: Number(nam),
          thang: Number(thang),
          kenhBanId: g.kenhBanId,
          chiTieu: 0,
          thucTe: g._sum.soTien || 0,
        },
      })
    );

    if (syncOps.length > 0) await prisma.$transaction(syncOps);

    return NextResponse.json({ ok: true, count: valid.length });
  } catch (error) {
    logger.error('POST /api/doanh-thu/hang-ngay', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
