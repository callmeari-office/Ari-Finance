import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaDeXuat } from '@/lib/generateId';

const DEFAULT_LIMIT = 20;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trangThai = searchParams.get('trangThai');
    const nguonTien = searchParams.get('nguonTien');
    const nhaCungCapId = searchParams.get('nhaCungCapId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const skip = (page - 1) * limit;

    const where = {};
    if (trangThai) where.trangThai = trangThai;
    if (nguonTien) where.nguonTien = nguonTien;
    if (nhaCungCapId) where.nhaCungCapId = nhaCungCapId;

    // Staff chỉ thấy đề xuất của mình
    if (user.role === 'STAFF') {
      where.nguoiTaoId = user.id;
    }

    const include = {
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      quyThanhToan: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true, role: true } },
      nguoiDuyet: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
    };

    const [total, proposals] = await Promise.all([
      prisma.deXuatChiPhi.count({ where }),
      prisma.deXuatChiPhi.findMany({
        where,
        include,
        orderBy: { ngayTao: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const filteredProposals = proposals.filter((prop) => {
      if (user.role === 'OWNER' || user.role === 'MANAGER') return true;
      try {
        const allowedRoles = JSON.parse(prop.danhMuc.chucVuDuocXem);
        return allowedRoles.includes(user.role);
      } catch {
        return false;
      }
    });

    return NextResponse.json({
      data: filteredProposals,
      pagination: { page, limit, total },
    });
  } catch (error) {
    logger.error('GET /api/de-xuat', error);
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
      nguonTien,
      trangThai,
      ghiChu,
      ngayCanThanhToan,
    } = body;

    if (!ngayPhatSinh || !danhMucId || !noiDung || !soTien || !nguonTien || !trangThai) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Nội dung đề xuất không hợp lệ (1–500 ký tự).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền đề xuất phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    const VALID_NGUON_TIEN = ['TIEN_SHOP', 'TIEN_CA_NHAN'];
    const VALID_TRANG_THAI = ['CHO_THANH_TOAN', 'CHO_HOAN_UNG', 'DA_THANH_TOAN'];
    if (!VALID_NGUON_TIEN.includes(nguonTien)) {
      return NextResponse.json({ error: 'Nguồn tiền không hợp lệ.' }, { status: 400 });
    }
    if (!VALID_TRANG_THAI.includes(trangThai)) {
      return NextResponse.json({ error: 'Trạng thái đề xuất không hợp lệ.' }, { status: 400 });
    }

    const danhMuc = await prisma.danhMuc.findUnique({ where: { id: danhMucId } });
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh mục chi phí không hợp lệ.' }, { status: 400 });
    }

    try {
      const allowedRoles = JSON.parse(danhMuc.chucVuDuocXem);
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền chọn danh mục chi phí này.' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Lỗi kiểm tra quyền danh mục.' }, { status: 500 });
    }

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
        noiDung: noiDung.trim(),
        soTien: Number(soTien),
        nhaCungCapId: nhaCungCapId || null,
        nguonTien,
        trangThai,
        ghiChu: ghiChu || null,
        nguoiTaoId: user.id,
        ngayCanThanhToan:
          ngayCanThanhToan && String(ngayCanThanhToan).trim() !== ''
            ? new Date(ngayCanThanhToan)
            : null,
      },
    });

    return NextResponse.json({
      success: true,
      proposal: newProposal,
      message: `Đã tạo đề xuất ${maPhieu} thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/de-xuat', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
