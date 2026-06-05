import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/quy/cashflow?ky=thang|nam|all
// Tổng dòng tiền VÀO (THU) / RA (CHI) theo kỳ cho 4 thẻ KPI trang Thông tin Quỹ.
// KHÔNG gồm khoản điều chỉnh thủ công (đó không phải dòng tiền thật).
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ky = ['thang', 'nam', 'all'].includes(searchParams.get('ky')) ? searchParams.get('ky') : 'all';

    const now = new Date();
    let range = null; // null = lũy kế toàn thời gian
    if (ky === 'thang') {
      range = {
        gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      };
    } else if (ky === 'nam') {
      range = {
        gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
        lt: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)),
      };
    }

    const [agg, ungAgg] = await Promise.all([
      prisma.thuChi.groupBy({
        by: ['loaiGiaoDich'],
        _sum: { soTien: true },
        ...(range ? { where: { ngayGiaoDich: range } } : {}),
      }),
      // Tiền nhân viên đang ứng cá nhân chưa được hoàn (snapshot hiện tại, không theo kỳ)
      prisma.deXuatChiPhi.aggregate({
        _sum: { soTien: true },
        _count: { _all: true },
        where: { trangThai: 'CHO_HOAN_UNG' },
      }),
    ]);

    const kyThu = agg.filter((a) => a.loaiGiaoDich === 'THU').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);
    const kyChi = agg.filter((a) => a.loaiGiaoDich === 'CHI').reduce((s, a) => s + (a._sum.soTien ?? 0), 0);

    return NextResponse.json({
      ky,
      kyThu,
      kyChi,
      netCashflow: kyThu - kyChi,
      tienDangUng: ungAgg._sum.soTien ?? 0,
      soPhieuDangUng: ungAgg._count._all ?? 0,
    });
  } catch (error) {
    logger.error('GET /api/quy/cashflow', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
