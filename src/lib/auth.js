import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { logger } from './logger';

// Thời hạn phiên đăng nhập: 30 ngày, tự gia hạn khi người dùng còn hoạt động (sliding session).
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) return null;

    const session = await prisma.session.findUnique({
      where: { id: sessionToken },
      include: {
        nhanVien: {
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
          },
        },
      },
    });

    if (!session) return null;

    const now = new Date();
    if (now > session.expiresAt) {
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    // Sliding renewal: nếu phiên đã trôi qua >1 ngày, gia hạn về đủ 30 ngày + làm mới cookie.
    // Throttle ~1 lần/ngày để tránh ghi DB mỗi request.
    const remaining = session.expiresAt.getTime() - now.getTime();
    if (remaining < SESSION_TTL_MS - ONE_DAY_MS) {
      const newExpiry = new Date(now.getTime() + SESSION_TTL_MS);
      await prisma.session.update({ where: { id: session.id }, data: { expiresAt: newExpiry } });
      try {
        cookieStore.set('session_token', session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: newExpiry,
          path: '/',
        });
      } catch {
        // Một số ngữ cảnh (render server component) không cho set cookie — bỏ qua an toàn.
      }
    }

    return session.nhanVien;
  } catch (error) {
    logger.error('getSession', error);
    return null;
  }
}

export async function createSession(userId) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: { userId, expiresAt },
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
    logger.error('destroySession', error);
    return false;
  }
}

export function checkRole(user, allowedRoles) {
  if (!user || user.trangThai !== 'ACTIVE') return false;
  return allowedRoles.includes(user.role);
}
