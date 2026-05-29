import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

// Hàm sinh mã phiếu Thu-Chi: TC-YYMMDD-xxxx
async function generateMaThuChi() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `TC-${yy}${mm}${dd}-`;

  const count = await prisma.thuChi.count({
    where: {
      maPhieu: {
        startsWith: prefix,
      },
    },
  });

  const xxxx = String(count + 1).padStart(4, '0');
  return `${prefix}${xxxx}`;
}

export async function GET(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { id } = await params;

    const proposal = await prisma.deXuatChiPhi.findUnique({
      where: { id },
      include: {
        danhMuc: true,
        nhaCungCap: true,
        quyThanhToan: true,
        nguoiTao: {
          select: { id: true, hoTen: true, email: true, role: true },
        },
        nguoiDuyet: {
          select: { id: true, hoTen: true, email: true },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Không tìm thấy đề xuất.' }, { status: 404 });
    }

    // RBAC check
    if (user.role === 'STAFF' && proposal.nguoiTaoId !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xem đề xuất này.' }, { status: 403 });
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error('Get single proposal error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

// Cập nhật, Duyệt (TH1, TH2) hoặc Hủy đề xuất
export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, quyThanhToanId, noiDung, soTien, danhMucId, nhaCungCapId, ghiChu, ngayCanThanhToan, ngayPhatSinh, nguonTien, trangThai, anhHoaDon } = body;

    const existingProposal = await prisma.deXuatChiPhi.findUnique({
      where: { id },
      include: { danhMuc: true },
    });

    if (!existingProposal) {
      return NextResponse.json({ error: 'Không tìm thấy đề xuất.' }, { status: 404 });
    }

    // Khóa: Đề xuất đã thanh toán (đã liên kết dòng tiền) hoặc đã hủy thì không cho sửa (Trừ quyền admin tức OWNER)
    if (user.role !== 'OWNER') {
      if (existingProposal.trangThai === 'DA_THANH_TOAN' && existingProposal.thuChiId !== null && action !== 'DUYET') {
        return NextResponse.json(
          { error: 'Đề xuất đã được thanh toán và liên kết dòng tiền, không thể chỉnh sửa hoặc hủy bỏ.' },
          { status: 400 }
        );
      }
      if (existingProposal.trangThai === 'HUY') {
        return NextResponse.json(
          { error: 'Đề xuất đã bị hủy, không thể chỉnh sửa.' },
          { status: 400 }
        );
      }
    }

    // 1. Nghiệp vụ HỦY ĐỀ XUẤT (action === 'HUY')
    if (action === 'HUY') {
      // Staff chỉ được hủy đề xuất của mình, Owner/Manager được hủy đề xuất bất kỳ (RBAC)
      if (user.role === 'STAFF' && existingProposal.nguoiTaoId !== user.id) {
        return NextResponse.json(
          { error: 'Bạn không có quyền hủy đề xuất này.' },
          { status: 403 }
        );
      }

      const updated = await prisma.deXuatChiPhi.update({
        where: { id },
        data: {
          trangThai: 'HUY',
          ghiChu: ghiChu || existingProposal.ghiChu,
        },
      });

      return NextResponse.json({
        success: true,
        proposal: updated,
        message: `Đã hủy đề xuất ${existingProposal.maPhieu} thành công.`,
      });
    }

    // 2. Nghiệp vụ DUYỆT & THANH TOÁN (action === 'DUYET') - Dành riêng cho OWNER/MANAGER
    if (action === 'DUYET') {
      if (!checkRole(user, ['OWNER', 'MANAGER'])) {
        return NextResponse.json(
          { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền duyệt thanh toán.' },
          { status: 403 }
        );
      }

      if (!quyThanhToanId) {
        return NextResponse.json(
          { error: 'Vui lòng chọn quỹ dùng để thanh toán.' },
          { status: 400 }
        );
      }

      const quy = await prisma.quy.findUnique({ where: { id: quyThanhToanId } });
      if (!quy) {
        return NextResponse.json({ error: 'Quỹ thanh toán không hợp lệ.' }, { status: 400 });
      }

      // TH1 & TH2: Tạo phiếu ThuChi loại Chi
      const maThuChi = await generateMaThuChi();
      
      // Thực hiện Transaction để đảm bảo tính nhất quán (tạo phiếu Chi + cập nhật đề xuất)
      const result = await prisma.$transaction(async (tx) => {
        const phieuChi = await tx.thuChi.create({
          data: {
            maPhieu: maThuChi,
            ngayGiaoDich: new Date(),
            loaiGiaoDich: 'CHI',
            soTien: existingProposal.soTien,
            quyId: quyThanhToanId,
            danhMucId: existingProposal.danhMucId,
            nhaCungCapId: existingProposal.nhaCungCapId,
            noiDung: existingProposal.noiDung,
            nguoiTaoId: user.id, // Người duyệt sinh giao dịch
            ghiChu: `Thanh toán tự động cho đề xuất ${existingProposal.maPhieu}`,
          },
        });

        const proposalUpdated = await tx.deXuatChiPhi.update({
          where: { id },
          data: {
            trangThai: 'DA_THANH_TOAN',
            quyThanhToanId,
            thuChiId: phieuChi.id,
            ngayThanhToan: new Date(),
            nguoiDuyetId: user.id,
            ghiChu: ghiChu || existingProposal.ghiChu,
          },
        });

        return { phieuChi, proposalUpdated };
      });

      return NextResponse.json({
        success: true,
        message: `Đã duyệt thanh toán thành công. Đã sinh phiếu chi ${maThuChi}.`,
        data: result,
      });
    }

    // 3. Nghiệp vụ CHỈNH SỬA THÔNG TIN (Dành cho người tạo khi chưa thanh toán)
    if (user.role === 'STAFF' && existingProposal.nguoiTaoId !== user.id) {
      return NextResponse.json(
        { error: 'Bạn không có quyền sửa đề xuất này.' },
        { status: 403 }
      );
    }

    // Validate sửa
    if (soTien && Number(soTien) <= 0) {
      return NextResponse.json({ error: 'Số tiền phải lớn hơn 0.' }, { status: 400 });
    }

    const updateData = {};
    if (noiDung) updateData.noiDung = noiDung;
    if (soTien) updateData.soTien = Number(soTien);
    if (danhMucId) updateData.danhMucId = danhMucId;
    if (nhaCungCapId !== undefined) updateData.nhaCungCapId = nhaCungCapId;
    if (ghiChu !== undefined) updateData.ghiChu = ghiChu;
    if (ngayPhatSinh) updateData.ngayPhatSinh = new Date(ngayPhatSinh);
    if (nguonTien) updateData.nguonTien = nguonTien;
    if (trangThai) updateData.trangThai = trangThai;
    if (anhHoaDon !== undefined) updateData.anhHoaDon = anhHoaDon;
    if (ngayCanThanhToan !== undefined) {
      updateData.ngayCanThanhToan = (ngayCanThanhToan && String(ngayCanThanhToan).trim() !== '') ? new Date(ngayCanThanhToan) : null;
    }

    const updatedProposal = await prisma.deXuatChiPhi.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      message: 'Đã cập nhật đề xuất thành công.',
    });
  } catch (error) {
    console.error('Update proposal error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
