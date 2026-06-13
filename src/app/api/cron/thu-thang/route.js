import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendMonthlyReport } from '@/lib/email';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/thu-thang?thang=5&nam=2026
 * GET /api/cron/thu-thang?thang=5&nam=2026&preview=true  → trả text/html để xem trước
 *
 * Auth GET:
 *  - ?preview=true : session OWNER (read-only, không gửi email)
 *  - gửi email     : Header "Authorization: Bearer <CRON_SECRET>" — Vercel Cron tự gắn
 *
 * POST /api/cron/thu-thang?thang=5&nam=2026
 * Auth POST: session OWNER — gửi thủ công từ /bao-cao (tránh CSRF khi dùng GET).
 *
 * Cách lên lịch Vercel Cron (thêm vào vercel.json):
 *   { "crons": [{ "path": "/api/cron/thu-thang", "schedule": "0 1 1 * *" }] }
 *   → Chạy lúc 1:00 AM UTC (= 8:00 SA giờ VN) ngày 1 hàng tháng.
 *   Đặt biến CRON_SECRET trong Vercel Dashboard → Vercel tự gắn Authorization header.
 */

function parseThangNam(searchParams) {
  const defaultDate = new Date();
  defaultDate.setDate(1);
  defaultDate.setMonth(defaultDate.getMonth() - 1);
  const thang = parseInt(searchParams.get('thang') || String(defaultDate.getMonth() + 1), 10);
  const nam = parseInt(searchParams.get('nam') || String(defaultDate.getFullYear()), 10);
  return { thang, nam };
}

function validateThangNam(thang, nam) {
  if (isNaN(thang) || thang < 1 || thang > 12) return 'Tháng không hợp lệ (1–12).';
  if (isNaN(nam) || nam < 2020 || nam > 2099) return 'Năm không hợp lệ.';
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let user = null;
    if (isPreview) {
      // Preview read-only — cho phép OWNER session (không gửi email, không có rủi ro CSRF)
      if (!isCronCall) {
        user = await getSession();
        if (!user || user.role !== 'OWNER') {
          return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
        }
      }
    } else {
      // Gửi email qua GET chỉ dành cho Vercel Cron (Authorization header)
      if (!isCronCall) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { thang, nam } = parseThangNam(searchParams);
    const validationError = validateThangNam(thang, nam);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    logger.info(`cron/thu-thang GET: ${isPreview ? 'preview' : 'gửi'} tháng ${thang}/${nam} — ${isCronCall ? 'cron' : `user ${user?.username}`}`);

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

// Gửi thủ công từ /bao-cao — dùng POST để tránh CSRF (GET với side-effect bị dụ click)
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { thang, nam } = parseThangNam(searchParams);
    const validationError = validateThangNam(thang, nam);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    logger.info(`cron/thu-thang POST: gửi tháng ${thang}/${nam} — user ${user.username}`);

    const result = await sendMonthlyReport({ thang, nam, user, preview: false });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('POST /api/cron/thu-thang', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
