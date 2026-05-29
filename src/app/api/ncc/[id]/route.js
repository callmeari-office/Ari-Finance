import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { tenNCC, soTaiKhoan, tenNganHang, maQR } = body;

    const existingVendor = await prisma.nhaCungCap.findUnique({
      where: { id }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp.' }, { status: 404 });
    }

    const updateData = {};
    if (tenNCC) updateData.tenNCC = tenNCC.trim();
    if (soTaiKhoan) updateData.soTaiKhoan = soTaiKhoan.trim();
    if (tenNganHang) updateData.tenNganHang = tenNganHang.trim();
    if (maQR !== undefined) updateData.maQR = maQR;

    const updated = await prisma.nhaCungCap.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      vendor: updated,
      message: 'Cập nhật thông tin nhà cung cấp thành công.'
    });
  } catch (error) {
    console.error('NhaCungCap PUT error:', error);
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

    const { id } = await params;

    const existingVendor = await prisma.nhaCungCap.findUnique({
      where: { id },
      include: {
        deXuatChiPhi: { select: { id: true } },
        thuChi: { select: { id: true } }
      }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp.' }, { status: 404 });
    }

    // Safety check: block delete if used in proposals or transactions
    if (existingVendor.deXuatChiPhi.length > 0 || existingVendor.thuChi.length > 0) {
      return NextResponse.json(
        { error: 'Không thể xóa nhà cung cấp này vì đã phát sinh giao dịch hoặc đề xuất liên quan.' },
        { status: 400 }
      );
    }

    await prisma.nhaCungCap.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa nhà cung cấp "${existingVendor.tenNCC}" thành công.`
    });
  } catch (error) {
    console.error('NhaCungCap DELETE error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
