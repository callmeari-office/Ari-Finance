'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Check, AlertCircle, KeyRound } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function DoiMatKhauPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [matKhauCu, setMatKhauCu] = useState('');
  const [matKhauMoi, setMatKhauMoi] = useState('');
  const [xacNhan, setXacNhan] = useState('');
  const [showCu, setShowCu] = useState(false);
  const [showMoi, setShowMoi] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!matKhauCu || !matKhauMoi) {
      setError('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới.');
      return;
    }
    if (matKhauMoi.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (matKhauMoi !== xacNhan) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (matKhauCu === matKhauMoi) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/doi-mat-khau', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matKhauCu, matKhauMoi }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đã xảy ra lỗi.');
      } else {
        setSuccess('Đã đổi mật khẩu thành công! Lần đăng nhập sau hãy dùng mật khẩu mới.');
        setMatKhauCu('');
        setMatKhauMoi('');
        setXacNhan('');
      }
    } catch {
      setError('Không kết nối được máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="layout-wrapper">
        <Sidebar user={user} />
        <main style={{ flex: 1, padding: '2rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Đang tải...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--brand-brown)' }}>
            <KeyRound size={26} /> Đổi mật khẩu
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Đặt mật khẩu mới cho tài khoản của bạn ({user?.tenNgan || user?.hoTen}).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card" style={{ maxWidth: 460, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '0.7rem 0.9rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.12)', color: 'var(--success)', padding: '0.7rem 0.9rem', borderRadius: 8, fontSize: '0.9rem' }}>
              <Check size={18} /> {success}
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Mật khẩu hiện tại</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showCu ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                value={matKhauCu}
                onChange={(e) => setMatKhauCu(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCu(!showCu)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showCu ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showMoi ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                value={matKhauMoi}
                onChange={(e) => setMatKhauMoi(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowMoi(!showMoi)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showMoi ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Ít nhất 6 ký tự.</p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem' }}>Xác nhận mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showMoi ? 'text' : 'password'}
                className="form-control"
                style={{ paddingLeft: 38 }}
                value={xacNhan}
                onChange={(e) => setXacNhan(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '0.3rem' }}>
            {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </main>
    </div>
  );
}
