import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (error) {
    logger.error('POST /api/auth/logout', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
