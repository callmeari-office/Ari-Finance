import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth.js';

// GET /api/push/vapid-key — trả public VAPID key cho client đăng ký SW
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}
