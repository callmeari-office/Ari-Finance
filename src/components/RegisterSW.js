'use client';

import { useEffect } from 'react';

// Đăng ký service worker để app cài được lên màn hình điện thoại (PWA) + mở nhanh.
// Chỉ chạy ở production để không gây phiền khi dev (HMR).
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Im lặng nếu lỗi — không ảnh hưởng app.
      });
    };
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
