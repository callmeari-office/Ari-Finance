import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';

// GET /api/thong-bao-noi-bo — lấy thông báo ACTIVE còn hiệu lực (mọi role đã đăng nhập)
export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

    const rows = await prisma.$queryRaw`
      SELECT *
      FROM "ThongBaoNoiBo"
      WHERE "trangThai" = 'ACTIVE'
        AND ("ngayHetHan" IS NULL OR "ngayHetHan" > NOW())
      ORDER BY
        CASE WHEN "tag" = 'QUAN_TRONG' THEN 0 ELSE 1 END,
        "createdAt" DESC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    logger.error('GET /api/thong-bao-noi-bo', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}

// POST /api/thong-bao-noi-bo — tạo thông báo mới (OWNER/MANAGER)
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Chỉ OWNER/MANAGER được tạo thông báo.' }, { status: 403 });
    }

    const body = await request.json();
    const { tieuDe, noiDung, tag, ngayHetHan } = body;

    if (!tieuDe?.trim()) return NextResponse.json({ error: 'Thiếu tiêu đề.' }, { status: 400 });
    if (!noiDung?.trim()) return NextResponse.json({ error: 'Thiếu nội dung.' }, { status: 400 });
    if (tieuDe.trim().length > 80) return NextResponse.json({ error: 'Tiêu đề tối đa 80 ký tự.' }, { status: 400 });
    if (noiDung.trim().length > 500) return NextResponse.json({ error: 'Nội dung tối đa 500 ký tự.' }, { status: 400 });

    const validTags = ['QUAN_TRONG', 'NHAC_NHO', 'THONG_TIN'];
    const tagVal = validTags.includes(tag) ? tag : 'THONG_TIN';
    const hetHan = ngayHetHan ? new Date(ngayHetHan) : null;
    const id = randomUUID();
    const tenNguoiTao = user.tenNgan || user.hoTen || user.username;

    await prisma.$executeRaw`
      INSERT INTO "ThongBaoNoiBo"
        ("id", "tieuDe", "noiDung", "tag", "ngayHetHan", "trangThai", "nguoiTaoId", "tenNguoiTao", "createdAt", "updatedAt")
      VALUES
        (${id}, ${tieuDe.trim()}, ${noiDung.trim()}, ${tagVal}, ${hetHan}, 'ACTIVE', ${user.id}, ${tenNguoiTao}, NOW(), NOW())
    `;

    await ghiNhatKy({
      user,
      hanhDong: 'TAO',
      doiTuong: 'THONG_BAO',
      maDoiTuong: id,
      moTa: `Tạo thông báo nội bộ: "${tieuDe.trim()}"`,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    logger.error('POST /api/thong-bao-noi-bo', error);
    return NextResponse.json({ error: 'Lỗi hệ thống.' }, { status: 500 });
  }
}
