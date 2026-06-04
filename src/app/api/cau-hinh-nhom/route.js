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
        { error: 'Bạn không có quyền truy cập thông tin cấu hình.' },
        { status: 403 }
      );
    }

    const groups = await prisma.nhomChiPhi.findMany({
      orderBy: { thuTu: 'asc' },
    });

    return NextResponse.json(groups);
  } catch (error) {
    logger.error('GET /api/cau-hinh-nhom', error);
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
        { error: 'Chỉ Admin/Owner mới có quyền thêm mới nhóm danh mục.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { id, tenNhom, thuTu } = body;

    if (!id || !tenNhom) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ Mã Nhóm và Tên Nhóm.' },
        { status: 400 }
      );
    }

    // Chuẩn hóa ID: viết hoa, xóa khoảng trắng
    id = id.trim().toUpperCase();
    
    // Đồng bộ chữ hoa, chữ thường cho Tên Nhóm hợp lý và chuẩn:
    // - Nhóm Chi (bắt đầu bằng C): Đổi sang VIẾT HOA TOÀN BỘ (ví dụ: GIÁ VỐN, VẬN HÀNH)
    // - Nhóm Thu (bắt đầu bằng T): Đổi sang viết hoa chữ cái đầu tiên (Sentence case, ví dụ: Thu từ hoạt động kinh doanh)
    // - Nhóm khác: viết hoa chữ cái đầu tiên
    tenNhom = tenNhom.trim();
    if (id.startsWith('C')) {
      tenNhom = tenNhom.toUpperCase();
    } else {
      // Sentence case: Viết hoa chữ cái đầu tiên, các chữ sau giữ nguyên hoặc chuyển thường hợp lý
      tenNhom = tenNhom.charAt(0).toUpperCase() + tenNhom.slice(1);
    }

    const orderNum = parseInt(thuTu) || 99;

    // Check trùng ID nhóm
    const existing = await prisma.nhomChiPhi.findUnique({
      where: { id },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Mã nhóm "${id}" đã tồn tại trên hệ thống.` },
        { status: 400 }
      );
    }

    const newGroup = await prisma.nhomChiPhi.create({
      data: {
        id,
        tenNhom,
        thuTu: orderNum,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cấu hình thêm nhóm danh mục "${tenNhom}" [${id}] thành công.`,
      group: newGroup,
    });
  } catch (error) {
    logger.error('POST /api/cau-hinh-nhom', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
