import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

function getCpPrefix() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `CP${yy}${mm}-`;
}

function getTcPrefix() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `TC${yy}${mm}-`;
}

function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Nhập dữ liệu phiếu chi CŨ từ Excel.
// - Không có quỹ → chỉ tạo DeXuatChiPhi (laLichSu=true), không trừ quỹ.
// - Có quỹ → tạo DeXuatChiPhi + ThuChi trong transaction, trừ số dư quỹ.
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

    // Load lookup maps
    const [danhMucList, nccList, quyList] = await Promise.all([
      prisma.danhMuc.findMany({ where: { loaiGiaoDich: 'CHI' } }),
      prisma.nhaCungCap.findMany(),
      prisma.quy.findMany({ where: { trangThai: 'ACTIVE' } }),
    ]);
    const danhMucMap = new Map(danhMucList.map((d) => [normName(d.tenDanhMuc), d]));
    const nccMap = new Map(nccList.map((n) => [normName(n.tenNCC), n]));
    const quyMap = new Map(quyList.map((q) => [normName(q.tenQuy), q]));

    const errors = [];
    const validWithoutQuy = []; // chỉ tạo DeXuatChiPhi
    const validWithQuy = [];    // tạo cả DeXuatChiPhi + ThuChi

    rows.forEach((row, idx) => {
      const dong = idx + 2;
      const { ngayPhatSinh, danhMuc, noiDung, soTien, nhaCungCap, ghiChu, ngayThanhToan, tenQuy } = row;

      // Ngày phát sinh
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

      // Ngày thanh toán (tùy chọn, nhưng nếu có phải cùng tháng với ngày phát sinh)
      let ngayTT = ngay; // mặc định = ngayPhatSinh
      if (ngayThanhToan && String(ngayThanhToan).trim()) {
        const parsed = new Date(ngayThanhToan);
        if (isNaN(parsed.getTime())) {
          errors.push({ dong, message: `Ngày thanh toán "${ngayThanhToan}" không đọc được. Định dạng phải là dd/mm/yyyy hoặc yyyy-mm-dd.` });
          return;
        }
        if (
          parsed.getFullYear() !== ngay.getFullYear() ||
          parsed.getMonth() !== ngay.getMonth()
        ) {
          const fmtParsed = `${String(parsed.getDate()).padStart(2,'0')}/${String(parsed.getMonth()+1).padStart(2,'0')}/${parsed.getFullYear()}`;
          const fmtNgay = `${String(ngay.getDate()).padStart(2,'0')}/${String(ngay.getMonth()+1).padStart(2,'0')}/${ngay.getFullYear()}`;
          errors.push({
            dong,
            message: `Ngày thanh toán (${fmtParsed}) khác tháng ngày phát sinh (${fmtNgay}). Nếu cố ý, vui lòng nhập tay.`,
          });
          return;
        }
        ngayTT = parsed;
      }

      // Quỹ thanh toán (tùy chọn)
      let quy = null;
      if (tenQuy && normName(tenQuy)) {
        quy = quyMap.get(normName(tenQuy));
        if (!quy) {
          const validNames = quyList.map((q) => `"${q.tenQuy}"`).join(', ');
          errors.push({
            dong,
            message: `Quỹ "${tenQuy}" không tồn tại hoặc không hoạt động. Tên quỹ hợp lệ: ${validNames || '(chưa có quỹ nào)'}`,
          });
          return;
        }
      }

      const base = {
        dong,
        ngayPhatSinh: ngay,
        ngayThanhToan: ngayTT,
        danhMucId: dm.id,
        noiDung: String(noiDung).trim(),
        soTien: tien,
        nhaCungCapId: nccId,
        ghiChu: ghiChu ? String(ghiChu).trim() : null,
      };

      if (quy) {
        validWithQuy.push({ ...base, quy });
      } else {
        validWithoutQuy.push(base);
      }
    });

    const totalValid = validWithoutQuy.length + validWithQuy.length;
    if (totalValid === 0) {
      return NextResponse.json(
        { error: 'Không có dòng hợp lệ nào để nhập.', errors, successCount: 0 },
        { status: 400 }
      );
    }

    // Sinh mã phiếu DeXuatChiPhi hàng loạt (1 query)
    const cpPrefix = getCpPrefix();
    const lastCp = await prisma.deXuatChiPhi.findFirst({
      where: { maPhieu: { startsWith: cpPrefix } },
      orderBy: { maPhieu: 'desc' },
      select: { maPhieu: true },
    });
    let cpNext = 1;
    if (lastCp) {
      const parts = lastCp.maPhieu.split('-');
      const n = parseInt(parts[parts.length - 1], 10);
      cpNext = (isNaN(n) ? 0 : n) + 1;
    }

    // Sinh mã phiếu ThuChi hàng loạt (1 query, chỉ khi có row cần quỹ)
    let tcNext = 1;
    const tcPrefix = getTcPrefix();
    if (validWithQuy.length > 0) {
      const lastTc = await prisma.thuChi.findFirst({
        where: { maPhieu: { startsWith: tcPrefix } },
        orderBy: { maPhieu: 'desc' },
        select: { maPhieu: true },
      });
      if (lastTc) {
        const parts = lastTc.maPhieu.split('-');
        const n = parseInt(parts[parts.length - 1], 10);
        tcNext = (isNaN(n) ? 0 : n) + 1;
      }
    }

    // Gán mã phiếu cho tất cả valid rows
    const allValid = [...validWithoutQuy, ...validWithQuy];
    for (const v of allValid) {
      v.maCp = `${cpPrefix}${String(cpNext++).padStart(4, '0')}`;
    }
    for (const v of validWithQuy) {
      v.maTc = `${tcPrefix}${String(tcNext++).padStart(4, '0')}`;
    }

    // 1. Tạo DeXuatChiPhi không có quỹ (createMany — nhanh)
    let successNoQuy = 0;
    if (validWithoutQuy.length > 0) {
      const result = await prisma.deXuatChiPhi.createMany({
        data: validWithoutQuy.map((v) => ({
          maPhieu: v.maCp,
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
          ngayThanhToan: v.ngayThanhToan,
          ghiChu: v.ghiChu,
        })),
      });
      successNoQuy = result.count;
    }

    // 2. Tạo DeXuatChiPhi + ThuChi có quỹ (transaction per row)
    let successWithQuy = 0;
    const txErrors = [];
    for (const v of validWithQuy) {
      try {
        await prisma.$transaction(async (tx) => {
          const thuChi = await tx.thuChi.create({
            data: {
              maPhieu: v.maTc,
              ngayGiaoDich: v.ngayThanhToan,
              loaiGiaoDich: 'CHI',
              soTien: v.soTien,
              quyId: v.quy.id,
              danhMucId: v.danhMucId,
              nhaCungCapId: v.nhaCungCapId,
              noiDung: v.noiDung,
              nguoiTaoId: user.id,
              ghiChu: v.ghiChu,
            },
          });
          await tx.deXuatChiPhi.create({
            data: {
              maPhieu: v.maCp,
              ngayPhatSinh: v.ngayPhatSinh,
              danhMucId: v.danhMucId,
              noiDung: v.noiDung,
              soTien: v.soTien,
              nhaCungCapId: v.nhaCungCapId,
              nguonTien: 'TIEN_SHOP',
              trangThai: 'DA_THANH_TOAN',
              laLichSu: true,
              thuChiId: thuChi.id,
              quyThanhToanId: v.quy.id,
              nguoiTaoId: user.id,
              nguoiDuyetId: user.id,
              ngayThanhToan: v.ngayThanhToan,
              ghiChu: v.ghiChu,
            },
          });
        });
        successWithQuy++;
      } catch (err) {
        txErrors.push({ dong: v.dong, message: `Lỗi tạo phiếu có quỹ: ${err?.message || String(err)}` });
      }
    }

    const allErrors = [...errors, ...txErrors];
    const successCount = successNoQuy + successWithQuy;

    return NextResponse.json({
      success: true,
      successCount,
      errorCount: allErrors.length,
      errors: allErrors,
      message: `Đã nhập ${successCount} phiếu chi cũ thành công${successWithQuy > 0 ? ` (${successWithQuy} phiếu có quỹ, đã tạo phiếu Thu-Chi)` : ''}.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/import', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
