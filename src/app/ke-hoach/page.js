'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TableProperties,
  BarChart3,
  Save,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './ke-hoach.module.css';

const THANG_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

const formatVND = (num) => {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString('vi-VN');
};

const parseVND = (str) => {
  const clean = String(str).replace(/[^\d]/g, '');
  return clean === '' ? 0 : parseInt(clean, 10);
};

export default function KeHoachPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('ke-hoach'); // 'ke-hoach' | 'dashboard'
  const [nam, setNam] = useState(new Date().getFullYear());
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Dữ liệu danh mục CHI
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);

  // Dữ liệu kế hoạch: { [danhMucId_thang]: soTien }
  const [keHoachMap, setKeHoachMap] = useState({});
  const [dirtyMap, setDirtyMap] = useState({}); // ô đã chỉnh sửa

  // Dữ liệu thực tế: { [danhMucId_thang]: soTien }
  const [thucTeMap, setThucTeMap] = useState({});

  // Dashboard: expand state per nhóm
  const [expandedGroups, setExpandedGroups] = useState({});

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.authenticated) { router.push('/login'); return; }
        const ok = data.user.permissions?.keHoach !== false || data.user.role === 'OWNER' || data.user.role === 'MANAGER';
        if (!ok) { alert('Bạn không có quyền truy cập.'); router.push('/'); return; }
        setUser(data.user);
        if (data.user.role !== 'OWNER') setView('dashboard');
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [catRes, khRes] = await Promise.all([
        fetch('/api/cau-hinh'),
        fetch(`/api/ke-hoach?nam=${nam}`),
      ]);
      const catData = catRes.ok ? await catRes.json() : {};
      const khData = khRes.ok ? await khRes.json() : {};

      const allCats = (catData.categories || []).filter((c) => c.loaiGiaoDich === 'CHI');
      setCategories(allCats);
      setGroups(catData.groups || []);

      // Build keHoachMap
      const km = {};
      (khData.keHoach || []).forEach((kh) => {
        km[`${kh.danhMucId}_${kh.thang}`] = kh.soTien;
      });
      setKeHoachMap(km);
      setDirtyMap({});

      // Build thucTeMap
      const tm = {};
      (khData.thucTeByMonth || []).forEach((row) => {
        if (row.loaigiaodich === 'CHI' || row.loaiGiaoDich === 'CHI') {
          const key = `${row.danhmucid || row.danhMucId}_${row.thang}`;
          tm[key] = Number(row.total) || 0;
        }
      });
      setThucTeMap(tm);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  }, [nam]);

  useEffect(() => {
    if (!loading) fetchData();
  }, [loading, fetchData]);

  const getKH = (danhMucId, thang) => keHoachMap[`${danhMucId}_${thang}`] || 0;
  const getTT = (danhMucId, thang) => thucTeMap[`${danhMucId}_${thang}`] || 0;
  const getDirty = (danhMucId, thang) => dirtyMap[`${danhMucId}_${thang}`];

  const handleCellChange = (danhMucId, thang, value) => {
    const key = `${danhMucId}_${thang}`;
    const num = parseVND(value);
    setKeHoachMap((prev) => ({ ...prev, [key]: num }));
    setDirtyMap((prev) => ({ ...prev, [key]: true }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const items = [];
    categories.forEach((cat) => {
      for (let t = 1; t <= 12; t++) {
        items.push({ danhMucId: cat.id, thang: t, soTien: getKH(cat.id, t) });
      }
    });
    try {
      const res = await fetch('/api/ke-hoach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, items }),
      });
      if (res.ok) {
        setSaveMsg('Đã lưu kế hoạch!');
        setDirtyMap({});
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg('Lỗi khi lưu, thử lại.');
      }
    } catch {
      setSaveMsg('Lỗi kết nối.');
    } finally {
      setSaving(false);
    }
  };

  // Nhóm danh mục CHI theo nhóm chi phí
  const groupedCats = groups
    .map((g) => ({
      ...g,
      cats: categories.filter((c) => c.nhomChiPhiId === g.id),
    }))
    .filter((g) => g.cats.length > 0);

  // Tổng kế hoạch năm per tháng
  const tongKHThang = (thang) =>
    categories.reduce((s, c) => s + getKH(c.id, thang), 0);

  const tongTTThang = (thang) =>
    categories.reduce((s, c) => s + getTT(c.id, thang), 0);

  const tongKHNam = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
    (s, t) => s + tongKHThang(t), 0
  );
  const tongTTNam = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
    (s, t) => s + tongTTThang(t), 0
  );

  const hasDirty = Object.values(dirtyMap).some(Boolean);

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        {/* HEADER */}
        <div className={styles.pageHeader}>
          <div>
            <h1>Kế hoạch chi phí</h1>
            <p className={styles.pageDesc}>Lập và theo dõi kế hoạch chi phí theo danh mục — so sánh với thực tế phát sinh</p>
          </div>
          <div className={styles.headerActions}>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={nam}
              onChange={(e) => setNam(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
            <div className={styles.viewToggle}>
              {user?.role === 'OWNER' && (
                <button
                  className={view === 'ke-hoach' ? styles.toggleActive : styles.toggleBtn}
                  onClick={() => setView('ke-hoach')}
                >
                  <TableProperties size={15} /> Kế Hoạch
                </button>
              )}
              <button
                className={view === 'dashboard' ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setView('dashboard')}
              >
                <BarChart3 size={15} /> Dashboard
              </button>
            </div>
          </div>
        </div>

        {view === 'ke-hoach' && (
          <>
            {/* TOOLBAR */}
            <div className={styles.toolbar}>
              <span className={styles.toolbarInfo}>
                {hasDirty ? (
                  <span style={{ color: '#f59e0b' }}>● Có thay đổi chưa lưu</span>
                ) : (
                  <span style={{ color: '#6b7280' }}>Nhấp vào ô để chỉnh sửa số tiền kế hoạch</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {saveMsg && <span style={{ color: saveMsg.includes('Đã lưu') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{saveMsg}</span>}
                <button className="btn btn-secondary" onClick={fetchData} disabled={dataLoading}>
                  <RefreshCw size={14} /> Làm mới
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !hasDirty}
                >
                  <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
                </button>
              </div>
            </div>

            {/* BẢNG KẾ HOẠCH */}
            {dataLoading ? (
              <div className={styles.loaderSmall}>Đang tải dữ liệu...</div>
            ) : categories.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Chưa có danh mục CHI nào. Hãy thêm danh mục trong Cấu hình trước.
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.spreadsheet}>
                  <thead>
                    <tr>
                      <th className={styles.colDanhMuc}>Danh mục</th>
                      {THANG_LABELS.map((t) => (
                        <th key={t} className={styles.colThang}>{t}</th>
                      ))}
                      <th className={styles.colTotal}>Cả năm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCats.map((grp) => (
                      <React.Fragment key={grp.id}>
                        {/* Hàng nhóm */}
                        <tr className={styles.groupRow}>
                          <td className={styles.groupLabel}>{grp.tenNhom}</td>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => {
                            const total = grp.cats.reduce((s, c) => s + getKH(c.id, t), 0);
                            return (
                              <td key={t} className={styles.groupCell}>
                                {total > 0 ? formatVND(total) : '—'}
                              </td>
                            );
                          })}
                          <td className={styles.groupCell}>
                            {formatVND(
                              grp.cats.reduce(
                                (s, c) =>
                                  s +
                                  Array.from({ length: 12 }, (_, i) => i + 1).reduce(
                                    (ss, t) => ss + getKH(c.id, t),
                                    0
                                  ),
                                0
                              )
                            )}
                          </td>
                        </tr>

                        {/* Hàng từng danh mục */}
                        {grp.cats.map((cat) => {
                          const rowTotal = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
                            (s, t) => s + getKH(cat.id, t), 0
                          );
                          return (
                            <tr key={cat.id} className={styles.catRow}>
                              <td className={styles.catLabel}>{cat.tenDanhMuc}</td>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => (
                                <td key={t} className={`${styles.inputCell} ${getDirty(cat.id, t) ? styles.dirty : ''}`}>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className={styles.cellInput}
                                    value={getKH(cat.id, t) > 0 ? formatVND(getKH(cat.id, t)) : ''}
                                    placeholder="—"
                                    onChange={(e) => handleCellChange(cat.id, t, e.target.value)}
                                  />
                                </td>
                              ))}
                              <td className={styles.rowTotalCell}>
                                {rowTotal > 0 ? formatVND(rowTotal) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}

                    {/* Hàng tổng */}
                    <tr className={styles.totalRow}>
                      <td className={styles.totalLabel}>TỔNG CHI KẾ HOẠCH</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => (
                        <td key={t} className={styles.totalCell}>
                          {tongKHThang(t) > 0 ? formatVND(tongKHThang(t)) : '—'}
                        </td>
                      ))}
                      <td className={styles.totalCell}>{formatVND(tongKHNam)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {view === 'dashboard' && (
          <DashboardView
            categories={categories}
            groupedCats={groupedCats}
            getKH={getKH}
            getTT={getTT}
            tongKHThang={tongKHThang}
            tongTTThang={tongTTThang}
            tongKHNam={tongKHNam}
            tongTTNam={tongTTNam}
            dataLoading={dataLoading}
            expandedGroups={expandedGroups}
            setExpandedGroups={setExpandedGroups}
            nam={nam}
          />
        )}
      </main>
    </div>
  );
}

function DashboardView({
  categories, groupedCats, getKH, getTT,
  tongKHThang, tongTTThang, tongKHNam, tongTTNam,
  dataLoading, expandedGroups, setExpandedGroups, nam,
}) {
  const formatVND = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';
  const pct = tongKHNam > 0 ? Math.round((tongTTNam / tongKHNam) * 100) : 0;
  const thangHienTai = new Date().getFullYear() === nam ? new Date().getMonth() + 1 : null;

  // Tháng hiện tại
  const khThang = thangHienTai ? tongKHThang(thangHienTai) : 0;
  const ttThang = thangHienTai ? tongTTThang(thangHienTai) : 0;
  const pctThang = khThang > 0 ? Math.round((ttThang / khThang) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {dataLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className={styles.kpiGrid}>
            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}>
                <Target size={16} style={{ color: '#6366f1' }} /> Tổng KH năm {nam}
              </div>
              <div className={styles.kpiValue} style={{ color: '#6366f1' }}>{formatVND(tongKHNam)}</div>
              <div className={styles.kpiSub}>Kế hoạch chi phí đã lập</div>
            </div>

            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}>
                <TrendingDown size={16} style={{ color: '#ef4444' }} /> Thực tế đã chi
              </div>
              <div className={styles.kpiValue} style={{ color: '#ef4444' }}>{formatVND(tongTTNam)}</div>
              <div className={styles.kpiSub}>
                {pct >= 100 ? (
                  <span style={{ color: '#f87171' }}>▲ Vượt {pct - 100}% kế hoạch</span>
                ) : (
                  <span style={{ color: '#34d399' }}>Còn lại {formatVND(tongKHNam - tongTTNam)}</span>
                )}
              </div>
            </div>

            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}>
                <BarChart3 size={16} style={{ color: '#f59e0b' }} /> Tỉ lệ thực hiện năm
              </div>
              <div
                className={styles.kpiValue}
                style={{ color: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#34d399' }}
              >
                {pct}%
              </div>
              <ProgressBar value={pct} />
            </div>

            {thangHienTai && (
              <div className={`glass-card ${styles.kpiCard}`}>
                <div className={styles.kpiLabel}>
                  <TrendingUp size={16} style={{ color: '#10b981' }} /> Tháng {thangHienTai} hiện tại
                </div>
                <div
                  className={styles.kpiValue}
                  style={{ color: pctThang >= 100 ? '#ef4444' : pctThang >= 80 ? '#f59e0b' : '#10b981' }}
                >
                  {pctThang}%
                </div>
                <div className={styles.kpiSub}>
                  TT: {formatVND(ttThang)} / KH: {formatVND(khThang)}
                </div>
              </div>
            )}
          </div>

          {/* BẢNG SO SÁNH THEO THÁNG */}
          <div className="glass-card">
            <div className={styles.cardHeader}>
              <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2>So sánh Kế hoạch vs Thực tế theo tháng</h2>
            </div>
            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th style={{ textAlign: 'right' }}>Kế hoạch</th>
                    <th style={{ textAlign: 'right' }}>Thực tế</th>
                    <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                    <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => {
                    const kh = tongKHThang(t);
                    const tt = tongTTThang(t);
                    const diff = tt - kh;
                    const p = kh > 0 ? Math.round((tt / kh) * 100) : null;
                    const isCurrentMonth = thangHienTai === t;
                    return (
                      <tr key={t} style={isCurrentMonth ? { background: 'rgba(99,102,241,0.08)' } : {}}>
                        <td style={{ fontWeight: isCurrentMonth ? 700 : 400 }}>
                          Tháng {t} {isCurrentMonth && <span style={{ color: '#6366f1', fontSize: '0.75rem' }}>(hiện tại)</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {kh > 0 ? formatVND(kh) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {tt > 0 ? formatVND(tt) : '—'}
                        </td>
                        <td style={{
                          textAlign: 'right',
                          color: diff > 0 ? '#ef4444' : diff < 0 ? '#34d399' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}>
                          {diff !== 0 && kh > 0 ? (diff > 0 ? '+' : '') + formatVND(diff) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {p !== null ? (
                            <span style={{ fontWeight: 700, color: p >= 100 ? '#ef4444' : p >= 80 ? '#f59e0b' : '#34d399' }}>
                              {p}%
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {kh === 0 && tt === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Chưa có dữ liệu</span>
                          ) : p === null ? (
                            <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Chưa lập KH</span>
                          ) : p >= 100 ? (
                            <span className={styles.badgeRed}><AlertTriangle size={12} /> Vượt hạn mức</span>
                          ) : p >= 80 ? (
                            <span className={styles.badgeYellow}><AlertTriangle size={12} /> Sắp đến hạn</span>
                          ) : (
                            <span className={styles.badgeGreen}><CheckCircle2 size={12} /> Trong kế hoạch</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)' }}>
                    <td>TỔNG NĂM</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(tongKHNam)}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(tongTTNam)}</td>
                    <td style={{
                      textAlign: 'right',
                      color: tongTTNam - tongKHNam > 0 ? '#ef4444' : '#34d399',
                    }}>
                      {tongKHNam > 0 ? (tongTTNam - tongKHNam > 0 ? '+' : '') + formatVND(tongTTNam - tongKHNam) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#34d399', fontWeight: 800 }}>{pct}%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* BẢNG THEO DANH MỤC — NHÓM GỌN */}
          <div className="glass-card">
            <div className={styles.cardHeader}>
              <Target size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2>Chi tiết theo Danh mục — Lũy kế năm {nam}</h2>
            </div>
            {groupedCats.map((grp) => {
              const grpKH = grp.cats.reduce(
                (s, c) => s + Array.from({ length: 12 }, (_, i) => i + 1).reduce((ss, t) => ss + getKH(c.id, t), 0), 0
              );
              const grpTT = grp.cats.reduce(
                (s, c) => s + Array.from({ length: 12 }, (_, i) => i + 1).reduce((ss, t) => ss + getTT(c.id, t), 0), 0
              );
              const grpPct = grpKH > 0 ? Math.round((grpTT / grpKH) * 100) : null;
              const isExpanded = expandedGroups[grp.id];

              return (
                <div key={grp.id} className={styles.groupSection}>
                  <div
                    className={styles.groupToggleRow}
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [grp.id]: !prev[grp.id] }))}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className={styles.groupToggleName}>{grp.tenNhom}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>KH: {grpKH > 0 ? formatVND(grpKH) : '—'}</span>
                      <span style={{ fontWeight: 700 }}>TT: {grpTT > 0 ? formatVND(grpTT) : '—'}</span>
                      {grpPct !== null && (
                        <span style={{ fontWeight: 800, color: grpPct >= 100 ? '#ef4444' : grpPct >= 80 ? '#f59e0b' : '#34d399' }}>
                          {grpPct}%
                        </span>
                      )}
                    </span>
                  </div>

                  {isExpanded && (
                    <table className="custom-table" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      <thead>
                        <tr>
                          <th>Danh mục</th>
                          <th style={{ textAlign: 'right' }}>Kế hoạch năm</th>
                          <th style={{ textAlign: 'right' }}>Thực tế</th>
                          <th style={{ textAlign: 'right' }}>Còn lại</th>
                          <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                          <th>Tiến độ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grp.cats.map((cat) => {
                          const catKH = Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, t) => s + getKH(cat.id, t), 0);
                          const catTT = Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, t) => s + getTT(cat.id, t), 0);
                          const catPct = catKH > 0 ? Math.round((catTT / catKH) * 100) : null;
                          const conLai = catKH - catTT;
                          return (
                            <tr key={cat.id}>
                              <td>{cat.tenDanhMuc}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{catKH > 0 ? formatVND(catKH) : '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{catTT > 0 ? formatVND(catTT) : '—'}</td>
                              <td style={{
                                textAlign: 'right',
                                color: conLai < 0 ? '#ef4444' : '#34d399',
                                fontWeight: 600,
                              }}>
                                {catKH > 0 ? (conLai < 0 ? '-' : '') + formatVND(Math.abs(conLai)) : '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {catPct !== null ? (
                                  <span style={{ fontWeight: 700, color: catPct >= 100 ? '#ef4444' : catPct >= 80 ? '#f59e0b' : '#34d399' }}>
                                    {catPct}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td style={{ minWidth: '120px' }}>
                                {catKH > 0 ? <ProgressBar value={Math.min(catPct, 120)} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa lập KH</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ProgressBar({ value }) {
  const capped = Math.min(value, 100);
  const color = value >= 100 ? '#ef4444' : value >= 80 ? '#f59e0b' : '#34d399';
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{ width: `${capped}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s' }} />
    </div>
  );
}
