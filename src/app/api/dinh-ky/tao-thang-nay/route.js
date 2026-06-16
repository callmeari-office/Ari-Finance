import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { taoPhieuDinhKyChoThang } from '@/lib/dinhKy';

// POST /api/dinh-ky/tao-thang-nay
// OWNER/MANAGER bấm nút → tự tạo bản sao phiếu định kỳ cho tháng này.
// Body (tùy chọn): { nam, thang } — mặc định là tháng/năm hiện tại.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được tạo phiếu định kỳ.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const nam = parseInt(body.nam, 10) || now.getFullYear();
    const thang = parseInt(body.thang, 10) || now.getMonth() + 1;
    if (thang < 1 || thang > 12) {
      return NextResponse.json({ error: 'Tháng không hợp lệ (1–12).' }, { status: 400 });
    }

    const { created, skipped } = await taoPhieuDinhKyChoThang(prisma, {
      nam, thang, nguoiTaoId: user.id, user,
    });

    const choThanhToanIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
    if (choThanhToanIds.length > 0) {
      await notifyManagersBulkChoThanhToan(choThanhToanIds);
    }

    const msg = `Đã tạo ${created.length} phiếu định kỳ tháng ${thang}/${nam}` +
      (skipped.length > 0 ? `. Bỏ qua ${skipped.length} mẫu đã tồn tại: ${skipped.join(', ')}.` : '.');
    return NextResponse.json({ success: true, created: created.length, skipped: skipped.length, message: msg });
  } catch (error) {
    logger.error('POST /api/dinh-ky/tao-thang-nay', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
