import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const vendors = await prisma.nhaCungCap.findMany({
      include: {
        thuChi: {
          where: { loaiGiaoDich: 'CHI' },
          select: { soTien: true }
        }
      },
      orderBy: { tenNCC: 'asc' },
    });

    const result = vendors.map(v => {
      const tongDaChi = v.thuChi.reduce((sum, item) => sum + item.soTien, 0);
      return {
        id: v.id,
        tenNCC: v.tenNCC,
        soTaiKhoan: v.soTaiKhoan,
        tenNganHang: v.tenNganHang,
        maQR: v.maQR,
        tongDaChi,
        soPhieuChi: v.thuChi.length
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('NhaCungCap API error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, tenNCC, soTaiKhoan, tenNganHang, maQR } = body;

    if (!tenNCC || !soTaiKhoan || !tenNganHang) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc (Tên NCC, STK, Ngân hàng).' }, { status: 400 });
    }

    // Auto generate ID if not provided
    let finalId = id ? id.trim().toUpperCase() : null;
    if (!finalId) {
      const count = await prisma.nhaCungCap.count();
      finalId = `NCC-${String(count + 1).padStart(4, '0')}`;
    }

    // Check duplicate ID
    const exists = await prisma.nhaCungCap.findUnique({
      where: { id: finalId }
    });
    if (exists) {
      return NextResponse.json({ error: `Mã nhà cung cấp [${finalId}] đã tồn tại.` }, { status: 400 });
    }

    const newVendor = await prisma.nhaCungCap.create({
      data: {
        id: finalId,
        tenNCC: tenNCC.trim(),
        soTaiKhoan: soTaiKhoan.trim(),
        tenNganHang: tenNganHang.trim(),
        maQR: maQR || null
      }
    });

    return NextResponse.json({
      success: true,
      vendor: newVendor,
      message: `Đã tạo nhà cung cấp [${finalId}] thành công.`
    });
  } catch (error) {
    console.error('NhaCungCap POST error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
