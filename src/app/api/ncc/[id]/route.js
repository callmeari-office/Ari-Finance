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

    const { id } = await params;
    const body = await request.json();
    const { tenNCC, tenTaiKhoan, soTaiKhoan, tenNganHang, maQR, loaiDoiTuong } = body;

    const existingVendor = await prisma.nhaCungCap.findUnique({ where: { id } });
    if (!existingVendor) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp.' }, { status: 404 });
    }

    const isStaffOrLeader = !['OWNER', 'MANAGER'].includes(user.role);
    if (isStaffOrLeader && existingVendor.loaiDoiTuong === 'NHAN_VIEN') {
      return NextResponse.json({ error: 'Bạn không có quyền chỉnh sửa đối tượng Nhân viên.' }, { status: 403 });
    }

    const updateData = {};
    if (tenNCC) updateData.tenNCC = tenNCC.trim();
    if (tenTaiKhoan !== undefined) updateData.tenTaiKhoan = tenTaiKhoan ? tenTaiKhoan.trim() : null;
    if (soTaiKhoan) updateData.soTaiKhoan = soTaiKhoan.trim();
    if (tenNganHang) updateData.tenNganHang = tenNganHang.trim();
    if (maQR !== undefined) updateData.maQR = maQR;

    if (loaiDoiTuong !== undefined) {
      if (isStaffOrLeader) {
        return NextResponse.json({ error: 'Bạn không có quyền thay đổi loại đối tượng.' }, { status: 403 });
      }
      updateData.loaiDoiTuong = loaiDoiTuong;
    }

    const updated = await prisma.nhaCungCap.update({ where: { id }, data: updateData });

    return NextResponse.json({
      success: true,
      vendor: updated,
      message: 'Cập nhật thông tin nhà cung cấp thành công.',
    });
  } catch (error) {
    logger.error('PUT /api/ncc/[id]', error);
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

    // Chỉ OWNER được xóa nhà cung cấp
    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền xóa nhà cung cấp.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingVendor = await prisma.nhaCungCap.findUnique({
      where: { id },
      include: {
        deXuatChiPhi: { select: { id: true } },
        thuChi: { select: { id: true } },
      },
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp.' }, { status: 404 });
    }

    if (existingVendor.deXuatChiPhi.length > 0 || existingVendor.thuChi.length > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa nhà cung cấp này vì đã phát sinh giao dịch hoặc đề xuất liên quan.' },
        { status: 400 }
      );
    }

    await prisma.nhaCungCap.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhà cung cấp "${existingVendor.tenNCC}" thành công.`,
    });
  } catch (error) {
    logger.error('DELETE /api/ncc/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
