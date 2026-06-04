import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

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
    const { hoTen, tenNgan, email, phone, phongBan, viTri, matKhau, role, trangThai } = body;

    const existingNhanVien = await prisma.nhanVien.findUnique({
      where: { id },
    });

    if (!existingNhanVien) {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên.' }, { status: 404 });
    }

    const updateData = {};
    if (hoTen) updateData.hoTen = hoTen;
    if (tenNgan !== undefined) updateData.tenNgan = tenNgan || null;
    if (email !== undefined && email !== null) updateData.email = email.trim();
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

    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: updated.id,
      moTa: `Cập nhật nhân viên ${updated.hoTen}${matKhau ? ' (có đặt lại mật khẩu)' : ''}`,
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

    // Không cho phép tự khóa tài khoản của chính mình
    if (existingNhanVien.id === user.id) {
      return NextResponse.json(
        { error: 'Không thể tự khóa tài khoản quản trị đang đăng nhập.' },
        { status: 400 }
      );
    }

    if (existingNhanVien.trangThai === 'INACTIVE') {
      return NextResponse.json(
        { error: `Nhân viên ${existingNhanVien.hoTen} đã ở trạng thái ngừng hoạt động.` },
        { status: 400 }
      );
    }

    // SOFT-DELETE: khóa tài khoản (INACTIVE) thay vì xóa cứng.
    // Giữ lại toàn bộ lịch sử phiếu/giao dịch đã ghi sổ; tài khoản INACTIVE không đăng nhập được.
    await prisma.nhanVien.update({
      where: { id },
      data: { trangThai: 'INACTIVE' },
    });

    // Xóa các phiên đăng nhập đang mở để buộc đăng xuất ngay.
    await prisma.session.deleteMany({ where: { userId: id } }).catch(() => {});

    await ghiNhatKy({
      user,
      hanhDong: 'KHOA',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: existingNhanVien.id,
      moTa: `Khóa (ngừng hoạt động) nhân viên ${existingNhanVien.hoTen}`,
    });

    return NextResponse.json({
      success: true,
      message: `Đã khóa nhân viên ${existingNhanVien.hoTen}. Tài khoản không đăng nhập được nữa nhưng lịch sử vẫn được giữ lại.`,
    });
  } catch (error) {
    logger.error('DELETE /api/nhan-su/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
