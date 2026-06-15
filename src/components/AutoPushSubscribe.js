'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, X, Loader } from 'lucide-react';
import styles from './AutoPushSubscribe.module.css';

/**
 * AutoPushSubscribe — tự động đăng ký nhận Web Push cho MỌI người đã đăng nhập,
 * để khỏi phải vào app bấm "Bật" thủ công.
 *
 * Giới hạn của trình duyệt (không thể vượt): Web Push luôn cần người dùng bấm
 * "Cho phép" 1 lần ở hộp thoại trình duyệt. Sau đó thiết bị nhận thông báo vĩnh viễn.
 *
 * Cơ chế:
 *  - Đã "granted" trước đó → tự đăng ký lại IM LẶNG (không hỏi).
 *  - Chưa quyết định ("default") → hiện banner nhẹ "Cho phép thông báo", 1 chạm là xong
 *    (iOS bắt buộc hộp thoại quyền phải do người chạm → không thể auto bung).
 *  - Đã "denied" → bỏ qua, không làm phiền (muốn bật lại dùng nút trong Sidebar/Cài đặt trình duyệt).
 *
 * Chỉ thực sự hoạt động ở production (Service Worker chỉ đăng ký ở production — xem RegisterSW).
 */

const AUTH_FREE_PATHS = ['/login', '/dat-lai-mat-khau', '/doi-mat-khau'];
const DISMISS_KEY = 'ari-push-banner-dismissed';

// Chỉ chạy logic auto 1 lần/phiên (module scope giữ qua các lần chuyển trang client-side)
// → tránh gọi lại /api/auth/me và /api/push/subscribe mỗi lần điều hướng.
let autoRan = false;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Đăng ký push & lưu lên server (idempotent). Trả về true nếu xong. */
async function doSubscribe() {
  const reg = await navigator.serviceWorker.ready;

  // Nếu thiết bị đã có subscription → đồng bộ lại lên server (phòng khi đổi tài khoản).
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing.toJSON()),
    });
    return true;
  }

  const keyRes = await fetch('/api/push/vapid-key');
  if (!keyRes.ok) return false;
  const { publicKey } = await keyRes.json();
  if (!publicKey) return false; // server chưa cấu hình VAPID

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  return true;
}

export default function AutoPushSubscribe() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (autoRan) return;
    if (AUTH_FREE_PATHS.some((p) => pathname?.startsWith(p))) return;
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return; // trình duyệt không hỗ trợ (vd: Safari tab chưa cài PWA)
    }

    let cancelled = false;
    (async () => {
      try {
        // Chỉ chạy khi đã đăng nhập. Nếu chưa → KHÔNG đánh dấu đã chạy,
        // để khi đăng nhập xong và điều hướng sang trang khác sẽ thử lại.
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        if (!me?.authenticated) return;

        autoRan = true; // đã xác thực → chỉ xử lý 1 lần cho cả phiên

        const perm = Notification.permission;
        if (perm === 'granted') {
          await doSubscribe().catch(() => {}); // im lặng, không hỏi
        } else if (perm === 'default') {
          if (!cancelled && sessionStorage.getItem(DISMISS_KEY) !== '1') {
            setShowBanner(true);
          }
        }
        // 'denied' → không làm gì
      } catch {
        // bỏ qua mọi lỗi — không ảnh hưởng app
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await doSubscribe().catch(() => {});
      }
    } catch {
      // bỏ qua
    } finally {
      setBusy(false);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className={styles.banner} role="dialog" aria-live="polite">
      <Bell size={20} className={styles.icon} />
      <div className={styles.text}>
        <strong>Bật thông báo của Ari?</strong>
        <span>Nhận báo ngay khi có phiếu cần duyệt, đã duyệt hoặc phiếu thu mới.</span>
      </div>
      <button className={styles.allowBtn} onClick={handleAllow} disabled={busy}>
        {busy ? <Loader size={14} className={styles.spin} /> : 'Cho phép'}
      </button>
      <button className={styles.dismissBtn} onClick={handleDismiss} aria-label="Để sau">
        <X size={16} />
      </button>
    </div>
  );
}
