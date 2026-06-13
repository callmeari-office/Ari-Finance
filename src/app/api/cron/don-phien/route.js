/**
 * GET /api/cron/don-phien
 *
 * Xóa tất cả Session đã hết hạn (expiresAt < now) để giữ bảng Session gọn.
 * Bảo vệ: header "Authorization: Bearer <CRON_SECRET>" — FAIL CLOSED nếu thiếu secret.
 *
 * Lịch chạy (vercel.json): "0 2 * * *" → 02:00 UTC = 09:00 ICT mỗi ngày.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const deleted = await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return NextResponse.json({ ok: true, ran: now.toISOString(), deleted: deleted.count });
}
