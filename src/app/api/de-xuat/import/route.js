import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Sinh tiền tố mã phiếu theo tháng hiện tại (giống generateMaDeXuat: CPYYMM-)
function getMaPrefix() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `CP${yy}${mm}-`;
}

// Chuẩn hoá tên để so khớp (bỏ khoảng trắng thừa + thường hoá)
function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Nhập dữ liệu phiếu chi CŨ từ Excel.
// Mỗi dòng -> 1 DeXuatChiPhi: trạng thái DA_THANH_TOAN, laLichSu=true,
// KHÔNG tạo phiếu Thu-Chi (không trừ quỹ), KHÔNG cần duyệt.
// Chỉ OWNER được phép.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền nhập dữ liệu cũ.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu để nhập.' }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json(
        { error: 'Mỗi lần chỉ nhập tối đa 2000 dòng. Vui lòng chia nhỏ file.' },
        { status: 400 }
      );
    }

    // Tải sẵn danh mục CHI + NCC để so khớp theo tên (1 query mỗi loại)
    const [danhMucList, nccList] = await Promise.all([
      prisma.danhMuc.findMany({ where: { loaiGiaoDich: 'CHI' } }),
      prisma.nhaCungCap.findMany(),
    ]);
    const danhMucMap = new Map(danhMucList.map((d) => [normName(d.tenDanhMuc), d]));
    const nccMap = new Map(nccList.map((n) => [normName(n.tenNCC), n]));

    const errors = [];
    const valid = [];

    rows.forEach((row, idx) => {
      const dong = idx + 2; // dòng thực tế trong Excel (có header ở dòng 1)
      const { ngayPhatSinh, danhMuc, noiDung, soTien, nhaCungCap, ghiChu } = row;

      // Ngày
      const ngay = ngayPhatSinh ? new Date(ngayPhatSinh) : null;
      if (!ngay || isNaN(ngay.getTime())) {
        errors.push({ dong, message: 'Ngày chi không hợp lệ.' });
        return;
      }
      // Danh mục
      if (!danhMuc || !normName(danhMuc)) {
        errors.push({ dong, message: 'Thiếu Danh mục.' });
        return;
      }
      const dm = danhMucMap.get(normName(danhMuc));
      if (!dm) {
        errors.push({ dong, message: `Danh mục "${danhMuc}" không khớp danh mục CHI nào trong hệ thống.` });
        return;
      }
      // Nội dung
      if (!noiDung || !String(noiDung).trim()) {
        errors.push({ dong, message: 'Thiếu Nội dung.' });
        return;
      }
      if (String(noiDung).length > 500) {
        errors.push({ dong, message: 'Nội dung quá dài (>500 ký tự).' });
        return;
      }
      // Số tiền
      const tien = Number(soTien);
      if (!Number.isFinite(tien) || tien <= 0) {
        errors.push({ dong, message: 'Số tiền không hợp lệ (phải là số > 0).' });
        return;
      }
      // NCC (tùy chọn)
      let nccId = null;
      if (nhaCungCap && normName(nhaCungCap)) {
        const ncc = nccMap.get(normName(nhaCungCap));
        if (!ncc) {
          errors.push({ dong, message: `Nhà cung cấp "${nhaCungCap}" không tồn tại. Bỏ trống hoặc thêm NCC trước.` });
          return;
        }
        nccId = ncc.id;
      }

      valid.push({
        ngayPhatSinh: ngay,
        danhMucId: dm.id,
        noiDung: String(noiDung).trim(),
        soTien: tien,
        nhaCungCapId: nccId,
        ghiChu: ghiChu ? String(ghiChu).trim() : null,
      });
    });

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Không có dòng hợp lệ nào để nhập.', errors, successCount: 0 },
        { status: 400 }
      );
    }

    // Sinh mã phiếu hàng loạt: lấy số bắt đầu 1 lần rồi tăng trong bộ nhớ (tránh trùng)
    const prefix = getMaPrefix();
    const last = await prisma.deXuatChiPhi.findFirst({
      where: { maPhieu: { startsWith: prefix } },
      orderBy: { maPhieu: 'desc' },
      select: { maPhieu: true },
    });
    let nextNum = 1;
    if (last) {
      const parts = last.maPhieu.split('-');
      const n = parseInt(parts[parts.length - 1], 10);
      nextNum = (isNaN(n) ? 0 : n) + 1;
    }

    const dataToCreate = valid.map((v) => ({
      maPhieu: `${prefix}${String(nextNum++).padStart(4, '0')}`,
      ngayPhatSinh: v.ngayPhatSinh,
      danhMucId: v.danhMucId,
      noiDung: v.noiDung,
      soTien: v.soTien,
      nhaCungCapId: v.nhaCungCapId,
      nguonTien: 'TIEN_SHOP',
      trangThai: 'DA_THANH_TOAN',
      laLichSu: true,
      thuChiId: null,
      quyThanhToanId: null,
      nguoiTaoId: user.id,
      nguoiDuyetId: user.id,
      ngayThanhToan: v.ngayPhatSinh,
      ghiChu: v.ghiChu,
    }));

    const result = await prisma.deXuatChiPhi.createMany({ data: dataToCreate });

    return NextResponse.json({
      success: true,
      successCount: result.count,
      errorCount: errors.length,
      errors,
      message: `Đã nhập ${result.count} phiếu chi cũ thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/import', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
