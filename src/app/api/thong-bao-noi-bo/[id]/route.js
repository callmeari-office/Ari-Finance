import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// PUT /api/thong-bao-noi-bo/[id] — cập nhật hoặc archive (OWNER/MANAGER)
export async function PUT(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được sửa thông báo.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { tieuDe, noiDung, tag, ngayHetHan, trangThai } = body;

    const existing = await prisma.$queryRaw`
      SELECT "id" FROM "ThongBaoNoiBo" WHERE "id" = ${id} LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Không tìm thấy thông báo.' }, { status: 404 });
    }

    // Validate nếu có trường nội dung
    if (tieuDe !== undefined && tieuDe.trim().length > 80) {
      return NextResponse.json({ error: 'Tiêu đề tối đa 80 ký tự.' }, { status: 400 });
    }
    if (noiDung !== undefined && noiDung.trim().length > 500) {
      return NextResponse.json({ error: 'Nội dung tối đa 500 ký tự.' }, { status: 400 });
    }

    const validTags = ['QUAN_TRONG', 'NHAC_NHO', 'THONG_TIN'];
    const validTrangThai = ['ACTIVE', 'ARCHIVED'];

    // Lấy giá trị hiện tại rồi patch
    const [cur] = await prisma.$queryRaw`
      SELECT * FROM "ThongBaoNoiBo" WHERE "id" = ${id} LIMIT 1
    `;

    const newTieuDe = tieuDe !== undefined ? tieuDe.trim() : cur.tieuDe;
    const newNoiDung = noiDung !== undefined ? noiDung.trim() : cur.noiDung;
    const newTag = tag !== undefined && validTags.includes(tag) ? tag : cur.tag;
    const newHetHan = ngayHetHan !== undefined ? (ngayHetHan ? new Date(ngayHetHan) : null) : cur.ngayHetHan;
    const newTrangThai = trangThai !== undefined && validTrangThai.includes(trangThai) ? trangThai : cur.trangThai;

    await prisma.$executeRaw`
      UPDATE "ThongBaoNoiBo" SET
        "tieuDe"     = ${newTieuDe},
        "noiDung"    = ${newNoiDung},
        "tag"        = ${newTag},
        "ngayHetHan" = ${newHetHan},
        "trangThai"  = ${newTrangThai},
        "updatedAt"  = NOW()
      WHERE "id" = ${id}
    `;

    const moTa = newTrangThai === 'ARCHIVED'
      ? `Ẩn thông báo: "${newTieuDe}"`
      : `Cập nhật thông báo: "${newTieuDe}"`;

    await ghiNhatKy({
      user,
      hanhDong: 'SUA',
      doiTuong: 'THONG_BAO',
      maDoiTuong: id,
      moTa,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PUT /api/thong-bao-noi-bo/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// DELETE /api/thong-bao-noi-bo/[id] — xóa vĩnh viễn (OWNER only)
export async function DELETE(request, { params }) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Chỉ OWNER được xóa vĩnh viễn thông báo.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.$queryRaw`
      SELECT "tieuDe" FROM "ThongBaoNoiBo" WHERE "id" = ${id} LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Không tìm thấy thông báo.' }, { status: 404 });
    }

    await prisma.$executeRaw`DELETE FROM "ThongBaoNoiBo" WHERE "id" = ${id}`;

    await ghiNhatKy({
      user,
      hanhDong: 'XOA',
      doiTuong: 'THONG_BAO',
      maDoiTuong: id,
      moTa: `Xóa vĩnh viễn thông báo: "${existing[0].tieuDe}"`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/thong-bao-noi-bo/[id]', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
