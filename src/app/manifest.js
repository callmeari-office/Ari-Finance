// Web App Manifest cho PWA — Next.js App Router tự phục vụ tại /manifest.webmanifest.
export default function manifest() {
  return {
    name: 'ARI Finance — Quản lý tài chính',
    short_name: 'ARI Finance',
    description: 'Hệ thống quản lý tài chính nội bộ shop Call Me Ari: đề xuất chi phí, duyệt thanh toán, doanh thu, lợi nhuận.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#634d3e',
    lang: 'vi',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
