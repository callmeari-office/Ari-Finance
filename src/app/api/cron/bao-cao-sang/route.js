/**
 * GET /api/cron/bao-cao-sang
 *
 * Email "Báo cáo sáng" cho Owner + Manager — gửi 8:00 sáng VN mỗi ngày.
 * Bảo vệ: header "Authorization: Bearer <CRON_SECRET>".
 * Bật/tắt: biến môi trường EMAIL_BAO_CAO_SANG=on (mặc định off → không gửi).
 * Test thủ công: GET .../api/cron/bao-cao-sang?preview=email@cuaban.com
 *   (vẫn cần CRON_SECRET; gửi thử tới 1 email, bỏ qua cờ bật/tắt).
 *
 * Lịch (vercel.json): "0 1 * * *" = 1:00 UTC = 8:00 ICT.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { thuThapDuLieuBaoCao } from '@/lib/morningBriefing';
import { taoNhanDinhAI } from '@/lib/aiBrief';
import { sendMorningBriefing } from '@/lib/email';

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get('preview');

  if (!preview && process.env.EMAIL_BAO_CAO_SANG !== 'on') {
    return NextResponse.json({ ok: true, skipped: 'disabled' });
  }

  try {
    const data = await thuThapDuLieuBaoCao(prisma);

    // AI tự bắt lỗi bên trong và trả null nếu hỏng → email vẫn gửi đủ số liệu.
    const ai = await taoNhanDinhAI(data);

    const result = await sendMorningBriefing({
      data,
      ai,
      preview: !!preview,
      previewEmail: preview,
    });

    return NextResponse.json({ ok: true, ran: new Date().toISOString(), aiUsed: !!ai, ...result });
  } catch (error) {
    logger.error('GET /api/cron/bao-cao-sang', error);
    // Không ném ra ngoài — luôn trả 200 để Vercel Cron không retry dồn dập.
    return NextResponse.json({ ok: false, error: 'Lỗi nội bộ' });
  }
}
