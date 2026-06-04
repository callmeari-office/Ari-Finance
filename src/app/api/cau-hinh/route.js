import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập thông tin cấu hình danh mục.' },
        { status: 403 }
      );
    }

    const categories = await prisma.danhMuc.findMany({
      include: { nhomChiPhi: true },
      orderBy: { id: 'asc' },
    });

    const groups = await prisma.nhomChiPhi.findMany({
      orderBy: { thuTu: 'asc' },
    });

    return NextResponse.json({ categories, groups });
  } catch (error) {
    logger.error('GET /api/cau-hinh', error);
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

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Chỉ Admin/Owner mới có quyền thêm mới danh mục.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id, // Ví dụ: C1.07
      tenDanhMuc,
      nhomChiPhiId,
      loaiGiaoDich, // CHI, THU
      chucVuDuocXem, // Mảng roles: ['OWNER', 'MANAGER', 'STAFF']
      yeuCauNCC, // true/false
      trangThai,
    } = body;

    if (!id || !tenDanhMuc || !nhomChiPhiId || !loaiGiaoDich || !chucVuDuocXem) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*).' },
        { status: 400 }
      );
    }

    // Kiểm tra tính nhất quán giữa nhóm và loại giao dịch
    const nhomId = nhomChiPhiId.toUpperCase();
    const isGroupThu = nhomId.startsWith('T');
    const isGroupChi = nhomId.startsWith('C');

    if (loaiGiaoDich === 'CHI' && !isGroupChi) {
      return NextResponse.json(
        { error: `Nhóm được chọn [${nhomChiPhiId}] không khớp với loại giao dịch CHI (Mã nhóm chi phải bắt đầu bằng chữ C).` },
        { status: 400 }
      );
    }

    if (loaiGiaoDich === 'THU' && !isGroupThu) {
      return NextResponse.json(
        { error: `Nhóm được chọn [${nhomChiPhiId}] không khớp với loại giao dịch THU (Mã nhóm thu phải bắt đầu bằng chữ T).` },
        { status: 400 }
      );
    }

    // Check trùng ID
    const existing = await prisma.danhMuc.findUnique({
      where: { id },
    });


    if (existing) {
      return NextResponse.json(
        { error: `Mã danh mục "${id}" đã tồn tại trên hệ thống.` },
        { status: 400 }
      );
    }

    const newDanhMuc = await prisma.danhMuc.create({
      data: {
        id,
        tenDanhMuc,
        nhomChiPhiId,
        loaiGiaoDich,
        chucVuDuocXem: typeof chucVuDuocXem === 'string' ? chucVuDuocXem : JSON.stringify(chucVuDuocXem),
        yeuCauNCC: !!yeuCauNCC,
        trangThai: trangThai || 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cấu hình thêm danh mục "${tenDanhMuc}" thành công.`,
      danhMuc: newDanhMuc,
    });
  } catch (error) {
    logger.error('POST /api/cau-hinh', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
