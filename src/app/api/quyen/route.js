import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập thông tin phân quyền.' },
        { status: 403 }
      );
    }

    let quyens = await prisma.vaiTroQuyen.findMany();

    // Tự bảo đảm vai trò LEADER luôn tồn tại (sao chép quyền STAFF hiện tại
    // nếu chưa có) — để không phải re-seed DB khi triển khai thực tế.
    if (!quyens.some((q) => q.role === 'LEADER')) {
      const staff = quyens.find((q) => q.role === 'STAFF');
      const leaderPermissions = staff
        ? staff.permissions
        : JSON.stringify({ tongQuan: true, deXuat: true, doanhThu: true });
      const leader = await prisma.vaiTroQuyen.create({
        data: { role: 'LEADER', permissions: leaderPermissions },
      });
      quyens = [...quyens, leader];
    }

    return NextResponse.json(quyens);
  } catch (error) {
    logger.error('GET /api/quyen', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền sửa đổi ma trận phân quyền.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, permissions } = body;

    if (!role || !permissions) {
      return NextResponse.json(
        { error: 'Thiếu thông tin vai trò hoặc quyền hạn.' },
        { status: 400 }
      );
    }

    const result = await prisma.vaiTroQuyen.upsert({
      where: { role },
      update: {
        permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions),
      },
      create: {
        role,
        permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã lưu phân quyền vai trò ${role} thành công.`,
      quyen: result,
    });
  } catch (error) {
    logger.error('POST /api/quyen', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
