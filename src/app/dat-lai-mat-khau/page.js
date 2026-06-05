'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, CheckCircle, XCircle, Loader2 } from 'lucide-react';

function DatLaiMatKhauForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState('checking'); // checking | form | success | error
  const [hoTen, setHoTen] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [matKhauLai, setMatKhauLai] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMsg('Link không hợp lệ. Vui lòng yêu cầu OWNER gửi lại link đặt lại mật khẩu.');
      setPhase('error');
      return;
    }

    fetch(`/api/auth/dat-lai-mat-khau/xac-nhan?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setHoTen(data.tenNgan || data.hoTen || '');
          setPhase('form');
        } else {
          setErrorMsg(data.error || 'Link không hợp lệ hoặc đã hết hạn.');
          setPhase('error');
        }
      })
      .catch(() => {
        setErrorMsg('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
        setPhase('error');
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (matKhau.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (matKhau !== matKhauLai) {
      setFormError('Hai lần nhập mật khẩu không khớp.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/dat-lai-mat-khau/xac-nhan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, matKhau }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Đặt lại mật khẩu thất bại.');
      } else {
        setPhase('success');
      }
    } catch {
      setFormError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--background)',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: 'var(--shadow)',
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <KeyRound size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
            ARI Finance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Đặt lại mật khẩu
          </p>
        </div>

        {/* Phase: checking */}
        {phase === 'checking' && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <p style={{ marginTop: '0.75rem' }}>Đang xác thực link...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Phase: error */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <XCircle size={40} color="#ef4444" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <p style={{ color: '#ef4444', fontWeight: '600', marginBottom: '1rem' }}>{errorMsg}</p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Quay về trang đăng nhập
            </button>
          </div>
        )}

        {/* Phase: success */}
        {phase === 'success' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle size={40} color="#10b981" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
            <p style={{ color: '#10b981', fontWeight: '700', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
              Đặt lại mật khẩu thành công!
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Vui lòng đăng nhập lại với mật khẩu mới.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Đăng nhập ngay →
            </button>
          </div>
        )}

        {/* Phase: form */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit}>
            {hoTen && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                Xin chào <strong style={{ color: 'var(--text-main)' }}>{hoTen}</strong>,<br />
                nhập mật khẩu mới cho tài khoản của bạn.
              </p>
            )}

            {formError && (
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '0.65rem 0.875rem',
                color: '#ef4444',
                fontSize: '0.88rem',
                marginBottom: '1rem',
              }}>
                {formError}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Mật khẩu mới *</label>
              <input
                type="password"
                placeholder="Ít nhất 6 ký tự..."
                className="form-control"
                value={matKhau}
                onChange={(e) => setMatKhau(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Nhập lại mật khẩu *</label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu mới..."
                className="form-control"
                value={matKhauLai}
                onChange={(e) => setMatKhauLai(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DatLaiMatKhauPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Đang tải...</p>
      </div>
    }>
      <DatLaiMatKhauForm />
    </Suspense>
  );
}
