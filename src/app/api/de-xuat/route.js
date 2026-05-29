import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Hàm sinh mã đề xuất: CP-YYMMDD-xxxx
async function generateMaDeXuat() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `CP-${yy}${mm}${dd}-`;

  const count = await prisma.deXuatChiPhi.count({
    where: {
      maPhieu: {
        startsWith: prefix,
      },
    },
  });

  const xxxx = String(count + 1).padStart(4, '0');
  return `${prefix}${xxxx}`;
}

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trangThai = searchParams.get('trangThai');
    const nguonTien = searchParams.get('nguonTien');

    // Xây dựng điều kiện query
    const where = {};
    if (trangThai) where.trangThai = trangThai;
    if (nguonTien) where.nguonTien = nguonTien;

    // Phân quyền xem danh sách
    if (user.role === 'STAFF') {
      // Staff chỉ thấy đề xuất của mình
      where.nguoiTaoId = user.id;
    }

    const proposals = await prisma.deXuatChiPhi.findMany({
      where,
      include: {
        danhMuc: {
          include: { nhomChiPhi: true },
        },
        nhaCungCap: true,
        quyThanhToan: true,
        nguoiTao: {
          select: { id: true, hoTen: true, email: true, role: true },
        },
        nguoiDuyet: {
          select: { id: true, hoTen: true, email: true },
        },
      },
      orderBy: { ngayTao: 'desc' },
    });

    // Đối với Manager: Xem tất cả đề xuất, nhưng KHÔNG thấy các đề xuất thuộc danh mục nhạy cảm
    // (nhạy cảm = chucVuDuocXem không chứa role MANAGER)
    const filteredProposals = proposals.filter((prop) => {
      if (user.role === 'OWNER' || user.role === 'MANAGER') return true;
      
      try {
        const allowedRoles = JSON.parse(prop.danhMuc.chucVuDuocXem);
        return allowedRoles.includes(user.role);
      } catch (e) {
        return false;
      }
    });

    return NextResponse.json(filteredProposals);
  } catch (error) {
    console.error('Get proposals error:', error);
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
    const {
      ngayPhatSinh,
      danhMucId,
      noiDung,
      soTien,
      nhaCungCapId,
      anhHoaDon,
      nguonTien,
      trangThai,
      ghiChu,
      ngayCanThanhToan,
    } = body;

    // Validate dữ liệu
    if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien || !trangThai) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền đề xuất phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    // Kiểm tra danh mục có tồn tại và hợp lệ
    const danhMuc = await prisma.danhMuc.findUnique({
      where: { id: danhMucId },
    });

    if (!danhMuc) {
      return NextResponse.json(
        { error: 'Danh mục chi phí không hợp lệ.' },
        { status: 400 }
      );
    }

    // Kiểm tra xem danh mục này user có quyền truy cập/chọn không
    try {
      const allowedRoles = JSON.parse(danhMuc.chucVuDuocXem);
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền chọn danh mục chi phí này.' },
          { status: 403 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Lỗi kiểm tra quyền danh mục.' },
        { status: 500 }
      );
    }

    // Kiểm tra nhà cung cấp nếu danh mục yêu cầu NCC
    if (danhMuc.yeuCauNCC && !nhaCungCapId) {
      return NextResponse.json(
        { error: `Danh mục "${danhMuc.tenDanhMuc}" yêu cầu phải chọn Nhà cung cấp.` },
        { status: 400 }
      );
    }

    const maPhieu = await generateMaDeXuat();

    const newProposal = await prisma.deXuatChiPhi.create({
      data: {
        maPhieu,
        ngayPhatSinh: new Date(ngayPhatSinh),
        danhMucId,
        noiDung,
        soTien: Number(soTien),
        nhaCungCapId: nhaCungCapId || null,
        anhHoaDon: anhHoaDon || null,
        nguonTien,
        trangThai, // CHO_THANH_TOAN, CHO_HOAN_UNG, DA_THANH_TOAN, HUY
        nguoiTaoId: user.id,
        ngayCanThanhToan: (ngayCanThanhToan && String(ngayCanThanhToan).trim() !== '') ? new Date(ngayCanThanhToan) : null,
      },
    });


    return NextResponse.json({
      success: true,
      proposal: newProposal,
      message: `Đã tạo đề xuất ${maPhieu} thành công.`,
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
