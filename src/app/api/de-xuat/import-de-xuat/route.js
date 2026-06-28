import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { notifyManagersBulkChoThanhToan } from '@/lib/email';
import { canViewCategory } from '@/lib/roles';
import { allocateSequentialCodes, withUniqueCodeRetry, getDeXuatPrefix } from '@/lib/generateId';
import { resolveCreateProposalStatus } from '@/lib/proposalWorkflow';

function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// "Ai trả khoản này" (token client gửi lên) -> { nguonTien, requestedTrangThai }.
// Trạng thái cuối cùng do resolveCreateProposalStatus quyết (role-agnostic): mọi vai trò
// được đánh dấu "Shop đã trả rồi" → DA_THANH_TOAN (Thanh toán sẵn, chờ gán quỹ).
function mapAiTra(token) {
  switch (token) {
    case 'CA_NHAN':
      return { nguonTien: 'TIEN_CA_NHAN', requestedTrangThai: 'CHO_HOAN_UNG' };
    case 'SHOP_DA_TRA':
      return { nguonTien: 'TIEN_SHOP', requestedTrangThai: 'DA_THANH_TOAN' };
    case 'SHOP_CHUA_TRA':
    default:
      return { nguonTien: 'TIEN_SHOP', requestedTrangThai: 'CHO_THANH_TOAN' };
  }
}

// Nhập HÀNG LOẠT đề xuất chi cho tháng thực tế, ĐI QUA QUY TRÌNH DUYỆT như tạo tay.
// - KHÔNG phải phiếu lịch sử (laLichSu=false), KHÔNG trừ quỹ, KHÔNG sinh Thu-Chi.
// - Mọi vai trò đăng nhập đều được dùng (Staff/Leader/Manager/Owner).
// - Khác với /api/de-xuat/import (nhập phiếu CŨ đã thanh toán — chỉ Owner).
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu để nhập.' }, { status: 400 });
    }
    if (rows.length > 300) {
      return NextResponse.json(
        { error: 'Mỗi lần chỉ nhập tối đa 300 dòng. Vui lòng chia nhỏ file.' },
        { status: 400 }
      );
    }

    // Lookup maps
    const [danhMucList, nccList] = await Promise.all([
      prisma.danhMuc.findMany({ where: { loaiGiaoDich: 'CHI' } }),
      prisma.nhaCungCap.findMany(),
    ]);
    const danhMucMap = new Map(danhMucList.map((d) => [normName(d.tenDanhMuc), d]));
    const nccMap = new Map(nccList.map((n) => [normName(n.tenNCC), n]));

    const errors = [];
    const valid = [];

    rows.forEach((row, idx) => {
      const dong = idx + 2; // dòng 1 là tiêu đề
      const { ngayPhatSinh, danhMuc, noiDung, soTien, nhaCungCap, ghiChu, ngayCanThanhToan, aiTra } = row;

      // Ngày phát sinh
      const ngay = ngayPhatSinh ? new Date(ngayPhatSinh) : null;
      if (!ngay || isNaN(ngay.getTime())) {
        errors.push({ dong, message: 'Ngày phát sinh không hợp lệ.' });
        return;
      }

      // Danh mục + quyền theo vai trò
      if (!danhMuc || !normName(danhMuc)) {
        errors.push({ dong, message: 'Thiếu Danh mục.' });
        return;
      }
      const dm = danhMucMap.get(normName(danhMuc));
      if (!dm) {
        errors.push({ dong, message: `Danh mục "${danhMuc}" không khớp danh mục CHI nào trong hệ thống.` });
        return;
      }
      let allowedRoles = null;
      try {
        allowedRoles = JSON.parse(dm.chucVuDuocXem);
      } catch {
        errors.push({ dong, message: 'Lỗi kiểm tra quyền danh mục.' });
        return;
      }
      if (!canViewCategory(user.role, allowedRoles)) {
        errors.push({ dong, message: `Bạn không có quyền dùng danh mục "${dm.tenDanhMuc}".` });
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

      // NCC (tùy chọn) + ràng buộc yeuCauNCC
      let nccId = null;
      if (nhaCungCap && normName(nhaCungCap)) {
        const ncc = nccMap.get(normName(nhaCungCap));
        if (!ncc) {
          errors.push({ dong, message: `Nhà cung cấp "${nhaCungCap}" không tồn tại. Bỏ trống hoặc thêm NCC trước.` });
          return;
        }
        nccId = ncc.id;
      }
      if (dm.yeuCauNCC && !nccId) {
        errors.push({ dong, message: `Danh mục "${dm.tenDanhMuc}" bắt buộc phải có Nhà cung cấp.` });
        return;
      }

      // Hạn thanh toán (tùy chọn)
      let hanTT = null;
      if (ngayCanThanhToan && String(ngayCanThanhToan).trim()) {
        const parsed = new Date(ngayCanThanhToan);
        if (isNaN(parsed.getTime())) {
          errors.push({ dong, message: `Hạn thanh toán "${ngayCanThanhToan}" không đọc được (dd/mm/yyyy).` });
          return;
        }
        hanTT = parsed;
      }

      const { nguonTien, requestedTrangThai } = mapAiTra(aiTra);
      const trangThai = resolveCreateProposalStatus({
        role: user.role,
        nguonTien,
        requestedTrangThai,
      });

      valid.push({
        dong,
        ngayPhatSinh: ngay,
        danhMucId: dm.id,
        noiDung: String(noiDung).trim(),
        soTien: lamTronTien(tien),
        nhaCungCapId: nccId,
        nguonTien,
        trangThai,
        ghiChu: ghiChu ? String(ghiChu).trim() : null,
        ngayCanThanhToan: hanTT,
      });
    });

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Không có dòng hợp lệ nào để nhập.', errors, successCount: 0 },
        { status: 400 }
      );
    }

    // Tạo hàng loạt bằng createMany (1 lệnh INSERT — nhanh, tránh timeout transaction
    // khi nối Supabase từ xa); retry nếu trùng mã phiếu (P2002).
    const createData = await withUniqueCodeRetry(async () => {
      const codes = await allocateSequentialCodes({
        model: 'deXuatChiPhi',
        field: 'maPhieu',
        prefix: getDeXuatPrefix(),
        count: valid.length,
      });
      const data = valid.map((v, i) => ({
        maPhieu: codes[i],
        ngayPhatSinh: v.ngayPhatSinh,
        danhMucId: v.danhMucId,
        noiDung: v.noiDung,
        soTien: v.soTien,
        nhaCungCapId: v.nhaCungCapId,
        nguonTien: v.nguonTien,
        trangThai: v.trangThai,
        ghiChu: v.ghiChu,
        nguoiTaoId: user.id,
        ngayCanThanhToan: v.ngayCanThanhToan,
      }));
      await prisma.deXuatChiPhi.createMany({ data });
      return data;
    });

    // Một email tổng hợp cho các phiếu "Chờ thanh toán" (tự bắt lỗi bên trong).
    // createMany không trả về bản ghi → truy id theo mã phiếu vừa tạo.
    const choTTCodes = createData.filter((d) => d.trangThai === 'CHO_THANH_TOAN').map((d) => d.maPhieu);
    if (choTTCodes.length > 0) {
      const choTTRows = await prisma.deXuatChiPhi.findMany({
        where: { maPhieu: { in: choTTCodes } },
        select: { id: true },
      });
      if (choTTRows.length > 0) {
        await notifyManagersBulkChoThanhToan(choTTRows.map((r) => r.id));
      }
    }

    const successCount = createData.length;
    return NextResponse.json({
      success: true,
      successCount,
      errorCount: errors.length,
      errors,
      message: `Đã nhập ${successCount} đề xuất chi. Phiếu sẽ chờ quản lý duyệt như bình thường.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/import-de-xuat', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
