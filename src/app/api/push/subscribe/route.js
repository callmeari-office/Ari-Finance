import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';
import { prisma } from '@/lib/prisma.js';

// POST /api/push/subscribe — lưu subscription của thiết bị hiện tại
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { endpoint, keys } = body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Thiếu dữ liệu subscription' }, { status: 400 });
  }

  // Upsert theo endpoint (1 browser = 1 endpoint duy nhất)
  // getSession() trả về NhanVien → dùng .id (không phải .userId)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: session.id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: session.id },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — hủy đăng ký thiết bị hiện tại
export async function DELETE(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { endpoint } = body || {};
  if (!endpoint) return NextResponse.json({ error: 'Thiếu endpoint' }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.id },
  });

  return NextResponse.json({ ok: true });
}
