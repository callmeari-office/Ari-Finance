import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/loi-nhuan?nam=2026
// Tổng hợp Lãi/Lỗ theo tháng cho cả năm.
//   Doanh thu = KeHoachDoanhThu.thucTe (đồng bộ từ DoanhThuHangNgay) / chiTieu (kế hoạch)
//   Chi phí   = ThuChi(CHI) + phiếu lịch sử (laLichSu) / KeHoach.soTien (kế hoạch)
//   Lợi nhuận = Doanh thu − Chi phí
// Quyền xem: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const nam = parseInt(searchParams.get('nam') || new Date().getFullYear());

    const startOfYear = new Date(nam, 0, 1);
    const endOfYear = new Date(nam + 1, 0, 1);

    // Chạy song song các truy vấn tổng hợp.
    const [
      doanhThuRows,
      keHoachChiRows,
      chiThuChiRows,
      chiLichSuRows,
    ] = await Promise.all([
      // Doanh thu thực tế + chỉ tiêu theo tháng (gộp mọi kênh)
      prisma.keHoachDoanhThu.groupBy({
        by: ['thang'],
        where: { nam },
        _sum: { thucTe: true, chiTieu: true },
      }),
      // Kế hoạch chi phí theo tháng (gộp mọi danh mục)
      prisma.keHoach.groupBy({
        by: ['thang'],
        where: { nam },
        _sum: { soTien: true },
      }),
      // Chi phí thực tế từ sổ ThuChi (CHI) theo tháng
      prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang, SUM("soTien") AS total
        FROM "ThuChi"
        WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
          AND "loaiGiaoDich" = 'CHI'
        GROUP BY thang
      `,
      // Chi phí thực tế từ phiếu lịch sử (laLichSu) theo tháng
      prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM COALESCE("ngayThanhToan", "ngayPhatSinh"))::int AS thang, SUM("soTien") AS total
        FROM "DeXuatChiPhi"
        WHERE COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfYear}
          AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfYear}
          AND "laLichSu" = true
        GROUP BY thang
      `,
    ]);

    // Khởi tạo 12 tháng rỗng
    const months = [];
    for (let t = 1; t <= 12; t++) {
      months.push({
        thang: t,
        doanhThuThucTe: 0,
        doanhThuChiTieu: 0,
        chiPhiThucTe: 0,
        chiPhiKeHoach: 0,
        loiNhuanThucTe: 0,
        loiNhuanKeHoach: 0,
      });
    }
    const byMonth = (t) => months[t - 1];

    doanhThuRows.forEach((r) => {
      const m = byMonth(r.thang);
      if (!m) return;
      m.doanhThuThucTe += Number(r._sum.thucTe || 0);
      m.doanhThuChiTieu += Number(r._sum.chiTieu || 0);
    });
    keHoachChiRows.forEach((r) => {
      const m = byMonth(r.thang);
      if (!m) return;
      m.chiPhiKeHoach += Number(r._sum.soTien || 0);
    });
    chiThuChiRows.forEach((r) => {
      const m = byMonth(Number(r.thang));
      if (!m) return;
      m.chiPhiThucTe += Number(r.total || 0);
    });
    chiLichSuRows.forEach((r) => {
      const m = byMonth(Number(r.thang));
      if (!m) return;
      m.chiPhiThucTe += Number(r.total || 0);
    });

    // Tính lợi nhuận từng tháng + tổng năm
    const tong = {
      doanhThuThucTe: 0,
      doanhThuChiTieu: 0,
      chiPhiThucTe: 0,
      chiPhiKeHoach: 0,
      loiNhuanThucTe: 0,
      loiNhuanKeHoach: 0,
    };
    months.forEach((m) => {
      m.loiNhuanThucTe = m.doanhThuThucTe - m.chiPhiThucTe;
      m.loiNhuanKeHoach = m.doanhThuChiTieu - m.chiPhiKeHoach;
      tong.doanhThuThucTe += m.doanhThuThucTe;
      tong.doanhThuChiTieu += m.doanhThuChiTieu;
      tong.chiPhiThucTe += m.chiPhiThucTe;
      tong.chiPhiKeHoach += m.chiPhiKeHoach;
    });
    tong.loiNhuanThucTe = tong.doanhThuThucTe - tong.chiPhiThucTe;
    tong.loiNhuanKeHoach = tong.doanhThuChiTieu - tong.chiPhiKeHoach;
    // Biên lợi nhuận năm (%) = lợi nhuận / doanh thu
    tong.bienLoiNhuan = tong.doanhThuThucTe > 0
      ? Math.round((tong.loiNhuanThucTe / tong.doanhThuThucTe) * 100)
      : 0;

    return NextResponse.json({ nam, months, tong });
  } catch (error) {
    logger.error('GET /api/loi-nhuan', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
