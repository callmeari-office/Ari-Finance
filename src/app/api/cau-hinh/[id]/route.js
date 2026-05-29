import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền sửa danh mục.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { tenDanhMuc, nhomChiPhiId, loaiGiaoDich, chucVuDuocXem, yeuCauNCC, trangThai } = body;

    const existing = await prisma.danhMuc.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy danh mục.' }, { status: 404 });
    }

    // Kiểm tra tính nhất quán khi sửa đổi nhóm hoặc loại
    const targetLoai = loaiGiaoDich || existing.loaiGiaoDich;
    const targetNhom = nhomChiPhiId || existing.nhomChiPhiId;

    const nhomId = targetNhom.toUpperCase();
    const isGroupThu = nhomId.startsWith('T');
    const isGroupChi = nhomId.startsWith('C');

    if (targetLoai === 'CHI' && !isGroupChi) {
      return NextResponse.json(
        { error: `Nhóm được chọn [${targetNhom}] không khớp với loại giao dịch CHI (Mã nhóm chi phải bắt đầu bằng chữ C).` },
        { status: 400 }
      );
    }

    if (targetLoai === 'THU' && !isGroupThu) {
      return NextResponse.json(
        { error: `Nhóm được chọn [${targetNhom}] không khớp với loại giao dịch THU (Mã nhóm thu phải bắt đầu bằng chữ T).` },
        { status: 400 }
      );
    }


    const updateData = {};
    if (tenDanhMuc) updateData.tenDanhMuc = tenDanhMuc;
    if (nhomChiPhiId) updateData.nhomChiPhiId = nhomChiPhiId;
    if (loaiGiaoDich) updateData.loaiGiaoDich = loaiGiaoDich;
    if (chucVuDuocXem) {
      updateData.chucVuDuocXem = typeof chucVuDuocXem === 'string' ? chucVuDuocXem : JSON.stringify(chucVuDuocXem);
    }
    if (yeuCauNCC !== undefined) updateData.yeuCauNCC = !!yeuCauNCC;
    if (trangThai) updateData.trangThai = trangThai;

    const updated = await prisma.danhMuc.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật danh mục ${updated.tenDanhMuc} thành công.`,
      danhMuc: updated,
    });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền xóa danh mục.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.danhMuc.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy danh mục.' }, { status: 404 });
    }

    await prisma.danhMuc.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa danh mục ${existing.tenDanhMuc} thành công.`,
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống. Danh mục này đang được liên kết với một số phiếu đề xuất hoặc giao dịch cũ.' },
      { status: 500 }
    );
  }
}
