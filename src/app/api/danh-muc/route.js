import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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

    // Lọc danh mục theo vai trò của người dùng
    const filteredCategories = categories.filter((cat) => {
      // Nếu là OWNER hoặc MANAGER thì xem được toàn bộ danh mục không bị giới hạn
      if (user.role === 'OWNER' || user.role === 'MANAGER') return true;
      try {
        const allowedRoles = JSON.parse(cat.chucVuDuocXem);
        return allowedRoles.includes(user.role);
      } catch (e) {
        return false;
      }
    });

    return NextResponse.json({
      categories: filteredCategories,
      groups,
    });
  } catch (error) {
    console.error('DanhMuc API error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
