// src/lib/dashboardQueries.js
// Hàm query thuần — tách từ các route API để dùng chung cho /api/dashboard.
// Không có auth check, không import NextResponse.
// Các route gốc vẫn giữ nguyên URL + response shape, chỉ đổi ruột thành gọi hàm này.

import { tinhSoDuQuy } from './finance';

/**
 * Tổng hợp lãi/lỗ theo tháng cho cả năm.
 * Nguồn chi: ThuChi(CHI) + DeXuatChiPhi(laLichSu=true) — COALESCE(ngayThanhToan, ngayPhatSinh).
 */
export async function getLoiNhuanNam(prisma, nam) {
  const startOfYear = new Date(nam, 0, 1);
  const endOfYear = new Date(nam + 1, 0, 1);

  const [doanhThuRows, keHoachChiRows, chiThuChiRows, chiLichSuRows] = await Promise.all([
    prisma.keHoachDoanhThu.groupBy({
      by: ['thang'],
      where: { nam },
      _sum: { thucTe: true, chiTieu: true },
    }),
    prisma.keHoach.groupBy({
      by: ['thang'],
      where: { nam },
      _sum: { soTien: true },
    }),
    prisma.$queryRaw`
      SELECT EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang, SUM("soTien") AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
        AND "loaiGiaoDich" = 'CHI'
      GROUP BY thang
    `,
    prisma.$queryRaw`
      SELECT EXTRACT(MONTH FROM COALESCE("ngayThanhToan", "ngayPhatSinh"))::int AS thang, SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfYear}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfYear}
        AND "laLichSu" = true
      GROUP BY thang
    `,
  ]);

  const months = [];
  for (let t = 1; t <= 12; t++) {
    months.push({
      thang: t,
      doanhThuThucTe: 0, doanhThuChiTieu: 0,
      chiPhiThucTe: 0, chiPhiKeHoach: 0,
      loiNhuanThucTe: 0, loiNhuanKeHoach: 0,
    });
  }
  const byMonth = (t) => months[t - 1];

  doanhThuRows.forEach((r) => {
    const m = byMonth(r.thang); if (!m) return;
    m.doanhThuThucTe += Number(r._sum.thucTe || 0);
    m.doanhThuChiTieu += Number(r._sum.chiTieu || 0);
  });
  keHoachChiRows.forEach((r) => {
    const m = byMonth(r.thang); if (!m) return;
    m.chiPhiKeHoach += Number(r._sum.soTien || 0);
  });
  chiThuChiRows.forEach((r) => {
    const m = byMonth(Number(r.thang)); if (!m) return;
    m.chiPhiThucTe += Number(r.total || 0);
  });
  chiLichSuRows.forEach((r) => {
    const m = byMonth(Number(r.thang)); if (!m) return;
    m.chiPhiThucTe += Number(r.total || 0);
  });

  const tong = {
    doanhThuThucTe: 0, doanhThuChiTieu: 0,
    chiPhiThucTe: 0, chiPhiKeHoach: 0,
    loiNhuanThucTe: 0, loiNhuanKeHoach: 0,
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
  tong.bienLoiNhuan = tong.doanhThuThucTe > 0
    ? Math.round((tong.loiNhuanThucTe / tong.doanhThuThucTe) * 100) : 0;

  return { nam, months, tong };
}

/**
 * Cảnh báo: nhắc hạn, vượt hạn mức, vượt kế hoạch tháng.
 * Nguồn chi dùng COALESCE — khớp với loi-nhuan, ke-hoach.
 */
export async function getCanhBao(prisma, days = 3) {
  const now = new Date();
  const nam = now.getFullYear();
  const thang = now.getMonth() + 1;
  const startOfMonth = new Date(nam, thang - 1, 1);
  const endOfMonth = new Date(nam, thang, 1);
  const nguongHan = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59);

  const [phieuToiHan, chiThangRaw, chiLichSuRaw, danhMucCoHanMuc, keHoachThang, pendingCount] = await Promise.all([
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
    prisma.thuChi.groupBy({
      by: ['danhMucId'],
      where: { loaiGiaoDich: 'CHI', ngayGiaoDich: { gte: startOfMonth, lt: endOfMonth } },
      _sum: { soTien: true },
    }),
    prisma.$queryRaw`
      SELECT "danhMucId", SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE "laLichSu" = true
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfMonth}
      GROUP BY "danhMucId"
    `,
    prisma.danhMuc.findMany({
      where: { hanMucThang: { not: null, gt: 0 }, trangThai: 'ACTIVE' },
      select: { id: true, tenDanhMuc: true, hanMucThang: true },
    }),
    prisma.keHoach.findMany({
      where: { nam, thang, soTien: { gt: 0 } },
      include: { danhMuc: { select: { tenDanhMuc: true } } },
    }),
    prisma.deXuatChiPhi.count({
      where: {
        OR: [
          { trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] }, laLichSu: false },
          {
            trangThai: 'DA_THANH_TOAN',
            laLichSu: false,
            OR: [
              { quyThanhToanId: null },
              { thuChiId: null }
            ]
          }
        ]
      },
    }),
  ]);

  const chiThangMap = {};
  chiThangRaw.forEach((r) => {
    chiThangMap[r.danhMucId] = (chiThangMap[r.danhMucId] || 0) + Number(r._sum.soTien || 0);
  });
  chiLichSuRaw.forEach((r) => {
    chiThangMap[r.danhMucId] = (chiThangMap[r.danhMucId] || 0) + Number(r.total || 0);
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nhacHan = phieuToiHan.map((p) => {
    const han = new Date(p.ngayCanThanhToan);
    const quaHan = han < startOfToday;
    const soNgay = Math.round((han - startOfToday) / (24 * 60 * 60 * 1000));
    return {
      id: p.id, maPhieu: p.maPhieu, noiDung: p.noiDung, soTien: p.soTien,
      danhMuc: p.danhMuc?.tenDanhMuc || '', nhaCungCap: p.nhaCungCap?.tenNCC || '',
      ngayCanThanhToan: p.ngayCanThanhToan, quaHan, soNgay,
    };
  });

  const vuotHanMuc = [];
  danhMucCoHanMuc.forEach((dm) => {
    const daChi = chiThangMap[dm.id] || 0;
    const hanMuc = dm.hanMucThang;
    const tile = hanMuc > 0 ? Math.round((daChi / hanMuc) * 100) : 0;
    if (tile >= 90) {
      vuotHanMuc.push({ danhMucId: dm.id, tenDanhMuc: dm.tenDanhMuc, daChi, hanMuc, tile, vuot: daChi > hanMuc });
    }
  });
  vuotHanMuc.sort((a, b) => b.tile - a.tile);

  const vuotKeHoach = [];
  keHoachThang.forEach((kh) => {
    const daChi = chiThangMap[kh.danhMucId] || 0;
    if (daChi > kh.soTien) {
      vuotKeHoach.push({
        danhMucId: kh.danhMucId, tenDanhMuc: kh.danhMuc?.tenDanhMuc || '',
        daChi, keHoach: kh.soTien,
        tile: kh.soTien > 0 ? Math.round((daChi / kh.soTien) * 100) : 0,
      });
    }
  });
  vuotKeHoach.sort((a, b) => b.tile - a.tile);

  return {
    thang, nam, days,
    nhacHan, vuotHanMuc, vuotKeHoach,
    tongSo: nhacHan.length + vuotHanMuc.length + vuotKeHoach.length,
    pendingCount,
  };
}

/**
 * Thống kê thu/chi N tháng gần nhất.
 * Trả mảng { thang: "YYYY-MM", thu, chi }[] theo thứ tự tăng dần.
 */
export async function getThongKeThang(prisma, soThang = 6) {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = new Date(now.getFullYear(), now.getMonth() - soThang + 1, 1);

  const [thuChiRows, lichSuRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "ngayGiaoDich"), 'YYYY-MM') AS thang,
        "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startDate} AND "ngayGiaoDich" < ${endDate}
      GROUP BY 1, 2
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE("ngayThanhToan", "ngayPhatSinh")), 'YYYY-MM') AS thang,
        SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startDate}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endDate}
        AND "laLichSu" = true
      GROUP BY 1
    `,
  ]);

  const map = {};
  for (const row of thuChiRows) {
    const t = row.thang;
    if (!map[t]) map[t] = { thang: t, thu: 0, chi: 0 };
    if (row.loaiGiaoDich === 'THU') map[t].thu = Number(row.total);
    else if (row.loaiGiaoDich === 'CHI') map[t].chi = Number(row.total);
  }
  for (const row of lichSuRows) {
    const t = row.thang;
    if (!map[t]) map[t] = { thang: t, thu: 0, chi: 0 };
    map[t].chi += Number(row.total);
  }

  return Object.values(map).sort((a, b) => a.thang.localeCompare(b.thang));
}

/**
 * Dự báo dòng tiền đến cuối tháng hoặc N ngày.
 * daysParam: 'thang' | '30' | '60' | '90'
 */
export async function getDuBao(prisma, daysParam = 'thang') {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nam = now.getFullYear();
  const thang = now.getMonth() + 1;

  let endDate, soNgayForecast;
  if (daysParam === 'thang') {
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    soNgayForecast = endDate.getDate() - today.getDate();
  } else {
    const d = parseInt(daysParam, 10);
    soNgayForecast = isNaN(d) ? 30 : Math.min(90, Math.max(7, d));
    endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + soNgayForecast);
  }
  if (soNgayForecast <= 0) soNgayForecast = 1;

  const endDateInclusive = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);

  const [funds, thuChiAgg, committedDeXuat, avgChiRaw, keHoachThangAgg, avgThuRaw, phieuDinhKyList, phieuDaTaoTrongKy] = await Promise.all([
    prisma.quy.findMany({ where: { trangThai: 'ACTIVE' }, select: { id: true, soDuDauKy: true, soDuDieuChinh: true } }),
    prisma.thuChi.groupBy({ by: ['quyId', 'loaiGiaoDich'], _sum: { soTien: true } }),
    prisma.deXuatChiPhi.findMany({
      where: {
        trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
        laLichSu: false,
        ngayCanThanhToan: { gte: today, lte: endDateInclusive },
      },
      select: { soTien: true, ngayCanThanhToan: true, maPhieu: true },
      orderBy: { ngayCanThanhToan: 'asc' },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "ThuChi"
      WHERE "loaiGiaoDich" = 'CHI'
        AND "ngayGiaoDich" >= ${thirtyDaysAgo} AND "ngayGiaoDich" < ${today}
    `,
    prisma.keHoachDoanhThu.aggregate({ _sum: { chiTieu: true }, where: { nam, thang } }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "ThuChi"
      WHERE "loaiGiaoDich" = 'THU'
        AND "ngayGiaoDich" >= ${thirtyDaysAgo} AND "ngayGiaoDich" < ${today}
    `,
    prisma.phieuDinhKy.findMany({ where: { active: true }, select: { soTien: true, ngayChiTrongThang: true, danhMucId: true, noiDung: true } }),
    prisma.deXuatChiPhi.findMany({
      where: {
        laLichSu: false,
        trangThai: { not: 'HUY' },
        ngayPhatSinh: { gte: today, lte: endDateInclusive },
      },
      select: { danhMucId: true, noiDung: true, ngayPhatSinh: true },
    }),
  ]);

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
    soDuHomNay += tinhSoDuQuy({ soDuDauKy: q.soDuDauKy, tongThu: tc.thu, tongChi: tc.chi, soDuDieuChinh: q.soDuDieuChinh });
  });

  const avgChiNgay = Number(avgChiRaw[0]?.total || 0) / 30;
  const chiTieuThang = Number(keHoachThangAgg._sum.chiTieu || 0);
  let avgThuNgay, nguonThu;
  if (chiTieuThang > 0) {
    const ngayTrongThang = new Date(nam, thang, 0).getDate();
    avgThuNgay = chiTieuThang / ngayTrongThang;
    nguonThu = 'ke-hoach';
  } else {
    avgThuNgay = Number(avgThuRaw[0]?.total || 0) / 30;
    nguonThu = 'xu-huong';
  }

  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const committedByDay = {};
  committedDeXuat.forEach((p) => {
    const k = dateKey(new Date(p.ngayCanThanhToan));
    committedByDay[k] = (committedByDay[k] || 0) + p.soTien;
  });

  const monthsInRange = new Map();
  for (let i = 1; i <= soNgayForecast; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const mk = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!monthsInRange.has(mk)) monthsInRange.set(mk, { year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  // Set khoá "danhMucId|noiDung|YYYY-M" của các phiếu đã được tạo thật trong kỳ
  // → tháng nào đã có phiếu thật thì KHÔNG chiếu bóng mẫu định kỳ nữa (tránh đếm trùng).
  const daTaoKeys = new Set();
  phieuDaTaoTrongKy.forEach((p) => {
    const d = new Date(p.ngayPhatSinh);
    daTaoKeys.add(`${p.danhMucId}|${p.noiDung}|${d.getFullYear()}-${d.getMonth() + 1}`);
  });

  phieuDinhKyList.forEach((p) => {
    monthsInRange.forEach(({ year, month }) => {
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(p.ngayChiTrongThang, lastDay);
      const targetDate = new Date(year, month - 1, day);
      if (targetDate >= today && targetDate <= endDate) {
        const monthKey = `${p.danhMucId}|${p.noiDung}|${year}-${month}`;
        if (daTaoKeys.has(monthKey)) return; // đã có phiếu thật cho khoản này tháng này
        const k = dateKey(targetDate);
        committedByDay[k] = (committedByDay[k] || 0) + p.soTien;
      }
    });
  });

  let soDuChay = soDuHomNay;
  let ngayCoTheAm = null;
  const weekBuckets = [];
  for (let i = 1; i <= soNgayForecast; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const k = dateKey(d);
    const committed = committedByDay[k] || 0;
    const dayChi = committed > 0 ? committed : avgChiNgay;
    soDuChay = soDuChay + avgThuNgay - dayChi;
    if (soDuChay < 0 && ngayCoTheAm === null) ngayCoTheAm = k;

    const weekIdx = Math.floor((i - 1) / 7);
    if (!weekBuckets[weekIdx]) {
      weekBuckets[weekIdx] = {
        nhan: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        ngayBatDau: k, soDuCuoiTuan: 0, chiCommitted: 0,
      };
    }
    weekBuckets[weekIdx].chiCommitted += committed;
    weekBuckets[weekIdx].soDuCuoiTuan = Math.round(soDuChay);
  }

  const thisMonthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
  const tongChiCommitted = committedDeXuat.reduce((s, p) => s + p.soTien, 0)
    + phieuDinhKyList.reduce((s, p) =>
        daTaoKeys.has(`${p.danhMucId}|${p.noiDung}|${thisMonthKey}`) ? s : s + p.soTien, 0);

  return {
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
  };
}

/**
 * Danh sách quỹ ACTIVE kèm tổng thu/chi và số phiếu.
 * Khớp 100% với GET /api/quy.
 */
export async function getFunds(prisma) {
  const [quys, aggregations] = await Promise.all([
    prisma.quy.findMany({ where: { trangThai: 'ACTIVE' } }),
    prisma.thuChi.groupBy({
      by: ['quyId', 'loaiGiaoDich'],
      _sum: { soTien: true },
      _count: { _all: true },
    }),
  ]);

  return quys.map((quy) => {
    const rows = aggregations.filter((a) => a.quyId === quy.id);
    const tongThu = rows.filter((a) => a.loaiGiaoDich === 'THU').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);
    const tongChi = rows.filter((a) => a.loaiGiaoDich === 'CHI').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);
    const soPhieu = rows.reduce((s, a) => s + (a._count?._all ?? 0), 0);
    const soDuDieuChinh = quy.soDuDieuChinh ?? 0;
    return {
      ...quy,
      soDuDieuChinh,
      tongThu,
      tongChi,
      soPhieu,
      soDuHienTai: tinhSoDuQuy({ soDuDauKy: quy.soDuDauKy, tongThu, tongChi, soDuDieuChinh }),
    };
  });
}

/**
 * Gộp các dòng "còn lại" theo danh mục → tổng + mảng sắp giảm dần.
 * rows: [{ danhMucId, tenDanhMuc, soTien }]
 * Pure — test được (xem chiPhiDuKien.test.js).
 */
export function gomConLaiTheoDanhMuc(rows) {
  const map = {};
  for (const r of rows || []) {
    const id = r.danhMucId;
    if (!map[id]) map[id] = { danhMucId: id, tenDanhMuc: r.tenDanhMuc || '', soTien: 0 };
    map[id].soTien += Number(r.soTien || 0);
  }
  const conLaiTheoDanhMuc = Object.values(map).sort((a, b) => b.soTien - a.soTien);
  const conLaiCoDinh = conLaiTheoDanhMuc.reduce((s, d) => s + d.soTien, 0);
  return { conLaiCoDinh, conLaiTheoDanhMuc };
}

/**
 * Chi phí dự kiến cả tháng (tháng hiện tại) — lớp phái sinh, KHÔNG đụng invariant §4.
 *   daChiThang  : đã chi thực tế tháng (ThuChi CHI + DeXuat laLichSu) — KHỚP getLoiNhuanNam.
 *   conLaiCoDinh: Σ phiếu Chờ thanh toán/Chờ hoàn ứng (laLichSu=false, chưa thành ThuChi),
 *                 COALESCE(ngayCanThanhToan, ngayPhatSinh) trong tháng hiện tại.
 *   duKienCaThang = daChiThang + conLaiCoDinh.
 */
export async function getChiPhiDuKienThang(prisma) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [chiThuChiRows, chiLichSuRows, conLaiRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startOfMonth} AND "ngayGiaoDich" < ${endOfMonth}
        AND "loaiGiaoDich" = 'CHI'
    `,
    prisma.$queryRaw`
      SELECT COALESCE(SUM("soTien"), 0) AS total
      FROM "DeXuatChiPhi"
      WHERE "laLichSu" = true
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE("ngayThanhToan", "ngayPhatSinh") < ${endOfMonth}
    `,
    prisma.$queryRaw`
      SELECT d."danhMucId", dm."tenDanhMuc", SUM(d."soTien") AS "soTien"
      FROM "DeXuatChiPhi" d
      LEFT JOIN "DanhMuc" dm ON dm."id" = d."danhMucId"
      WHERE d."laLichSu" = false
        AND d."thuChiId" IS NULL
        AND d."trangThai" IN ('CHO_THANH_TOAN', 'CHO_HOAN_UNG')
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") < ${endOfMonth}
      GROUP BY d."danhMucId", dm."tenDanhMuc"
    `,
  ]);

  const daChiThang = Number(chiThuChiRows[0]?.total || 0) + Number(chiLichSuRows[0]?.total || 0);
  const { conLaiCoDinh, conLaiTheoDanhMuc } = gomConLaiTheoDanhMuc(conLaiRows);

  return {
    daChiThang: Math.round(daChiThang),
    conLaiCoDinh: Math.round(conLaiCoDinh),
    duKienCaThang: Math.round(daChiThang + conLaiCoDinh),
    conLaiTheoDanhMuc: conLaiTheoDanhMuc.map((d) => ({ ...d, soTien: Math.round(d.soTien) })),
  };
}
