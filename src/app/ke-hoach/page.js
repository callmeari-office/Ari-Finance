'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TableProperties,
  BarChart3,
  CalendarDays,
  Save,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { canViewMenu } from '@/lib/roles';
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
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('ke-hoach'); // 'ke-hoach' | 'db-thang' | 'db-nam'
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thangXem, setThangXem] = useState(new Date().getMonth() + 1); // tháng đang xem ở DB Tháng
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

  // Chi phí dự kiến tháng hiện tại (cố định chưa chi + sắp tới hạn) — chỉ OWNER/MANAGER.
  const [chiPhiDuKien, setChiPhiDuKien] = useState(null);

  // Dashboard: expand state per nhóm
  const [expandedGroups, setExpandedGroups] = useState({});

  // Import States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importParseError, setImportParseError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.authenticated) { router.push('/login'); return; }
        if (!canViewMenu(data.user, 'keHoach') && !canViewMenu(data.user, 'keHoachDBThang') && !canViewMenu(data.user, 'keHoachDBNam')) { toast.error('Bạn không có quyền truy cập.'); router.push('/'); return; }
        setUser(data.user);
        // OWNER mặc định vào màn lập Kế Hoạch; vai trò khác vào Dashboard đầu tiên được phép.
        if (data.user.role !== 'OWNER') {
          setView(canViewMenu(data.user, 'keHoachDBThang') ? 'db-thang' : 'db-nam');
        }
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      // OWNER/MANAGER lấy toàn bộ danh mục (kể cả ngưng) qua /api/cau-hinh để lập kế hoạch.
      // STAFF/LEADER lấy /api/danh-muc — đã được LỌC sẵn theo danh mục họ được phân quyền xem.
      const catUrl = (user?.role === 'OWNER' || user?.role === 'MANAGER') ? '/api/cau-hinh' : '/api/danh-muc';
      const [catRes, khRes] = await Promise.all([
        fetch(catUrl),
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

      // Chi phí dự kiến tháng hiện tại (cố định chưa chi + sắp tới hạn) — chỉ OWNER/MANAGER xem được.
      if (user?.role === 'OWNER' || user?.role === 'MANAGER') {
        try {
          const cpRes = await fetch('/api/chi-phi-du-kien');
          setChiPhiDuKien(cpRes.ok ? await cpRes.json() : null);
        } catch { setChiPhiDuKien(null); }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  }, [nam, user?.role]);

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

  // ── Download & Import Excel cho Kế hoạch Chi phí ──
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['Danh mục chi', ...THANG_LABELS];
      const rows = categories.map(cat => {
        const row = [cat.tenDanhMuc];
        for (let t = 1; t <= 12; t++) {
          const val = getKH(cat.id, t);
          row.push(val > 0 ? val : 0);
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 24 }, ...Array(12).fill({ wch: 12 })];

      const refSheet = XLSX.utils.aoa_to_sheet([
        ['DANH MỤC CHI HỢP LỆ (Copy chính xác tên vào cột "Danh mục chi")'],
        ...categories.map(c => [c.tenDanhMuc])
      ]);
      refSheet['!cols'] = [{ wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kế hoạch chi phí');
      XLSX.utils.book_append_sheet(wb, refSheet, 'DanhMuc hợp lệ');

      XLSX.writeFile(wb, `mau-ke-hoach-chi-phi-nam-${nam}.xlsx`);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được file mẫu.');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportFileName(file.name);
    setImportParseError('');
    setImportResult(null);
    setImportErrors([]);
    setImportSuccessCount(0);
    setImportLoading(true);

    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

      if (aoa.length < 2) {
        setImportParseError('File không có dòng dữ liệu nào (chỉ có tiêu đề).');
        setImportLoading(false);
        return;
      }

      const norm = (s) => String(s || '').trim().toLowerCase();
      const headers = (aoa[0] || []).map(norm);
      const colDanhMuc = headers.findIndex(h => h.includes('danh mục chi') || h.includes('danhmucchi') || h.includes('danh mục') || h.includes('danhmuc'));
      if (colDanhMuc === -1) {
        setImportParseError('Không tìm thấy cột "Danh mục chi".');
        setImportLoading(false);
        return;
      }

      const colThangs = {};
      for (let t = 1; t <= 12; t++) {
        const idx = headers.findIndex(h => h === `t${t}` || h === `tháng ${t}` || h === `thang ${t}` || h === `th${t}`);
        if (idx !== -1) {
          colThangs[t] = idx;
        } else {
          const idxPartial = headers.findIndex(h => h.includes(`t${t}`) || h.includes(`t ${t}`));
          if (idxPartial !== -1) {
            colThangs[t] = idxPartial;
          }
        }
      }

      if (Object.keys(colThangs).length === 0) {
        setImportParseError('Không tìm thấy các cột tháng (T1, T2, ..., T12).');
        setImportLoading(false);
        return;
      }

      const rows = [];
      for (let i = 1; i < aoa.length; i++) {
        const line = aoa[i];
        const danhMucVal = String(line[colDanhMuc] || '').trim();
        if (!danhMucVal) continue;

        const rowObj = { danhMuc: danhMucVal };
        for (let t = 1; t <= 12; t++) {
          const colIdx = colThangs[t];
          if (colIdx !== undefined) {
            const rawVal = line[colIdx];
            rowObj[`T${t}`] = rawVal !== '' ? Number(rawVal) : 0;
          }
        }
        rows.push(rowObj);
      }

      const res = await fetch('/api/ke-hoach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, rows }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult('success');
        setImportSuccessCount(data.successCount);
        fetchData();
      } else {
        setImportResult('error');
        setImportParseError(data.error || 'Nhập dữ liệu thất bại.');
        setImportErrors(data.errors || []);
      }
    } catch (err) {
      console.error(err);
      setImportParseError('Lỗi đọc/xử lý file Excel. Vui lòng kiểm tra định dạng.');
    } finally {
      setImportLoading(false);
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

  // Quyền xem từng Dashboard (phân quyền tinh ở trang /quyen). OWNER luôn xem được.
  const canDBThang = canViewMenu(user, 'keHoachDBThang');
  const canDBNam = canViewMenu(user, 'keHoachDBNam');
  const isOwner = user?.role === 'OWNER';

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
              {isOwner && (
                <button
                  className={view === 'ke-hoach' ? styles.toggleActive : styles.toggleBtn}
                  onClick={() => setView('ke-hoach')}
                >
                  <TableProperties size={15} /> Kế Hoạch
                </button>
              )}
              {canDBThang && (
                <button
                  className={view === 'db-thang' ? styles.toggleActive : styles.toggleBtn}
                  onClick={() => setView('db-thang')}
                >
                  <CalendarDays size={15} /> DB Tháng
                </button>
              )}
              {canDBNam && (
                <button
                  className={view === 'db-nam' ? styles.toggleActive : styles.toggleBtn}
                  onClick={() => setView('db-nam')}
                >
                  <BarChart3 size={15} /> DB Năm
                </button>
              )}
            </div>
          </div>
        </div>

        {view === 'ke-hoach' && (
          <>
            {/* TOOLBAR */}
            <div className={styles.toolbar}>
              <span className={styles.toolbarInfo}>
                {hasDirty ? (
                  <span style={{ color: 'var(--warning)' }}>● Có thay đổi chưa lưu</span>
                ) : (
                  <span style={{ color: '#6b7280' }}>Nhấp vào ô để chỉnh sửa số tiền kế hoạch</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {saveMsg && <span style={{ color: saveMsg.includes('Đã lưu') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{saveMsg}</span>}
                <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                  <Download size={14} /> Tải mẫu
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  setImportFileName('');
                  setImportParseError('');
                  setImportResult(null);
                  setImportErrors([]);
                  setIsImportOpen(true);
                }}>
                  <Upload size={14} /> Nhập Excel
                </button>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
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

        {view === 'db-thang' && canDBThang && (
          <DashboardThangView
            categories={categories}
            groupedCats={groupedCats}
            getKH={getKH}
            getTT={getTT}
            dataLoading={dataLoading}
            nam={nam}
            thang={thangXem}
            setThang={setThangXem}
            chiPhiDuKien={chiPhiDuKien}
          />
        )}

        {view === 'db-nam' && canDBNam && (
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
        {isImportOpen && (
          <div className={styles.modalOverlay} onClick={() => { if (!importLoading) setIsImportOpen(false); }}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Nhập kế hoạch chi phí năm {nam}</h2>
                <button className={styles.modalClose} onClick={() => setIsImportOpen(false)} disabled={importLoading}><X size={20} /></button>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <button type="button" onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Download size={16} /> <span>Tải file Excel mẫu</span>
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Chọn file Excel (.xlsx) đã điền kế hoạch</label>
                <label className={styles.uploadBox}>
                  <FileSpreadsheet size={32} style={{ color: '#6366f1' }} />
                  <span style={{ fontWeight: '600' }}>
                    {importFileName ? `📄 ${importFileName}` : 'Bấm để chọn file .xlsx'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Hệ thống sẽ cập nhật tự động kế hoạch 12 tháng của các danh mục chi
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                    disabled={importLoading}
                  />
                </label>
              </div>

              {importLoading && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div className={styles.spinner} style={{ margin: '0 auto 0.5rem' }}></div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Đang xử lý dữ liệu Excel...</p>
                </div>
              )}

              {importResult === 'success' && (
                <div className={styles.successAlert}>
                  <CheckCircle2 size={18} />
                  <span>
                    Đã nhập thành công! Cập nhật <strong>{importSuccessCount}</strong> bản ghi kế hoạch.
                  </span>
                </div>
              )}

              {importResult === 'error' && (
                <div>
                  <div className={styles.errorAlert}>
                    <AlertTriangle size={18} />
                    <span>{importParseError}</span>
                  </div>
                  {importErrors.length > 0 && (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.5rem' }}>
                      <table className={styles.importErrorsTable}>
                        <thead>
                          <tr>
                            <th style={{ width: '60px' }}>Dòng</th>
                            <th>Mô tả lỗi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importErrors.map((err, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '700', color: '#ff8b8b' }}>{err.dong}</td>
                              <td style={{ color: 'var(--text-main)' }}>{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={() => setIsImportOpen(false)} disabled={importLoading}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Dashboard THEO THÁNG: so sánh thực chi vs kế hoạch của 1 tháng + dự đoán cuối tháng.
function DashboardThangView({ categories, groupedCats, getKH, getTT, dataLoading, nam, thang, setThang, chiPhiDuKien }) {
  const formatVND = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  // Chi phí: cao là XẤU -> đỏ ≥100% (vượt KH), vàng 80-99% (sắp chạm), xanh <80% (trong KH).
  const costColor = (p) => (p >= 100 ? 'var(--danger)' : p >= 80 ? 'var(--warning)' : 'var(--success)');

  const khThang = categories.reduce((s, c) => s + getKH(c.id, thang), 0);
  const ttThang = categories.reduce((s, c) => s + getTT(c.id, thang), 0);
  const pct = khThang > 0 ? Math.round((ttThang / khThang) * 100) : null;
  const conLai = khThang - ttThang;

  const today = new Date();
  const isCurrentMonth = nam === today.getFullYear() && thang === today.getMonth() + 1;
  const daysInM = new Date(nam, thang, 0).getDate();
  const daysPassed = isCurrentMonth ? today.getDate() : daysInM;
  // Dự đoán cuối tháng = nhịp chi trung bình/ngày × số ngày trong tháng (chỉ cho tháng hiện tại).
  const duDoan = isCurrentMonth && daysPassed > 0 ? Math.round((ttThang / daysPassed) * daysInM) : null;
  const duDoanPct = duDoan !== null && khThang > 0 ? Math.round((duDoan / khThang) * 100) : null;

  const soVuot = categories.filter((c) => getKH(c.id, thang) > 0 && getTT(c.id, thang) > getKH(c.id, thang)).length;
  const topCat = categories
    .map((c) => ({ ten: c.tenDanhMuc, tt: getTT(c.id, thang) }))
    .filter((r) => r.tt > 0)
    .sort((a, b) => b.tt - a.tt)[0] || null;

  // Donut chart calculations
  const donutData = groupedCats.map((grp) => {
    const tt = grp.cats.reduce((s, c) => s + getTT(c.id, thang), 0);
    return {
      id: grp.id,
      name: grp.tenNhom,
      amount: tt
    };
  }).filter(d => d.amount > 0);

  const totalDonutAmount = donutData.reduce((s, d) => s + d.amount, 0) || 1;
  const DONUT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
  const donutSegments = donutData.map((d, i) => ({
    ...d,
    percent: (d.amount / totalDonutAmount) * 100,
    color: DONUT_COLORS[i % DONUT_COLORS.length]
  }));

  let accumulated = 0;
  const donutSegmentsWithOffsets = donutSegments.map((seg) => {
    const offset = accumulated;
    accumulated += seg.percent;
    return { ...seg, offset };
  });

  const radius = 35;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  // Diverging variance chart calculations
  const varianceData = groupedCats.map((grp) => {
    const kh = grp.cats.reduce((s, c) => s + getKH(c.id, thang), 0);
    const tt = grp.cats.reduce((s, c) => s + getTT(c.id, thang), 0);
    return {
      id: grp.id,
      name: grp.tenNhom,
      kh,
      tt,
      diff: tt - kh
    };
  }).filter(d => d.kh > 0 || d.tt > 0);

  const maxAbsoluteDiff = Math.max(...varianceData.map(d => Math.abs(d.diff)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Chọn tháng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Xem tháng:</span>
        <select className="form-control" style={{ width: 'auto' }} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
          {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        {isCurrentMonth && <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>● Tháng hiện tại</span>}
      </div>

      {dataLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
      ) : khThang === 0 && ttThang === 0 ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Chưa có kế hoạch hoặc chi phí phát sinh nào trong Tháng {thang}/{nam}.
        </div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className={styles.kpiGrid}>
            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}><Target size={16} style={{ color: '#6366f1' }} /> Kế hoạch chi T{thang}</div>
              <div className={styles.kpiValue} style={{ color: '#6366f1' }}>{formatVND(khThang)}</div>
              <div className={styles.kpiSub}>Ngân sách dự kiến tháng</div>
            </div>

            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}><TrendingDown size={16} style={{ color: 'var(--danger)' }} /> Thực chi T{thang}</div>
              <div className={styles.kpiValue} style={{ color: 'var(--danger)' }}>{formatVND(ttThang)}</div>
              <div className={styles.kpiSub}>
                {khThang === 0 ? <span style={{ color: 'var(--text-muted)' }}>Chưa lập KH</span>
                  : conLai < 0 ? <span style={{ color: 'var(--danger)' }}>▲ Vượt {formatVND(-conLai)}</span>
                  : <span style={{ color: 'var(--success)' }}>Còn được chi {formatVND(conLai)}</span>}
              </div>
              {isCurrentMonth && chiPhiDuKien && chiPhiDuKien.conLaiCoDinh > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  (đã cam kết ~{formatVND(chiPhiDuKien.conLaiCoDinh)} sắp chi)
                </div>
              )}
            </div>

            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}><BarChart3 size={16} style={{ color: 'var(--warning)' }} /> Tỉ lệ thực hiện</div>
              <div className={styles.kpiValue} style={{ color: pct === null ? 'var(--text-muted)' : costColor(pct) }}>
                {pct === null ? '—' : `${pct}%`}
              </div>
              {pct === null ? <div className={styles.kpiSub}>Chưa lập kế hoạch</div> : <ProgressBar value={pct} />}
            </div>

            {isCurrentMonth && khThang > 0 ? (
              <div className={`glass-card ${styles.kpiCard}`}>
                <div className={styles.kpiLabel}><TrendingUp size={16} style={{ color: 'var(--success)' }} /> Dự đoán cuối tháng</div>
                <div className={styles.kpiValue} style={{ color: duDoanPct === null ? 'var(--text-muted)' : costColor(duDoanPct) }}>{formatVND(duDoan)}</div>
                <div className={styles.kpiSub}>
                  {duDoanPct !== null && duDoanPct >= 100
                    ? <span style={{ color: 'var(--danger)' }}>Dự kiến VƯỢT {duDoanPct - 100}% KH</span>
                    : <span style={{ color: 'var(--success)' }}>Dự kiến trong KH ({duDoanPct ?? 0}%)</span>}
                  {` · theo ${daysPassed}/${daysInM} ngày`}
                </div>
              </div>
            ) : (
              <div className={`glass-card ${styles.kpiCard}`}>
                <div className={styles.kpiLabel}><AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> {topCat ? 'Chi nhiều nhất' : 'Vượt kế hoạch'}</div>
                {topCat ? (
                  <>
                    <div className={styles.kpiValue} style={{ fontSize: '1.05rem', color: 'var(--brand-brown)' }}>{topCat.ten}</div>
                    <div className={styles.kpiSub}>{formatVND(topCat.tt)} · {soVuot} danh mục vượt KH</div>
                  </>
                ) : (
                  <>
                    <div className={styles.kpiValue}>{soVuot}</div>
                    <div className={styles.kpiSub}>danh mục vượt kế hoạch</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Banner cố định chưa chi + sắp tới hạn (chỉ tháng hiện tại) */}
          {isCurrentMonth && chiPhiDuKien && chiPhiDuKien.conLaiCoDinh > 0 && (
            <div
              className="glass-card"
              style={{ padding: '0.6rem 0.9rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 1.1rem', fontSize: '0.85rem' }}
            >
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <CalendarDays size={14} style={{ flexShrink: 0, color: 'var(--brand-brown)' }} />
                Cố định chưa chi tháng này:{' '}
                <strong style={{ color: 'var(--text-main)' }}>~{formatVND(chiPhiDuKien.conLaiCoDinh)}</strong>
              </span>
              {chiPhiDuKien.sapToiHan > 0 && (
                <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  sắp tới hạn {chiPhiDuKien.soNgay} ngày: ~{formatVND(chiPhiDuKien.sapToiHan)}
                </span>
              )}
            </div>
          )}

          {/* CEO VISUAL DASHBOARD CHARTS */}
          <div className={styles.chartsGrid}>
            {/* Donut Chart */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div className={styles.cardHeader}>
                <Target size={18} style={{ color: 'var(--brand-accent)' }} />
                <h2>Cơ cấu thực chi theo Nhóm</h2>
              </div>
              {donutSegments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>
                  Chưa có chi phí thực tế trong tháng {thang}/{nam}
                </div>
              ) : (
                <div className={styles.donutWrapper}>
                  <svg width="100" height="100" viewBox="0 0 100 100" className={styles.donutSvg}>
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
                    {donutSegmentsWithOffsets.map((seg) => {
                      const strokeDasharray = `${(seg.percent / 100) * circumference} ${circumference}`;
                      const rotation = (seg.offset / 100) * 360;
                      return (
                        <circle
                          key={seg.id}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth={strokeWidth}
                          strokeDasharray={strokeDasharray}
                          transform={`rotate(${-90 + rotation} 50 50)`}
                          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                        />
                      );
                    })}
                  </svg>
                  <div className={styles.donutLegends}>
                    {donutSegmentsWithOffsets.map((seg) => (
                      <div key={seg.id} className={styles.legendRow}>
                        <div className={styles.legendLabelGroup}>
                          <div className={styles.legendColorBox} style={{ backgroundColor: seg.color }} />
                          <span>{seg.name}</span>
                        </div>
                        <span className={styles.legendPercent}>
                          {seg.percent.toFixed(0)}% ({Number(seg.amount).toLocaleString('vi-VN')} đ)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Diverging Bar Chart */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div className={styles.cardHeader}>
                <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
                <h2>Độ lệch Ngân sách (Thực tế - Kế hoạch)</h2>
              </div>
              {varianceData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 0' }}>
                  Chưa lập kế hoạch hoặc chi phí phát sinh
                </div>
              ) : (
                <div className={styles.varianceChart}>
                  {varianceData.map((d) => {
                    const widthPercent = (Math.abs(d.diff) / maxAbsoluteDiff) * 50;
                    const isOverspent = d.diff > 0;
                    const displayVal = (d.diff > 0 ? '+' : '') + Number(d.diff).toLocaleString('vi-VN') + ' đ';
                    
                    return (
                      <div key={d.id} className={styles.varianceRow}>
                        <div className={styles.varianceLabel} title={d.name}>{d.name}</div>
                        <div className={styles.varianceTrack}>
                          <div className={styles.varianceMidline} />
                          {d.diff !== 0 && (
                            <div 
                              className={`${styles.varianceBar} ${isOverspent ? styles.varianceBarPositive : styles.varianceBarNegative}`}
                              style={{ 
                                width: `${widthPercent}%`,
                                [isOverspent ? 'left' : 'right']: '50%'
                              }}
                            />
                          )}
                        </div>
                        <div className={styles.varianceVal} style={{ color: d.diff > 0 ? 'var(--alert-error-text)' : d.diff < 0 ? 'var(--alert-success-text)' : 'var(--text-muted)' }}>
                          {d.diff === 0 ? 'Cân bằng' : displayVal}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    <span>← Tiết kiệm (Xanh)</span>
                    <span>Vượt hạn mức (Đỏ) →</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BẢNG CHI TIẾT THEO DANH MỤC TRONG THÁNG */}
          <div className="glass-card">
            <div className={styles.cardHeader}>
              <Target size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2>Chi tiết theo Danh mục — Tháng {thang}/{nam}</h2>
            </div>
            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Danh mục</th>
                    <th style={{ textAlign: 'right' }}>Kế hoạch</th>
                    <th style={{ textAlign: 'right' }}>Thực chi</th>
                    <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                    <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCats.map((grp) => {
                    const gKH = grp.cats.reduce((s, c) => s + getKH(c.id, thang), 0);
                    const gTT = grp.cats.reduce((s, c) => s + getTT(c.id, thang), 0);
                    if (gKH === 0 && gTT === 0) return null;
                    const gp = gKH > 0 ? Math.round((gTT / gKH) * 100) : null;
                    return (
                      <React.Fragment key={grp.id}>
                        <tr style={{ background: 'rgba(99,102,241,0.06)', fontWeight: 700 }}>
                          <td>{grp.tenNhom}</td>
                          <td style={{ textAlign: 'right' }}>{gKH > 0 ? formatVND(gKH) : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{gTT > 0 ? formatVND(gTT) : '—'}</td>
                          <td style={{ textAlign: 'right', color: gTT - gKH > 0 ? '#ef4444' : '#34d399' }}>
                            {gKH > 0 ? (gTT - gKH > 0 ? '+' : '') + formatVND(gTT - gKH) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', color: gp === null ? 'var(--text-muted)' : costColor(gp) }}>{gp === null ? '—' : `${gp}%`}</td>
                          <td></td>
                        </tr>
                        {grp.cats.map((cat) => {
                          const kh = getKH(cat.id, thang);
                          const tt = getTT(cat.id, thang);
                          if (kh === 0 && tt === 0) return null;
                          const p = kh > 0 ? Math.round((tt / kh) * 100) : null;
                          const diff = tt - kh;
                          return (
                            <tr key={cat.id}>
                              <td style={{ paddingLeft: '1.5rem' }}>{cat.tenDanhMuc}</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{kh > 0 ? formatVND(kh) : '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{tt > 0 ? formatVND(tt) : '—'}</td>
                              <td style={{ textAlign: 'right', color: diff > 0 ? '#ef4444' : '#34d399', fontWeight: 600 }}>
                                {kh > 0 ? (diff > 0 ? '+' : '') + formatVND(diff) : '—'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {p !== null ? <span style={{ fontWeight: 700, color: costColor(p) }}>{p}%</span> : '—'}
                              </td>
                              <td>
                                {kh === 0 ? <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>Chưa lập KH</span>
                                  : p >= 100 ? <span className={styles.badgeRed}><AlertTriangle size={12} /> Vượt KH</span>
                                  : p >= 80 ? <span className={styles.badgeYellow}><AlertTriangle size={12} /> Sắp chạm</span>
                                  : <span className={styles.badgeGreen}><CheckCircle2 size={12} /> Trong KH</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)' }}>
                    <td>TỔNG THÁNG {thang}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(khThang)}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(ttThang)}</td>
                    <td style={{ textAlign: 'right', color: ttThang - khThang > 0 ? '#ef4444' : '#34d399' }}>
                      {khThang > 0 ? (ttThang - khThang > 0 ? '+' : '') + formatVND(ttThang - khThang) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: pct === null ? 'var(--text-muted)' : costColor(pct), fontWeight: 800 }}>{pct === null ? '—' : `${pct}%`}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
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
                <TrendingDown size={16} style={{ color: 'var(--danger)' }} /> Thực tế đã chi
              </div>
              <div className={styles.kpiValue} style={{ color: 'var(--danger)' }}>{formatVND(tongTTNam)}</div>
              <div className={styles.kpiSub}>
                {pct >= 100 ? (
                  <span style={{ color: 'var(--danger)' }}>▲ Vượt {pct - 100}% kế hoạch</span>
                ) : (
                  <span style={{ color: 'var(--success)' }}>Còn lại {formatVND(tongKHNam - tongTTNam)}</span>
                )}
              </div>
            </div>

            <div className={`glass-card ${styles.kpiCard}`}>
              <div className={styles.kpiLabel}>
                <BarChart3 size={16} style={{ color: 'var(--warning)' }} /> Tỉ lệ thực hiện năm
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
                  <TrendingUp size={16} style={{ color: 'var(--success)' }} /> Tháng {thangHienTai} hiện tại
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

          {/* BIỂU ĐỒ XU HƯỚNG CẢ NĂM */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div className={styles.cardHeader}>
              <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2>Biểu đồ Xu hướng Chi phí cả năm {nam}</h2>
            </div>
            
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendSwatch} style={{ backgroundColor: 'var(--chart-1)' }} />
                <span>Kế hoạch năm</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendSwatch} style={{ backgroundColor: 'var(--success)' }} />
                <span>Thực tế trong hạn mức (Xanh)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendSwatch} style={{ backgroundColor: 'var(--danger)' }} />
                <span>Thực tế vượt hạn mức (Đỏ)</span>
              </div>
            </div>

            <div className={styles.chartScroll}>
              <div className={styles.chart}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => {
                  const kh = tongKHThang(t);
                  const tt = tongTTThang(t);
                  
                  // Compute max for scaling
                  const maxVal = Math.max(...Array.from({ length: 12 }, (_, i) => i + 1).map(m => Math.max(tongKHThang(m), tongTTThang(m))), 1);
                  const heightKH = kh > 0 ? (kh / maxVal) * 100 : 0;
                  const heightTT = tt > 0 ? (tt / maxVal) * 100 : 0;
                  
                  const isCurrentMonth = new Date().getFullYear() === nam && new Date().getMonth() + 1 === t;

                  return (
                    <div key={t} className={styles.chartCol}>
                      <div className={styles.chartBars}>
                        <div 
                          className={`${styles.bar} ${styles.barKH}`} 
                          style={{ height: `${heightKH}%` }} 
                          title={`Kế hoạch: ${Number(kh).toLocaleString('vi-VN')} đ`}
                        />
                        <div 
                          className={styles.bar} 
                          style={{ 
                            height: `${heightTT}%`, 
                            backgroundColor: tt > kh ? 'var(--danger)' : 'var(--success)' 
                          }} 
                          title={`Thực chi: ${Number(tt).toLocaleString('vi-VN')} đ`}
                        />
                      </div>
                      <span 
                        className={styles.barLabel} 
                        style={isCurrentMonth ? { color: '#6366f1', fontWeight: 700 } : {}}
                      >
                        Tháng {t}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
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
                            <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>Chưa lập KH</span>
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
  const color = value >= 100 ? 'var(--danger)' : value >= 80 ? 'var(--warning)' : 'var(--success)';
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '6px', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{ width: `${capped}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s' }} />
    </div>
  );
}
