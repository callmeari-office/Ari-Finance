import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { notifyManagers as pushNotifyManagers } from '@/lib/webpush';
import { canViewCategory } from '@/lib/roles';
import { allocateSequentialCodes, getDeXuatPrefix, withUniqueCodeRetry } from '@/lib/generateId';
import { VALID_NGUON_TIEN, resolveCreateProposalStatus } from '@/lib/proposalWorkflow';

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
      const { ngayPhatSinh, danhMucId, noiDung, soTien, nhaCungCapId, nguonTien } = r || {};

      if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien) {
        errors.push({ dong, message: 'Thiếu thông tin bắt buộc (ngày, danh mục, nội dung, số tiền, nguồn tiền).' });
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

    const created = await withUniqueCodeRetry(async () => {
      const maPhieuList = await allocateSequentialCodes({
        model: 'deXuatChiPhi',
        field: 'maPhieu',
        prefix: getDeXuatPrefix(),
        count: rows.length,
      });

      const createData = rows.map((r, idx) => ({
        maPhieu: maPhieuList[idx],
        ngayPhatSinh: new Date(r.ngayPhatSinh),
        danhMucId: r.danhMucId,
        noiDung: r.noiDung.trim(),
        soTien: lamTronTien(r.soTien),
        nhaCungCapId: r.nhaCungCapId || null,
        nguonTien: r.nguonTien,
        trangThai: resolveCreateProposalStatus({
          role: user.role,
          nguonTien: r.nguonTien,
          requestedTrangThai: r.trangThai,
        }),
        ghiChu: r.ghiChu || null,
        nguoiTaoId: user.id,
        ngayCanThanhToan:
          r.ngayCanThanhToan && String(r.ngayCanThanhToan).trim() !== ''
            ? new Date(r.ngayCanThanhToan)
            : null,
      }));

      return prisma.$transaction(
        createData.map((data) => prisma.deXuatChiPhi.create({ data }))
      );
    });
    // Gửi MỘT email tổng hợp cho các phiếu "Chờ thanh toán" (thay vì N email — tránh spam & giảm tải).
    // Hàm tự bắt lỗi bên trong nên không làm hỏng luồng tạo phiếu nếu gửi mail thất bại.
    const choTTIds = created.filter((p) => p.trangThai === 'CHO_THANH_TOAN').map((p) => p.id);
    if (choTTIds.length > 0) {
      await notifyManagersBulkChoThanhToan(choTTIds);
      pushNotifyManagers({
        title: `${choTTIds.length} phiếu mới chờ duyệt`,
        body: `Vừa tạo ${choTTIds.length} đề xuất — bấm để xem.`,
        url: '/de-xuat/duyet',
        tag: 'new-proposals',
      }).catch(() => {});
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
