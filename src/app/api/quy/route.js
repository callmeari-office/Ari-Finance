import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) return NextResponse.json({ error: 'Chỉ Owner mới có quyền thêm quỹ.' }, { status: 403 });

    const body = await request.json();
    const { id, tenQuy, loaiQuy, soDuDauKy } = body;

    if (!id || !tenQuy || !loaiQuy) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin bắt buộc.' }, { status: 400 });
    }

    if (!['TIEN_MAT', 'NGAN_HANG', 'CA_NHAN'].includes(loaiQuy)) {
      return NextResponse.json({ error: 'Loại quỹ không hợp lệ.' }, { status: 400 });
    }

    const exists = await prisma.quy.findUnique({ where: { id: id.trim().toUpperCase() } });
    if (exists) return NextResponse.json({ error: `Mã quỹ [${id}] đã tồn tại.` }, { status: 400 });

    const newQuy = await prisma.quy.create({
      data: {
        id: id.trim().toUpperCase(),
        tenQuy: tenQuy.trim(),
        loaiQuy,
        soDuDauKy: Number(soDuDauKy) || 0,
        trangThai: 'ACTIVE',
      }
    });

    return NextResponse.json({ success: true, message: `Đã thêm quỹ "${tenQuy}" thành công.`, quy: newQuy });
  } catch (error) {
    logger.error('POST /api/quy', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền thực hiện hành động này.' },
        { status: 403 }
      );
    }

    const [quys, aggregations] = await Promise.all([
      prisma.quy.findMany({ where: { trangThai: 'ACTIVE' } }),
      prisma.thuChi.groupBy({
        by: ['quyId', 'loaiGiaoDich'],
        _sum: { soTien: true },
      }),
    ]);

    const data = quys.map((quy) => {
      const tongThu = aggregations
        .filter((a) => a.quyId === quy.id && a.loaiGiaoDich === 'THU')
        .reduce((sum, a) => sum + (a._sum.soTien ?? 0), 0);

      const tongChi = aggregations
        .filter((a) => a.quyId === quy.id && a.loaiGiaoDich === 'CHI')
        .reduce((sum, a) => sum + (a._sum.soTien ?? 0), 0);

      return {
        ...quy,
        tongThu,
        tongChi,
        soDuHienTai: quy.soDuDauKy + tongThu - tongChi,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Quy API GET', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
