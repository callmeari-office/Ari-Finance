import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { formatDate } from '@/lib/date';

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

export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) mới có quyền chỉnh sửa ngày giao dịch.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { ngayGiaoDich } = body;

    if (!ngayGiaoDich) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp ngày giao dịch mới.' },
        { status: 400 }
      );
    }

    const newDate = new Date(ngayGiaoDich);
    if (isNaN(newDate.getTime())) {
      return NextResponse.json(
        { error: 'Ngày giao dịch không hợp lệ.' },
        { status: 400 }
      );
    }

    // Kiểm tra xem ID có tồn tại trong bảng ThuChi hay không
    const existingTx = await prisma.thuChi.findUnique({
      where: { id },
    });

    if (existingTx) {
      // 1. Trường hợp là giao dịch tiêu chuẩn (ThuChi)
      await prisma.$transaction(async (tx) => {
        // Cập nhật ngày giao dịch trong ThuChi
        await tx.thuChi.update({
          where: { id },
          data: { ngayGiaoDich: newDate },
        });

        // Cập nhật ngayThanhToan của các đề xuất liên quan (nếu có)
        await tx.deXuatChiPhi.updateMany({
          where: { thuChiId: id },
          data: { ngayThanhToan: newDate },
        });
      });

      await ghiNhatKy({
        user,
        hanhDong: 'SUA',
        doiTuong: 'THU_CHI',
        maDoiTuong: existingTx.maPhieu,
        moTa: `Sửa ngày giao dịch của phiếu ${existingTx.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} ${existingTx.maPhieu} từ ${formatDate(existingTx.ngayGiaoDich)} thành ${formatDate(newDate)}`,
      });

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật ngày giao dịch của phiếu ${existingTx.maPhieu} thành công.`,
      });
    } else {
      // 2. Kiểm tra xem có phải là phiếu chi lịch sử (DeXuatChiPhi với laLichSu = true) không
      const existingProposal = await prisma.deXuatChiPhi.findUnique({
        where: { id },
      });

      if (!existingProposal || !existingProposal.laLichSu) {
        return NextResponse.json(
          { error: 'Không tìm thấy giao dịch hoặc phiếu lịch sử tương ứng.' },
          { status: 404 }
        );
      }

      await prisma.deXuatChiPhi.update({
        where: { id },
        data: {
          ngayPhatSinh: newDate,
        },
      });

      await ghiNhatKy({
        user,
        hanhDong: 'SUA',
        doiTuong: 'DE_XUAT',
        maDoiTuong: existingProposal.maPhieu,
        moTa: `Sửa ngày giao dịch của phiếu chi lịch sử ${existingProposal.maPhieu} từ ${formatDate(existingProposal.ngayPhatSinh)} thành ${formatDate(newDate)}`,
      });

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật ngày giao dịch của phiếu chi lịch sử ${existingProposal.maPhieu} thành công.`,
      });
    }
  } catch (error) {
    logger.error('PUT /api/thu-chi/[id]', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
