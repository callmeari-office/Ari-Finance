import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { generateMaThuChi } from '@/lib/generateId';

const DEFAULT_LIMIT = 50;

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập dữ liệu Thu-Chi.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
    const skip = (page - 1) * limit;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const include = {
      quy: true,
      danhMuc: { include: { nhomChiPhi: true } },
      nhaCungCap: true,
      nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
      deXuatChiPhi: {
        select: {
          id: true,
          maPhieu: true,
          noiDung: true,
          soTien: true,
          trangThai: true,
          nguoiTao: { select: { hoTen: true, tenNgan: true } },
        },
      },
    };

    const [total, thuChis] = await Promise.all([
      prisma.thuChi.count(),
      prisma.thuChi.findMany({
        include,
        orderBy: { ngayGiaoDich: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = thuChis.map((tc) => ({
      ...tc,
      soPhieuDeXuat: tc.deXuatChiPhi.length,
      tongTienDeXuat: tc.deXuatChiPhi.reduce((sum, dx) => sum + dx.soTien, 0),
    }));

    // Khi includeHistory=true: gộp thêm phiếu lịch sử từ DeXuatChiPhi vào kết quả
    // (chỉ dùng cho báo cáo/dashboard, không ảnh hưởng quỹ)
    if (includeHistory) {
      const lichSuRecords = await prisma.deXuatChiPhi.findMany({
        where: { laLichSu: true },
        include: {
          danhMuc: { include: { nhomChiPhi: true } },
          nhaCungCap: true,
          nguoiTao: { select: { id: true, hoTen: true, tenNgan: true, email: true } },
        },
        orderBy: { ngayPhatSinh: 'desc' },
      });

      const normalizedLichSu = lichSuRecords.map((dx) => ({
        id: dx.id,
        maPhieu: dx.maPhieu,
        ngayGiaoDich: dx.ngayThanhToan || dx.ngayPhatSinh,
        loaiGiaoDich: 'CHI',
        soTien: dx.soTien,
        danhMucId: dx.danhMucId,
        danhMuc: dx.danhMuc,
        nhaCungCapId: dx.nhaCungCapId,
        nhaCungCap: dx.nhaCungCap,
        noiDung: dx.noiDung,
        ghiChu: dx.ghiChu,
        quyId: null,
        quy: null,
        nguoiTaoId: dx.nguoiTaoId,
        nguoiTao: dx.nguoiTao,
        deXuatChiPhi: [],
        soPhieuDeXuat: 0,
        tongTienDeXuat: dx.soTien,
        laLichSu: true,
      }));

      const allData = [...data, ...normalizedLichSu].sort(
        (a, b) => new Date(b.ngayGiaoDich) - new Date(a.ngayGiaoDich)
      );

      return NextResponse.json({
        data: allData,
        pagination: { page, limit, total: total + lichSuRecords.length },
      });
    }

    return NextResponse.json({ data, pagination: { page, limit, total } });
  } catch (error) {
    logger.error('GET /api/thu-chi', error);
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

    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền tạo giao dịch Thu-Chi trực tiếp.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ngayGiaoDich, loaiGiaoDich, soTien, quyId, danhMucId, nhaCungCapId, noiDung, ghiChu } = body;

    if (!ngayGiaoDich || !loaiGiaoDich || !soTien || !quyId || !danhMucId || !noiDung) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (typeof noiDung !== 'string' || noiDung.trim().length === 0 || noiDung.length > 500) {
      return NextResponse.json(
        { error: 'Nội dung giao dịch không hợp lệ (1–500 ký tự).' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền giao dịch phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    if (!['CHI', 'THU'].includes(loaiGiaoDich)) {
      return NextResponse.json({ error: 'Loại giao dịch không hợp lệ.' }, { status: 400 });
    }

    const [quy, danhMuc] = await Promise.all([
      prisma.quy.findUnique({ where: { id: quyId } }),
      prisma.danhMuc.findUnique({ where: { id: danhMucId } }),
    ]);

    if (!quy) {
      return NextResponse.json({ error: 'Quỹ được chọn không hợp lệ.' }, { status: 400 });
    }
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh mục giao dịch không hợp lệ.' }, { status: 400 });
    }
    if (danhMuc.loaiGiaoDich !== loaiGiaoDich) {
      return NextResponse.json(
        { error: `Danh mục "${danhMuc.tenDanhMuc}" là loại ${danhMuc.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'}, không khớp với loại giao dịch đã chọn.` },
        { status: 400 }
      );
    }

    const maPhieu = await generateMaThuChi();

    const newThuChi = await prisma.thuChi.create({
      data: {
        maPhieu,
        ngayGiaoDich: new Date(ngayGiaoDich),
        loaiGiaoDich,
        soTien: Number(soTien),
        quyId,
        danhMucId,
        nhaCungCapId: nhaCungCapId || null,
        noiDung: noiDung.trim(),
        nguoiTaoId: user.id,
        ghiChu: ghiChu || '',
      },
    });

    return NextResponse.json({
      success: true,
      thuChi: newThuChi,
      message: `Đã ghi nhận phiếu ${loaiGiaoDich === 'THU' ? 'Thu' : 'Chi'} ${maPhieu} thành công.`,
    });
  } catch (error) {
    logger.error('POST /api/thu-chi', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
