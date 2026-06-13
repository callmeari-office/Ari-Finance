import { NextResponse } from 'next/server';

// Paths không yêu cầu cookie session_token.
// Cron dùng startsWith vì có nhiều sub-routes; các route khác dùng exact match.
const PUBLIC_PATHS_EXACT = new Set([
  '/login',
  '/dat-lai-mat-khau',
  '/api/auth/login',
  '/api/auth/dat-lai-mat-khau',
  '/api/auth/dat-lai-mat-khau/xac-nhan',
  '/api/push/vapid-key', // tự check session bên trong, middleware chỉ bỏ qua
]);

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // /api/cron/* dùng CRON_SECRET Bearer — không cần session cookie
  if (pathname.startsWith('/api/cron/')) return NextResponse.next();

  if (PUBLIC_PATHS_EXACT.has(pathname)) return NextResponse.next();

  // Defense-in-depth: chặn sớm nếu thiếu cookie phiên.
  // Verify phiên + role chi tiết vẫn do từng route handler đảm nhiệm.
  const sessionToken = request.cookies.get('session_token');
  if (!sessionToken?.value) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Bỏ qua: _next/*, static assets, service worker, icons, PWA manifest
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|icons/|manifest\\.webmanifest|.*\\.png|.*\\.svg|.*\\.webp|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.ico).*)',
  ],
};
