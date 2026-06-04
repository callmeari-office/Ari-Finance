/* Service worker tối giản cho ARI Finance PWA.
 * Nguyên tắc: KHÔNG bao giờ cache dữ liệu API (/api/*) để số liệu tài chính luôn mới.
 * Chỉ cache "vỏ" trang để mở nhanh & có màn hình chờ khi mất mạng.
 */
const CACHE = 'ari-finance-v1';
const OFFLINE_URLS = ['/login', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Bỏ qua hoàn toàn API và request khác origin — luôn lấy từ mạng.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Điều hướng trang (HTML): ưu tiên mạng, mất mạng thì trả trang đã cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/login')))
    );
    return;
  }

  // Tài nguyên tĩnh (icon, ảnh, font, _next/static): cache-first, nền cập nhật.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
