import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

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

    const quyens = await prisma.vaiTroQuyen.findMany();

    return NextResponse.json(quyens);
  } catch (error) {
    console.error('Get permissions error:', error);
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
    console.error('Update permissions error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
