'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScrollText,
  Search,
  RefreshCw,
  LogIn,
  KeyRound,
  PlusCircle,
  Pencil,
  CheckCircle2,
  XCircle,
  Lock,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

const HANH_DONG_META = {
  DANG_NHAP:    { label: 'Đăng nhập', color: '#3b82f6', Icon: LogIn },
  DOI_MAT_KHAU: { label: 'Đổi mật khẩu', color: '#8b5cf6', Icon: KeyRound },
  TAO:          { label: 'Tạo mới', color: 'var(--success)', Icon: PlusCircle },
  SUA:          { label: 'Chỉnh sửa', color: 'var(--warning)', Icon: Pencil },
  DUYET:        { label: 'Duyệt/Thanh toán', color: '#0ea5e9', Icon: CheckCircle2 },
  HUY:          { label: 'Hủy', color: 'var(--danger)', Icon: XCircle },
  KHOA:         { label: 'Khóa tài khoản', color: 'var(--danger)', Icon: Lock },
};

const DOI_TUONG_LABEL = {
  DE_XUAT: 'Đề xuất',
  THU_CHI: 'Thu - Chi',
  NHAN_VIEN: 'Nhân viên',
  QUY: 'Quỹ',
};

export default function NhatKyPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterHanhDong, setFilterHanhDong] = useState('');
  const [filterDoiTuong, setFilterDoiTuong] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterHanhDong) params.set('hanhDong', filterHanhDong);
      if (filterDoiTuong) params.set('doiTuong', filterDoiTuong);
      if (search.trim()) params.set('q', search.trim());
      params.set('limit', '300');
      const res = await fetch(`/api/nhat-ky?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch {
      // bỏ qua
    } finally {
      setDataLoading(false);
    }
  }, [filterHanhDong, filterDoiTuong, search]);

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
          if (data.user.role !== 'OWNER') {
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, fetchLogs]);

  const formatThoiGian = (t) => {
    const d = new Date(t);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--brand-brown)' }}>
              <ScrollText size={26} /> Nhật ký hệ thống
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Ghi lại ai đã làm gì, lúc nào — phục vụ tra soát khi số liệu bất thường.
            </p>
          </div>
          <button onClick={fetchLogs} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} disabled={dataLoading}>
            <RefreshCw size={16} className={dataLoading ? 'spin' : ''} /> Tải lại
          </button>
        </div>

        {/* Bộ lọc */}
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 36 }}
              placeholder="Tìm theo nội dung, người, mã phiếu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(); }}
            />
          </div>
          <select className="form-control" style={{ flex: '0 1 180px' }} value={filterHanhDong} onChange={(e) => setFilterHanhDong(e.target.value)}>
            <option value="">Tất cả hành động</option>
            {Object.entries(HANH_DONG_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select className="form-control" style={{ flex: '0 1 160px' }} value={filterDoiTuong} onChange={(e) => setFilterDoiTuong(e.target.value)}>
            <option value="">Tất cả đối tượng</option>
            {Object.entries(DOI_TUONG_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Danh sách nhật ký — dạng thẻ, hợp cả mobile lẫn desktop */}
        {dataLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Đang tải nhật ký...</p>
        ) : logs.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chưa có hoạt động nào khớp với bộ lọc.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {logs.map((log) => {
              const meta = HANH_DONG_META[log.hanhDong] || { label: log.hanhDong, color: '#78716c', Icon: ScrollText };
              const Icon = meta.Icon;
              return (
                <div key={log.id} className="glass-card" style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.color + '1a', color: meta.color }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.85rem' }}>{meta.label}</span>
                      {log.doiTuong && (
                        <span style={{ fontSize: '0.72rem', background: 'var(--background)', border: '1px solid var(--border, #e7e0d8)', color: 'var(--text-muted)', padding: '1px 7px', borderRadius: 999 }}>
                          {DOI_TUONG_LABEL[log.doiTuong] || log.doiTuong}
                        </span>
                      )}
                      {log.maDoiTuong && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--brand-brown)' }}>{log.maDoiTuong}</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, wordBreak: 'break-word' }}>
                      {log.moTa || '—'}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                      <strong>{log.tenNguoiDung || 'Ẩn danh'}</strong>
                      {log.vaiTro ? ` (${log.vaiTro})` : ''} · {formatThoiGian(log.thoiGian)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
          Hiển thị tối đa 300 hoạt động gần nhất. Dùng bộ lọc để thu hẹp kết quả.
        </p>
      </main>
    </div>
  );
}
