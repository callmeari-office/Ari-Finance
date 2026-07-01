// src/lib/dashboardQueries.js
// Hàm query thuần — tách từ các route API để dùng chung cho /api/dashboard.
// Không có auth check, không import NextResponse.
// Các route gốc vẫn giữ nguyên URL + response shape, chỉ đổi ruột thành gọi hàm này.

import { tinhSoDuQuy } from './finance';
import { getSoNgaySapToiHan } from './cauHinh';

/**
 * Tổng hợp lãi/lỗ theo tháng cho cả năm.
 * Nguồn chi: ThuChi(CHI) + DeXuatChiPhi(laLichSu=true) — ngayPhatSinh.
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
        AND "buTruLichSu" = false
      GROUP BY thang
    `,
    prisma.$queryRaw`
      SELECT EXTRACT(MONTH FROM "ngayPhatSinh")::int AS thang, SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE "ngayPhatSinh" >= ${startOfYear}
        AND "ngayPhatSinh" < ${endOfYear}
        AND "laLichSu" = true
        AND "thuChiId" IS NULL
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
 * Nguồn chi dùng ngayPhatSinh — khớp với loi-nhuan, ke-hoach.
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
      where: { loaiGiaoDich: 'CHI', ngayGiaoDich: { gte: startOfMonth, lt: endOfMonth }, buTruLichSu: false },
      _sum: { soTien: true },
    }),
    prisma.$queryRaw`
      SELECT "danhMucId", SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE "laLichSu" = true
        AND "thuChiId" IS NULL
        AND "ngayPhatSinh" >= ${startOfMonth}
        AND "ngayPhatSinh" < ${endOfMonth}
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
 * Trả mảng { thang: "YYYY-MM", thu, chi, thuLaUocTinh? }[] theo thứ tự tăng dần.
 * Tháng chưa có ThuChi.THU (chưa hợp thức hoá) → fallback sang KeHoachDoanhThu.thucTe.
 */
export async function getThongKeThang(prisma, soThang = 6) {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = new Date(now.getFullYear(), now.getMonth() - soThang + 1, 1);
  const startMonthNum = startDate.getFullYear() * 100 + (startDate.getMonth() + 1);
  const endMonthNum = endDate.getFullYear() * 100 + (endDate.getMonth() + 1);

  const [thuChiRows, lichSuRows, doanhThuRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "ngayGiaoDich"), 'YYYY-MM') AS thang,
        "loaiGiaoDich",
        SUM("soTien") AS total
      FROM "ThuChi"
      WHERE "ngayGiaoDich" >= ${startDate} AND "ngayGiaoDich" < ${endDate}
        AND "buTruLichSu" = false
      GROUP BY 1, 2
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "ngayPhatSinh"), 'YYYY-MM') AS thang,
        SUM("soTien") AS total
      FROM "DeXuatChiPhi"
      WHERE "ngayPhatSinh" >= ${startDate}
        AND "ngayPhatSinh" < ${endDate}
        AND "laLichSu" = true
        AND "thuChiId" IS NULL
      GROUP BY 1
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(TO_DATE(nam::text || '-' || LPAD(thang::text, 2, '0') || '-01', 'YYYY-MM-DD'), 'YYYY-MM') AS thang,
        SUM("thucTe") AS total
      FROM "KeHoachDoanhThu"
      WHERE (nam * 100 + thang) >= ${startMonthNum}
        AND (nam * 100 + thang) < ${endMonthNum}
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

  // Fallback: tháng chưa có ThuChi.THU → dùng doanh thu thực tế làm ước tính
  const doanhThuMap = {};
  for (const row of doanhThuRows) {
    doanhThuMap[row.thang] = Number(row.total || 0);
  }
  for (const [key, dt] of Object.entries(doanhThuMap)) {
    if (!map[key]) map[key] = { thang: key, thu: 0, chi: 0 };
    if (map[key].thu === 0 && dt > 0) {
      map[key].thu = dt;
      map[key].thuLaUocTinh = true;
    }
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
        AND "buTruLichSu" = false
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
 * Tách các dòng "còn lại" thành: sắp tới hạn (ngày tới hạn <= nguong, GỒM quá hạn) và phần xa.
 * rows: [{ ..., ngay: Date|string }]; nguong: Date (cuối ngày hôm nay + N).
 * Pure — test được (xem chiPhiDuKien.test.js).
 */
export function splitSapToiHan(rows, nguong) {
  const sapToiHanRows = [];
  const conLaiXaRows = [];
  for (const r of rows || []) {
    const ngay = r.ngay instanceof Date ? r.ngay : new Date(r.ngay);
    if (!Number.isNaN(ngay.getTime()) && ngay <= nguong) sapToiHanRows.push(r);
    else conLaiXaRows.push(r);
  }
  return { sapToiHanRows, conLaiXaRows };
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
        AND "thuChiId" IS NULL
        AND "ngayPhatSinh" >= ${startOfMonth}
        AND "ngayPhatSinh" < ${endOfMonth}
    `,
    prisma.$queryRaw`
      SELECT d."danhMucId", dm."tenDanhMuc", d."soTien",
             COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") AS "ngay"
      FROM "DeXuatChiPhi" d
      LEFT JOIN "DanhMuc" dm ON dm."id" = d."danhMucId"
      WHERE d."laLichSu" = false
        AND d."thuChiId" IS NULL
        AND d."trangThai" IN ('CHO_THANH_TOAN', 'CHO_HOAN_UNG')
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") >= ${startOfMonth}
        AND COALESCE(d."ngayCanThanhToan", d."ngayPhatSinh") < ${endOfMonth}
    `,
  ]);

  const daChiThang = Number(chiThuChiRows[0]?.total || 0) + Number(chiLichSuRows[0]?.total || 0);
  const { conLaiCoDinh, conLaiTheoDanhMuc } = gomConLaiTheoDanhMuc(conLaiRows);

  // Lát cắt "sắp tới hạn N ngày" (gồm khoản quá hạn chưa trả).
  const soNgay = await getSoNgaySapToiHan(prisma);
  const nguong = new Date(now.getFullYear(), now.getMonth(), now.getDate() + soNgay, 23, 59, 59, 999);
  const { sapToiHanRows } = splitSapToiHan(conLaiRows, nguong);
  const { conLaiCoDinh: sapToiHan, conLaiTheoDanhMuc: sapToiHanTheoDanhMuc } = gomConLaiTheoDanhMuc(sapToiHanRows);

  return {
    daChiThang: Math.round(daChiThang),
    conLaiCoDinh: Math.round(conLaiCoDinh),
    duKienCaThang: Math.round(daChiThang + conLaiCoDinh),
    conLaiTheoDanhMuc: conLaiTheoDanhMuc.map((d) => ({ ...d, soTien: Math.round(d.soTien) })),
    soNgay,
    sapToiHan: Math.round(sapToiHan),
    sapToiHanTheoDanhMuc: sapToiHanTheoDanhMuc.map((d) => ({ ...d, soTien: Math.round(d.soTien) })),
    conLaiXa: Math.round(conLaiCoDinh - sapToiHan),
  };
}

/**
 * Pipeline duyệt đề xuất theo người — tháng hiện tại (widget Tổng quan, Owner/Manager).
 * Loại trừ HUY và laLichSu. Phạm vi theo ngayPhatSinh.
 *  - Đã duyệt & chi: DA_THANH_TOAN AND thuChiId != null
 *  - Chờ duyệt:      CHO_THANH_TOAN + CHO_HOAN_UNG + (DA_THANH_TOAN & thuChiId null = "thanh toán sẵn")
 * Kèm "tồn đọng": phiếu chờ duyệt phát sinh trước đầu tháng này (treo từ trước).
 */
export async function getDeXuatTheoNguoiThang(prisma) {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  const [rows, backlog] = await Promise.all([
    prisma.deXuatChiPhi.findMany({
      where: {
        laLichSu: false,
        trangThai: { not: 'HUY' },
        ngayPhatSinh: { gte: startOfMonth, lt: startOfNextMonth },
      },
      select: {
        soTien: true,
        trangThai: true,
        thuChiId: true,
        nguoiDeXuat: { select: { id: true, hoTen: true, tenNgan: true } },
      },
    }),
    prisma.deXuatChiPhi.findMany({
      where: {
        laLichSu: false,
        ngayPhatSinh: { lt: startOfMonth },
        OR: [
          { trangThai: 'CHO_THANH_TOAN' },
          { trangThai: 'CHO_HOAN_UNG' },
          { trangThai: 'DA_THANH_TOAN', thuChiId: null },
        ],
      },
      select: { soTien: true },
    }),
  ]);

  const byNguoi = {};
  for (const r of rows) {
    const id = r.nguoiDeXuat?.id || '__unknown__';
    const name = r.nguoiDeXuat?.tenNgan || r.nguoiDeXuat?.hoTen || 'Không xác định';
    if (!byNguoi[id]) byNguoi[id] = { id, name, daDuyet: 0, choDuyet: 0, soPhieu: 0 };
    const isDone = r.trangThai === 'DA_THANH_TOAN' && r.thuChiId != null;
    if (isDone) byNguoi[id].daDuyet += r.soTien;
    else byNguoi[id].choDuyet += r.soTien;
    byNguoi[id].soPhieu += 1;
  }

  const nguoiList = Object.values(byNguoi)
    .map((p) => ({
      id: p.id,
      name: p.name,
      daDuyet: Math.round(p.daDuyet),
      choDuyet: Math.round(p.choDuyet),
      tong: Math.round(p.daDuyet + p.choDuyet),
      soPhieu: p.soPhieu,
    }))
    .sort((a, b) => b.choDuyet - a.choDuyet || b.tong - a.tong);

  const tonDong = {
    soPhieu: backlog.length,
    soTien: Math.round(backlog.reduce((s, r) => s + r.soTien, 0)),
  };

  return {
    nguoiList,
    tonDong,
    tongChoDuyet: nguoiList.reduce((s, p) => s + p.choDuyet, 0),
    tongDaDuyet: nguoiList.reduce((s, p) => s + p.daDuyet, 0),
    thang: now.getMonth() + 1,
    nam: now.getFullYear(),
  };
}
