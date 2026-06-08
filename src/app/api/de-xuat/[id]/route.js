import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaThuChi } from '@/lib/generateId';
import { isRestrictedToOwnProposals } from '@/lib/roles';
import { ghiNhatKy } from '@/lib/audit';
import { notifyUser } from '@/lib/webpush';

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
          select: { id: true, hoTen: true, tenNgan: true, email: true, role: true },
        },
        nguoiDuyet: {
          select: { id: true, hoTen: true, tenNgan: true, email: true },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Không tìm thấy đề xuất.' }, { status: 404 });
    }

    // RBAC check
    if (isRestrictedToOwnProposals(user.role) && proposal.nguoiTaoId !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xem đề xuất này.' }, { status: 403 });
    }

    return NextResponse.json(proposal);
  } catch (error) {
    logger.error('GET /api/de-xuat/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

// Xóa cứng đề xuất — CHỈ OWNER, chỉ với phiếu CHƯA gắn dòng tiền (chứng từ rác)
export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Chủ shop (OWNER) mới được xóa vĩnh viễn
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền xóa vĩnh viễn đề xuất.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingProposal = await prisma.deXuatChiPhi.findUnique({
      where: { id },
    });

    if (!existingProposal) {
      return NextResponse.json({ error: 'Không tìm thấy đề xuất.' }, { status: 404 });
    }

    // Không cho xóa phiếu đã gắn dòng tiền (đã thanh toán thực tế) để tránh lệch quỹ/sổ sách
    if (existingProposal.thuChiId !== null) {
      return NextResponse.json(
        { error: 'Đề xuất đã thanh toán và liên kết dòng tiền, không thể xóa vĩnh viễn. Hãy xử lý phiếu chi liên quan trước.' },
        { status: 400 }
      );
    }

    await prisma.deXuatChiPhi.delete({ where: { id } });

    await ghiNhatKy({
      user,
      hanhDong: 'XOA',
      doiTuong: 'DE_XUAT',
      maDoiTuong: existingProposal.maPhieu,
      moTa: `Xóa vĩnh viễn đề xuất "${existingProposal.noiDung}" (${Number(existingProposal.soTien).toLocaleString('vi-VN')}đ)`,
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa vĩnh viễn đề xuất ${existingProposal.maPhieu}.`,
    });
  } catch (error) {
    logger.error('DELETE /api/de-xuat/[id]', error);
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

    // Kiểm tra ảnh hóa đơn nếu có gửi lên (chỉ validate khi có giá trị khác null)
    if (anhHoaDon) {
      const MAX_BYTES = 2 * 1024 * 1024;
      if (typeof anhHoaDon !== 'string' || !anhHoaDon.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Ảnh hóa đơn không hợp lệ (chỉ chấp nhận file ảnh).' }, { status: 400 });
      }
      const commaIdx = anhHoaDon.indexOf(',');
      if (commaIdx === -1) {
        return NextResponse.json({ error: 'Định dạng ảnh hóa đơn không hợp lệ.' }, { status: 400 });
      }
      const byteLength = Math.floor(anhHoaDon.slice(commaIdx + 1).length * 0.75);
      if (byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Ảnh hóa đơn quá lớn (tối đa 2 MB). Vui lòng nén ảnh trước khi tải lên.' }, { status: 400 });
      }
    }

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
      if (isRestrictedToOwnProposals(user.role) && existingProposal.nguoiTaoId !== user.id) {
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

      await ghiNhatKy({
        user,
        hanhDong: 'HUY',
        doiTuong: 'DE_XUAT',
        maDoiTuong: existingProposal.maPhieu,
        moTa: `Hủy đề xuất "${existingProposal.noiDung}"`,
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

      // Chống duyệt 2 lần: phiếu đã gắn dòng tiền (đã thanh toán) thì không duyệt lại,
      // tránh sinh phiếu chi trùng làm lệch số dư quỹ. (Bulk-approve đã chặn sẵn việc này.)
      if (existingProposal.thuChiId !== null) {
        return NextResponse.json(
          { error: 'Đề xuất này đã được thanh toán trước đó, không thể duyệt lại.' },
          { status: 400 }
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

      await ghiNhatKy({
        user,
        hanhDong: 'DUYET',
        doiTuong: 'DE_XUAT',
        maDoiTuong: existingProposal.maPhieu,
        moTa: `Duyệt thanh toán ${Number(existingProposal.soTien).toLocaleString('vi-VN')}đ từ quỹ ${quy.tenQuy} → sinh phiếu chi ${maThuChi}`,
      });

      try {
        await notifyUser(existingProposal.nguoiTaoId, {
          title: '✅ Phiếu đã được duyệt',
          body: `${existingProposal.maPhieu} — ${Number(existingProposal.soTien).toLocaleString('vi-VN')}đ đã được thanh toán.`,
          url: '/de-xuat?open=' + existingProposal.id,
          tag: 'duyet-' + existingProposal.id,
        });
      } catch (_) { /* push thất bại không làm hỏng nghiệp vụ */ }

      return NextResponse.json({
        success: true,
        message: `Đã duyệt thanh toán thành công. Đã sinh phiếu chi ${maThuChi}.`,
        data: result,
      });
    }

    // 3. Nghiệp vụ CHỈNH SỬA THÔNG TIN (Dành cho người tạo khi chưa thanh toán)
    if (isRestrictedToOwnProposals(user.role) && existingProposal.nguoiTaoId !== user.id) {
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
    if (ngayCanThanhToan !== undefined) {
      updateData.ngayCanThanhToan = (ngayCanThanhToan && String(ngayCanThanhToan).trim() !== '') ? new Date(ngayCanThanhToan) : null;
    }
    if (anhHoaDon !== undefined) {
      updateData.anhHoaDon = anhHoaDon || null;
    }

    const updatedProposal = await prisma.deXuatChiPhi.update({
      where: { id },
      data: updateData,
    });

    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'DE_XUAT',
      maDoiTuong: existingProposal.maPhieu,
      moTa: `Chỉnh sửa đề xuất "${updatedProposal.noiDung}"`,
    });

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      message: 'Đã cập nhật đề xuất thành công.',
    });
  } catch (error) {
    logger.error('PUT /api/de-xuat/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
