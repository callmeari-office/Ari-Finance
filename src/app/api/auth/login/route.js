import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    const { email, matKhau } = await request.json(); // Ở client truyền tham số 'email' (ID đăng nhập) để tương thích state

    if (!email || !matKhau) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu.' },
        { status: 400 }
      );
    }

    // Chống dò mật khẩu: giới hạn theo IP + tên đăng nhập.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rlKey = `${ip}:${String(email).toLowerCase()}`;

    const rl = await checkRateLimit(rlKey);
    if (!rl.allowed) {
      const phut = Math.ceil((rl.retryAfterSec || 0) / 60);
      return NextResponse.json(
        { error: `Bạn đã thử sai quá nhiều lần. Vui lòng đợi ${phut} phút rồi thử lại.` },
        { status: 429 }
      );
    }

    // Tra cứu theo 'username' thay vì 'email'
    const user = await prisma.nhanVien.findUnique({
      where: { username: email },
    });

    if (!user || user.trangThai !== 'ACTIVE') {
      await recordFailure(rlKey);
      return NextResponse.json(
        { error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(matKhau, user.matKhau);
    if (!match) {
      const blocked = await recordFailure(rlKey);
      return NextResponse.json(
        {
          error: blocked
            ? 'Sai quá nhiều lần. Tài khoản tạm khóa đăng nhập 15 phút.'
            : 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        },
        { status: blocked ? 429 : 401 }
      );
    }

    // Đăng nhập thành công → xóa bộ đếm
    await resetRateLimit(rlKey);

    // Tạo session
    await createSession(user.id);

    await ghiNhatKy({
      user,
      hanhDong: 'DANG_NHAP',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: user.id,
      moTa: `Đăng nhập vào hệ thống`,
    });

    return NextResponse.json({
      id: user.id,
      hoTen: user.hoTen,
      email: user.email,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    logger.error('POST /api/auth/login', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
