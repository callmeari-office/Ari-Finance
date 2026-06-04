import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

// PUT /api/kenh-ban/[id]  -> sửa kênh (OWNER)
// Body: { tenKenh?, mauSac?, thuTu?, trangThai? }
export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền sửa kênh bán.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.kenhBan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy kênh bán.' }, { status: 404 });
    }

    const updateData = {};
    if (body.tenKenh !== undefined) {
      const t = (body.tenKenh || '').trim();
      if (!t) return NextResponse.json({ error: 'Tên kênh bán không được để trống.' }, { status: 400 });
      updateData.tenKenh = t;
    }
    if (body.mauSac !== undefined) updateData.mauSac = body.mauSac || null;
    if (body.thuTu !== undefined) updateData.thuTu = Number(body.thuTu) || 0;
    if (body.trangThai !== undefined) updateData.trangThai = body.trangThai;

    const updated = await prisma.kenhBan.update({ where: { id }, data: updateData });

    return NextResponse.json({ ok: true, kenhBan: updated });
  } catch (error) {
    logger.error('PUT /api/kenh-ban/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// DELETE /api/kenh-ban/[id]  -> xoá kênh (OWNER)
// Soft-delete (set INACTIVE) nếu đã có dữ liệu doanh thu; xoá cứng nếu chưa có.
export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json({ error: 'Chỉ Chủ shop (Owner) mới có quyền xoá kênh bán.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.kenhBan.findUnique({
      where: { id },
      include: { keHoachDoanhThu: { select: { id: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy kênh bán.' }, { status: 404 });
    }

    if (existing.keHoachDoanhThu.length > 0) {
      // Đã có dữ liệu -> ẩn kênh để giữ lịch sử
      await prisma.kenhBan.update({ where: { id }, data: { trangThai: 'INACTIVE' } });
      return NextResponse.json({ ok: true, softDeleted: true, message: `Đã ẩn kênh "${existing.tenKenh}" (giữ lại dữ liệu cũ).` });
    }

    await prisma.kenhBan.delete({ where: { id } });
    return NextResponse.json({ ok: true, softDeleted: false, message: `Đã xoá kênh "${existing.tenKenh}".` });
  } catch (error) {
    logger.error('DELETE /api/kenh-ban/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
