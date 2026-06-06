import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/du-bao-dong-tien?days=thang|30|60|90
// Dự báo số dư quỹ từ hôm nay đến cuối kỳ.
// Công thức mỗi ngày t:
//   E_t = E_{t-1} + avgThuNgay − (committedChi_t nếu có, ngược lại avgChiNgay)
// Quyền: OWNER + MANAGER.
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days') || 'thang';

    const now = new Date();
    // Dùng local time, nhất quán với /api/canh-bao
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let endDate;
    let soNgayForecast;

    if (daysParam === 'thang') {
      // Cuối tháng hiện tại (ngày cuối cùng của tháng)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      soNgayForecast = endDate.getDate() - today.getDate();
    } else {
      const d = parseInt(daysParam, 10);
      soNgayForecast = isNaN(d) ? 30 : Math.min(90, Math.max(7, d));
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + soNgayForecast);
    }

    // Ít nhất 1 ngày để tránh chia 0
    if (soNgayForecast <= 0) soNgayForecast = 1;

    const endDateInclusive = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const nam = now.getFullYear();
    const thang = now.getMonth() + 1;

    // ===== 7 query chạy song song, không kéo hàng nghìn bản ghi =====
    const [
      funds,
      thuChiAgg,
      committedDeXuat,
      avgChiRaw,
      keHoachThangAgg,
      avgThuRaw,
      phieuDinhKyList,
    ] = await Promise.all([
      // Quỹ ACTIVE
      prisma.quy.findMany({
        where: { trangThai: 'ACTIVE' },
        select: { id: true, soDuDauKy: true, soDuDieuChinh: true },
      }),
      // Tổng THU/CHI toàn bộ lịch sử theo từng quỹ — để tính số dư hiện tại
      prisma.thuChi.groupBy({
        by: ['quyId', 'loaiGiaoDich'],
        _sum: { soTien: true },
      }),
      // Phiếu đề xuất cam kết sẽ chi trong kỳ dự báo
      prisma.deXuatChiPhi.findMany({
        where: {
          trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
          laLichSu: false,
          ngayCanThanhToan: { gte: today, lte: endDateInclusive },
        },
        select: { soTien: true, ngayCanThanhToan: true, maPhieu: true },
        orderBy: { ngayCanThanhToan: 'asc' },
      }),
      // Tổng CHI trong 30 ngày qua → avg/ngày
      prisma.$queryRaw`
        SELECT COALESCE(SUM("soTien"), 0) AS total
        FROM "ThuChi"
        WHERE "loaiGiaoDich" = 'CHI'
          AND "ngayGiaoDich" >= ${thirtyDaysAgo}
          AND "ngayGiaoDich" < ${today}
      `,
      // Tổng chỉ tiêu doanh thu tháng hiện tại (tất cả kênh)
      prisma.keHoachDoanhThu.aggregate({
        _sum: { chiTieu: true },
        where: { nam, thang },
      }),
      // Tổng THU trong 30 ngày qua → fallback avg/ngày
      prisma.$queryRaw`
        SELECT COALESCE(SUM("soTien"), 0) AS total
        FROM "ThuChi"
        WHERE "loaiGiaoDich" = 'THU'
          AND "ngayGiaoDich" >= ${thirtyDaysAgo}
          AND "ngayGiaoDich" < ${today}
      `,
      // Phiếu định kỳ active (số lượng nhỏ, an toàn findMany)
      prisma.phieuDinhKy.findMany({
        where: { active: true },
        select: { soTien: true, ngayChiTrongThang: true },
      }),
    ]);

    // ===== Số dư quỹ hiện tại (E₀) =====
    const thuChiMap = {};
    thuChiAgg.forEach((r) => {
      if (!thuChiMap[r.quyId]) thuChiMap[r.quyId] = { thu: 0, chi: 0 };
      const amt = Number(r._sum.soTien || 0);
      if (r.loaiGiaoDich === 'THU') thuChiMap[r.quyId].thu += amt;
      else thuChiMap[r.quyId].chi += amt;
    });

    let soDuHomNay = 0;
    funds.forEach((q) => {
      const tc = thuChiMap[q.id] || { thu: 0, chi: 0 };
      soDuHomNay += q.soDuDauKy + tc.thu - tc.chi + (q.soDuDieuChinh || 0);
    });

    // ===== avg chi/thu ngày =====
    const avgChiNgay = Number(avgChiRaw[0]?.total || 0) / 30;

    const chiTieuThang = Number(keHoachThangAgg._sum.chiTieu || 0);
    let avgThuNgay;
    let nguonThu;
    if (chiTieuThang > 0) {
      const ngayTrongThang = new Date(nam, thang, 0).getDate();
      avgThuNgay = chiTieuThang / ngayTrongThang;
      nguonThu = 'ke-hoach';
    } else {
      avgThuNgay = Number(avgThuRaw[0]?.total || 0) / 30;
      nguonThu = 'xu-huong';
    }

    // ===== Map committed chi theo ngày (key: "YYYY-MM-DD") =====
    const dateKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const committedByDay = {};
    committedDeXuat.forEach((p) => {
      const k = dateKey(new Date(p.ngayCanThanhToan));
      committedByDay[k] = (committedByDay[k] || 0) + p.soTien;
    });

    // Thêm phiếu định kỳ: mỗi tháng trong kỳ, tính ngày chi
    const monthsInRange = new Map(); // "Y-M" → {year, month}
    for (let i = 1; i <= soNgayForecast; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const mk = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!monthsInRange.has(mk)) monthsInRange.set(mk, { year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    phieuDinhKyList.forEach((p) => {
      monthsInRange.forEach(({ year, month }) => {
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(p.ngayChiTrongThang, lastDay);
        const targetDate = new Date(year, month - 1, day);
        if (targetDate >= today && targetDate <= endDate) {
          const k = dateKey(targetDate);
          committedByDay[k] = (committedByDay[k] || 0) + p.soTien;
        }
      });
    });

    // ===== Tính timeline, gom theo tuần =====
    let soDuChay = soDuHomNay;
    let ngayCoTheAm = null;
    const weekBuckets = [];

    for (let i = 1; i <= soNgayForecast; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const k = dateKey(d);
      const committed = committedByDay[k] || 0;
      // Ngày có khoản cam kết: dùng committed thay avgChi (không nhân đôi)
      const dayChi = committed > 0 ? committed : avgChiNgay;
      soDuChay = soDuChay + avgThuNgay - dayChi;

      if (soDuChay < 0 && ngayCoTheAm === null) {
        ngayCoTheAm = k;
      }

      const weekIdx = Math.floor((i - 1) / 7);
      if (!weekBuckets[weekIdx]) {
        weekBuckets[weekIdx] = {
          nhan: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          ngayBatDau: k,
          soDuCuoiTuan: 0,
          chiCommitted: 0,
        };
      }
      weekBuckets[weekIdx].chiCommitted += committed;
      weekBuckets[weekIdx].soDuCuoiTuan = Math.round(soDuChay);
    }

    const tongChiCommitted = committedDeXuat.reduce((s, p) => s + p.soTien, 0)
      + phieuDinhKyList.reduce((s, p) => s + p.soTien, 0);

    return NextResponse.json({
      soDuHomNay: Math.round(soDuHomNay),
      soDuDuBaoCuoiKy: Math.round(soDuChay),
      ngayKetThuc: dateKey(endDate),
      ngayCoTheAm,
      canhBaoAm: ngayCoTheAm !== null,
      soNgayForecast,
      giaDinh: {
        avgChiNgay: Math.round(avgChiNgay),
        avgThuNgay: Math.round(avgThuNgay),
        soPhieuSapToi: committedDeXuat.length,
        tongChiCommitted: Math.round(tongChiCommitted),
        nguonThu,
      },
      timeline: weekBuckets,
    });
  } catch (error) {
    logger.error('GET /api/du-bao-dong-tien', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
