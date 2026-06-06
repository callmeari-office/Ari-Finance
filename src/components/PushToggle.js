'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader } from 'lucide-react';
import styles from './PushToggle.module.css';

/**
 * Chuyển VAPID public key (base64url) → Uint8Array cho PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | granted | denied | default | subscribed | unsubscribed
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Kiểm tra khả năng hỗ trợ và trạng thái hiện tại khi mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      setStatus('unsupported');
      return;
    }
    setSupported(true);

    const perm = Notification.permission;
    setStatus(perm);

    // Kiểm tra xem thiết bị này đã subscribe chưa
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    setMsg('');

    try {
      const reg = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        // --- Hủy đăng ký ---
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setIsSubscribed(false);
        setMsg('Đã tắt thông báo.');
      } else {
        // --- Xin quyền ---
        const permission = await Notification.requestPermission();
        setStatus(permission);

        if (permission !== 'granted') {
          setMsg('Bạn đã từ chối quyền thông báo. Vào Cài đặt trình duyệt để bật lại.');
          setLoading(false);
          return;
        }

        // --- Lấy VAPID public key ---
        const keyRes = await fetch('/api/push/vapid-key');
        if (!keyRes.ok) throw new Error('Không lấy được VAPID key');
        const { publicKey } = await keyRes.json();

        // --- Đăng ký subscription ---
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // --- Gửi subscription lên server ---
        const saveRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!saveRes.ok) throw new Error('Lưu subscription thất bại');

        setIsSubscribed(true);
        setMsg('Đã bật thông báo đẩy!');
      }
    } catch (err) {
      setMsg('Có lỗi: ' + (err.message || 'Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }

  if (status === 'unsupported') {
    return (
      <div className={styles.note}>
        <BellOff size={16} />
        Trình duyệt không hỗ trợ thông báo đẩy.
      </div>
    );
  }

  if (status === 'loading') return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.label}>
          {isSubscribed ? <Bell size={18} className={styles.iconOn} /> : <BellOff size={18} className={styles.iconOff} />}
          <span>Thông báo đẩy (Push)</span>
        </div>
        <button
          className={`${styles.btn} ${isSubscribed ? styles.btnOff : styles.btnOn}`}
          onClick={handleToggle}
          disabled={loading || status === 'denied'}
        >
          {loading ? <Loader size={14} className={styles.spin} /> : isSubscribed ? 'Tắt' : 'Bật'}
        </button>
      </div>

      {status === 'denied' && (
        <p className={styles.warn}>
          Trình duyệt đang chặn thông báo. Vào <strong>Cài đặt trình duyệt → Quyền trang web</strong> để cấp lại.
        </p>
      )}

      {msg && <p className={isSubscribed ? styles.success : styles.info}>{msg}</p>}

      <p className={styles.note}>
        📱 <strong>iOS:</strong> Chỉ hoạt động khi đã "Thêm vào màn hình chính" (Add to Home Screen) và iOS ≥ 16.4.
      </p>
    </div>
  );
}
