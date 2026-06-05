import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// PUT /api/dinh-ky/[id] — cập nhật hoặc bật/tắt mẫu phiếu định kỳ
export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { tenMau, noiDung, soTien, danhMucId, nhaCungCapId, nguonTien, trangThaiMacDinh, ngayChiTrongThang, ghiChu, active } = body;

    const existing = await prisma.$queryRaw`
      SELECT "id" FROM "PhieuDinhKy" WHERE "id" = ${id} LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Không tìm thấy mẫu phiếu định kỳ.' }, { status: 404 });
    }

    // Nếu chỉ toggle active
    if (typeof active === 'boolean' && Object.keys(body).length === 1) {
      await prisma.$executeRaw`
        UPDATE "PhieuDinhKy" SET "active" = ${active}, "updatedAt" = NOW() WHERE "id" = ${id}
      `;
      await ghiNhatKy({ user, hanhDong: 'SUA', doiTuong: 'PHIEU_DINH_KY', maDoiTuong: id, moTa: active ? 'Kích hoạt mẫu phiếu định kỳ' : 'Tắt mẫu phiếu định kỳ' });
      return NextResponse.json({ success: true });
    }

    if (!tenMau?.trim() || !noiDung?.trim() || !soTien || !danhMucId || !nguonTien) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }
    if (Number(soTien) <= 0) {
      return NextResponse.json({ error: 'Số tiền phải lớn hơn 0.' }, { status: 400 });
    }

    const ngay = Math.min(28, Math.max(1, parseInt(ngayChiTrongThang, 10) || 1));
    const activeVal = typeof active === 'boolean' ? active : true;

    await prisma.$executeRaw`
      UPDATE "PhieuDinhKy" SET
        "tenMau" = ${tenMau.trim()},
        "noiDung" = ${noiDung.trim()},
        "soTien" = ${Number(soTien)},
        "danhMucId" = ${danhMucId},
        "nhaCungCapId" = ${nhaCungCapId || null},
        "nguonTien" = ${nguonTien},
        "trangThaiMacDinh" = ${trangThaiMacDinh || 'CHO_THANH_TOAN'},
        "ngayChiTrongThang" = ${ngay},
        "ghiChu" = ${ghiChu?.trim() || null},
        "active" = ${activeVal},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    await ghiNhatKy({ user, hanhDong: 'SUA', doiTuong: 'PHIEU_DINH_KY', maDoiTuong: id, moTa: `Cập nhật mẫu phiếu định kỳ "${tenMau.trim()}"` });

    return NextResponse.json({ success: true, message: 'Đã cập nhật mẫu phiếu định kỳ.' });
  } catch (error) {
    logger.error('PUT /api/dinh-ky/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// DELETE /api/dinh-ky/[id] — xóa mẫu phiếu định kỳ
export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Chỉ OWNER được xóa mẫu phiếu định kỳ.' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.$executeRaw`DELETE FROM "PhieuDinhKy" WHERE "id" = ${id}`;

    await ghiNhatKy({ user, hanhDong: 'XOA', doiTuong: 'PHIEU_DINH_KY', maDoiTuong: id, moTa: 'Xóa mẫu phiếu định kỳ' });

    return NextResponse.json({ success: true, message: 'Đã xóa mẫu phiếu định kỳ.' });
  } catch (error) {
    logger.error('DELETE /api/dinh-ky/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
