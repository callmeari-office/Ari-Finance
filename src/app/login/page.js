'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ShieldAlert, ArrowRight, Check } from 'lucide-react';
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

  const handleQuickLogin = (role) => {
    if (role === 'owner') {
      setEmail('owner');
      setMatKhau('owner123');
    } else if (role === 'manager') {
      setEmail('manager');
      setMatKhau('manager123');
    } else if (role === 'staff') {
      setEmail('staff');
      setMatKhau('staff123');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        {/* Brand Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-hover.png" alt="Logo" className={styles.logoImg} />
          </div>
          <h1>ARI Finance</h1>
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Đang xử lý...' : (
                <>
                  <span>Đăng Nhập</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Login Section (Hidden for Production) */}
        {/*
        <div className={styles.quickLoginBox}>
          <h3>TÀI KHOẢN NGHIỆM THU (QUICK TEST)</h3>
          <p>Nhấp vào vai trò dưới đây để tự động điền ID & Mật khẩu mẫu:</p>
          <div className={styles.quickButtons}>
            <button onClick={() => handleQuickLogin('owner')} className={`${styles.quickBtn} ${styles.ownerBtn}`}>
              <span>Owner (Chủ shop)</span>
              <small>ID: owner | MK: owner123</small>
            </button>
            <button onClick={() => handleQuickLogin('manager')} className={`${styles.quickBtn} ${styles.managerBtn}`}>
              <span>Manager (Quản lý)</span>
              <small>ID: manager | MK: manager123</small>
            </button>
            <button onClick={() => handleQuickLogin('staff')} className={`${styles.quickBtn} ${styles.staffBtn}`}>
              <span>Staff (Nhân viên)</span>
              <small>ID: staff | MK: staff123</small>
            </button>
          </div>
        </div>
        */}
      </div>
    </div>
  );
}
