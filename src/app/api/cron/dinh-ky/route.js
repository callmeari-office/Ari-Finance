import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { notifyManagers } from '@/lib/webpush';
import { taoPhieuDinhKyChoThang } from '@/lib/dinhKy';

// GET /api/cron/dinh-ky        → Vercel Cron (Authorization: Bearer CRON_SECRET) tạo phiếu tháng này
// GET /api/cron/dinh-ky?preview=true → OWNER session: liệt kê mẫu active, KHÔNG tạo
//
// Lịch Vercel Cron (vercel.json): { "path": "/api/cron/dinh-ky", "schedule": "0 1 1 * *" }
//   → 1:00 AM UTC (= 8:00 SA giờ VN) ngày 1 hàng tháng. CRON_SECRET đặt trong Vercel.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (isPreview) {
      const user = await getSession();
      if (!user || user.role !== 'OWNER') {
        return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
      }
      const templates = await prisma.$queryRawUnsafe(
        `SELECT "tenMau","soTien","ngayChiTrongThang","trangThaiMacDinh" FROM "PhieuDinhKy" WHERE "active" = true ORDER BY "createdAt" ASC`
      );
      return NextResponse.json({ preview: true, mauActive: templates });
    }

    if (!isCronCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const nam = now.getFullYear();
    const thang = now.getMonth() + 1;

    // Cron không có session → lấy OWNER đầu tiên làm người tạo + đối tượng ghi nhật ký
    const owner = await prisma.nhanVien.findFirst({
      where: { role: 'OWNER', trangThai: 'ACTIVE' },
      select: { id: true, hoTen: true, username: true, role: true },
    });
    if (!owner) {
      logger.error('cron/dinh-ky: không tìm thấy OWNER active');
      return NextResponse.json({ success: false, error: 'Không có OWNER active.' });
    }

    const { created, skipped } = await taoPhieuDinhKyChoThang(prisma, {
      nam, thang, nguoiTaoId: owner.id, user: owner,
    });

    // Email + Web Push — bọc riêng, lỗi không làm hỏng việc tạo phiếu
    try {
      const choThanhToanIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
      if (choThanhToanIds.length > 0) await notifyManagersBulkChoThanhToan(choThanhToanIds);
    } catch (e) { logger.error('cron/dinh-ky email', e); }

    try {
      if (created.length > 0) {
        await notifyManagers({
          title: 'Phiếu định kỳ tháng mới',
          body: `Đã tạo ${created.length} phiếu định kỳ tháng ${thang}/${nam}.`,
          url: '/de-xuat/duyet',
          tag: 'dinh-ky-thang',
        });
      }
    } catch (e) { logger.error('cron/dinh-ky push', e); }

    logger.info(`cron/dinh-ky: tạo ${created.length}, bỏ qua ${skipped.length} — tháng ${thang}/${nam}`);
    return NextResponse.json({ success: true, created: created.length, skipped: skipped.length });
  } catch (error) {
    logger.error('GET /api/cron/dinh-ky', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống.' });
  }
}
