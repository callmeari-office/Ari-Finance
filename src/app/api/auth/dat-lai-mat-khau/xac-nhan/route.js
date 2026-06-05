import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// GET /api/auth/dat-lai-mat-khau/xac-nhan?token=xxx
// Kiểm tra token còn hợp lệ, trả về tên nhân viên để hiển thị trên form.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Thiếu token.' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw`
      SELECT "id", "nhanVienId", "expiresAt", "used"
      FROM "PasswordResetToken"
      WHERE "token" = ${token}
      LIMIT 1
    `;

    const record = rows[0];
    if (!record) {
      return NextResponse.json({ error: 'Link không hợp lệ hoặc đã hết hạn.' }, { status: 400 });
    }
    if (record.used) {
      return NextResponse.json({ error: 'Link này đã được sử dụng. Yêu cầu OWNER gửi link mới.' }, { status: 400 });
    }
    if (new Date() > new Date(record.expiresAt)) {
      return NextResponse.json({ error: 'Link đã hết hạn (quá 1 giờ). Yêu cầu OWNER gửi lại.' }, { status: 400 });
    }

    const employee = await prisma.nhanVien.findUnique({
      where: { id: record.nhanVienId },
      select: { hoTen: true, tenNgan: true, email: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      hoTen: employee.hoTen,
      tenNgan: employee.tenNgan,
    });
  } catch (error) {
    logger.error('GET /api/auth/dat-lai-mat-khau/xac-nhan', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/auth/dat-lai-mat-khau/xac-nhan
// Body: { token, matKhau }
// Đặt mật khẩu mới cho nhân viên.
export async function POST(request) {
  try {
    const { token, matKhau } = await request.json();

    if (!token || !matKhau) {
      return NextResponse.json({ error: 'Thiếu token hoặc mật khẩu.' }, { status: 400 });
    }

    if (typeof matKhau !== 'string' || matKhau.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw`
      SELECT "id", "nhanVienId", "expiresAt", "used"
      FROM "PasswordResetToken"
      WHERE "token" = ${token}
      LIMIT 1
    `;

    const record = rows[0];
    if (!record) {
      return NextResponse.json({ error: 'Link không hợp lệ.' }, { status: 400 });
    }
    if (record.used) {
      return NextResponse.json({ error: 'Link này đã được sử dụng.' }, { status: 400 });
    }
    if (new Date() > new Date(record.expiresAt)) {
      return NextResponse.json({ error: 'Link đã hết hạn. Yêu cầu OWNER gửi link mới.' }, { status: 400 });
    }

    // Hash mật khẩu mới
    const hash = await bcrypt.hash(matKhau, 10);

    // Cập nhật mật khẩu và đánh dấu token đã dùng trong một transaction
    await prisma.$transaction([
      prisma.nhanVien.update({
        where: { id: record.nhanVienId },
        data: { matKhau: hash },
      }),
      prisma.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "used" = true
        WHERE "id" = ${record.id}
      `,
    ]);

    // Xóa hết session cũ của nhân viên để buộc đăng nhập lại
    await prisma.session.deleteMany({ where: { userId: record.nhanVienId } });

    const employee = await prisma.nhanVien.findUnique({
      where: { id: record.nhanVienId },
      select: { id: true, hoTen: true, role: true },
    });

    await ghiNhatKy({
      user: { id: record.nhanVienId, hoTen: employee?.hoTen, role: employee?.role, tenNgan: null },
      hanhDong: 'DOI_MAT_KHAU',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: record.nhanVienId,
      moTa: 'Đặt lại mật khẩu qua link email (do OWNER gửi)',
    });

    return NextResponse.json({ success: true, message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.' });
  } catch (error) {
    logger.error('POST /api/auth/dat-lai-mat-khau/xac-nhan', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống.' }, { status: 500 });
  }
}
