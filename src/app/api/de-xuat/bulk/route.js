import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { canViewCategory } from '@/lib/roles';

const VALID_NGUON_TIEN = ['TIEN_SHOP', 'TIEN_CA_NHAN'];
const VALID_TRANG_THAI = ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];

function getYYMM() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

// POST /api/de-xuat/bulk
// Body: { rows: [{ ngayPhatSinh, danhMucId, noiDung, soTien, nhaCungCapId, nguonTien, trangThai, ghiChu, ngayCanThanhToan }] }
// Tạo nhiều đề xuất chi cùng lúc trong 1 transaction. Mã phiếu sinh tuần tự, không trùng.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Không có dòng dữ liệu nào để tạo.' }, { status: 400 });
    }
    if (rows.length > 50) {
      return NextResponse.json({ error: 'Chỉ tạo tối đa 50 phiếu mỗi lần.' }, { status: 400 });
    }

    // Tải trước toàn bộ danh mục liên quan để validate quyền + yeuCauNCC
    const danhMucIds = [...new Set(rows.map((r) => r?.danhMucId).filter(Boolean))];
    const danhMucList = await prisma.danhMuc.findMany({ where: { id: { in: danhMucIds } } });
    const danhMucMap = new Map(danhMucList.map((d) => [d.id, d]));

    // Validate từng dòng trước khi tạo (fail-fast, không tạo phiếu nào nếu có lỗi)
    const errors = [];
    rows.forEach((r, idx) => {
      const dong = idx + 1;
      const { ngayPhatSinh, danhMucId, noiDung, soTien, nhaCungCapId, nguonTien, trangThai } = r || {};

      if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien || !trangThai) {
        errors.push({ dong, message: 'Thiếu thông tin bắt buộc (ngày, danh mục, nội dung, số tiền, nguồn tiền, trạng thái).' });
        return;
      }
      if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
        errors.push({ dong, message: 'Nội dung không hợp lệ (1–500 ký tự).' });
        return;
      }
      if (Number(soTien) <= 0) {
        errors.push({ dong, message: 'Số tiền phải lớn hơn 0.' });
        return;
      }
      if (!VALID_NGUON_TIEN.includes(nguonTien)) {
        errors.push({ dong, message: 'Nguồn tiền không hợp lệ.' });
        return;
      }
      if (!VALID_TRANG_THAI.includes(trangThai)) {
        errors.push({ dong, message: 'Trạng thái không hợp lệ.' });
        return;
      }

      const danhMuc = danhMucMap.get(danhMucId);
      if (!danhMuc) {
        errors.push({ dong, message: 'Danh mục không tồn tại.' });
        return;
      }
      try {
        const allowedRoles = JSON.parse(danhMuc.chucVuDuocXem);
        if (!canViewCategory(user.role, allowedRoles)) {
          errors.push({ dong, message: `Bạn không có quyền chọn danh mục "${danhMuc.tenDanhMuc}".` });
          return;
        }
      } catch {
        errors.push({ dong, message: 'Lỗi kiểm tra quyền danh mục.' });
        return;
      }
      if (danhMuc.yeuCauNCC && !nhaCungCapId) {
        errors.push({ dong, message: `Danh mục "${danhMuc.tenDanhMuc}" bắt buộc phải chọn Nhà cung cấp.` });
      }
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Một số dòng không hợp lệ. Vui lòng kiểm tra lại.', errors },
        { status: 400 }
      );
    }

    // Sinh mã phiếu tuần tự: lấy số lớn nhất hiện có 1 lần, rồi tăng dần trong bộ nhớ
    const prefix = `CP${getYYMM()}-`;
    const last = await prisma.deXuatChiPhi.findFirst({
      where: { maPhieu: { startsWith: prefix } },
      orderBy: { maPhieu: 'desc' },
      select: { maPhieu: true },
    });
    let nextNum = 1;
    if (last) {
      const parts = last.maPhieu.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      nextNum = (isNaN(num) ? 0 : num) + 1;
    }

    const createData = rows.map((r, idx) => ({
      maPhieu: `${prefix}${String(nextNum + idx).padStart(4, '0')}`,
      ngayPhatSinh: new Date(r.ngayPhatSinh),
      danhMucId: r.danhMucId,
      noiDung: r.noiDung.trim(),
      soTien: Number(r.soTien),
      nhaCungCapId: r.nhaCungCapId || null,
      nguonTien: r.nguonTien,
      trangThai: r.trangThai,
      ghiChu: r.ghiChu || null,
      nguoiTaoId: user.id,
      ngayCanThanhToan:
        r.ngayCanThanhToan && String(r.ngayCanThanhToan).trim() !== ''
          ? new Date(r.ngayCanThanhToan)
          : null,
    }));

    // Tạo toàn bộ trong 1 transaction
    const created = await prisma.$transaction(
      createData.map((data) => prisma.deXuatChiPhi.create({ data }))
    );

    // Gửi MỘT email tổng hợp cho các phiếu "Chờ thanh toán" (thay vì N email — tránh spam & giảm tải).
    // Hàm tự bắt lỗi bên trong nên không làm hỏng luồng tạo phiếu nếu gửi mail thất bại.
    const choTTIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
    if (choTTIds.length > 0) {
      await notifyManagersBulkChoThanhToan(choTTIds);
    }

    return NextResponse.json({
      success: true,
      successCount: created.length,
      maPhieuList: created.map((p) => p.maPhieu),
      message: `Đã tạo ${created.length} đề xuất thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/bulk', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi trên hệ thống.' }, { status: 500 });
  }
}
