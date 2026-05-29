import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

// Hàm sinh mã phiếu Thu-Chi: TC-YYMMDD-xxxx
async function generateMaThuChi() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `TC-${yy}${mm}${dd}-`;

  const count = await prisma.thuChi.count({
    where: {
      maPhieu: {
        startsWith: prefix,
      },
    },
  });

  const xxxx = String(count + 1).padStart(4, '0');
  return `${prefix}${xxxx}`;
}

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Owner/Manager được xem lịch sử ThuChi
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập dữ liệu Thu-Chi.' },
        { status: 403 }
      );
    }

    const thuChis = await prisma.thuChi.findMany({
      include: {
        quy: true,
        danhMuc: {
          include: {
            nhomChiPhi: true,
          },
        },
        nhaCungCap: true,

        nguoiTao: {
          select: { id: true, hoTen: true, email: true },
        },
        deXuatChiPhi: {
          select: {
            id: true,
            maPhieu: true,
            noiDung: true,
            soTien: true,
            trangThai: true,
            nguoiTao: {
              select: { hoTen: true },
            },
          },
        },
      },
      orderBy: { ngayGiaoDich: 'desc' },
    });

    // Tính toán thêm các thuộc tính tính toán tongTienDeXuat và soPhieuDeXuat
    const data = thuChis.map((tc) => {
      const soPhieuDeXuat = tc.deXuatChiPhi.length;
      const tongTienDeXuat = tc.deXuatChiPhi.reduce((sum, dx) => sum + dx.soTien, 0);

      return {
        ...tc,
        soPhieuDeXuat,
        tongTienDeXuat,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get ThuChi error:', error);
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

    // Chỉ Owner/Manager được tạo phiếu ThuChi trực tiếp
    if (!checkRole(user, ['OWNER', 'MANAGER'])) {
      return NextResponse.json(
        { error: 'Chỉ Chủ shop (Owner) hoặc Quản lý (Manager) mới có quyền tạo giao dịch Thu-Chi trực tiếp.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      ngayGiaoDich,
      loaiGiaoDich, // CHI, THU
      soTien,
      quyId,
      danhMucId,
      nhaCungCapId,
      noiDung,
      ghiChu,
    } = body;

    // Validate dữ liệu
    if (!ngayGiaoDich || !loaiGiaoDich || !soTien || !quyId || !danhMucId || !noiDung) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc.' },
        { status: 400 }
      );
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json(
        { error: 'Số tiền giao dịch phải lớn hơn 0.' },
        { status: 400 }
      );
    }

    // Kiểm tra Quỹ nhận/chi
    const quy = await prisma.quy.findUnique({ where: { id: quyId } });
    if (!quy) {
      return NextResponse.json({ error: 'Quỹ được chọn không hợp lệ.' }, { status: 400 });
    }

    // Kiểm tra Danh mục
    const danhMuc = await prisma.danhMuc.findUnique({ where: { id: danhMucId } });
    if (!danhMuc) {
      return NextResponse.json({ error: 'Danh mục giao dịch không hợp lệ.' }, { status: 400 });
    }

    // Kiểm tra xem loaiGiaoDich có khớp với loại danh mục không
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
        noiDung,
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
    console.error('Create ThuChi error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
