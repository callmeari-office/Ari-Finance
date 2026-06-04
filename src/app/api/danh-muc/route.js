import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { canViewCategory } from '@/lib/roles';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const categories = await prisma.danhMuc.findMany({
      where: { trangThai: 'ACTIVE' },
      include: { nhomChiPhi: true },
    });

    const groups = await prisma.nhomChiPhi.findMany({
      orderBy: { thuTu: 'asc' },
    });

    // Tính tổng chi tháng hiện tại per danh mục (1 query GROUP BY)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const chiThangRaw = await prisma.thuChi.groupBy({
      by: ['danhMucId'],
      where: {
        loaiGiaoDich: 'CHI',
        ngayGiaoDich: { gte: startOfMonth, lt: endOfMonth },
      },
      _sum: { soTien: true },
    });

    // Map danhMucId → soTienDaThuong
    const chiThangMap = {};
    chiThangRaw.forEach((r) => {
      chiThangMap[r.danhMucId] = r._sum.soTien || 0;
    });

    // Lọc danh mục theo vai trò
    const filteredCategories = categories
      .filter((cat) => {
        if (user.role === 'OWNER' || user.role === 'MANAGER') return true;
        try {
          const allowedRoles = JSON.parse(cat.chucVuDuocXem);
          return canViewCategory(user.role, allowedRoles);
        } catch {
          return false;
        }
      })
      .map((cat) => ({
        ...cat,
        soTienDaThuong: chiThangMap[cat.id] || 0,
      }));

    return NextResponse.json({ categories: filteredCategories, groups });
  } catch (error) {
    logger.error('GET /api/danh-muc', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
