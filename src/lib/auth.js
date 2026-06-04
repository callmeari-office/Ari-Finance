import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { logger } from './logger';

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

    if (new Date() > session.expiresAt) {
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    return session.nhanVien;
  } catch (error) {
    logger.error('getSession', error);
    return null;
  }
}

export async function createSession(userId) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
