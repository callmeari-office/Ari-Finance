import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền hủy/xóa phiếu thu-chi.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existingTx = await prisma.thuChi.findUnique({
      where: { id },
      include: {
        deXuatChiPhi: true,
        quy: true,
      },
    });

    if (!existingTx) {
      return NextResponse.json({ error: 'Không tìm thấy giao dịch.' }, { status: 404 });
    }

    // Thực hiện trong một transaction để đảm bảo tính toàn vẹn dữ liệu
    await prisma.$transaction(async (tx) => {
      // 1. Revert các đề xuất chi phí liên kết
      if (existingTx.deXuatChiPhi && existingTx.deXuatChiPhi.length > 0) {
        for (const proposal of existingTx.deXuatChiPhi) {
          const targetStatus = proposal.nguonTien === 'TIEN_CA_NHAN' ? 'CHO_HOAN_UNG' : 'CHO_THANH_TOAN';
          await tx.deXuatChiPhi.update({
            where: { id: proposal.id },
            data: {
              trangThai: targetStatus,
              thuChiId: null,
              quyThanhToanId: null,
              ngayThanhToan: null,
              nguoiDuyetId: null,
            },
          });
        }
      }

      // 2. Xóa giao dịch ThuChi
      await tx.thuChi.delete({
        where: { id },
      });
    });

    // 3. Ghi nhật ký hệ thống
    await ghiNhatKy({
      user,
      hanhDong: 'XOA',
      doiTuong: 'THU_CHI',
      maDoiTuong: existingTx.maPhieu,
      moTa: `Hủy phiếu ${existingTx.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} ${existingTx.maPhieu} — ${Number(existingTx.soTien).toLocaleString('vi-VN')}đ (quỹ ${existingTx.quy.tenQuy}). Đã khôi phục trạng thái các đề xuất liên quan.`,
    });

    return NextResponse.json({
      success: true,
      message: `Đã hủy phiếu ${existingTx.maPhieu} thành công và khôi phục trạng thái đề xuất liên quan.`,
    });
  } catch (error) {
    logger.error('DELETE /api/thu-chi/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
