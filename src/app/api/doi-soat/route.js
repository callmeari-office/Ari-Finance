import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { tinhDoiSoat, phatHienBatThuong } from '@/lib/doiSoat';

// GET /api/doi-soat?nam=YYYY
// Đối soát doanh thu khai báo vs tiền THU thực nhận theo tháng. Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear(), 10);
    if (isNaN(nam) || nam < 2000 || nam > 2100) {
      return NextResponse.json({ error: 'Năm không hợp lệ.' }, { status: 400 });
    }

    const startOfYear = new Date(nam, 0, 1);
    const endOfYear = new Date(nam + 1, 0, 1);

    const [doanhThuRows, thuRows, ghiChuRows] = await Promise.all([
      // Doanh thu khai báo: tổng thucTe từ KeHoachDoanhThu nhóm theo tháng
      prisma.keHoachDoanhThu.groupBy({
        by: ['thang'],
        where: { nam },
        _sum: { thucTe: true },
      }),
      // Tiền THU thực nhận: ThuChi loại THU, KHÔNG gồm phiếu bù trừ lịch sử
      prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang, SUM("soTien") AS total
        FROM "ThuChi"
        WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
          AND "loaiGiaoDich" = 'THU'
          AND "buTruLichSu" = false
        GROUP BY thang
      `,
      // Ghi chú đối soát từ bảng DoiSoatThang
      prisma.doiSoatThang.findMany({ where: { nam } }),
    ]);

    const doanhThuMap = {};
    doanhThuRows.forEach((r) => {
      doanhThuMap[r.thang] = Number(r._sum.thucTe || 0);
    });

    const thuMap = {};
    thuRows.forEach((r) => {
      thuMap[Number(r.thang)] = Number(r.total || 0);
    });

    const ghiChuMap = {};
    ghiChuRows.forEach((r) => {
      ghiChuMap[r.thang] = r.ghiChu ?? null;
    });

    const raw = Array.from({ length: 12 }, (_, i) => ({
      thang: i + 1,
      doanhThuKhaiBao: doanhThuMap[i + 1] || 0,
      tienThucNhan: thuMap[i + 1] || 0,
      ghiChu: ghiChuMap[i + 1] || null,
    }));

    const withCalc = tinhDoiSoat(raw);
    const { rows: months, trungViTyLe } = phatHienBatThuong(withCalc);

    const tongDT = months.reduce((s, m) => s + m.doanhThuKhaiBao, 0);
    const tongThu = months.reduce((s, m) => s + m.tienThucNhan, 0);
    const tong = {
      doanhThuKhaiBao: tongDT,
      tienThucNhan: tongThu,
      chenhLech: tongDT - tongThu,
      tyLe: tongDT > 0 ? Math.round((tongThu / tongDT) * 100) : null,
    };

    return NextResponse.json({ nam, months, tong, trungViTyLe });
  } catch (error) {
    logger.error('GET /api/doi-soat', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/doi-soat
// Upsert ghi chú đối soát theo tháng. Quyền: OWNER + MANAGER.
// Body: { nam: number, thang: number (1-12), ghiChu: string|null }
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body không hợp lệ.' }, { status: 400 });
    }

    const { nam, thang, ghiChu } = body;

    if (!Number.isInteger(nam) || nam < 2000 || nam > 2100) {
      return NextResponse.json({ error: 'Năm không hợp lệ.' }, { status: 400 });
    }
    if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
      return NextResponse.json({ error: 'Tháng phải từ 1 đến 12.' }, { status: 400 });
    }

    const ghiChuStr = ghiChu === null || ghiChu === undefined ? null : String(ghiChu);
    if (ghiChuStr !== null && ghiChuStr.length > 500) {
      return NextResponse.json({ error: 'Ghi chú không được vượt quá 500 ký tự.' }, { status: 400 });
    }

    await prisma.doiSoatThang.upsert({
      where: { nam_thang: { nam, thang } },
      create: { nam, thang, ghiChu: ghiChuStr },
      update: { ghiChu: ghiChuStr },
    });

    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'DOI_SOAT',
      moTa: `Cập nhật ghi chú đối soát tháng ${thang}/${nam}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('POST /api/doi-soat', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
