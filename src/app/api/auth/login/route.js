import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, matKhau } = await request.json(); // Ở client truyền tham số 'email' (ID đăng nhập) để tương thích state

    if (!email || !matKhau) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu.' },
        { status: 400 }
      );
    }

    // Tra cứu theo 'username' thay vì 'email'
    const user = await prisma.nhanVien.findUnique({
      where: { username: email },
    });

    if (!user || user.trangThai !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Tài khoản không tồn tại hoặc đã bị khóa.' },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(matKhau, user.matKhau);
    if (!match) {
      return NextResponse.json(
        { error: 'Mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    // Tạo session
    await createSession(user.id);

    return NextResponse.json({
      id: user.id,
      hoTen: user.hoTen,
      email: user.email,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
