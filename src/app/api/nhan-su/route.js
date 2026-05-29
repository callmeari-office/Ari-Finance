import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, checkRole } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    // Chỉ Owner mới được xem danh sách nhân sự
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
      }
    });

    return NextResponse.json(nhanViens);
  } catch (error) {
    console.error('Get users error:', error);
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
    const {
      hoTen,
      tenNgan,
      username,
      email,
      phone,
      phongBan,
      viTri,
      matKhau,
      role,
      trangThai,
    } = body;


    if (!hoTen || !username || !matKhau || !role) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp các trường bắt buộc (Họ tên, Username, Mật khẩu, Vai trò).' },
        { status: 400 }
      );
    }

    // Kiểm tra trùng username
    const existingUser = await prisma.nhanVien.findFirst({
      where: {
        OR: [
          { username },
          { email: email || 'nevermatch' }
        ]
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Tên đăng nhập (Username) hoặc Email đã tồn tại.' },
        { status: 400 }
      );
    }

    // Tạo mã NV tự tăng NV00x
    const count = await prisma.nhanVien.count();
    const nextId = 'NV' + String(count + 1).padStart(3, '0');

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(matKhau, salt);

    const newNhanVien = await prisma.nhanVien.create({
      data: {
        id: nextId,
        hoTen,
        tenNgan: tenNgan || null,
        username,
        email: email || `${username}@demo.vn`, // Default email nếu trống
        phone: phone || '',
        phongBan: phongBan || '',
        viTri: viTri || '',
        matKhau: hashPassword,
        role,
        trangThai: trangThai || 'ACTIVE',
      },
    });


    return NextResponse.json({
      success: true,
      message: `Đã thêm nhân viên ${hoTen} (Mã: ${nextId}) thành công.`,
      nhanVien: {
        id: newNhanVien.id,
        hoTen: newNhanVien.hoTen,
        username: newNhanVien.username,
        role: newNhanVien.role,
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi trên hệ thống.' },
      { status: 500 }
    );
  }
}
