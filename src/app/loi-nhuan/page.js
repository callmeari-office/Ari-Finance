'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Percent,
  RefreshCw,
  Target,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import styles from '../dashboard.module.css';

const THANG_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const formatVND = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';
const formatShort = (num) => {
  const n = Number(num || 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (abs >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
};

export default function LoiNhuanPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nam, setNam] = useState(new Date().getFullYear());
  const [dataLoading, setDataLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [tong, setTong] = useState(null);

  // Auth — chỉ OWNER + MANAGER
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.authenticated) { router.push('/login'); return; }
        const u = data.user;
        const allowed = typeof u.permissions?.loiNhuan !== 'undefined'
          ? !!u.permissions.loiNhuan
          : (u.role === 'OWNER' || u.role === 'MANAGER');
        if (!allowed) { toast.error('Bạn không có quyền xem trang Lợi nhuận.'); router.push('/'); return; }
        setUser(u);
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/loi-nhuan?nam=${nam}`);
      if (res.ok) {
        const d = await res.json();
        setMonths(d.months || []);
        setTong(d.tong || null);
      }
    } catch (e) {
      console.error('fetch loi-nhuan', e);
    } finally {
      setDataLoading(false);
    }
  }, [nam]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải dữ liệu lợi nhuận...</p>
      </div>
    );
  }

  // Biểu đồ cột lãi/lỗ — baseline ở giữa, cột lên (lãi) / xuống (lỗ)
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.loiNhuanThucTe)), 1);
  const HALF = 90; // px nửa chiều cao vùng cột

  const years = [];
  for (let y = new Date().getFullYear() + 1; y >= 2024; y--) years.push(y);

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />
      <main className={styles.mainContent}>
        {/* Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h1>Lợi nhuận (Lãi / Lỗ)</h1>
            <p>Doanh thu − Chi phí theo từng tháng, đối chiếu với kế hoạch.</p>
          </div>
          <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={nam}
              onChange={(e) => setNam(parseInt(e.target.value))}
              className="form-input"
              style={{ width: 'auto', minWidth: '110px' }}
            >
              {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
            </select>
            <button onClick={fetchData} className="btn btn-secondary" title="Tải lại">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {dataLoading || !tong ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className={styles.dashboardGrid}>
              <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Doanh thu năm</span>
                  <TrendingUp className={styles.cardIcon} />
                </div>
                <h3>{formatVND(tong.doanhThuThucTe)}</h3>
                <p className={styles.cardInfo}>Kế hoạch: {formatVND(tong.doanhThuChiTieu)}</p>
              </div>

              <div className={`${styles.statCard} ${styles.redCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Chi phí năm</span>
                  <TrendingDown className={styles.cardIcon} />
                </div>
                <h3>{formatVND(tong.chiPhiThucTe)}</h3>
                <p className={styles.cardInfo}>Kế hoạch: {formatVND(tong.chiPhiKeHoach)}</p>
              </div>

              <div
                className={`${styles.statCard} glass-card`}
                style={{ borderLeft: `4px solid ${tong.loiNhuanThucTe >= 0 ? '#34d399' : '#ef4444'}` }}
              >
                <div className={styles.cardHeader}>
                  <span>{tong.loiNhuanThucTe >= 0 ? 'Lãi cả năm' : 'Lỗ cả năm'}</span>
                  <Scale className={styles.cardIcon} style={{ color: tong.loiNhuanThucTe >= 0 ? '#34d399' : '#ef4444' }} />
                </div>
                <h3 style={{ color: tong.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatVND(tong.loiNhuanThucTe)}
                </h3>
                <p className={styles.cardInfo}>
                  Kế hoạch: {formatVND(tong.loiNhuanKeHoach)}
                </p>
              </div>

              <div
                className={`${styles.statCard} glass-card`}
                style={{ borderLeft: `4px solid ${tong.bienLoiNhuan >= 0 ? 'var(--info)' : '#ef4444'}` }}
              >
                <div className={styles.cardHeader}>
                  <span>Biên lợi nhuận</span>
                  <Percent className={styles.cardIcon} style={{ color: 'var(--info)' }} />
                </div>
                <h3 style={{ color: tong.bienLoiNhuan >= 0 ? 'var(--text-main)' : '#ef4444' }}>
                  {tong.bienLoiNhuan}%
                </h3>
                <p className={styles.cardInfo}>Lợi nhuận / Doanh thu</p>
              </div>
            </div>

            {/* Biểu đồ cột lãi/lỗ 12 tháng */}
            <div className={`glass-card ${styles.largeCard}`} style={{ marginTop: '1.5rem' }}>
              <div className={styles.cardTitleBar}>
                <h2>Xu hướng Lãi / Lỗ 12 tháng — {nam}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', padding: '0.5rem 0' }}>
                {months.map((m) => {
                  const val = m.loiNhuanThucTe;
                  const h = Math.round((Math.abs(val) / maxAbs) * HALF);
                  const positive = val >= 0;
                  return (
                    <div key={m.thang} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {/* Nửa trên (lãi) */}
                      <div style={{ height: `${HALF}px`, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {positive && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--success)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                            {val !== 0 ? formatShort(val) : ''}
                          </span>
                        )}
                        {positive && (
                          <div
                            title={`Lãi T${m.thang}: ${formatVND(val)}`}
                            style={{ width: '70%', height: `${h}px`, minHeight: val !== 0 ? '3px' : '0', background: 'linear-gradient(180deg,#34d399,#10b981)', borderRadius: '4px 4px 0 0' }}
                          />
                        )}
                      </div>
                      {/* Đường baseline 0 */}
                      <div style={{ width: '100%', height: '1px', background: 'rgba(150,150,150,0.35)' }} />
                      {/* Nửa dưới (lỗ) */}
                      <div style={{ height: `${HALF}px`, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}>
                        {!positive && (
                          <div
                            title={`Lỗ T${m.thang}: ${formatVND(val)}`}
                            style={{ width: '70%', height: `${h}px`, minHeight: '3px', background: 'linear-gradient(180deg,#ef4444,#b91c1c)', borderRadius: '0 0 4px 4px' }}
                          />
                        )}
                        {!positive && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--danger)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {formatShort(val)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{THANG_LABELS[m.thang - 1]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(150,150,150,0.15)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981' }} /> Lãi
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444' }} /> Lỗ
                </span>
              </div>
            </div>

            {/* Bảng đối chiếu thực tế vs kế hoạch */}
            <div className="glass-card" style={{ marginTop: '1.5rem' }}>
              <div className={styles.cardTitleBar}>
                <h2>Chi tiết theo tháng</h2>
              </div>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th style={{ textAlign: 'right' }}>Doanh thu</th>
                      <th style={{ textAlign: 'right' }}>Chi phí</th>
                      <th style={{ textAlign: 'right' }}>Lãi / Lỗ (Thực tế)</th>
                      <th style={{ textAlign: 'right' }}>Lãi / Lỗ (Kế hoạch)</th>
                      <th style={{ textAlign: 'center' }}>So với KH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const datKH = m.loiNhuanThucTe >= m.loiNhuanKeHoach;
                      const coData = m.doanhThuThucTe !== 0 || m.chiPhiThucTe !== 0;
                      return (
                        <tr key={m.thang}>
                          <td style={{ fontWeight: 600 }}>{THANG_LABELS[m.thang - 1]}</td>
                          <td style={{ textAlign: 'right' }}>{formatVND(m.doanhThuThucTe)}</td>
                          <td style={{ textAlign: 'right' }}>{formatVND(m.chiPhiThucTe)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: m.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatVND(m.loiNhuanThucTe)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatVND(m.loiNhuanKeHoach)}</td>
                          <td style={{ textAlign: 'center' }}>
                            {!coData ? (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : datKH ? (
                              <span className="badge badge-paid">Đạt KH</span>
                            ) : (
                              <span className="badge badge-cancelled">Dưới KH</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(150,150,150,0.25)', fontWeight: 700 }}>
                      <td>Cả năm</td>
                      <td style={{ textAlign: 'right' }}>{formatVND(tong.doanhThuThucTe)}</td>
                      <td style={{ textAlign: 'right' }}>{formatVND(tong.chiPhiThucTe)}</td>
                      <td style={{ textAlign: 'right', color: tong.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatVND(tong.loiNhuanThucTe)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatVND(tong.loiNhuanKeHoach)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Target size={16} style={{ color: 'var(--info)' }} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
