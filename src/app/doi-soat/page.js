'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitCompare,
  RefreshCw,
  AlertTriangle,
  Save,
  TrendingUp,
  TrendingDown,
  Percent,
  ArrowLeftRight,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { canViewMenu } from '@/lib/roles';
import styles from '../dashboard.module.css';
import dsStyles from './doi-soat.module.css';

const THANG_LABELS = [
  'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
];
const formatVND = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';
const formatShort = (num) => {
  const n = Number(num || 0);
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (abs >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
};

// Màu thanh tỷ lệ: TRUNG TÍNH mặc định, chỉ chuyển cảnh báo khi tháng được đánh dấu
// bất thường (so với trung vị các tháng). KHÔNG tô đỏ theo mức tuyệt đối — shop TMĐT
// có tỷ lệ B/A thấp đều đặn do tiền sàn về trễ là bình thường, tô đỏ sẽ gây báo động giả.
function barColor(warn) {
  return warn ? 'var(--danger)' : 'var(--info)';
}

function TyLeBar({ tl, warn }) {
  if (tl === null || tl === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const color = barColor(warn);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        flex: 1,
        height: '6px',
        borderRadius: '3px',
        background: 'rgba(var(--brand-brown-rgb), 0.12)',
        overflow: 'hidden',
        minWidth: '60px',
      }}>
        <div style={{
          width: `${Math.min(tl, 100)}%`,
          height: '100%',
          background: color,
          borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, minWidth: '38px', textAlign: 'right' }}>
        {tl}%
      </span>
    </div>
  );
}

export default function DoiSoatPage() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nam, setNam] = useState(new Date().getFullYear());
  const [dataLoading, setDataLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [tong, setTong] = useState(null);
  const [notes, setNotes] = useState({});
  const [savingThang, setSavingThang] = useState(null);

  // Auth — chỉ OWNER + MANAGER (qua canViewMenu)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.authenticated) { router.push('/login'); return; }
        const u = data.user;
        if (!canViewMenu(u, 'doiSoat')) {
          toast.error('Bạn không có quyền xem trang Đối soát doanh thu.');
          router.push('/');
          return;
        }
        setUser(u);
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/doi-soat?nam=${nam}`);
      if (res.ok) {
        const d = await res.json();
        setMonths(d.months || []);
        setTong(d.tong || null);
        const n = {};
        (d.months || []).forEach((m) => { n[m.thang] = m.ghiChu || ''; });
        setNotes(n);
      }
    } catch (e) {
      console.error('fetch doi-soat', e);
    } finally {
      setDataLoading(false);
    }
  }, [nam]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const saveNote = async (thang) => {
    setSavingThang(thang);
    try {
      const res = await fetch('/api/doi-soat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, thang, ghiChu: notes[thang] || null }),
      });
      if (res.ok) {
        toast.success(`Đã lưu ghi chú tháng ${thang}.`);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Lưu thất bại.');
      }
    } catch {
      toast.error('Lỗi kết nối.');
    } finally {
      setSavingThang(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải dữ liệu đối soát...</p>
      </div>
    );
  }

  const years = [];
  for (let y = new Date().getFullYear() + 1; y >= 2024; y--) years.push(y);

  const tyLeChung = tong?.tyLe ?? null;
  const soThangBatThuong = months.filter((m) => m.batThuong).length;

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />
      <main className={styles.mainContent}>
        {/* Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h1>Đối soát doanh thu</h1>
            <p>So sánh doanh thu khai báo với tiền THU thực nhận về quỹ theo từng tháng.</p>
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
            {/* KPI Cards */}
            <div className={styles.dashboardGrid}>
              <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>DT khai báo (A)</span>
                  <TrendingUp className={styles.cardIcon} />
                </div>
                <h3>{formatShort(tong.doanhThuKhaiBao)}</h3>
                <p className={styles.cardInfo}>{formatVND(tong.doanhThuKhaiBao)}</p>
              </div>

              <div className={`${styles.statCard} ${styles.blueCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Tiền thực nhận (B)</span>
                  <ArrowLeftRight className={styles.cardIcon} />
                </div>
                <h3>{formatShort(tong.tienThucNhan)}</h3>
                <p className={styles.cardInfo}>{formatVND(tong.tienThucNhan)}</p>
              </div>

              <div
                className={`${styles.statCard} glass-card`}
                style={{ borderLeft: `4px solid ${soThangBatThuong > 0 ? 'var(--warning)' : 'var(--info)'}` }}
              >
                <div className={styles.cardHeader}>
                  <span>Tỷ lệ B/A</span>
                  <Percent className={styles.cardIcon} style={{ color: soThangBatThuong > 0 ? 'var(--warning)' : 'var(--info)' }} />
                </div>
                <h3 style={{ color: 'var(--info)' }}>
                  {tyLeChung !== null ? `${tyLeChung}%` : '—'}
                </h3>
                <p className={styles.cardInfo}>
                  {soThangBatThuong > 0 ? `${soThangBatThuong} tháng cần kiểm tra` : 'Tiền nhận / Khai báo'}
                </p>
              </div>

              <div
                className={`${styles.statCard} glass-card`}
                style={{ borderLeft: '4px solid var(--info)' }}
              >
                <div className={styles.cardHeader}>
                  <span>Chênh lệch (A−B)</span>
                  <TrendingDown className={styles.cardIcon} style={{ color: 'var(--info)' }} />
                </div>
                <h3 style={{ color: 'var(--text-main)' }}>
                  {formatShort(tong.chenhLech)}
                </h3>
                <p className={styles.cardInfo}>Tiền chưa về + phí + lệch</p>
              </div>
            </div>

            {/* Chú thích */}
            <div className={dsStyles.noteBox}>
              <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Chênh lệch</strong> gồm tiền đang về (sàn TMĐT thường chuyển trễ 7–30 ngày) + phí nền tảng + sai lệch nhập liệu.
                Theo dõi <strong>TỶ LỆ</strong> qua các tháng để phát hiện bất thường sớm.
              </span>
            </div>

            {/* ===== Desktop: bảng ===== */}
            <div className={`glass-card ${dsStyles.tableWrap}`} style={{ marginTop: '1.5rem' }}>
              <div className={styles.cardTitleBar}>
                <h2>Chi tiết từng tháng — {nam}</h2>
              </div>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th style={{ textAlign: 'right' }}>DT khai báo (A)</th>
                      <th style={{ textAlign: 'right' }}>Tiền thực nhận (B)</th>
                      <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                      <th style={{ minWidth: '140px' }}>Tỷ lệ B/A</th>
                      <th style={{ minWidth: '200px' }}>Ghi chú</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const warn = m.batThuong;
                      return (
                        <tr
                          key={m.thang}
                          style={warn ? { background: 'var(--warning-bg)' } : undefined}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {THANG_LABELS[m.thang - 1]}
                              {warn && (
                                <span
                                  title="Tỷ lệ tiền về thấp bất thường so với trung vị — nên kiểm tra"
                                  style={{ display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatVND(m.doanhThuKhaiBao)}</td>
                          <td style={{ textAlign: 'right' }}>{formatVND(m.tienThucNhan)}</td>
                          <td style={{
                            textAlign: 'right',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                          }}>
                            {formatVND(m.chenhLech)}
                          </td>
                          <td><TyLeBar tl={m.tyLe} warn={m.batThuong} /></td>
                          <td>
                            <input
                              type="text"
                              className="form-input"
                              style={{ fontSize: '0.82rem', padding: '0.3rem 0.5rem', width: '100%', minWidth: 0 }}
                              placeholder="Ghi chú..."
                              value={notes[m.thang] ?? ''}
                              onChange={(e) => setNotes((prev) => ({ ...prev, [m.thang]: e.target.value }))}
                              maxLength={500}
                            />
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              disabled={savingThang === m.thang}
                              onClick={() => saveNote(m.thang)}
                              title="Lưu ghi chú"
                            >
                              <Save size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(150,150,150,0.25)', fontWeight: 700 }}>
                      <td>Cả năm</td>
                      <td style={{ textAlign: 'right' }}>{formatVND(tong.doanhThuKhaiBao)}</td>
                      <td style={{ textAlign: 'right' }}>{formatVND(tong.tienThucNhan)}</td>
                      <td style={{
                        textAlign: 'right',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                      }}>
                        {formatVND(tong.chenhLech)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--info)' }}>
                          {tyLeChung !== null ? `${tyLeChung}%` : '—'}
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ===== Mobile: cards ===== */}
            <div className={dsStyles.cardList}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Chi tiết từng tháng — {nam}
              </h2>
              {months.map((m) => {
                const warn = m.batThuong;
                const tl = m.tyLe;
                return (
                  <div
                    key={m.thang}
                    className={`glass-card ${dsStyles.monthCard} ${warn ? dsStyles.monthWarn : ''}`}
                  >
                    {/* Header: tháng + tỷ lệ */}
                    <div className={dsStyles.monthCardHead}>
                      <span className={dsStyles.monthLabel}>
                        {THANG_LABELS[m.thang - 1]}
                        {warn && (
                          <span className={dsStyles.warnBadge}>
                            <AlertTriangle size={11} />
                            Bất thường
                          </span>
                        )}
                      </span>
                      <span className={dsStyles.tyLeChip} style={{ color: tl === null ? 'var(--text-muted)' : barColor(warn) }}>
                        {tl !== null ? `${tl}%` : '—'}
                      </span>
                    </div>

                    {/* Grid số liệu */}
                    <div className={dsStyles.monthCardGrid}>
                      <div className={dsStyles.cardField}>
                        <span>DT khai báo (A)</span>
                        <strong>{formatVND(m.doanhThuKhaiBao)}</strong>
                      </div>
                      <div className={dsStyles.cardField}>
                        <span>Tiền thực nhận (B)</span>
                        <strong>{formatVND(m.tienThucNhan)}</strong>
                      </div>
                      <div className={dsStyles.cardField}>
                        <span>Chênh lệch</span>
                        <strong style={{ color: 'var(--text-main)' }}>
                          {formatVND(m.chenhLech)}
                        </strong>
                      </div>
                    </div>

                    {/* Thanh tỷ lệ */}
                    {tl !== null && (
                      <div className={dsStyles.barWrap}>
                        <div className={dsStyles.barTrack}>
                          <div
                            className={dsStyles.barFill}
                            style={{ width: `${Math.min(tl, 100)}%`, background: barColor(warn) }}
                          />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: barColor(warn), fontWeight: 700, minWidth: '36px', textAlign: 'right' }}>
                          {tl}%
                        </span>
                      </div>
                    )}

                    {/* Cảnh báo bất thường */}
                    {warn && (
                      <p className={dsStyles.warnNote}>
                        Tỷ lệ tiền về thấp bất thường so với trung vị — nên kiểm tra.
                      </p>
                    )}

                    {/* Ghi chú */}
                    <div className={dsStyles.noteRow}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
                        placeholder="Ghi chú tháng này..."
                        value={notes[m.thang] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [m.thang]: e.target.value }))}
                        maxLength={500}
                      />
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                        disabled={savingThang === m.thang}
                        onClick={() => saveNote(m.thang)}
                      >
                        <Save size={14} />
                        Lưu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
