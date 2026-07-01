import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ghiNhatKy } from '@/lib/audit';
import { canUseProposalCreatorFilter, canChonLamNguoiDeXuat } from '@/lib/roles';

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    if (scope === 'proposal-filter') {
      if (!canUseProposalCreatorFilter(user.role)) {
        return NextResponse.json(
          { error: 'Bạn không có quyền xem bộ lọc người đề xuất.' },
          { status: 403 }
        );
      }

      const proposalCreators = await prisma.nhanVien.findMany({
        where: { trangThai: 'ACTIVE' },
        orderBy: [{ role: 'asc' }, { hoTen: 'asc' }],
        select: {
          id: true,
          hoTen: true,
          tenNgan: true,
          role: true,
        },
      });

      return NextResponse.json(proposalCreators);
    }

    if (scope === 'tao-giup') {
      const allActive = await prisma.nhanVien.findMany({
        where: { trangThai: 'ACTIVE' },
        orderBy: [{ role: 'asc' }, { hoTen: 'asc' }],
        select: {
          id: true,
          hoTen: true,
          tenNgan: true,
          role: true,
          phongBan: true,
          trangThai: true,
        },
      });

      const eligible = allActive
        .filter((nv) => nv.id !== user.id)
        .filter((nv) => canChonLamNguoiDeXuat(user, nv))
        .map(({ id, hoTen, tenNgan, role }) => ({ id, hoTen, tenNgan, role }));

      return NextResponse.json(eligible);
    }

    if (!checkRole(user, ['OWNER'])) {
      return NextResponse.json(
        { error: 'Bạn không có quyền thực hiện hành động này.' },
        { status: 403 }
      );
    }

    const nhanViens = await prisma.nhanVien.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        hoTen: true,
        tenNgan: true,
        email: true,
        username: true,
        phone: true,
        phongBan: true,
        viTri: true,
        role: true,
        trangThai: true,
        createdAt: true,
      },
    });

    return NextResponse.json(nhanViens);
  } catch (error) {
    logger.error('GET /api/nhan-su', error);
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
        { error: 'Chỉ Admin/Owner mới có quyền thêm nhân viên.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { hoTen, tenNgan, username, email, phone, phongBan, viTri, matKhau, role, trangThai } = body;

    if (!hoTen || !username || !matKhau || !role) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp các trường bắt buộc (Họ tên, Username, Mật khẩu, Vai trò).' },
        { status: 400 }
      );
    }

    if (!['OWNER', 'MANAGER', 'LEADER', 'STAFF'].includes(role)) {
      return NextResponse.json({ error: 'Vai trò không hợp lệ.' }, { status: 400 });
    }

    if (typeof username !== 'string' || username.trim().length < 3 || username.length > 50) {
      return NextResponse.json(
        { error: 'Username phải từ 3–50 ký tự.' },
        { status: 400 }
      );
    }

    if (matKhau.length < 10) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 10 ký tự.' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.nhanVien.findFirst({
      where: {
        OR: [
          { username: username.trim() },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Tên đăng nhập (Username) hoặc Email đã tồn tại.' },
        { status: 400 }
      );
    }

    // Dùng max ID thay vì count để tránh race condition khi có nhân viên bị xóa
    const lastUser = await prisma.nhanVien.findFirst({
      where: { id: { startsWith: 'NV' } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const lastNum = lastUser ? parseInt(lastUser.id.replace('NV', ''), 10) : 0;
    const nextId = 'NV' + String(lastNum + 1).padStart(3, '0');

    const hashPassword = await bcrypt.hash(matKhau, 12);

    const newNhanVien = await prisma.nhanVien.create({
      data: {
        id: nextId,
        hoTen,
        tenNgan: tenNgan || null,
        username: username.trim(),
        email: email || `${username.trim()}@demo.vn`,
        phone: phone || '',
        phongBan: phongBan || '',
        viTri: viTri || '',
        matKhau: hashPassword,
        role,
        trangThai: trangThai || 'ACTIVE',
      },
    });

    await ghiNhatKy({
      user,
      hanhDong: 'TAO',
      doiTuong: 'NHAN_VIEN',
      maDoiTuong: nextId,
      moTa: `Thêm nhân viên ${hoTen} (${username.trim()}) — vai trò ${role}`,
    });

    return NextResponse.json({
      success: true,
      message: `Đã thêm nhân viên ${hoTen} (Mã: ${nextId}) thành công.`,
      nhanVien: {
        id: newNhanVien.id,
        hoTen: newNhanVien.hoTen,
        username: newNhanVien.username,
        role: newNhanVien.role,
      },
    });
  } catch (error) {
    logger.error('POST /api/nhan-su', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
