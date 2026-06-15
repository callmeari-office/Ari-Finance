'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ShieldAlert, ArrowRight, Check, Loader2 } from 'lucide-react';
import AriCameo from '@/components/AriCameo';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); // State name kept as 'email' to match backend schema field mapping without breaking existing routes
  const [matKhau, setMatKhau] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Kiểm tra nếu đã đăng nhập thì redirect về home
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          router.push('/');
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !matKhau) {
      setError('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, matKhau }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập không thành công.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      {/* Ảnh nền cameo mờ — chỉ hiện ở Chế độ Ari */}
      <div className={styles.bgOverlay} aria-hidden="true" />

      {/* Blob ánh sáng nền hồng phấn */}
      <div className={styles.bgBlob1} aria-hidden="true" />
      <div className={styles.bgBlob2} aria-hidden="true" />
      <div className={styles.bgBlob3} aria-hidden="true" />

      {/* Sparkle ✦ lơ lửng — chỉ hiện ở Chế độ Ari */}
      <div className={styles.sparkles} aria-hidden="true">
        <span className={styles.sp1}>✦</span>
        <span className={styles.sp2}>✦</span>
        <span className={styles.sp3}>✦</span>
        <span className={styles.sp4}>✦</span>
        <span className={styles.sp5}>✦</span>
      </div>

      {/* Cameo watermark lớn — bóng mờ sang trọng phía sau */}
      <div className={styles.ariWatermark} aria-hidden="true">
        <AriCameo size={240} color="currentColor" />
      </div>

      <div className={styles.loginBox}>
        {/* Brand Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-hover.png" alt="Logo" className={styles.logoImg} />
          </div>

          {/* Vòng ánh kim quanh logo — chỉ ở Chế độ Ari */}
          <div className={styles.logoRing} aria-hidden="true" />

          <h1>ARI Finance</h1>

          {/* Vạch vàng hồng shimmer — chỉ ở Chế độ Ari */}
          <div className={styles.goldDivider} aria-hidden="true" />

          <p className={styles.subtitle}>Hệ thống Quản lý Tài chính Nội bộ</p>

        </div>

        {/* Login Card */}
        <div className={`${styles.card} glass-card`}>
          <h2>Đăng nhập hệ thống</h2>
          <p className={styles.cardDesc}>Nhập thông tin ID đăng nhập để tiếp tục</p>

          {error && (
            <div className={styles.errorAlert}>
              <ShieldAlert size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successAlert}>
              <Check size={20} />
              <span>Đăng nhập thành công! Đang chuyển hướng...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Tên đăng nhập (ID) *</label>
              <div className={styles.inputWrapper}>
                <User size={18} className={styles.inputIcon} />
                <input
                  id="email"
                  type="text"
                  placeholder="Nhập ID (Ví dụ: namnnb, linhnnt...)"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Mật khẩu *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  value={matKhau}
                  onChange={(e) => setMatKhau(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className={styles.spinnerIcon} />
                  <span>Đang xác thực...</span>
                </>
              ) : success ? (
                <>
                  <Check size={18} />
                  <span>Thành công!</span>
                </>
              ) : (
                <>
                  <span>Đăng Nhập</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Chữ ký thương hiệu — chỉ hiện ở Chế độ Ari */}
        <div className={styles.footerBrand} aria-hidden="true">
          <AriCameo size={14} color="currentColor" />
          <span>Call Me ARI</span>
        </div>

      </div>
    </div>
  );
}
