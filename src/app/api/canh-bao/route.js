import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/canh-bao?days=3
// Tổng hợp các cảnh báo cần chú ý cho chủ shop / quản lý:
//   1. nhacHan       — phiếu chờ thanh toán/hoàn ứng tới hạn (≤ N ngày) hoặc đã quá hạn
//   2. vuotHanMuc    — danh mục có hạn mức tháng, chi tháng này ≥ 90% hạn mức
//   3. vuotKeHoach   — danh mục chi thực tế tháng này vượt kế hoạch tháng
// Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(0, parseInt(searchParams.get('days') || '3', 10));

    const now = new Date();
    const nam = now.getFullYear();
    const thang = now.getMonth() + 1;
    const startOfMonth = new Date(nam, thang - 1, 1);
    const endOfMonth = new Date(nam, thang, 1);
    // Ngưỡng "sắp tới hạn": cuối ngày thứ N tính từ hôm nay.
    const nguongHan = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59);

    const [phieuToiHan, chiThangRaw, danhMucCoHanMuc, keHoachThang, pendingCount] = await Promise.all([
      // 1. Phiếu chờ xử lý có ngày cần thanh toán ≤ ngưỡng
      prisma.deXuatChiPhi.findMany({
        where: {
          trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
          laLichSu: false,
          ngayCanThanhToan: { not: null, lte: nguongHan },
        },
        include: {
          danhMuc: { select: { tenDanhMuc: true } },
          nhaCungCap: { select: { tenNCC: true } },
        },
        orderBy: { ngayCanThanhToan: 'asc' },
      }),
      // Chi thực tế tháng này theo danh mục
      prisma.thuChi.groupBy({
        by: ['danhMucId'],
        where: {
          loaiGiaoDich: 'CHI',
          ngayGiaoDich: { gte: startOfMonth, lt: endOfMonth },
        },
        _sum: { soTien: true },
      }),
      // Danh mục có đặt hạn mức tháng
      prisma.danhMuc.findMany({
        where: { hanMucThang: { not: null, gt: 0 }, trangThai: 'ACTIVE' },
        select: { id: true, tenDanhMuc: true, hanMucThang: true },
      }),
      // Kế hoạch chi tháng này theo danh mục
      prisma.keHoach.findMany({
        where: { nam, thang, soTien: { gt: 0 } },
        include: { danhMuc: { select: { tenDanhMuc: true } } },
      }),
      // Đếm nhẹ số phiếu đang chờ xử lý (cho chuông Sidebar — thay vì kéo cả 1000 phiếu)
      prisma.deXuatChiPhi.count({
        where: {
          trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
          laLichSu: false,
        },
      }),
    ]);

    // Map danhMucId → chi thực tế tháng
    const chiThangMap = {};
    chiThangRaw.forEach((r) => {
      chiThangMap[r.danhMucId] = Number(r._sum.soTien || 0);
    });

    // 1. Nhắc hạn thanh toán
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nhacHan = phieuToiHan.map((p) => {
      const han = new Date(p.ngayCanThanhToan);
      const quaHan = han < startOfToday;
      const soNgay = Math.round((han - startOfToday) / (24 * 60 * 60 * 1000));
      return {
        id: p.id,
        maPhieu: p.maPhieu,
        noiDung: p.noiDung,
        soTien: p.soTien,
        danhMuc: p.danhMuc?.tenDanhMuc || '',
        nhaCungCap: p.nhaCungCap?.tenNCC || '',
        ngayCanThanhToan: p.ngayCanThanhToan,
        quaHan,
        soNgay, // <0: quá hạn; 0: hôm nay; >0: còn N ngày
      };
    });

    // 2. Vượt / sắp chạm hạn mức (≥ 90%)
    const vuotHanMuc = [];
    danhMucCoHanMuc.forEach((dm) => {
      const daChi = chiThangMap[dm.id] || 0;
      const hanMuc = dm.hanMucThang;
      const tile = hanMuc > 0 ? Math.round((daChi / hanMuc) * 100) : 0;
      if (tile >= 90) {
        vuotHanMuc.push({
          danhMucId: dm.id,
          tenDanhMuc: dm.tenDanhMuc,
          daChi,
          hanMuc,
          tile,
          vuot: daChi > hanMuc,
        });
      }
    });
    vuotHanMuc.sort((a, b) => b.tile - a.tile);

    // 3. Vượt kế hoạch chi tháng
    const vuotKeHoach = [];
    keHoachThang.forEach((kh) => {
      const daChi = chiThangMap[kh.danhMucId] || 0;
      if (daChi > kh.soTien) {
        vuotKeHoach.push({
          danhMucId: kh.danhMucId,
          tenDanhMuc: kh.danhMuc?.tenDanhMuc || '',
          daChi,
          keHoach: kh.soTien,
          tile: kh.soTien > 0 ? Math.round((daChi / kh.soTien) * 100) : 0,
        });
      }
    });
    vuotKeHoach.sort((a, b) => b.tile - a.tile);

    const tongSo = nhacHan.length + vuotHanMuc.length + vuotKeHoach.length;

    return NextResponse.json({
      thang,
      nam,
      days,
      nhacHan,
      vuotHanMuc,
      vuotKeHoach,
      tongSo,
      pendingCount,
    });
  } catch (error) {
    logger.error('GET /api/canh-bao', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
