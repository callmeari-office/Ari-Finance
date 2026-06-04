import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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
        { error: 'Chỉ Admin/Owner mới có quyền cập nhật nhân viên.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { hoTen, tenNgan, phone, phongBan, viTri, matKhau, role, trangThai } = body;

    const existingNhanVien = await prisma.nhanVien.findUnique({
      where: { id },
    });

    if (!existingNhanVien) {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên.' }, { status: 404 });
    }

    const updateData = {};
    if (hoTen) updateData.hoTen = hoTen;
    if (tenNgan !== undefined) updateData.tenNgan = tenNgan || null;
    if (phone !== undefined) updateData.phone = phone;
    if (phongBan !== undefined) updateData.phongBan = phongBan;
    if (viTri !== undefined) updateData.viTri = viTri;
    if (role) updateData.role = role;
    if (trangThai) updateData.trangThai = trangThai;


    // Reset mật khẩu nếu có
    if (matKhau) {
      const salt = await bcrypt.genSalt(10);
      updateData.matKhau = await bcrypt.hash(matKhau, salt);
    }

    const updated = await prisma.nhanVien.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật nhân viên ${updated.hoTen} thành công.`,
      nhanVien: updated,
    });
  } catch (error) {
    logger.error('PUT /api/nhan-su/[id]', error);
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
        { error: 'Chỉ Admin/Owner mới có quyền xóa nhân viên.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingNhanVien = await prisma.nhanVien.findUnique({
      where: { id },
    });

    if (!existingNhanVien) {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên.' }, { status: 404 });
    }

    // Không cho phép tự xóa tài khoản của chính mình
    if (existingNhanVien.id === user.id) {
      return NextResponse.json(
        { error: 'Không thể tự xóa tài khoản quản trị đang đăng nhập.' },
        { status: 400 }
      );
    }

    await prisma.nhanVien.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhân viên ${existingNhanVien.hoTen} thành công.`,
    });
  } catch (error) {
    logger.error('DELETE /api/nhan-su/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống. Nhân viên này có thể có liên kết với phiếu đề xuất chi cũ.' },
      { status: 500 }
    );
  }
}
