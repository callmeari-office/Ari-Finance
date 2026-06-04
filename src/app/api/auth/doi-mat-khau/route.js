import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// Đổi mật khẩu của chính người đang đăng nhập (mọi vai trò).
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { matKhauCu, matKhauMoi } = await request.json();

    if (!matKhauCu || !matKhauMoi) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.' },
        { status: 400 }
      );
    }

    if (String(matKhauMoi).length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' },
        { status: 400 }
      );
    }

    if (matKhauCu === matKhauMoi) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' },
        { status: 400 }
      );
    }

    // getSession không trả về matKhau → lấy lại từ DB để kiểm tra.
    const dbUser = await prisma.nhanVien.findUnique({
      where: { id: user.id },
      select: { id: true, matKhau: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    const match = await bcrypt.compare(matKhauCu, dbUser.matKhau);
    if (!match) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(matKhauMoi, salt);

    await prisma.nhanVien.update({
      where: { id: user.id },
      data: { matKhau: hashed },
    });

    await ghiNhatKy({
      user,
      hanhDong: 'DOI_MAT_KHAU',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: user.id,
      moTa: 'Tự đổi mật khẩu cá nhân',
    });

    return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu thành công.' });
  } catch (error) {
    logger.error('POST /api/auth/doi-mat-khau', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
