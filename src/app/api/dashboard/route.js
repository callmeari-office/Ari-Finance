import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canViewMenu, isRestrictedToOwnProposals, canViewCategory } from '@/lib/roles';
import { logger } from '@/lib/logger';
import { getLoiNhuanNam, getCanhBao, getThongKeThang, getDuBao, getFunds, getChiPhiDuKienThang, getDeXuatTheoNguoiThang } from '@/lib/dashboardQueries';

// GET /api/dashboard
// Gộp 8-10 request Dashboard thành 1 endpoint.
// Permission check phía server mirror canViewMenu() của page.js.
// Phần không có quyền → null trong response.
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const nam = new Date().getFullYear();
    const isRestricted = isRestrictedToOwnProposals(user.role);

    // Mirror ĐÚNG logic canViewMenu của page.js
    const seeFunds    = canViewMenu(user, 'tqQuy') || canViewMenu(user, 'tqKPITaiChinh');
    const seeTx       = canViewMenu(user, 'tqXuHuong') || canViewMenu(user, 'tqKPITaiChinh');
    const seeInsights = canViewMenu(user, 'tqKPITaiChinh') || canViewMenu(user, 'tqCanXuLy');
    const seeDuBao    = canViewMenu(user, 'tqDuBao');
    const seeNganSach = isRestricted && canViewMenu(user, 'keHoachDBThang');
    const seeDoanhThu = isRestricted && canViewMenu(user, 'doanhThuDBThang');
    // Widget "Đề xuất theo người" — Owner/Manager (cùng quyền khối "Cần xử lý").
    const seeDeXuatNguoi = !isRestricted && canViewMenu(user, 'tqCanXuLy');

    const proposalInclude = {
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      quyThanhToan: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDuyet: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
    };

    const settled = await Promise.allSettled([
      // Lợi nhuận + cảnh báo (OWNER/MANAGER với tqKPITaiChinh hoặc tqCanXuLy)
      seeInsights ? getLoiNhuanNam(prisma, nam) : Promise.resolve(null),
      seeInsights ? getCanhBao(prisma, 3) : Promise.resolve(null),

      // Thu-chi 6 tháng (OWNER/MANAGER với tqXuHuong hoặc tqKPITaiChinh)
      seeTx ? getThongKeThang(prisma, 6) : Promise.resolve(null),

      // Dự báo dòng tiền (theo quyền tqDuBao)
      seeDuBao ? getDuBao(prisma, 'thang') : Promise.resolve(null),

      // Danh sách quỹ (theo quyền tqQuy hoặc tqKPITaiChinh)
      seeFunds ? getFunds(prisma) : Promise.resolve(null),

      // OWNER/MANAGER: 5 phiếu gần nhất (không lọc laLichSu để khớp với /api/de-xuat)
      !isRestricted ? prisma.deXuatChiPhi.findMany({
        include: proposalInclude,
        orderBy: { ngayTao: 'desc' },
        take: 5,
      }) : Promise.resolve(null),

      // STAFF/LEADER: tối đa 200 phiếu của mình để tính thống kê cá nhân
      isRestricted ? prisma.deXuatChiPhi.findMany({
        where: { nguoiTaoId: user.id },
        include: proposalInclude,
        orderBy: { ngayTao: 'desc' },
        take: 200,
      }) : Promise.resolve(null),

      // OWNER/MANAGER: đếm phiếu chờ thanh toán (!laLichSu — khớp với logic cũ)
      !isRestricted ? prisma.deXuatChiPhi.count({
        where: {
          OR: [
            { trangThai: 'CHO_THANH_TOAN', laLichSu: false },
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
      }) : Promise.resolve(0),

      // OWNER/MANAGER: đếm phiếu chờ hoàn ứng
      !isRestricted ? prisma.deXuatChiPhi.count({
        where: { trangThai: 'CHO_HOAN_UNG', laLichSu: false },
      }) : Promise.resolve(0),

      // Thông báo nội bộ — mọi role đã đăng nhập
      prisma.$queryRaw`
        SELECT *
        FROM "ThongBaoNoiBo"
        WHERE "trangThai" = 'ACTIVE'
          AND ("ngayHetHan" IS NULL OR "ngayHetHan" > NOW())
        ORDER BY
          CASE WHEN "tag" = 'QUAN_TRONG' THEN 0 ELSE 1 END,
          "createdAt" DESC
      `,

      // Ngân sách (STAFF/LEADER có quyền keHoach) — inline vì cần role-based filtering
      seeNganSach ? (async () => {
        const cats = await prisma.danhMuc.findMany({ where: { trangThai: 'ACTIVE' }, select: { id: true, chucVuDuocXem: true } });
        const viewableIds = new Set(
          cats.filter((c) => {
            try { return canViewCategory(user.role, JSON.parse(c.chucVuDuocXem)); }
            catch { return false; }
          }).map((c) => c.id)
        );
        const startOfYear = new Date(nam, 0, 1);
        const endOfYear = new Date(nam + 1, 0, 1);
        let keHoachList = await prisma.keHoach.findMany({
          where: { nam },
          include: { danhMuc: { include: { nhomChiPhi: true } } },
        });
        keHoachList = keHoachList.filter((kh) => viewableIds.has(kh.danhMucId));

        const [thucTeByMonthThuChi, thucTeByMonthLichSu] = await Promise.all([
          prisma.$queryRaw`
            SELECT EXTRACT(MONTH FROM "ngayGiaoDich")::int AS thang,
              "danhMucId", 'CHI' AS "loaiGiaoDich", SUM("soTien") AS total
            FROM "ThuChi"
            WHERE "ngayGiaoDich" >= ${startOfYear} AND "ngayGiaoDich" < ${endOfYear}
              AND "loaiGiaoDich" = 'CHI'
            GROUP BY thang, "danhMucId"
          `,
          prisma.$queryRaw`
            SELECT EXTRACT(MONTH FROM "ngayPhatSinh")::int AS thang,
              "danhMucId", 'CHI' AS "loaiGiaoDich", SUM("soTien") AS total
            FROM "DeXuatChiPhi"
            WHERE "ngayPhatSinh" >= ${startOfYear}
              AND "ngayPhatSinh" < ${endOfYear}
              AND "laLichSu" = true
              AND "thuChiId" IS NULL
            GROUP BY thang, "danhMucId"
          `,
        ]);

        const mergedMap = {};
        const merge = (rows) => {
          for (const row of rows) {
            const key = `${row.thang}__${row.danhMucId}__${row.loaiGiaoDich}`;
            if (!mergedMap[key]) {
              mergedMap[key] = { thang: Number(row.thang), danhMucId: row.danhMucId, loaiGiaoDich: row.loaiGiaoDich, total: 0 };
            }
            mergedMap[key].total += Number(row.total);
          }
        };
        merge(thucTeByMonthThuChi);
        merge(thucTeByMonthLichSu);
        const thucTeByMonth = Object.values(mergedMap).filter((r) => viewableIds.has(r.danhMucId));

        return { keHoach: keHoachList, thucTeByMonth, nam };
      })() : Promise.resolve(null),

      // Doanh thu tháng mini (STAFF/LEADER có quyền doanhThuDBThang)
      seeDoanhThu ? (async () => {
        const [kenhBan, rows] = await Promise.all([
          prisma.kenhBan.findMany({
            where: { trangThai: 'ACTIVE' },
            orderBy: [{ thuTu: 'asc' }, { createdAt: 'asc' }],
          }),
          prisma.keHoachDoanhThu.findMany({ where: { nam } }),
        ]);
        const data = rows.map((r) => ({
          kenhBanId: r.kenhBanId, thang: r.thang, chiTieu: r.chiTieu, thucTe: r.thucTe,
        }));
        return { kenhBan, data, nam };
      })() : Promise.resolve(null),

      // Chi phí dự kiến cả tháng (OWNER/MANAGER — cùng quyền KPI tài chính)
      seeInsights ? getChiPhiDuKienThang(prisma) : Promise.resolve(null),

      // Đề xuất theo người — pipeline duyệt tháng này (OWNER/MANAGER)
      seeDeXuatNguoi ? getDeXuatTheoNguoiThang(prisma) : Promise.resolve(null),
    ]);

    // Resilience: 1 query hỏng (vd lệch schema, timeout) KHÔNG được kéo sập cả Dashboard.
    // Log lỗi từng phần, phần hỏng trả null (hoặc 0 cho các bộ đếm) để UI vẫn hiện phần còn lại.
    settled.forEach((r, i) => {
      if (r.status === 'rejected') logger.error(`GET /api/dashboard query[${i}]`, r.reason);
    });
    const pick = (i, fallback = null) => (settled[i].status === 'fulfilled' ? settled[i].value : fallback);
    const loiNhuan = pick(0);
    const canhBao = pick(1);
    const thongKeThang = pick(2);
    const duBao = pick(3);
    const funds = pick(4);
    const recentProposalsRaw = pick(5);
    const staffProposalsRaw = pick(6);
    const pendingPaymentCount = pick(7, 0);
    const pendingReimburseCount = pick(8, 0);
    const thongBao = pick(9);
    const nganSachData = pick(10);
    const doanhThuData = pick(11);
    const chiPhiDuKien = pick(12);
    const deXuatTheoNguoi = pick(13);

    return NextResponse.json({
      loiNhuan,
      canhBao,
      thongKeThang,
      duBao,
      funds,
      recentProposals: recentProposalsRaw || [],
      proposals: staffProposalsRaw || [],
      pendingPayment: pendingPaymentCount,
      pendingReimburse: pendingReimburseCount,
      thongBao: thongBao || [],
      nganSach: nganSachData,
      doanhThu: doanhThuData,
      chiPhiDuKien,
      deXuatTheoNguoi,
    });
  } catch (error) {
    logger.error('GET /api/dashboard', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
