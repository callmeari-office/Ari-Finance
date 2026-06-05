/** @type {import('next').NextConfig} */

// Content-Security-Policy: cho phép đúng những gì app cần.
// - 'unsafe-inline' cho script: BẮT BUỘC vì có inline script chống FOUC theme trong layout.js.
// - 'unsafe-inline' cho style: app dùng rất nhiều style={{}} inline + CSS biến.
// - img-src thêm https://img.vietqr.io (ảnh QR động ở trang Duyệt) + data:/blob: (ảnh hóa đơn base64, preview).
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.vietqr.io",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  // Ép trình duyệt luôn dùng HTTPS trong 1 năm (chỉ có tác dụng khi đã chạy HTTPS — vô hại khi dev http).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Chặn nhúng app vào iframe của trang khác (chống clickjacking).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Chặn trình duyệt "đoán" sai kiểu file (chống tấn công qua MIME sniffing).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Không gửi đường dẫn đầy đủ sang web khác khi bấm link ra ngoài.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Tắt các quyền nhạy cảm không dùng tới.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: cspDirectives },
];

const nextConfig = {
  async headers() {
    return [
      {
        // Áp cho mọi đường dẫn.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
