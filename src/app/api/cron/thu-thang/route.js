import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendMonthlyReport } from '@/lib/email';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/thu-thang?thang=5&nam=2026
 * GET /api/cron/thu-thang?thang=5&nam=2026&preview=true  → trả text/html để xem trước
 *
 * Auth (ưu tiên từ trên xuống):
 *  1. Header "Authorization: Bearer <CRON_SECRET>" — Vercel Cron gửi tự động
 *  2. Session cookie hợp lệ với role OWNER — gửi thủ công từ /bao-cao
 *
 * Cách lên lịch Vercel Cron (thêm vào vercel.json):
 *   { "crons": [{ "path": "/api/cron/thu-thang", "schedule": "0 1 1 * *" }] }
 *   → Chạy lúc 1:00 AM UTC (= 8:00 SA giờ VN) ngày 1 hàng tháng.
 *   Đặt biến CRON_SECRET trong Vercel Dashboard → Vercel tự gắn Authorization header.
 *
 * Gửi thủ công (trigger từ trình duyệt khi đã đăng nhập OWNER):
 *   GET /api/cron/thu-thang?thang=5&nam=2026
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let user = null;
    if (!isCronCall) {
      user = await getSession();
      if (!user || user.role !== 'OWNER') {
        return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
      }
    }

    // ── Tháng / Năm ──────────────────────────────────────────────────────────
    // Mặc định: tháng trước (JavaScript tự xử lý qua đầu năm)
    const defaultDate = new Date();
    defaultDate.setDate(1);
    defaultDate.setMonth(defaultDate.getMonth() - 1);

    const thang = parseInt(searchParams.get('thang') || String(defaultDate.getMonth() + 1), 10);
    const nam = parseInt(searchParams.get('nam') || String(defaultDate.getFullYear()), 10);
    const isPreview = searchParams.get('preview') === 'true';

    if (isNaN(thang) || thang < 1 || thang > 12) {
      return NextResponse.json({ error: 'Tháng không hợp lệ (1–12).' }, { status: 400 });
    }
    if (isNaN(nam) || nam < 2020 || nam > 2099) {
      return NextResponse.json({ error: 'Năm không hợp lệ.' }, { status: 400 });
    }

    logger.info(`cron/thu-thang: ${isPreview ? 'preview' : 'gửi'} tháng ${thang}/${nam} — ${isCronCall ? 'cron' : `user ${user?.username}`}`);

    // ── Thực thi ─────────────────────────────────────────────────────────────
    const result = await sendMonthlyReport({ thang, nam, user, preview: isPreview });

    if (isPreview) {
      if (!result.ok || !result.html) {
        return NextResponse.json({ error: result.error || 'Không tạo được HTML.' }, { status: 500 });
      }
      return new Response(result.html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('GET /api/cron/thu-thang', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
