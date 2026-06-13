'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TableProperties,
  BarChart3,
  CalendarDays,
  Save,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Settings2,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Gauge,
  CalendarClock,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { canViewMenu } from '@/lib/roles';
import styles from './doanh-thu.module.css';

const THANG_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const formatVND = (num) => {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString('vi-VN');
};
const formatVNDFull = (num) => Number(num || 0).toLocaleString('vi-VN') + ' ₫';
const parseVND = (str) => {
  const clean = String(str).replace(/[^\d]/g, '');
  return clean === '' ? 0 : parseInt(clean, 10);
};

const daysInMonth = (nam, thang) => new Date(nam, thang, 0).getDate();

// Doanh thu: cao là tốt -> xanh ≥90%, vàng 70-89%, đỏ <70% (Dashboard Năm)
const pctColor = (p) => (p >= 90 ? '#34d399' : p >= 70 ? '#f59e0b' : '#ef4444');
// 4 mức theo yêu cầu Dashboard Tháng
const pctColor4 = (p) => (p >= 90 ? '#34d399' : p >= 70 ? '#f59e0b' : p >= 50 ? '#f87171' : '#ef4444');

export default function DoanhThuPage() {
  const router = useRouter();
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [view, setView] = useState('thang'); // 'thang' | 'nam' | 'nhap'
  const [nhapMode, setNhapMode] = useState('ngay'); // (OWNER) 'nam' = chỉ tiêu năm | 'ngay' = doanh thu ngày
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [kenhBan, setKenhBan] = useState([]);
  // maps năm: `${kenhBanId}_${thang}` -> số
  const [ctMap, setCtMap] = useState({});
  const [ttMap, setTtMap] = useState({});
  const [dirtyMap, setDirtyMap] = useState({}); // chỉ tiêu năm: key `c_${id}_${t}`

  // doanh thu ngày của tháng đang chọn: `${kenhBanId}_${day}` -> số
  const [dailyMap, setDailyMap] = useState({});
  const [dailyDirty, setDailyDirty] = useState({});
  const [dailyLoading, setDailyLoading] = useState(true);
  const [savingDaily, setSavingDaily] = useState(false);
  const [dailyMsg, setDailyMsg] = useState('');

  const [showKenhModal, setShowKenhModal] = useState(false);

  // Import States
  const [isImportYearlyOpen, setIsImportYearlyOpen] = useState(false);
  const [isImportDailyOpen, setIsImportDailyOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importParseError, setImportParseError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importSuccessCount, setImportSuccessCount] = useState(0);

  // Auth
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.authenticated) { router.push('/login'); return; }
        const u = data.user;
        if (!canViewMenu(u, 'doanhThu')) { toast.error('Bạn không có quyền truy cập.'); router.push('/'); return; }
        setUser(u);
        setIsOwner(u.role === 'OWNER');
        // Mở tab đầu tiên mà vai trò được phép xem (DB Tháng -> DB Năm -> Nhập số cho OWNER)
        const canThang = canViewMenu(u, 'doanhThuDBThang');
        const canNam = canViewMenu(u, 'doanhThuDBNam');
        setView(canThang ? 'thang' : canNam ? 'nam' : (u.role === 'OWNER' ? 'nhap' : 'thang'));
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // ── Dữ liệu năm (chỉ tiêu + thực tế đồng bộ) ──
  const fetchYear = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/doanh-thu?nam=${nam}`);
      const d = res.ok ? await res.json() : {};
      setKenhBan(d.kenhBan || []);
      const ct = {};
      const tt = {};
      (d.data || []).forEach((row) => {
        ct[`${row.kenhBanId}_${row.thang}`] = row.chiTieu || 0;
        tt[`${row.kenhBanId}_${row.thang}`] = row.thucTe || 0;
      });
      setCtMap(ct);
      setTtMap(tt);
      setDirtyMap({});
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  }, [nam]);

  // ── Doanh thu ngày của tháng đang chọn ──
  const fetchDaily = useCallback(async () => {
    setDailyLoading(true);
    try {
      const res = await fetch(`/api/doanh-thu/hang-ngay?nam=${nam}&thang=${thang}`);
      const d = res.ok ? await res.json() : {};
      const m = {};
      (d.data || []).forEach((row) => { m[`${row.kenhBanId}_${row.day}`] = row.soTien || 0; });
      setDailyMap(m);
      setDailyDirty({});
    } catch (e) {
      console.error(e);
    } finally {
      setDailyLoading(false);
    }
  }, [nam, thang]);

  useEffect(() => { if (!loading) fetchYear(); }, [loading, fetchYear]);
  useEffect(() => { if (!loading) fetchDaily(); }, [loading, fetchDaily]);

  const getCT = (id, t) => ctMap[`${id}_${t}`] || 0;
  const getTT = (id, t) => ttMap[`${id}_${t}`] || 0;
  const getDaily = (id, d) => dailyMap[`${id}_${d}`] || 0;

  // ── Sửa ô chỉ tiêu năm ──
  const handleCT = (id, t, value) => {
    const key = `${id}_${t}`;
    setCtMap((p) => ({ ...p, [key]: parseVND(value) }));
    setDirtyMap((p) => ({ ...p, [`c_${key}`]: true }));
  };

  const handleSaveYear = async () => {
    setSaving(true);
    setSaveMsg('');
    const items = [];
    kenhBan.forEach((k) => {
      for (let t = 1; t <= 12; t++) items.push({ kenhBanId: k.id, thang: t, chiTieu: getCT(k.id, t) });
    });
    try {
      const res = await fetch('/api/doanh-thu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, items }),
      });
      if (res.ok) {
        setSaveMsg('Đã lưu chỉ tiêu!');
        setDirtyMap({});
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        const e = await res.json().catch(() => ({}));
        setSaveMsg(e.error || 'Lỗi khi lưu, thử lại.');
      }
    } catch {
      setSaveMsg('Lỗi kết nối.');
    } finally {
      setSaving(false);
    }
  };

  // ── Sửa ô doanh thu ngày ──
  const handleDaily = (id, d, value) => {
    const key = `${id}_${d}`;
    setDailyMap((p) => ({ ...p, [key]: parseVND(value) }));
    setDailyDirty((p) => ({ ...p, [key]: true }));
  };

  const handleSaveDaily = async () => {
    setSavingDaily(true);
    setDailyMsg('');
    // Chỉ gửi các ô đã thay đổi (key = `${kenhBanId}_${day}`, kenhBanId là uuid không chứa "_")
    const items = Object.keys(dailyDirty)
      .filter((key) => dailyDirty[key])
      .map((key) => {
        const idx = key.lastIndexOf('_');
        const kenhBanId = key.slice(0, idx);
        const day = Number(key.slice(idx + 1));
        return { kenhBanId, day, soTien: getDaily(kenhBanId, day) };
      });
    if (items.length === 0) { setSavingDaily(false); return; }
    try {
      const res = await fetch('/api/doanh-thu/hang-ngay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, thang, items }),
      });
      if (res.ok) {
        setDailyMsg('Đã lưu doanh thu ngày!');
        setDailyDirty({});
        await fetchYear(); // làm mới thực tế đã đồng bộ
        setTimeout(() => setDailyMsg(''), 3000);
      } else {
        const e = await res.json().catch(() => ({}));
        setDailyMsg(e.error || 'Lỗi khi lưu, thử lại.');
      }
    } catch {
      setDailyMsg('Lỗi kết nối.');
    } finally {
      setSavingDaily(false);
    }
  };

  // ── Download & Import Excel (Chỉ tiêu Năm và Doanh thu Ngày) ──
  const handleDownloadYearlyTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['Kênh bán', ...THANG_LABELS];
      const rows = kenhBan.map(k => {
        const row = [k.tenKenh];
        for (let t = 1; t <= 12; t++) {
          const val = getCT(k.id, t);
          row.push(val > 0 ? val : 0);
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 18 }, ...Array(12).fill({ wch: 12 })];

      const refSheet = XLSX.utils.aoa_to_sheet([
        ['KÊNH BÁN HỢP LỆ (Copy chính xác tên vào cột "Kênh bán")'],
        ...kenhBan.map(k => [k.tenKenh])
      ]);
      refSheet['!cols'] = [{ wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Chỉ tiêu Doanh thu');
      XLSX.utils.book_append_sheet(wb, refSheet, 'KenhBan hợp lệ');

      XLSX.writeFile(wb, `mau-chi-tieu-doanh-thu-nam-${nam}.xlsx`);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được file mẫu.');
    }
  };

  const handleDownloadDailyTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['Ngày', ...kenhBan.map(k => k.tenKenh)];
      const ld = daysInMonth(nam, thang);
      const rows = [];
      for (let d = 1; d <= ld; d++) {
        const row = [d];
        kenhBan.forEach(k => {
          const val = getDaily(k.id, d);
          row.push(val > 0 ? val : 0);
        });
        rows.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 10 }, ...Array(kenhBan.length).fill({ wch: 15 })];

      const refSheet = XLSX.utils.aoa_to_sheet([
        ['KÊNH BÁN HỢP LỆ'],
        ...kenhBan.map(k => [k.tenKenh])
      ]);
      refSheet['!cols'] = [{ wch: 30 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Doanh thu T${thang}-${nam}`);
      XLSX.utils.book_append_sheet(wb, refSheet, 'KenhBan hợp lệ');

      XLSX.writeFile(wb, `mau-doanh-thu-ngay-thang-${thang}-${nam}.xlsx`);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được file mẫu.');
    }
  };

  const handleImportYearlyFile = async (e) => {
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
      const colKenh = headers.findIndex(h => h.includes('kênh bán') || h.includes('kenhban') || h.includes('kenh ban') || h.includes('kênh'));
      if (colKenh === -1) {
        setImportParseError('Không tìm thấy cột "Kênh bán".');
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
        const kenhBanVal = String(line[colKenh] || '').trim();
        if (!kenhBanVal) continue;

        const rowObj = { kenhBan: kenhBanVal };
        for (let t = 1; t <= 12; t++) {
          const colIdx = colThangs[t];
          if (colIdx !== undefined) {
            const rawVal = line[colIdx];
            rowObj[`T${t}`] = rawVal !== '' ? Number(rawVal) : 0;
          }
        }
        rows.push(rowObj);
      }

      const res = await fetch('/api/doanh-thu/import-chi-tieu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, rows }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult('success');
        setImportSuccessCount(data.successCount);
        fetchYear();
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

  const handleImportDailyFile = async (e) => {
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

      const headers = (aoa[0] || []).map(h => String(h || '').trim());
      const norm = (s) => String(s || '').trim().toLowerCase();
      const headersNorm = headers.map(norm);
      const colNgay = headersNorm.findIndex(h => h === 'ngày' || h === 'ngay' || h === 'day');
      if (colNgay === -1) {
        setImportParseError('Không tìm thấy cột "Ngày".');
        setImportLoading(false);
        return;
      }

      const rows = [];
      const ld = daysInMonth(nam, thang);
      for (let i = 1; i < aoa.length; i++) {
        const line = aoa[i];
        const ngayVal = parseInt(line[colNgay], 10);
        if (isNaN(ngayVal) || ngayVal < 1 || ngayVal > ld) {
          const hasAnyVal = line.some((val, colIdx) => colIdx !== colNgay && val !== '');
          if (!hasAnyVal) continue;
        }

        const rowObj = { ngay: line[colNgay] };
        headers.forEach((h, colIdx) => {
          if (colIdx === colNgay) return;
          const val = line[colIdx];
          if (val !== undefined && val !== null && val !== '') {
            rowObj[h] = val;
          }
        });
        rows.push(rowObj);
      }

      const res = await fetch('/api/doanh-thu/import-hang-ngay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam, thang, rows }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult('success');
        setImportSuccessCount(data.successCount);
        await fetchDaily();
        await fetchYear();
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

  // Tổng theo tháng (năm)
  const tongCTThang = (t) => kenhBan.reduce((s, k) => s + getCT(k.id, t), 0);
  const tongTTThang = (t) => kenhBan.reduce((s, k) => s + getTT(k.id, t), 0);
  const tongCTNam = MONTHS.reduce((s, t) => s + tongCTThang(t), 0);
  const tongTTNam = MONTHS.reduce((s, t) => s + tongTTThang(t), 0);

  const hasDirtyYear = Object.values(dirtyMap).some(Boolean);
  const hasDirtyDaily = Object.values(dailyDirty).some(Boolean);

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  // Quyền xem từng Dashboard (phân quyền tinh ở trang /quyen). OWNER luôn xem được.
  const canThang = canViewMenu(user, 'doanhThuDBThang');
  const canNam = canViewMenu(user, 'doanhThuDBNam');
  const noDashboard = !canThang && !canNam && !isOwner;

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Kế hoạch doanh thu</h1>
            <p className={styles.pageDesc}>
              {isOwner
                ? 'Lập chỉ tiêu, nhập doanh thu thực tế hàng ngày & theo dõi Dashboard Tháng / Năm'
                : 'Theo dõi tiến độ doanh thu theo Dashboard Tháng & Dashboard Năm'}
            </p>
          </div>
          <div className={styles.headerActions}>
            {/* Toggle Dashboard cho tất cả vai trò */}
            <div className={styles.viewToggle}>
              {canThang && (
                <button className={view === 'thang' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('thang')}>
                  <CalendarDays size={15} /> DB Tháng
                </button>
              )}
              {canNam && (
                <button className={view === 'nam' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('nam')}>
                  <BarChart3 size={15} /> DB Năm
                </button>
              )}
              {isOwner && (
                <button className={view === 'nhap' ? styles.toggleActive : styles.toggleBtn} onClick={() => setView('nhap')}>
                  <TableProperties size={15} /> Nhập số
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vai trò không được cấp Dashboard nào */}
        {noDashboard && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Bạn chưa được cấp quyền xem Dashboard doanh thu nào. Vui lòng liên hệ Chủ shop để được bật quyền.
          </div>
        )}

        {/* ── DASHBOARD THÁNG ── */}
        {canThang && view === 'thang' && (
          <>
            <div className={styles.periodBar}>
              <span className={styles.periodLabel}>Xem tháng:</span>
              <select className="form-control" style={{ width: 'auto' }} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
                {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
              </select>
              <select className="form-control" style={{ width: 'auto' }} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>Năm {y}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={fetchDaily} disabled={dailyLoading}>
                <RefreshCw size={14} /> Làm mới
              </button>
            </div>
            <DashboardThang
              kenhBan={kenhBan}
              getCT={getCT}
              getDaily={getDaily}
              nam={nam}
              thang={thang}
              loading={dataLoading || dailyLoading}
            />
          </>
        )}

        {/* ── DASHBOARD NĂM ── */}
        {canNam && view === 'nam' && (
          <>
            <div className={styles.periodBar}>
              <span className={styles.periodLabel}>Xem năm:</span>
              <select className="form-control" style={{ width: 'auto' }} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>Năm {y}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={fetchYear} disabled={dataLoading}>
                <RefreshCw size={14} /> Làm mới
              </button>
            </div>
            <DashboardNam
              kenhBan={kenhBan}
              getCT={getCT}
              getTT={getTT}
              tongCTThang={tongCTThang}
              tongTTThang={tongTTThang}
              tongCTNam={tongCTNam}
              tongTTNam={tongTTNam}
              dataLoading={dataLoading}
              nam={nam}
            />
          </>
        )}

        {/* ── BẢNG NHẬP SỐ (chỉ OWNER) ── */}
        {isOwner && view === 'nhap' && (
          <>
            <div className={styles.periodBar}>
              <div className={styles.subToggle}>
                <button className={nhapMode === 'ngay' ? styles.subToggleActive : styles.subToggleBtn} onClick={() => setNhapMode('ngay')}>
                  <CalendarDays size={14} /> Doanh thu ngày
                </button>
                <button className={nhapMode === 'nam' ? styles.subToggleActive : styles.subToggleBtn} onClick={() => setNhapMode('nam')}>
                  <Target size={14} /> Chỉ tiêu năm
                </button>
              </div>
              <div style={{ flex: 1 }} />
              {nhapMode === 'ngay' && (
                <select className="form-control" style={{ width: 'auto' }} value={thang} onChange={(e) => setThang(Number(e.target.value))}>
                  {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
              )}
              <select className="form-control" style={{ width: 'auto' }} value={nam} onChange={(e) => setNam(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>Năm {y}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={() => setShowKenhModal(true)}>
                <Settings2 size={14} /> Quản lý kênh
              </button>
            </div>

            {/* — Nhập chỉ tiêu năm — */}
            {nhapMode === 'nam' && (
              <>
                <div className={styles.toolbar}>
                  <span className={styles.toolbarInfo}>
                    {hasDirtyYear
                      ? <span style={{ color: 'var(--warning)' }}>● Có thay đổi chưa lưu</span>
                      : <span>Nhập <b style={{ color: '#a5b4fc' }}>Chỉ tiêu</b> từng tháng. <b style={{ color: '#6ee7b7' }}>Thực tế</b> tự tổng hợp từ doanh thu ngày.</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {saveMsg && <span style={{ color: saveMsg.includes('Đã lưu') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{saveMsg}</span>}
                    <button className="btn btn-secondary" onClick={handleDownloadYearlyTemplate}>
                      <Download size={14} /> Tải mẫu
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      setImportFileName('');
                      setImportParseError('');
                      setImportResult(null);
                      setImportErrors([]);
                      setIsImportYearlyOpen(true);
                    }}>
                      <Upload size={14} /> Nhập Excel
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveYear} disabled={saving || !hasDirtyYear}>
                      <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu chỉ tiêu'}
                    </button>
                  </div>
                </div>

                {dataLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                    {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeletonRow" />)}
                  </div>
                ) : kenhBan.length === 0 ? (
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có kênh bán nào. Nhấn <b>Quản lý kênh</b> để thêm.
                  </div>
                ) : (
                  <YearTable kenhBan={kenhBan} getCT={getCT} getTT={getTT} handleCT={handleCT} dirtyMap={dirtyMap}
                    tongCTThang={tongCTThang} tongTTThang={tongTTThang} tongCTNam={tongCTNam} tongTTNam={tongTTNam} />
                )}
              </>
            )}

            {/* — Nhập doanh thu ngày — */}
            {nhapMode === 'ngay' && (
              <>
                <div className={styles.toolbar}>
                  <span className={styles.toolbarInfo}>
                    {hasDirtyDaily
                      ? <span style={{ color: 'var(--warning)' }}>● Có thay đổi chưa lưu</span>
                      : <span>Nhập doanh thu từng <b style={{ color: '#6ee7b7' }}>ngày</b> của <b>Tháng {thang}/{nam}</b> theo từng kênh.</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {dailyMsg && <span style={{ color: dailyMsg.includes('Đã lưu') ? '#34d399' : '#f87171', fontSize: '0.85rem' }}>{dailyMsg}</span>}
                    <button className="btn btn-secondary" onClick={handleDownloadDailyTemplate}>
                      <Download size={14} /> Tải mẫu
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      setImportFileName('');
                      setImportParseError('');
                      setImportResult(null);
                      setImportErrors([]);
                      setIsImportDailyOpen(true);
                    }}>
                      <Upload size={14} /> Nhập Excel
                    </button>
                    <button className="btn btn-secondary" onClick={fetchDaily} disabled={dailyLoading}>
                      <RefreshCw size={14} /> Làm mới
                    </button>
                    <button className="btn btn-primary" onClick={handleSaveDaily} disabled={savingDaily || !hasDirtyDaily}>
                      <Save size={14} /> {savingDaily ? 'Đang lưu...' : 'Lưu doanh thu'}
                    </button>
                  </div>
                </div>

                {dailyLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                    {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeletonRow" />)}
                  </div>
                ) : kenhBan.length === 0 ? (
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có kênh bán nào. Nhấn <b>Quản lý kênh</b> để thêm.
                  </div>
                ) : (
                  <DailyGrid kenhBan={kenhBan} getDaily={getDaily} handleDaily={handleDaily} dailyDirty={dailyDirty} nam={nam} thang={thang} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {showKenhModal && (
        <KenhModal kenhBan={kenhBan} onClose={() => setShowKenhModal(false)} onChanged={fetchYear} />
      )}

      {isImportYearlyOpen && (
        <div className={styles.modalOverlay} onClick={() => { if (!importLoading) setIsImportYearlyOpen(false); }}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nhập chỉ tiêu doanh thu năm {nam}</h2>
              <button className={styles.modalClose} onClick={() => setIsImportYearlyOpen(false)} disabled={importLoading}><X size={20} /></button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <button type="button" onClick={handleDownloadYearlyTemplate} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <Download size={16} /> <span>Tải file Excel mẫu</span>
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Chọn file Excel (.xlsx) đã điền chỉ tiêu</label>
              <label className={styles.uploadBox}>
                <FileSpreadsheet size={32} style={{ color: '#6366f1' }} />
                <span style={{ fontWeight: '600' }}>
                  {importFileName ? `📄 ${importFileName}` : 'Bấm để chọn file .xlsx'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Hệ thống sẽ cập nhật tự động chỉ tiêu 12 tháng của các kênh bán
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportYearlyFile}
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
                  Đã nhập thành công! Cập nhật <strong>{importSuccessCount}</strong> bản ghi chỉ tiêu.
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
              <button className="btn btn-secondary" onClick={() => setIsImportYearlyOpen(false)} disabled={importLoading}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {isImportDailyOpen && (
        <div className={styles.modalOverlay} onClick={() => { if (!importLoading) setIsImportDailyOpen(false); }}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Nhập doanh thu ngày - Tháng {thang}/{nam}</h2>
              <button className={styles.modalClose} onClick={() => setIsImportDailyOpen(false)} disabled={importLoading}><X size={20} /></button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <button type="button" onClick={handleDownloadDailyTemplate} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                <Download size={16} /> <span>Tải file Excel mẫu (Tháng {thang}/{nam})</span>
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Chọn file Excel (.xlsx) đã điền doanh thu ngày</label>
              <label className={styles.uploadBox}>
                <FileSpreadsheet size={32} style={{ color: 'var(--success)' }} />
                <span style={{ fontWeight: '600' }}>
                  {importFileName ? `📄 ${importFileName}` : 'Bấm để chọn file .xlsx'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Hệ thống sẽ cập nhật doanh thu hàng ngày cho các kênh bán
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportDailyFile}
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
                  Đã nhập thành công! Cập nhật <strong>{importSuccessCount}</strong> bản ghi doanh thu.
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
              <button className="btn btn-secondary" onClick={() => setIsImportDailyOpen(false)} disabled={importLoading}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── DASHBOARD THÁNG ──────────────── */
function DashboardThang({ kenhBan, getCT, getDaily, nam, thang, loading }) {
  const ld = daysInMonth(nam, thang);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === nam && now.getMonth() + 1 === thang;
  const isPast = nam < now.getFullYear() || (nam === now.getFullYear() && thang < now.getMonth() + 1);
  const daysPassed = isCurrentMonth ? now.getDate() : isPast ? ld : 0;

  const chiTieuThang = kenhBan.reduce((s, k) => s + getCT(k.id, thang), 0);
  const dayTotal = (d) => kenhBan.reduce((s, k) => s + getDaily(k.id, d), 0);
  const days = Array.from({ length: ld }, (_, i) => i + 1);
  const thucTeThang = days.reduce((s, d) => s + dayTotal(d), 0);

  const pct = chiTieuThang > 0 ? Math.round((thucTeThang / chiTieuThang) * 1000) / 10 : null;
  const duDoan = daysPassed > 0 ? Math.round((thucTeThang / daysPassed) * ld) : 0;

  // Ngày cao nhất
  let maxDay = 0, maxVal = 0;
  days.forEach((d) => { const v = dayTotal(d); if (v > maxVal) { maxVal = v; maxDay = d; } });

  const chartMax = Math.max(1, ...days.map(dayTotal));

  // Xếp hạng kênh theo thực tế tháng
  const kenhStats = kenhBan
    .map((k) => ({ ...k, tt: days.reduce((s, d) => s + getDaily(k.id, d), 0), ct: getCT(k.id, thang) }))
    .map((k) => ({ ...k, pct: k.ct > 0 ? Math.round((k.tt / k.ct) * 1000) / 10 : null }))
    .sort((a, b) => b.tt - a.tt);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
  }

  const pctText = pct === null ? '—' : `${pct}%`;
  const pctCol = pct === null ? 'var(--text-muted)' : pctColor4(pct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><Target size={16} style={{ color: '#6366f1' }} /> Chỉ tiêu tháng {thang}</div>
          <div className={styles.kpiValue} style={{ color: '#6366f1' }}>{formatVNDFull(chiTieuThang)}</div>
          <div className={styles.kpiSub}>Mục tiêu doanh thu tháng</div>
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><TrendingUp size={16} style={{ color: 'var(--success)' }} /> Thực tế đạt</div>
          <div className={styles.kpiValue} style={{ color: 'var(--success)' }}>{formatVNDFull(thucTeThang)}</div>
          <div className={styles.kpiSub}>
            {chiTieuThang > 0
              ? (thucTeThang < chiTieuThang
                  ? <span style={{ color: 'var(--warning)' }}>Còn thiếu {formatVNDFull(chiTieuThang - thucTeThang)}</span>
                  : <span style={{ color: 'var(--success)' }}>▲ Vượt {formatVNDFull(thucTeThang - chiTieuThang)}</span>)
              : 'Cộng dồn doanh thu các ngày'}
          </div>
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><Gauge size={16} style={{ color: 'var(--warning)' }} /> Tỉ lệ hoàn thành</div>
          <div className={styles.kpiValue} style={{ color: pctCol }}>{pctText}</div>
          {pct !== null ? <ProgressBar value={pct} color4 /> : <div className={styles.kpiSub}>Chưa lập chỉ tiêu tháng</div>}
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><CalendarClock size={16} style={{ color: '#a78bfa' }} /> Dự đoán cuối tháng</div>
          <div className={styles.kpiValue} style={{ color: '#a78bfa', fontSize: '1.35rem' }}>
            {daysPassed > 0 ? formatVNDFull(duDoan) : '—'}
          </div>
          <div className={styles.kpiSub}>
            {daysPassed > 0
              ? `Dựa trên ${daysPassed}/${ld} ngày${chiTieuThang > 0 ? ` · ${Math.round((duDoan / chiTieuThang) * 100)}% chỉ tiêu` : ''}`
              : 'Tháng chưa bắt đầu'}
          </div>
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><Trophy size={16} style={{ color: '#fbbf24' }} /> Ngày cao nhất</div>
          <div className={styles.kpiValue} style={{ color: '#fbbf24', fontSize: '1.35rem' }}>
            {maxVal > 0 ? `Ngày ${maxDay}` : '—'}
          </div>
          <div className={styles.kpiSub}>{maxVal > 0 ? formatVNDFull(maxVal) : 'Chưa có doanh thu'}</div>
        </div>
      </div>

      {/* BIỂU ĐỒ DOANH THU TỪNG NGÀY */}
      <div className="glass-card">
        <div className={styles.cardHeader}>
          <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
          <h2>Doanh thu theo ngày — Tháng {thang}/{nam}</h2>
        </div>
        {thucTeThang === 0 ? (
          <div className={styles.loaderSmall}>Chưa có doanh thu ngày nào trong tháng này.</div>
        ) : (
          <div className={styles.chartScroll}>
            <div className={styles.dayChart} style={{ minWidth: `${ld * 26}px` }}>
              {days.map((d) => {
                const v = dayTotal(d);
                const isToday = isCurrentMonth && d === now.getDate();
                return (
                  <div key={d} className={styles.dayCol}>
                    <div className={styles.dayBarWrap}>
                      <div
                        className={styles.dayBar}
                        style={{
                          height: `${(v / chartMax) * 100}%`,
                          background: d === maxDay && maxVal > 0 ? '#fbbf24' : '#10b981',
                          opacity: v === 0 ? 0.15 : 1,
                        }}
                        title={`Ngày ${d}: ${formatVNDFull(v)}`}
                      />
                    </div>
                    <span className={styles.dayLabel} style={isToday ? { color: '#6366f1', fontWeight: 700 } : {}}>{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className={styles.chartLegend} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#10b981' }} /> Doanh thu ngày</span>
          <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#fbbf24' }} /> Ngày cao nhất</span>
        </div>
      </div>

      {/* XẾP HẠNG KÊNH TRONG THÁNG */}
      <div className="glass-card">
        <div className={styles.cardHeader}>
          <Trophy size={18} style={{ color: 'var(--brand-accent)' }} />
          <h2>Xếp hạng kênh bán — Tháng {thang}/{nam}</h2>
        </div>
        <div className="table-responsive">
          <table className="custom-table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>#</th>
                <th>Kênh bán</th>
                <th style={{ textAlign: 'right' }}>Chỉ tiêu</th>
                <th style={{ textAlign: 'right' }}>Thực tế</th>
                <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                <th style={{ minWidth: 130 }}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {kenhStats.map((k, i) => (
                <tr key={k.id}>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`${styles.rankBadge} ${i === 0 && k.tt > 0 ? styles.rankTop : ''}`}>{i + 1}</span>
                  </td>
                  <td><span className={styles.kenhDot} style={{ background: k.mauSac || '#6366f1' }} />{k.tenKenh}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{k.ct > 0 ? formatVNDFull(k.ct) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{k.tt > 0 ? formatVNDFull(k.tt) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {k.pct !== null ? <span style={{ fontWeight: 700, color: pctColor4(k.pct) }}>{k.pct}%</span> : '—'}
                  </td>
                  <td>
                    {k.ct > 0 ? <ProgressBar value={k.pct} color4 /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa lập chỉ tiêu</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)' }}>
                <td></td>
                <td>TỔNG THÁNG</td>
                <td style={{ textAlign: 'right' }}>{formatVNDFull(chiTieuThang)}</td>
                <td style={{ textAlign: 'right' }}>{formatVNDFull(thucTeThang)}</td>
                <td style={{ textAlign: 'center', color: pctCol, fontWeight: 800 }}>{pctText}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── DASHBOARD NĂM ──────────────── */
function DashboardNam({ kenhBan, getCT, getTT, tongCTThang, tongTTThang, tongCTNam, tongTTNam, dataLoading, nam }) {
  const pct = tongCTNam > 0 ? Math.round((tongTTNam / tongCTNam) * 1000) / 10 : 0;
  const thangHienTai = new Date().getFullYear() === nam ? new Date().getMonth() + 1 : null;

  const kenhStats = kenhBan
    .map((k) => {
      const ct = MONTHS.reduce((s, t) => s + getCT(k.id, t), 0);
      const tt = MONTHS.reduce((s, t) => s + getTT(k.id, t), 0);
      return { ...k, ct, tt, pct: ct > 0 ? Math.round((tt / ct) * 1000) / 10 : null };
    })
    .sort((a, b) => b.tt - a.tt);
  const topKenh = kenhStats[0];

  const chartMax = Math.max(1, ...MONTHS.map((t) => Math.max(tongCTThang(t), tongTTThang(t))));

  if (dataLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><Target size={16} style={{ color: '#6366f1' }} /> Tổng chỉ tiêu năm {nam}</div>
          <div className={styles.kpiValue} style={{ color: '#6366f1' }}>{formatVNDFull(tongCTNam)}</div>
          <div className={styles.kpiSub}>Mục tiêu doanh thu đã lập</div>
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><TrendingUp size={16} style={{ color: 'var(--success)' }} /> Tổng thực tế đạt</div>
          <div className={styles.kpiValue} style={{ color: 'var(--success)' }}>{formatVNDFull(tongTTNam)}</div>
          <div className={styles.kpiSub}>
            {tongCTNam > 0 && tongTTNam < tongCTNam ? (
              <span style={{ color: 'var(--warning)' }}>Còn thiếu {formatVNDFull(tongCTNam - tongTTNam)}</span>
            ) : tongCTNam > 0 ? (
              <span style={{ color: 'var(--success)' }}>▲ Vượt {formatVNDFull(tongTTNam - tongCTNam)}</span>
            ) : '—'}
          </div>
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><BarChart3 size={16} style={{ color: 'var(--warning)' }} /> Tỉ lệ hoàn thành năm</div>
          <div className={styles.kpiValue} style={{ color: pctColor(pct) }}>{pct}%</div>
          <ProgressBar value={pct} />
        </div>

        <div className={`glass-card ${styles.kpiCard}`}>
          <div className={styles.kpiLabel}><Trophy size={16} style={{ color: '#fbbf24' }} /> Kênh dẫn đầu</div>
          <div className={styles.kpiValue} style={{ color: '#fbbf24', fontSize: '1.25rem' }}>
            {topKenh && topKenh.tt > 0 ? topKenh.tenKenh : '—'}
          </div>
          <div className={styles.kpiSub}>
            {topKenh && topKenh.tt > 0 ? formatVNDFull(topKenh.tt) : 'Chưa có dữ liệu thực tế'}
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ CỘT 12 THÁNG */}
      <div className="glass-card">
        <div className={styles.cardHeader}>
          <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
          <h2>Biểu đồ Chỉ tiêu vs Thực tế — 12 tháng</h2>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#6366f1' }} /> Chỉ tiêu</span>
          <span className={styles.legendItem}><span className={styles.legendSwatch} style={{ background: '#10b981' }} /> Thực tế</span>
        </div>
        <div className={styles.chartScroll}>
          <div className={styles.chart}>
            {MONTHS.map((t) => {
              const ct = tongCTThang(t);
              const tt = tongTTThang(t);
              return (
                <div key={t} className={styles.chartCol}>
                  <div className={styles.chartBars}>
                    <div className={`${styles.bar} ${styles.barKH}`} style={{ height: `${(ct / chartMax) * 100}%` }}
                      title={`Chỉ tiêu T${t}: ${formatVNDFull(ct)}`} />
                    <div className={`${styles.bar} ${styles.barTT}`} style={{ height: `${(tt / chartMax) * 100}%` }}
                      title={`Thực tế T${t}: ${formatVNDFull(tt)}`} />
                  </div>
                  <span className={styles.chartLabel} style={thangHienTai === t ? { color: '#6366f1', fontWeight: 700 } : {}}>T{t}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BẢNG ĐỐI SOÁT THEO THÁNG */}
      <div className="glass-card">
        <div className={styles.cardHeader}>
          <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
          <h2>Đối soát theo tháng</h2>
        </div>
        <div className="table-responsive">
          <table className="custom-table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Tháng</th>
                <th style={{ textAlign: 'right' }}>Chỉ tiêu</th>
                <th style={{ textAlign: 'right' }}>Thực tế</th>
                <th style={{ textAlign: 'right' }}>Chênh lệch</th>
                <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((t) => {
                const ct = tongCTThang(t);
                const tt = tongTTThang(t);
                const diff = tt - ct;
                const p = ct > 0 ? Math.round((tt / ct) * 1000) / 10 : null;
                const cur = thangHienTai === t;
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth() + 1;
                const isFuture = nam > currentYear || (nam === currentYear && t > currentMonth);
                return (
                  <tr key={t} style={cur ? { background: 'rgba(99,102,241,0.08)' } : {}}>
                    <td style={{ fontWeight: cur ? 700 : 400 }}>
                      Tháng {t} {cur && <span style={{ color: '#6366f1', fontSize: '0.75rem' }}>(hiện tại)</span>}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{ct > 0 ? formatVNDFull(ct) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{tt > 0 ? formatVNDFull(tt) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: isFuture ? 'var(--text-muted)' : (diff >= 0 ? '#34d399' : '#ef4444') }}>
                      {isFuture ? '—' : (ct > 0 || tt > 0 ? (diff >= 0 ? '+' : '') + formatVNDFull(diff) : '—')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isFuture ? '—' : (p !== null ? <span style={{ fontWeight: 700, color: pctColor(p) }}>{p}%</span> : '—')}
                    </td>
                    <td>
                      {ct === 0 && tt === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Chưa có dữ liệu</span>
                      ) : p === null ? (
                        <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>Chưa lập chỉ tiêu</span>
                      ) : isFuture ? (
                        <span className={styles.badgeGray}><Clock size={12} /> Kế hoạch</span>
                      ) : cur ? (
                        <span className={styles.badgeBlue}><Activity size={12} /> Đang chạy ({p}%)</span>
                      ) : p >= 100 ? (
                        <span className={styles.badgeGreen}><CheckCircle2 size={12} /> Vượt chỉ tiêu</span>
                      ) : p >= 90 ? (
                        <span className={styles.badgeGreen}><CheckCircle2 size={12} /> Đạt tốt</span>
                      ) : p >= 70 ? (
                        <span className={styles.badgeYellow}><AlertTriangle size={12} /> Cần cố gắng</span>
                      ) : p >= 50 ? (
                        <span className={styles.badgeRed}><AlertTriangle size={12} /> Không đạt</span>
                      ) : (
                        <span className={styles.badgeAlarm}><AlertTriangle size={12} className={styles.pulseIcon} /> Báo động</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'rgba(255,255,255,0.04)' }}>
                <td>TỔNG NĂM</td>
                <td style={{ textAlign: 'right' }}>{formatVNDFull(tongCTNam)}</td>
                <td style={{ textAlign: 'right' }}>{formatVNDFull(tongTTNam)}</td>
                <td style={{ textAlign: 'right', color: tongTTNam - tongCTNam >= 0 ? '#34d399' : '#ef4444' }}>
                  {tongCTNam > 0 || tongTTNam > 0 ? (tongTTNam - tongCTNam >= 0 ? '+' : '') + formatVNDFull(tongTTNam - tongCTNam) : '—'}
                </td>
                <td style={{ textAlign: 'center', color: pctColor(pct), fontWeight: 800 }}>{pct}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* BẢNG XẾP HẠNG THEO KÊNH */}
      <div className="glass-card">
        <div className={styles.cardHeader}>
          <Trophy size={18} style={{ color: 'var(--brand-accent)' }} />
          <h2>Xếp hạng theo kênh bán — Lũy kế năm {nam}</h2>
        </div>
        <div className="table-responsive">
          <table className="custom-table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>#</th>
                <th>Kênh bán</th>
                <th style={{ textAlign: 'right' }}>Chỉ tiêu</th>
                <th style={{ textAlign: 'right' }}>Thực tế</th>
                <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                <th style={{ minWidth: 130 }}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {kenhStats.map((k, i) => (
                <tr key={k.id}>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`${styles.rankBadge} ${i === 0 && k.tt > 0 ? styles.rankTop : ''}`}>{i + 1}</span>
                  </td>
                  <td>
                    <span className={styles.kenhDot} style={{ background: k.mauSac || '#6366f1' }} />
                    {k.tenKenh}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{k.ct > 0 ? formatVNDFull(k.ct) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{k.tt > 0 ? formatVNDFull(k.tt) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {k.pct !== null ? <span style={{ fontWeight: 700, color: pctColor(k.pct) }}>{k.pct}%</span> : '—'}
                  </td>
                  <td>
                    {k.ct > 0 ? <ProgressBar value={k.pct} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa lập chỉ tiêu</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── BẢNG NHẬP CHỈ TIÊU NĂM ──────────────── */
function YearTable({ kenhBan, getCT, getTT, handleCT, dirtyMap, tongCTThang, tongTTThang, tongCTNam, tongTTNam }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.spreadsheet}>
        <thead>
          <tr>
            <th className={styles.colKenh}>Kênh bán</th>
            <th className={styles.colLoai}>Loại</th>
            {THANG_LABELS.map((t) => <th key={t} className={styles.colThang}>{t}</th>)}
            <th className={styles.colTotal}>Cả năm</th>
          </tr>
        </thead>
        <tbody>
          {kenhBan.map((k) => {
            const ctNam = MONTHS.reduce((s, t) => s + getCT(k.id, t), 0);
            const ttNam = MONTHS.reduce((s, t) => s + getTT(k.id, t), 0);
            return (
              <React.Fragment key={k.id}>
                {/* Dòng Chỉ tiêu (nhập tay) */}
                <tr className={styles.rowChiTieu}>
                  <td className={styles.kenhLabel} rowSpan={2}>
                    <span className={styles.kenhDot} style={{ background: k.mauSac || '#6366f1' }} />
                    {k.tenKenh}
                  </td>
                  <td className={styles.loaiChiTieu}>Chỉ tiêu</td>
                  {MONTHS.map((t) => (
                    <td key={t} className={`${styles.inputCell} ${dirtyMap[`c_${k.id}_${t}`] ? styles.dirty : ''}`}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.cellInput}
                        value={getCT(k.id, t) > 0 ? formatVND(getCT(k.id, t)) : ''}
                        placeholder="—"
                        onChange={(e) => handleCT(k.id, t, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className={styles.rowTotalCell}>{ctNam > 0 ? formatVND(ctNam) : '—'}</td>
                </tr>
                {/* Dòng Thực tế (read-only, đồng bộ từ doanh thu ngày) */}
                <tr className={styles.rowThucTe}>
                  <td className={styles.loaiThucTe}>Thực tế</td>
                  {MONTHS.map((t) => (
                    <td key={t} className={styles.readCell}>
                      {getTT(k.id, t) > 0 ? formatVND(getTT(k.id, t)) : '—'}
                    </td>
                  ))}
                  <td className={styles.rowTotalCell}>{ttNam > 0 ? formatVND(ttNam) : '—'}</td>
                </tr>
              </React.Fragment>
            );
          })}

          <tr className={styles.totalRow}>
            <td className={styles.totalLabel} style={{ color: '#c7d2fe' }} colSpan={2}>TỔNG CHỈ TIÊU</td>
            {MONTHS.map((t) => (
              <td key={t} className={styles.totalCell} style={{ color: '#c7d2fe' }}>
                {tongCTThang(t) > 0 ? formatVND(tongCTThang(t)) : '—'}
              </td>
            ))}
            <td className={styles.totalCell} style={{ color: '#c7d2fe' }}>{formatVND(tongCTNam)}</td>
          </tr>
          <tr className={styles.totalRowTT}>
            <td className={styles.totalLabel} style={{ color: '#6ee7b7' }} colSpan={2}>TỔNG THỰC TẾ</td>
            {MONTHS.map((t) => (
              <td key={t} className={styles.totalCell} style={{ color: '#6ee7b7' }}>
                {tongTTThang(t) > 0 ? formatVND(tongTTThang(t)) : '—'}
              </td>
            ))}
            <td className={styles.totalCell} style={{ color: '#6ee7b7' }}>{formatVND(tongTTNam)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ──────────────── LƯỚI NHẬP DOANH THU NGÀY ──────────────── */
function DailyGrid({ kenhBan, getDaily, handleDaily, dailyDirty, nam, thang }) {
  const ld = daysInMonth(nam, thang);
  const days = Array.from({ length: ld }, (_, i) => i + 1);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === nam && now.getMonth() + 1 === thang;

  const tongNgay = (d) => kenhBan.reduce((s, k) => s + getDaily(k.id, d), 0);
  const tongKenh = (id) => days.reduce((s, d) => s + getDaily(id, d), 0);
  const tongTatCa = kenhBan.reduce((s, k) => s + tongKenh(k.id), 0);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.dailySheet}>
        <thead>
          <tr>
            <th className={styles.colKenhSticky}>Kênh bán \ Ngày</th>
            {days.map((d) => (
              <th key={d} className={styles.colDay} style={isCurrentMonth && d === now.getDate() ? { color: '#6366f1' } : {}}>{d}</th>
            ))}
            <th className={styles.colTotal}>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {kenhBan.map((k) => (
            <tr key={k.id}>
              <td className={styles.kenhSticky}>
                <span className={styles.kenhDot} style={{ background: k.mauSac || '#6366f1' }} />
                {k.tenKenh}
              </td>
              {days.map((d) => (
                <td key={d} className={`${styles.inputCell} ${dailyDirty[`${k.id}_${d}`] ? styles.dirty : ''}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.cellInput}
                    value={getDaily(k.id, d) > 0 ? formatVND(getDaily(k.id, d)) : ''}
                    placeholder="—"
                    onChange={(e) => handleDaily(k.id, d, e.target.value)}
                  />
                </td>
              ))}
              <td className={styles.rowTotalCell}>{tongKenh(k.id) > 0 ? formatVND(tongKenh(k.id)) : '—'}</td>
            </tr>
          ))}
          <tr className={styles.totalRowTT}>
            <td className={styles.totalLabel} style={{ color: '#0f9d6b', position: 'sticky', left: 0, zIndex: 1, background: '#e3f5ee' }}>TỔNG NGÀY</td>
            {days.map((d) => (
              <td key={d} className={styles.totalCell} style={{ color: '#0f9d6b' }}>{tongNgay(d) > 0 ? formatVND(tongNgay(d)) : '—'}</td>
            ))}
            <td className={styles.totalCell} style={{ color: '#0f9d6b' }}>{formatVND(tongTatCa)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value, color4 }) {
  const capped = Math.min(Math.max(value, 0), 100);
  const col = color4 ? pctColor4(value) : pctColor(value);
  return (
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${capped}%`, background: col }} />
    </div>
  );
}

/* ──────────────── MODAL QUẢN LÝ KÊNH ──────────────── */
function KenhModal({ kenhBan, onClose, onChanged }) {
  const showConfirm = useConfirm();
  const [list, setList] = useState(kenhBan);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    const res = await fetch('/api/kenh-ban');
    if (res.ok) { const d = await res.json(); setList(d.kenhBan || []); }
    onChanged?.();
  };

  const addKenh = async () => {
    if (!newName.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/kenh-ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenKenh: newName.trim(), mauSac: newColor }),
      });
      if (res.ok) { setNewName(''); await refresh(); }
      else { const e = await res.json().catch(() => ({})); setMsg(e.error || 'Lỗi khi thêm.'); }
    } finally { setBusy(false); }
  };

  const updateColor = async (k, color) => {
    setList((p) => p.map((x) => (x.id === k.id ? { ...x, mauSac: color } : x)));
    await fetch(`/api/kenh-ban/${k.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mauSac: color }),
    });
    onChanged?.();
  };

  const delKenh = async (k) => {
    const ok = await showConfirm({ message: `Xoá/ẩn kênh "${k.tenKenh}"?\n(Nếu kênh đã có số liệu, hệ thống sẽ ẩn để giữ lịch sử.)`, confirmLabel: 'Xóa kênh', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kenh-ban/${k.id}`, { method: 'DELETE' });
      if (res.ok) await refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Quản lý kênh bán</h2>
          <button className={styles.modalClose} onClick={onClose}><X size={20} /></button>
        </div>

        {list.map((k) => (
          <div key={k.id} className={styles.kenhRow}>
            <input
              type="color"
              className={styles.colorInput}
              value={k.mauSac || '#6366f1'}
              onChange={(e) => updateColor(k, e.target.value)}
              title="Đổi màu cột biểu đồ"
            />
            <span className={styles.kenhRowName}>{k.tenKenh}</span>
            <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => delKenh(k)} disabled={busy} title="Xoá / ẩn kênh">
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div className={styles.addKenhRow}>
          <input type="color" className={styles.colorInput} value={newColor} onChange={(e) => setNewColor(e.target.value)} />
          <input
            className="form-control"
            style={{ flex: 1 }}
            placeholder="Tên kênh bán mới (vd: TikTok Shop)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKenh()}
          />
          <button className="btn btn-primary" onClick={addKenh} disabled={busy || !newName.trim()}>
            <Plus size={14} /> Thêm
          </button>
        </div>
        {msg && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{msg}</p>}
      </div>
    </div>
  );
}
