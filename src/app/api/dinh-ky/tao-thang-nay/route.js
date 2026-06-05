import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { generateMaDeXuat } from '@/lib/generateId';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';

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

    // Lấy danh sách mẫu đang active
    const templates = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PhieuDinhKy" WHERE "active" = true ORDER BY "createdAt" ASC
    `);

    if (!templates.length) {
      return NextResponse.json({ success: true, created: 0, message: 'Không có mẫu phiếu định kỳ nào đang hoạt động.' });
    }

    const created = [];
    const skipped = [];

    for (const tpl of templates) {
      // Ngày phát sinh: ngayChiTrongThang của tháng được chọn
      const ngay = Math.min(tpl.ngayChiTrongThang, new Date(nam, thang, 0).getDate());
      const ngayPhatSinh = new Date(Date.UTC(nam, thang - 1, ngay));

      // Kiểm tra đã tạo phiếu trùng tên + tháng chưa (tránh tạo 2 lần)
      const startOfMonth = new Date(Date.UTC(nam, thang - 1, 1));
      const startOfNext  = new Date(Date.UTC(nam, thang, 1));

      const existing = await prisma.deXuatChiPhi.findFirst({
        where: {
          noiDung: tpl.noiDung,
          danhMucId: tpl.danhMucId,
          ngayPhatSinh: { gte: startOfMonth, lt: startOfNext },
          trangThai: { not: 'HUY' },
        },
        select: { id: true },
      });

      if (existing) {
        skipped.push(tpl.tenMau);
        continue;
      }

      const maPhieu = await generateMaDeXuat();

      const proposal = await prisma.deXuatChiPhi.create({
        data: {
          maPhieu,
          ngayPhatSinh,
          danhMucId: tpl.danhMucId,
          noiDung: tpl.noiDung,
          soTien: tpl.soTien,
          nhaCungCapId: tpl.nhaCungCapId || null,
          nguonTien: tpl.nguonTien,
          trangThai: tpl.trangThaiMacDinh,
          ghiChu: tpl.ghiChu || null,
          nguoiTaoId: user.id,
          ngayCanThanhToan: ngayPhatSinh,
        },
        select: { id: true },
      });

      // Lưu id thật (UUID) + trạng thái đã biết để tránh re-query sau này
      created.push({ id: proposal.id, trangThai: tpl.trangThaiMacDinh });

      await ghiNhatKy({
        user,
        hanhDong: 'TAO',
        doiTuong: 'DE_XUAT',
        maDoiTuong: maPhieu,
        moTa: `Tạo phiếu định kỳ từ mẫu "${tpl.tenMau}" — Tháng ${thang}/${nam}`,
      });
    }

    // Gửi email thông báo — dùng trạng thái đã biết, không cần re-query DB
    const choThanhToanIds = created
      .filter((p) => p.trangThai === 'CHO_THANH_TOAN')
      .map((p) => p.id);
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
