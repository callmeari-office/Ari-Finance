/**
 * GET /api/cron/thong-bao
 *
 * Cron endpoint gửi thông báo push định kỳ — loại b, c, d:
 *   (b) Phiếu đến hạn thanh toán hôm nay / quá hạn → OWNER + MANAGER
 *   (c) Quỹ có số dư âm → OWNER
 *   (d) Nhắc nhập doanh thu (nếu chưa nhập hôm nay) → OWNER
 *
 * Bảo vệ: header "Authorization: Bearer <CRON_SECRET>"
 *
 * Cách lên lịch:
 *   - Vercel Cron (vercel.json): schedule "0 1,13 * * *" (8:00 & 20:00 ICT = 1:00 & 13:00 UTC)
 *   - Hoặc gọi thủ công: GET <APP_URL>/api/cron/thong-bao
 *     với header Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma.js';
import { notifyManagers, notifyOwners } from '@/lib/webpush.js';
import { logger } from '@/lib/logger';
import { tinhSoDuQuy } from '@/lib/finance';

export async function GET(request) {
  // Xác thực cron secret
  const authHeader = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Đầu ngày hôm nay theo UTC — dùng nhất quán để so sánh date trong DB
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const results = [];

  // ── (b) Phiếu đến hạn hôm nay + quá hạn ────────────────────────────────
  try {
    const [denHan, quaHan] = await Promise.all([
      // Đến hạn đúng hôm nay
      prisma.deXuatChiPhi.count({
        where: {
          trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
          ngayCanThanhToan: { gte: todayStart, lt: todayEnd },
          laLichSu: false,
        },
      }),
      // Quá hạn (trước hôm nay, chưa thanh toán)
      prisma.deXuatChiPhi.count({
        where: {
          trangThai: { in: ['CHO_THANH_TOAN', 'CHO_HOAN_UNG'] },
          ngayCanThanhToan: { lt: todayStart },
          laLichSu: false,
        },
      }),
    ]);

    if (denHan > 0 || quaHan > 0) {
      const parts = [];
      if (quaHan > 0) parts.push(`${quaHan} phiếu quá hạn`);
      if (denHan > 0) parts.push(`${denHan} phiếu đến hạn hôm nay`);
      await notifyManagers({
        title: '⚠️ Phiếu cần thanh toán',
        body: parts.join(' · '),
        url: '/de-xuat/duyet',
        tag: 'phieu-den-han',
      });
      results.push({ type: 'den-han', denHan, quaHan, sent: true });
    } else {
      results.push({ type: 'den-han', denHan: 0, quaHan: 0, sent: false });
    }
  } catch (err) {
    logger.error('cron/thong-bao: den-han', err);
    results.push({ type: 'den-han', error: 'Lỗi nội bộ' });
  }

  // ── (c) Quỹ âm ──────────────────────────────────────────────────────────
  try {
    // Tổng hợp THU/CHI tại DB, tránh fetch toàn bộ giao dịch vào JS
    const [quyList, grouped] = await Promise.all([
      prisma.quy.findMany({ where: { trangThai: 'ACTIVE' } }),
      prisma.thuChi.groupBy({
        by: ['quyId', 'loaiGiaoDich'],
        _sum: { soTien: true },
      }),
    ]);

    const balanceMap = {};
    for (const { quyId, loaiGiaoDich, _sum } of grouped) {
      if (!balanceMap[quyId]) balanceMap[quyId] = { thu: 0, chi: 0 };
      if (loaiGiaoDich === 'THU') balanceMap[quyId].thu = _sum.soTien || 0;
      else balanceMap[quyId].chi = _sum.soTien || 0;
    }

    const amQuy = quyList.filter((q) => {
      const { thu = 0, chi = 0 } = balanceMap[q.id] || {};
      return tinhSoDuQuy({ soDuDauKy: q.soDuDauKy, tongThu: thu, tongChi: chi, soDuDieuChinh: q.soDuDieuChinh }) < 0;
    });

    if (amQuy.length > 0) {
      await notifyOwners({
        title: '🔴 Quỹ âm số dư',
        body: `${amQuy.length} quỹ đang âm: ${amQuy.map((q) => q.tenQuy).join(', ')}`,
        url: '/quy',
        tag: 'quy-am',
      });
      results.push({ type: 'quy-am', count: amQuy.length, sent: true });
    } else {
      results.push({ type: 'quy-am', count: 0, sent: false });
    }
  } catch (err) {
    logger.error('cron/thong-bao: quy-am', err);
    results.push({ type: 'quy-am', error: 'Lỗi nội bộ' });
  }

  // ── (d) Nhắc nhập doanh thu ─────────────────────────────────────────────
  // Cron chạy 1 lần/ngày lúc 13:00 UTC = 20:00 ICT — luôn kiểm tra
  try {
    const todayNormalized = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [totalKenh, daCoHoTay] = await Promise.all([
      prisma.kenhBan.count({ where: { trangThai: 'ACTIVE' } }),
      prisma.doanhThuHangNgay.count({ where: { ngay: todayNormalized } }),
    ]);

    if (daCoHoTay < totalKenh) {
      await notifyOwners({
        title: '📊 Nhắc nhập doanh thu',
        body: `Còn ${totalKenh - daCoHoTay}/${totalKenh} kênh chưa nhập doanh thu hôm nay.`,
        url: '/doanh-thu',
        tag: 'nhac-doanh-thu',
      });
      results.push({ type: 'doanh-thu', chuaNhap: totalKenh - daCoHoTay, sent: true });
    } else {
      results.push({ type: 'doanh-thu', chuaNhap: 0, sent: false });
    }
  } catch (err) {
    logger.error('cron/thong-bao: doanh-thu', err);
    results.push({ type: 'doanh-thu', error: 'Lỗi nội bộ' });
  }

  return NextResponse.json({ ok: true, ran: now.toISOString(), results });
}
