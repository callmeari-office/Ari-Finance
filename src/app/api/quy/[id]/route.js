import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) return NextResponse.json({ error: 'Chỉ Owner mới có quyền sửa quỹ.' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { tenQuy, loaiQuy, soDuDauKy, trangThai } = body;

    const existing = await prisma.quy.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy quỹ.' }, { status: 404 });

    const updated = await prisma.quy.update({
      where: { id },
      data: {
        tenQuy: tenQuy?.trim() ?? existing.tenQuy,
        loaiQuy: loaiQuy ?? existing.loaiQuy,
        soDuDauKy: soDuDauKy !== undefined ? Number(soDuDauKy) : existing.soDuDauKy,
        trangThai: trangThai ?? existing.trangThai,
      }
    });

    return NextResponse.json({ success: true, message: `Đã cập nhật quỹ "${updated.tenQuy}".`, quy: updated });
  } catch (error) {
    logger.error('PUT /api/quy/[id]', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) return NextResponse.json({ error: 'Chỉ Owner mới có quyền xóa quỹ.' }, { status: 403 });

    const { id } = await params;

    const txCount = await prisma.thuChi.count({ where: { quyId: id } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Không thể xóa quỹ này vì có ${txCount} phiếu thu-chi liên kết.` },
        { status: 400 }
      );
    }

    await prisma.quy.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Đã xóa quỹ thành công.' });
  } catch (error) {
    logger.error('DELETE /api/quy/[id]', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
