import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { lamTronTien } from '@/lib/finance';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// GET /api/dinh-ky — lấy danh sách phiếu định kỳ
export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được quản lý phiếu định kỳ.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const whereClause = activeOnly ? `WHERE p."active" = true` : '';

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        p.*,
        d."tenDanhMuc",
        n."tenNCC", n."tenNganHang", n."soTaiKhoan"
      FROM "PhieuDinhKy" p
      LEFT JOIN "DanhMuc" d ON d."id" = p."danhMucId"
      LEFT JOIN "NhaCungCap" n ON n."id" = p."nhaCungCapId"
      ${whereClause}
      ORDER BY p."createdAt" DESC
    `);

    return NextResponse.json(rows);
  } catch (error) {
    logger.error('GET /api/dinh-ky', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/dinh-ky — tạo mẫu phiếu định kỳ mới
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được tạo phiếu định kỳ.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      tenMau, noiDung, soTien, danhMucId,
      nhaCungCapId, nguonTien, trangThaiMacDinh,
      ngayChiTrongThang, ghiChu,
    } = body;

    if (!tenMau?.trim() || !noiDung?.trim() || !soTien || !danhMucId || !nguonTien) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc: Tên mẫu, Nội dung, Số tiền, Danh mục, Nguồn tiền.' }, { status: 400 });
    }

    if (Number(soTien) <= 0) {
      return NextResponse.json({ error: 'Số tiền phải lớn hơn 0.' }, { status: 400 });
    }

    const ngay = Math.min(28, Math.max(1, parseInt(ngayChiTrongThang, 10) || 1));
    const id = randomUUID();
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO "PhieuDinhKy"
        ("id","tenMau","noiDung","soTien","danhMucId","nhaCungCapId","nguonTien","trangThaiMacDinh","ngayChiTrongThang","ghiChu","active","nguoiTaoId","createdAt","updatedAt")
      VALUES
        (${id}, ${tenMau.trim()}, ${noiDung.trim()}, ${lamTronTien(soTien)}, ${danhMucId},
         ${nhaCungCapId || null}, ${nguonTien}, ${trangThaiMacDinh || 'CHO_THANH_TOAN'},
         ${ngay}, ${ghiChu?.trim() || null}, true, ${user.id}, ${now}, ${now})
    `;

    await ghiNhatKy({
      user,
      hanhDong: 'TAO',
      doiTuong: 'PHIEU_DINH_KY',
      maDoiTuong: id,
      moTa: `Tạo mẫu phiếu định kỳ "${tenMau.trim()}" — ${Number(soTien).toLocaleString('vi-VN')}đ/tháng`,
    });

    return NextResponse.json({ success: true, id, message: `Đã tạo mẫu phiếu định kỳ "${tenMau.trim()}".` });
  } catch (error) {
    logger.error('POST /api/dinh-ky', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
