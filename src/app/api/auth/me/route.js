import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'Chưa đăng nhập.' },
        { status: 401 }
      );
    }

    const roleQuyen = await prisma.vaiTroQuyen.findUnique({
      where: { role: user.role }
    });

    let permissions = {};
    if (roleQuyen) {
      try {
        permissions = JSON.parse(roleQuyen.permissions);
      } catch (e) {
        permissions = {};
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        permissions
      },
    });
  } catch (error) {
    logger.error('GET /api/auth/me', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
