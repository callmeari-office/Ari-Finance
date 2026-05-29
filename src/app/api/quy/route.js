import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Owner/Manager được xem quỹ
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền thực hiện hành động này.' },
        { status: 403 }
      );
    }

    const quys = await prisma.quy.findMany({
      where: { trangThai: 'ACTIVE' },
    });

    const thuChis = await prisma.thuChi.findMany();

    const data = quys.map((quy) => {
      // Lọc các giao dịch thu và chi của quỹ này
      const giaoDichCuaQuy = thuChis.filter((tc) => tc.quyId === quy.id);
      
      const tongThu = giaoDichCuaQuy
        .filter((tc) => tc.loaiGiaoDich === 'THU')
        .reduce((sum, tc) => sum + tc.soTien, 0);

      const tongChi = giaoDichCuaQuy
        .filter((tc) => tc.loaiGiaoDich === 'CHI')
        .reduce((sum, tc) => sum + tc.soTien, 0);

      const soDuHienTai = quy.soDuDauKy + tongThu - tongChi;

      return {
        ...quy,
        tongThu,
        tongChi,
        soDuHienTai,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Quy API error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
