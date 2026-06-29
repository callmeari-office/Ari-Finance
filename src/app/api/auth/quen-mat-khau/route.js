import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, recordFailure } from '@/lib/rateLimit';
import { headers } from 'next/headers';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 giờ

// POST /api/auth/quen-mat-khau
// Body: { username }
// Public — không cần đăng nhập. Tra cứu username → gửi link reset về email.
// Luôn trả 200 để không lộ username có tồn tại hay không.
export async function POST(request) {
  try {
    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';

    const rlKey = `quen-mat-khau:${ip}`;
    const rl = await checkRateLimit(rlKey);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${rl.retryAfterSec} giây.` },
        { status: 429 }
      );
    }

    const { username } = await request.json();
    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ success: true }); // Không lộ thông tin
    }

    await recordFailure(rlKey); // Đếm mỗi lần gọi để chống spam

    const employee = await prisma.nhanVien.findUnique({
      where: { username: username.trim() },
      select: { id: true, hoTen: true, tenNgan: true, email: true, username: true, trangThai: true },
    });

    // Nếu không tìm thấy, hoặc không có email, hoặc tài khoản bị khóa → vẫn trả success
    if (
      !employee ||
      !employee.email ||
      !employee.email.includes('@') ||
      employee.trangThai === 'INACTIVE'
    ) {
      logger.info(`quen-mat-khau: username "${username}" không tìm thấy hoặc thiếu email — bỏ qua.`);
      return NextResponse.json({ success: true });
    }

    // Vô hiệu hoá token cũ chưa dùng
    await prisma.$executeRaw`
      UPDATE "PasswordResetToken"
      SET "used" = true
      WHERE "nhanVienId" = ${employee.id} AND "used" = false
    `;

    // Tạo token mới
    const token = randomUUID();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "token", "nhanVienId", "expiresAt", "used", "createdAt")
      VALUES (${id}, ${token}, ${employee.id}, ${expiresAt}, false, NOW())
    `;

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${appUrl}/dat-lai-mat-khau?token=${token}`;

    await sendPasswordResetEmail({ employee, resetLink });

    logger.info(`quen-mat-khau: đã gửi link reset cho username "${employee.username}" (${employee.email})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('POST /api/auth/quen-mat-khau', error);
    // Trả success để không lộ lỗi hệ thống
    return NextResponse.json({ success: true });
  }
}
