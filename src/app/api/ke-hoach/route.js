import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { canViewCategory } from '@/lib/roles';

// GET /api/ke-hoach?nam=2026
// Trả về toàn bộ kế hoạch của năm, kèm thực tế từ ThuChi.
// OWNER/MANAGER xem toàn bộ; STAFF/LEADER chỉ xem các DANH MỤC được phân quyền
// (theo chucVuDuocXem ở Cấu hình), nhưng số THỰC CHI là tổng của CẢ HỆ THỐNG.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const isFullView = user.role === 'OWNER' || user.role === 'MANAGER';

    // Với STAFF/LEADER: xác định tập danh mục được phép xem để lọc cả KH lẫn thực tế.
    let viewableIds = null;
    if (!isFullView) {
      const cats = await prisma.danhMuc.findMany({ select: { id: true, chucVuDuocXem: true } });
      viewableIds = new Set(
        cats
          .filter((c) => {
            try { return canViewCategory(user.role, JSON.parse(c.chucVuDuocXem)); }
            catch { return false; }
          })
          .map((c) => c.id)
      );
    }

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());

    // Lấy kế hoạch của năm
    let keHoachList = await prisma.keHoach.findMany({
      where: { nam },
      include: { danhMuc: { include: { nhomChiPhi: true } } },
    });
    if (viewableIds) {
      keHoachList = keHoachList.filter((kh) => viewableIds.has(kh.danhMucId));
    }

    // Lấy thực tế từ ThuChi + phiếu lịch sử (laLichSu=true) trong năm
    const startOfYear = new Date(nam, 0, 1);
    const endOfYear = new Date(nam + 1, 0, 1);

    // ThuChi theo tháng × danh mục
    const thucTeByMonthThuChi = await prisma.$queryRaw`
      SELECT
        EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang,
        "danhMucId",
        'CHI' AS "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
        AND "loaiGiaoDich" = 'CHI'
      GROUP BY thang, "danhMucId"
    `;

    // Phiếu lịch sử theo tháng × danh mục (dùng ngayThanhToan, fallback ngayPhatSinh)
    const thucTeByMonthLichSu = await prisma.$queryRaw`
      SELECT
        EXTRACT(MONTH FROM COALESCE("ngayThanhToan", "ngayPhatSinh"))::int AS thang,
        "danhMucId",
        'CHI' AS "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfYear}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfYear}
        AND "laLichSu" = true
      GROUP BY thang, "danhMucId"
    `;

    // Gộp 2 nguồn: cộng dồn theo thang+danhMucId
    const mergedMapSimple = {};
    const mergeSimple = (rows) => {
      for (const row of rows) {
        const key = `${row.thang}__${row.danhMucId}__${row.loaiGiaoDich}`;
        if (!mergedMapSimple[key]) {
          mergedMapSimple[key] = { thang: Number(row.thang), danhMucId: row.danhMucId, loaiGiaoDich: row.loaiGiaoDich, total: 0 };
        }
        mergedMapSimple[key].total += Number(row.total);
      }
    };
    mergeSimple(thucTeByMonthThuChi);
    mergeSimple(thucTeByMonthLichSu);
    let thucTeByMonth = Object.values(mergedMapSimple);
    if (viewableIds) {
      thucTeByMonth = thucTeByMonth.filter((row) => viewableIds.has(row.danhMucId));
    }

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
        update: { soTien: lamTronTien(item.soTien) },
        create: {
          nam: Number(nam),
          thang: Number(item.thang),
          danhMucId: item.danhMucId,
          soTien: lamTronTien(item.soTien),
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
