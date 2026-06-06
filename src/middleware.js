import { NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/dat-lai-mat-khau',
  '/api/auth/dat-lai-mat-khau/xac-nhan',
  '/api/cron/', // Cron jobs xác thực bằng CRON_SECRET header, không cần session
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Cho phép các public path không cần auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Kiểm tra session cookie
  const sessionToken = request.cookies.get('session_token');
  if (!sessionToken?.value) {
    // API routes trả về 401 thay vì redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match tất cả request paths trừ:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.webp|.*\\.jpg|.*\\.jpeg|.*\\.gif).*)',
  ],
};
