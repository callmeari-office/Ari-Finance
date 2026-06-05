import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { sendPasswordResetEmail } from '@/lib/email';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 giờ

// POST /api/auth/dat-lai-mat-khau
// Body: { nhanVienId }
// Chỉ OWNER được gọi. Tạo token, lưu DB, gửi email cho nhân viên.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Chỉ OWNER mới có thể đặt lại mật khẩu nhân viên.' }, { status: 403 });
    }

    const { nhanVienId } = await request.json();
    if (!nhanVienId) {
      return NextResponse.json({ error: 'Thiếu nhanVienId.' }, { status: 400 });
    }

    // Lấy thông tin nhân viên
    const employee = await prisma.nhanVien.findUnique({
      where: { id: nhanVienId },
      select: { id: true, hoTen: true, tenNgan: true, email: true, username: true, trangThai: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Không tìm thấy nhân viên.' }, { status: 404 });
    }
    if (!employee.email || !employee.email.includes('@')) {
      return NextResponse.json({ error: `Nhân viên "${employee.hoTen}" chưa có email hợp lệ để gửi link đặt lại mật khẩu.` }, { status: 400 });
    }

    // Vô hiệu hoá các token cũ chưa dùng của nhân viên này
    await prisma.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "used" = true
      WHERE "nhanVienId" = ${nhanVienId} AND "used" = false
    `;

    // Tạo token mới
    const token = randomUUID();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "token", "nhanVienId", "expiresAt", "used", "createdAt")
      VALUES (${id}, ${token}, ${nhanVienId}, ${expiresAt}, false, NOW())
    `;

    // Gửi email
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${appUrl}/dat-lai-mat-khau?token=${token}`;

    await sendPasswordResetEmail({ employee, resetLink });

    await ghiNhatKy({
      user,
      hanhDong: 'DAT_LAI_MAT_KHAU',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: employee.id,
      moTa: `OWNER gửi link đặt lại mật khẩu cho "${employee.hoTen}" (${employee.email})`,
    });

    logger.info(`dat-lai-mat-khau: OWNER ${user.id} gửi link cho nhân viên ${nhanVienId}`);

    return NextResponse.json({
      success: true,
      message: `Đã gửi link đặt lại mật khẩu tới email ${employee.email}. Link có hiệu lực trong 1 giờ.`,
    });
  } catch (error) {
    logger.error('POST /api/auth/dat-lai-mat-khau', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}
