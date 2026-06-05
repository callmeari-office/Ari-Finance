import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaThuChi } from '@/lib/generateId';
import { ghiNhatKy } from '@/lib/audit';

// Duyệt NHIỀU đề xuất chờ thanh toán cùng lúc (TH1/TH2).
// Khác với /duyet-gop (hoàn ứng gộp 1 phiếu): mỗi đề xuất sinh MỘT phiếu Chi riêng,
// cho phép mỗi phiếu chọn quỹ chi khác nhau.
// Body: { items: [{ id, quyThanhToanId }] }
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Owner/Manager được duyệt thanh toán
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền duyệt thanh toán.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp danh sách đề xuất cần duyệt.' },
        { status: 400 }
      );
    }

    // Kiểm tra mỗi item phải có quỹ chi
    for (const it of items) {
      if (!it || !it.id) {
        return NextResponse.json({ error: 'Danh sách đề xuất không hợp lệ.' }, { status: 400 });
      }
      if (!it.quyThanhToanId) {
        return NextResponse.json(
          { error: 'Mỗi đề xuất được chọn cần có quỹ thanh toán.' },
          { status: 400 }
        );
      }
    }

    const results = [];
    let successCount = 0;

    // Xử lý TUẦN TỰ để mã phiếu chi (TCyymm-xxxx) sinh liên tiếp, không trùng
    for (const it of items) {
      const { id, quyThanhToanId } = it;
      try {
        const existingProposal = await prisma.deXuatChiPhi.findUnique({
          where: { id },
          include: { danhMuc: true },
        });

        if (!existingProposal) {
          results.push({ id, success: false, error: 'Không tìm thấy đề xuất.' });
          continue;
        }

        // Chỉ duyệt các phiếu đang chờ duyệt chi (CHO_THANH_TOAN) hoặc đã trả sẵn chờ gán quỹ
        const hopLe =
          existingProposal.trangThai === 'CHO_THANH_TOAN' ||
          (existingProposal.trangThai === 'DA_THANH_TOAN' && existingProposal.thuChiId === null);
        if (!hopLe) {
          results.push({
            id,
            maPhieu: existingProposal.maPhieu,
            success: false,
            error: 'Đề xuất không ở trạng thái có thể duyệt chi.',
          });
          continue;
        }

        const quy = await prisma.quy.findUnique({ where: { id: quyThanhToanId } });
        if (!quy) {
          results.push({
            id,
            maPhieu: existingProposal.maPhieu,
            success: false,
            error: 'Quỹ thanh toán không hợp lệ.',
          });
          continue;
        }

        const maThuChi = await generateMaThuChi();

        await prisma.$transaction(async (tx) => {
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
              nguoiTaoId: user.id,
              ghiChu: `Thanh toán tự động cho đề xuất ${existingProposal.maPhieu}`,
            },
          });

          await tx.deXuatChiPhi.update({
            where: { id },
            data: {
              trangThai: 'DA_THANH_TOAN',
              quyThanhToanId,
              thuChiId: phieuChi.id,
              ngayThanhToan: new Date(),
              nguoiDuyetId: user.id,
            },
          });
        });

        await ghiNhatKy({
          user,
          hanhDong: 'DUYET',
          doiTuong: 'DE_XUAT',
          maDoiTuong: existingProposal.maPhieu,
          moTa: `Duyệt thanh toán ${Number(existingProposal.soTien).toLocaleString('vi-VN')}đ từ quỹ ${quy.tenQuy} → sinh phiếu chi ${maThuChi} (duyệt hàng loạt)`,
        });

        successCount += 1;
        results.push({ id, maPhieu: existingProposal.maPhieu, success: true, maThuChi });
      } catch (err) {
        logger.error('POST /api/de-xuat/duyet-nhieu (item)', err);
        results.push({ id, success: false, error: 'Lỗi khi duyệt phiếu này.' });
      }
    }

    const failCount = items.length - successCount;
    return NextResponse.json({
      success: failCount === 0,
      successCount,
      failCount,
      message:
        failCount === 0
          ? `Đã duyệt thanh toán thành công ${successCount} đề xuất.`
          : `Đã duyệt ${successCount} đề xuất, ${failCount} đề xuất thất bại.`,
      results,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat/duyet-nhieu', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
