import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, createSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/rateLimit';

// Đổi mật khẩu của chính người đang đăng nhập (mọi vai trò).
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const rlKey = `doi-mat-khau:${user.id}`;
    const rl = await checkRateLimit(rlKey);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Quá nhiều lần thử. Vui lòng thử lại sau ${rl.retryAfterSec} giây.` },
        { status: 429 }
      );
    }

    const { matKhauCu, matKhauMoi } = await request.json();

    if (!matKhauCu || !matKhauMoi) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.' },
        { status: 400 }
      );
    }

    if (String(matKhauMoi).length < 10) {
      return NextResponse.json(
        { error: 'Mật khẩu mới phải có ít nhất 10 ký tự.' },
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
      await recordFailure(rlKey);
      return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(matKhauMoi, salt);

    await prisma.nhanVien.update({
      where: { id: user.id },
      data: { matKhau: hashed },
    });

    await resetRateLimit(rlKey);
    // Vô hiệu hoá toàn bộ phiên cũ (bao gồm phiên kẻ tấn công đang chiếm),
    // sau đó tạo lại 1 phiên mới cho thiết bị hiện tại để người dùng không bị đăng xuất.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await createSession(user.id);

    await ghiNhatKy({
      user,
      hanhDong: 'DOI_MAT_KHAU',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: user.id,
      moTa: 'Tự đổi mật khẩu cá nhân — toàn bộ phiên cũ đã xóa',
    });

    return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu thành công.' });
  } catch (error) {
    logger.error('POST /api/auth/doi-mat-khau', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
