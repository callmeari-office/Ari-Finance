import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền sửa nhóm danh mục.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    let { tenNhom, thuTu } = body;

    const existing = await prisma.nhomChiPhi.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy nhóm danh mục cần sửa.' }, { status: 404 });
    }

    const updateData = {};
    if (tenNhom !== undefined) {
      tenNhom = tenNhom.trim();
      // Đồng bộ viết hoa/thường hợp lý và chuẩn:
      if (id.toUpperCase().startsWith('C')) {
        updateData.tenNhom = tenNhom.toUpperCase();
      } else {
        updateData.tenNhom = tenNhom.charAt(0).toUpperCase() + tenNhom.slice(1);
      }
    }
    if (thuTu !== undefined) {
      updateData.thuTu = parseInt(thuTu) || 99;
    }

    const updated = await prisma.nhomChiPhi.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật nhóm danh mục "${updated.tenNhom}" thành công.`,
      group: updated,
    });
  } catch (error) {
    logger.error('PUT /api/cau-hinh-nhom/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền xóa nhóm danh mục.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.nhomChiPhi.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy nhóm danh mục.' }, { status: 404 });
    }

    // Kiểm tra tính toàn vẹn dữ liệu: Có danh mục con nào liên kết không?
    const categoriesCount = await prisma.danhMuc.count({
      where: { nhomChiPhiId: id },
    });

    if (categoriesCount > 0) {
      return NextResponse.json(
        { error: `Không thể xóa vì nhóm "${existing.tenNhom}" đang có ${categoriesCount} danh mục con trực thuộc.` },
        { status: 400 }
      );
    }

    await prisma.nhomChiPhi.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhóm danh mục "${existing.tenNhom}" thành công.`,
    });
  } catch (error) {
    logger.error('DELETE /api/cau-hinh-nhom/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống khi xóa nhóm.' },
      { status: 500 }
    );
  }
}
