import { cookies } from 'next/headers';
import { prisma } from './prisma';

/**
 * Lấy thông tin session hiện tại từ cookie
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionToken },
      include: {
        nhanVien: {
          select: {
            id: true,
            hoTen: true,
            email: true,
            username: true,
            phone: true,
            phongBan: true,
            viTri: true,
            role: true,
            trangThai: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Kiểm tra hết hạn
    if (new Date() > session.expiresAt) {
      // Xóa session đã hết hạn
      await prisma.session.delete({ where: { id: session.id } });
      const responseCookies = await cookies();
      responseCookies.delete('session_token');
      return null;
    }

    return session.nhanVien;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Tạo một session mới cho user
 */
export async function createSession(userId) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set('session_token', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return session;
}

/**
 * Xóa session hiện tại (đăng xuất)
 */
export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      await prisma.session.delete({ where: { id: sessionToken } }).catch(() => {});
    }

    cookieStore.delete('session_token');
    return true;
  } catch (error) {
    console.error('Error destroying session:', error);
    return false;
  }
}

/**
 * Kiểm tra xem user có một trong các role hợp lệ không
 */
export function checkRole(user, allowedRoles) {
  if (!user || user.trangThai !== 'ACTIVE') {
    return false;
  }
  return allowedRoles.includes(user.role);
}
