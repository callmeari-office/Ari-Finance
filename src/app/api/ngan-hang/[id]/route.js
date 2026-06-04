import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Owner mới có quyền xóa ngân hàng.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.nganHang.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy ngân hàng.' }, { status: 404 });
    }

    await prisma.nganHang.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Đã xóa ngân hàng ${existing.tenVietTat} - ${existing.tenDayDu}.`,
    });
  } catch (error) {
    logger.error('DELETE /api/ngan-hang/[id]', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
