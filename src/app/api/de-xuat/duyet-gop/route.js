import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaThuChi, withUniqueCodeRetry } from '@/lib/generateId';
import { ghiNhatKy } from '@/lib/audit';
import { notifyUser, notifyProposalApproved } from '@/lib/webpush';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Owner/Manager được duyệt hoàn ứng gộp
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền duyệt hoàn ứng.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ids, quyThanhToanId, ghiChu, ngayGiaoDich } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp danh sách đề xuất cần hoàn ứng.' },
        { status: 400 }
      );
    }

    if (!quyThanhToanId) {
      return NextResponse.json(
        { error: 'Vui lòng chọn quỹ shop dùng để chi trả hoàn ứng.' },
        { status: 400 }
      );
    }

    // Lấy thông tin các đề xuất được chọn
    const proposals = await prisma.deXuatChiPhi.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        danhMuc: true,
        nguoiDeXuat: true,
      },
    });

    if (proposals.length !== ids.length) {
      return NextResponse.json(
        { error: 'Một số đề xuất không tồn tại trong hệ thống.' },
        { status: 400 }
      );
    }

    // Kiểm tra tính hợp lệ:
    // 1. Phải ở trạng thái CHO_HOAN_UNG
    // 2. Phải cùng nguồn tiền TIEN_CA_NHAN
    // 3. Phải thuộc CÙNG một người đề xuất (nguoiDeXuatId)
    const staffId = proposals[0].nguoiDeXuatId;
    for (const prop of proposals) {
      if (prop.trangThai !== 'CHO_HOAN_UNG') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không ở trạng thái chờ hoàn ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguonTien !== 'TIEN_CA_NHAN') {
        return NextResponse.json(
          { error: `Đề xuất ${prop.maPhieu} không phải là nguồn tiền cá nhân ứng.` },
          { status: 400 }
        );
      }
      if (prop.nguoiDeXuatId !== staffId) {
        return NextResponse.json(
          { error: 'Không thể duyệt gộp các đề xuất của nhiều người đề xuất khác nhau.' },
          { status: 400 }
        );
      }
    }

    // Tính tổng tiền hoàn ứng
    const tongTien = proposals.reduce((sum, prop) => sum + prop.soTien, 0);

    // Thông tin người đề xuất để ghi nội dung (đã include ở bước fetch proposals)
    const staffUser = proposals[0].nguoiDeXuat;

    let maThuChi;
    const firstProp = proposals[0];

    // Thực hiện trong một transaction
    const result = await withUniqueCodeRetry(async () => {
      maThuChi = await generateMaThuChi();
      return prisma.$transaction(async (tx) => {
      // 1. Tạo MỘT phiếu ThuChi loại Chi đại diện cho toàn bộ khoản gộp này
      const phieuChi = await tx.thuChi.create({
        data: {
          maPhieu: maThuChi,
          ngayGiaoDich: ngayGiaoDich ? new Date(ngayGiaoDich) : new Date(),
          loaiGiaoDich: 'CHI',
          soTien: tongTien,
          quyId: quyThanhToanId,
          danhMucId: firstProp.danhMucId, // Dùng danh mục của đề xuất đầu tiên làm đại diện
          nhaCungCapId: firstProp.nhaCungCapId,
          noiDung: `Hoàn ứng gộp ${proposals.length} phiếu chi cho NV ${staffUser.hoTen}. DS đề xuất: ${proposals.map(p => p.maPhieu).join(', ')}`,
          nguoiTaoId: user.id,
          ghiChu: ghiChu || `Duyệt gộp hoàn ứng cho nhân viên. ${ghiChu || ''}`,
        },
      });

      // 2. Cập nhật tất cả đề xuất trỏ về phiếu ThuChi gộp này và chuyển trạng thái
      await tx.deXuatChiPhi.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          trangThai: 'DA_THANH_TOAN',
          quyThanhToanId,
          thuChiId: phieuChi.id,
          ngayThanhToan: ngayGiaoDich ? new Date(ngayGiaoDich) : new Date(),
          nguoiDuyetId: user.id,
        },
      });

        return phieuChi;
      });
    });

    await ghiNhatKy({
      user,
      hanhDong: 'DUYET',
      doiTuong: 'DE_XUAT',
      maDoiTuong: maThuChi,
      moTa: `Duyệt gộp hoàn ứng ${proposals.length} phiếu (${proposals.map(p => p.maPhieu).join(', ')}) cho NV ${staffUser?.hoTen || ''} — tổng ${tongTien.toLocaleString('vi-VN')}đ`,
    });

    try {
      await notifyProposalApproved(staffId, {
        title: '✅ Phiếu đã được duyệt',
        body: `${proposals.length} phiếu hoàn ứng của bạn — ${tongTien.toLocaleString('vi-VN')}đ đã được thanh toán gộp.`,
        url: '/de-xuat?open=' + proposals[0].id,
        tag: 'duyet-gop-' + maThuChi,
      }, user.id);
    } catch (_) { /* push thất bại không làm hỏng nghiệp vụ */ }

    return NextResponse.json({
      success: true,
      message: `Đã duyệt gộp hoàn ứng thành công cho ${proposals.length} đề xuất. Sinh phiếu chi ${maThuChi} với tổng tiền ${tongTien.toLocaleString('vi-VN')} VND.`,
      thuChi: result,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/duyet-gop', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
