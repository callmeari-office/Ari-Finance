'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Layers,
  PieChart,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  Scale,
  Mail,
  Eye,
  Send,
  Printer,
  Users,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { getInitials, getAvatarColor } from '@/lib/avatar';
import FilterDropdown from '@/components/FilterDropdown';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/date';
import styles from './bao-cao.module.css';

export default function BaoCaoThuChiPage() {
  const router = useRouter();
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core Data States
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filter States (arrays = multi-select, string = single)
  const [filterNam, setFilterNam] = useState(String(new Date().getFullYear()));
  const [filterThang, setFilterThang] = useState([String(new Date().getMonth() + 1)]);
  const [filterNhom, setFilterNhom] = useState([]);
  const [filterDanhMuc, setFilterDanhMuc] = useState([]);

  // Pagination & stats states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [tongThu, setTongThu] = useState(0);
  const [tongThuUocTinh, setTongThuUocTinh] = useState(false);
  const [tongChi, setTongChi] = useState(0);
  const [netCashflow, setNetCashflow] = useState(0);
  const [tileChiThu, setTileChiThu] = useState(0);
  const [sortedChiGroups, setSortedChiGroups] = useState([]);
  const [sortedThuGroups, setSortedThuGroups] = useState([]);
  const [sortedChiCats, setSortedChiCats] = useState([]);
  const [sortedThuCats, setSortedThuCats] = useState([]);
  const [sortedChiNguoi, setSortedChiNguoi] = useState([]);

  const [loiNhuanData, setLoiNhuanData] = useState(null);
  const [loiNhuanLoading, setLoiNhuanLoading] = useState(false);

  const [chiPhiDuKien, setChiPhiDuKien] = useState(null);

  // Lá thư ARI — state gửi thư tháng (chỉ OWNER)
  const [letterThang, setLetterThang] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getMonth() + 1; // tháng trước
  });
  const [letterNam, setLetterNam] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear();
  });
  const [letterSending, setLetterSending] = useState(false);
  const [letterResult, setLetterResult] = useState(null);

  // Chi phí dự kiến cả tháng (khoản cố định/chờ trả còn lại) — chỉ tải khi đã có user
  useEffect(() => {
    if (!user) return;
    fetch('/api/chi-phi-du-kien')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setChiPhiDuKien(d); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    // 1. Kiểm tra session & vai trò (Chỉ OWNER/MANAGER được vào dựa trên permissions)
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
          // Báo cáo Thu - Chi map với key "baoCao" hoặc default cho Owner/Manager
          const hasPermission = data.user.permissions?.baoCao || data.user.role === 'OWNER' || data.user.role === 'MANAGER';
          if (!hasPermission) {
            toast.error('Bạn không có quyền truy cập trang Báo cáo Thu - Chi.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch static config
          fetchStaticConfig();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchData = async (page = currentPage) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('includeHistory', 'true');
      params.append('page', String(page));
      params.append('limit', '20');
      if (filterNam) params.append('nam', filterNam);
      if (filterThang.length > 0) params.append('thang', filterThang.join(','));
      if (filterNhom.length > 0) params.append('nhomChiPhiId', filterNhom.join(','));
      if (filterDanhMuc.length > 0) params.append('danhMucId', filterDanhMuc.join(','));

      const txRes = await fetch(`/api/thu-chi?${params.toString()}`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
        if (txData.pagination) {
          setTotalPages(txData.pagination.totalPages || 1);
          setTotalCount(txData.pagination.total || 0);
        }
        if (txData.stats) {
          setTongThu(txData.stats.tongThu || 0);
          setTongThuUocTinh(txData.stats.tongThuUocTinh || false);
          setTongChi(txData.stats.tongChi || 0);
          setNetCashflow(txData.stats.netCashflow || 0);
          setTileChiThu(txData.stats.tileChiThu || 0);
          setSortedChiGroups(txData.stats.sortedChiGroups || []);
          setSortedThuGroups(txData.stats.sortedThuGroups || []);
          setSortedChiCats(txData.stats.sortedChiCats || []);
          setSortedThuCats(txData.stats.sortedThuCats || []);
          setSortedChiNguoi(txData.stats.sortedChiNguoi || []);
        }
      }
    } catch (e) {
      console.error('Error fetching report data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchLoiNhuan = async (nam) => {
    if (!nam) return;
    setLoiNhuanLoading(true);
    try {
      const res = await fetch(`/api/loi-nhuan?nam=${nam}`);
      if (res.ok) {
        const data = await res.json();
        setLoiNhuanData(data);
      }
    } catch (e) {
      console.error('Error fetching loi-nhuan:', e);
    } finally {
      setLoiNhuanLoading(false);
    }
  };

  const fetchStaticConfig = async () => {
    try {
      const configRes = await fetch('/api/cau-hinh');
      if (configRes.ok) {
        const configData = await configRes.json();
        setCategories(configData.categories || []);
        setGroups(configData.groups || []);
      }
    } catch (e) {
      console.error('Error fetching static config:', e);
    }
  };

  // Lấy transactions khi page thay đổi
  useEffect(() => {
    if (user) {
      fetchData(currentPage);
    }
  }, [currentPage, user]);

  // Reset page về 1 khi filters thay đổi
  useEffect(() => {
    if (user) {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchData(1);
      }
    }
  }, [filterNam, filterThang, filterNhom, filterDanhMuc]);

  // Fetch lợi nhuận khi năm thay đổi
  useEffect(() => {
    if (user && filterNam) {
      fetchLoiNhuan(filterNam);
    } else if (user && !filterNam) {
      setLoiNhuanData(null);
    }
  }, [filterNam, user]);

  const loiNhuanKy = useMemo(() => {
    if (!loiNhuanData) return null;
    const selectedMonths = filterThang.length > 0
      ? filterThang.map(Number)
      : Array.from({ length: 12 }, (_, i) => i + 1);
    const filtered = loiNhuanData.months.filter(m => selectedMonths.includes(m.thang));
    const result = filtered.reduce((acc, m) => ({
      doanhThuThucTe: acc.doanhThuThucTe + m.doanhThuThucTe,
      chiPhiThucTe: acc.chiPhiThucTe + m.chiPhiThucTe,
      loiNhuanThucTe: acc.loiNhuanThucTe + m.loiNhuanThucTe,
    }), { doanhThuThucTe: 0, chiPhiThucTe: 0, loiNhuanThucTe: 0 });
    result.bienLoiNhuan = result.doanhThuThucTe > 0
      ? Math.round((result.loiNhuanThucTe / result.doanhThuThucTe) * 100)
      : 0;
    return result;
  }, [loiNhuanData, filterThang]);

  const handleGuiThuThang = async () => {
    const ok = await showConfirm({ message: `Gửi Lá thư ARI tổng kết tháng ${letterThang}/${letterNam} tới tất cả quản lý?`, confirmLabel: 'Gửi' });
    if (!ok) return;
    setLetterSending(true);
    setLetterResult(null);
    try {
      const res = await fetch(`/api/cron/thu-thang?thang=${letterThang}&nam=${letterNam}`, { method: 'POST' });
      const data = await res.json();
      setLetterResult(data);
    } catch {
      setLetterResult({ ok: false, error: 'Lỗi kết nối.' });
    } finally {
      setLetterSending(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải phân tích báo cáo tài chính...</p>
      </div>
    );
  }

  // Lọc dữ liệu phát sinh (Đã lọc từ server)
  const filteredTx = transactions;

  // Tính các biến bổ trợ hiển thị cơ cấu từ stats nhận về của server
  const tongChiTuNhom = sortedChiGroups.reduce((sum, g) => sum + g.amount, 0) || 1;
  const tongThuTuNhom = sortedThuGroups.reduce((sum, g) => sum + g.amount, 0) || 1;
  const maxChiCatAmount = sortedChiCats.length > 0 ? sortedChiCats[0].amount : 1;
  const maxThuCatAmount = sortedThuCats.length > 0 ? sortedThuCats[0].amount : 1;
  const tongChiNguoi = sortedChiNguoi.reduce((sum, p) => sum + p.amount, 0) || 1;
  const maxChiNguoiAmount = sortedChiNguoi.reduce((m, p) => Math.max(m, p.amount), 0) || 1;

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  const handleExportExcel = async () => {
    if (filteredTx.length === 0) {
      toast.info('Không có dữ liệu để xuất.');
      return;
    }

    const periodLabel = filterThang.length === 1
      ? `Tháng ${filterThang[0]}-${filterNam || 'TatCa'}`
      : filterThang.length > 1
      ? `T${filterThang.join('_')}-${filterNam || 'TatCa'}`
      : filterNam
      ? `Nam ${filterNam}`
      : 'TatCa';

    // Tải thư viện xlsx chỉ khi cần (giữ app nhẹ) — giống Backup/Import.
    const XLSX = await import('xlsx');

    const headers = ['Mã Giao Dịch', 'Ngày Giao Dịch', 'Loại', 'Quỹ', 'Nhóm Danh Mục', 'Danh Mục', 'Nội Dung', 'Số Tiền (VND)'];

    const rows = filteredTx.map((tx) => [
      tx.maPhieu,
      formatDate(tx.ngayGiaoDich),
      tx.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi',
      tx.quy?.tenQuy || '',
      tx.danhMuc?.nhomChiPhi?.tenNhom || '',
      tx.danhMuc?.tenDanhMuc || '',
      tx.noiDung || '',
      tx.loaiGiaoDich === 'THU' ? tx.soTien : -tx.soTien,
    ]);

    const summaryRows = [
      [],
      ['TỔNG KẾT', '', '', '', '', '', '', ''],
      ['Tổng Thu', '', '', '', '', '', '', tongThu],
      ['Tổng Chi', '', '', '', '', '', '', -tongChi],
      ['Net Cashflow', '', '', '', '', '', '', netCashflow],
    ];

    const aoa = [headers, ...rows, ...summaryRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Độ rộng cột cho dễ đọc
    ws['!cols'] = [
      { wch: 16 }, { wch: 14 }, { wch: 6 }, { wch: 16 },
      { wch: 20 }, { wch: 22 }, { wch: 40 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo Thu-Chi');
    const fileName = `BaoCaoThuChi_${periodLabel}_${formatDate(new Date()).replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Lọc động dropdown danh mục theo Nhóm đã chọn
  const filteredCategoriesForDropdown = filterNhom.length > 0
    ? categories.filter(c => filterNhom.includes(c.nhomChiPhiId))
    : categories;

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Báo cáo Thu - Chi</h1>
            <p className={styles.pageDesc}>Tổng hợp phân tích cơ cấu chi tiêu, doanh thu và net cashflow tích lũy của shop</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
              disabled={dataLoading}
            >
              <Download size={16} />
              Xuất Excel
            </button>
            <button
              onClick={() => window.print()}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
            >
              <Printer size={16} />
              In báo cáo
            </button>
          </div>
        </div>

        {/* Header bản in — chỉ hiện khi @media print */}
        <div className={styles.printHeader}>
          <h2>Call Me Ari — Báo cáo Thu-Chi</h2>
          <p>
            Kỳ:{' '}
            {filterThang.length > 0
              ? `Tháng ${[...filterThang].sort((a, b) => +a - +b).join(', ')}`
              : 'Cả năm'}{' '}
            {filterNam || ''}
          </p>
          <p>Ngày in: {formatDate(new Date())}</p>
        </div>

        {/* SECTION 1: SMART FILTER GRID */}
        <div className={`${styles.filterCard} glass-card`}>
          <div className={styles.filterTitleBar}>
            <SlidersHorizontal size={18} style={{ color: 'var(--brand-accent)' }} />
            <span>Bộ lọc báo cáo tài chính</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            {/* Năm — dropdown đơn */}
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Năm</label>
              <select className="form-control" style={{ minWidth: '110px' }} value={filterNam} onChange={(e) => setFilterNam(e.target.value)}>
                <option value="">Tất cả</option>
                {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <FilterDropdown
              label="Tháng"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }))}
              selected={filterThang}
              onChange={setFilterThang}
            />

            <FilterDropdown
              label="Nhóm danh mục"
              options={groups.map(g => ({ value: g.id, label: g.tenNhom }))}
              selected={filterNhom}
              onChange={(v) => { setFilterNhom(v); setFilterDanhMuc([]); }}
            />

            <FilterDropdown
              label="Danh mục"
              options={filteredCategoriesForDropdown.map(c => ({ value: c.id, label: c.tenDanhMuc }))}
              selected={filterDanhMuc}
              onChange={setFilterDanhMuc}
            />
          </div>
        </div>

        {/* SECTION 1.5: LỢI NHUẬN KINH DOANH */}
        {filterNam && (
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>
              <Scale size={18} style={{ color: 'var(--brand-accent)' }} />
              <h2 style={{ fontSize: '1rem', margin: 0 }}>
                Lợi nhuận kinh doanh
                {filterThang.length > 0 ? ` — T${filterThang.sort((a,b)=>Number(a)-Number(b)).join(', T')}` : ''} Năm {filterNam}
              </h2>
            </div>
            {loiNhuanLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
            ) : loiNhuanKy ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Doanh thu thực tế</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>+{formatVND(loiNhuanKy.doanhThuThucTe)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Từ kênh bán hàng</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chi phí vận hành</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>-{formatVND(loiNhuanKy.chiPhiThucTe)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>ThuChi + lịch sử</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lãi / Lỗ</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: loiNhuanKy.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444' }}>
                    {loiNhuanKy.loiNhuanThucTe >= 0 ? '+' : ''}{formatVND(loiNhuanKy.loiNhuanThucTe)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Doanh thu − Chi phí</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Biên lợi nhuận</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: loiNhuanKy.bienLoiNhuan >= 20 ? '#10b981' : loiNhuanKy.bienLoiNhuan >= 0 ? '#f59e0b' : '#ef4444' }}>
                    {loiNhuanKy.bienLoiNhuan}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>&gt;20% tốt · &lt;0% lỗ</div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* SECTION 1.7: BIỂU ĐỒ XU HƯỚNG THÁNG — luôn hiện cả năm, dim tháng ngoài filter */}
        {filterNam && loiNhuanData && (() => {
          const allMonths = loiNhuanData.months; // luôn 12 tháng
          const maxVal = Math.max(...allMonths.map(m => Math.max(m.doanhThuThucTe, m.chiPhiThucTe)), 1);
          const selectedSet = new Set(filterThang.length > 0 ? filterThang.map(Number) : []);
          return (
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
              <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>
                <BarChart3 size={18} style={{ color: 'var(--brand-accent)' }} />
                <h2 style={{ fontSize: '1rem', margin: 0 }}>
                  Xu hướng Doanh thu &amp; Chi phí — Năm {filterNam}
                  {filterThang.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>(tô đậm tháng đang lọc)</span>}
                </h2>
              </div>
              <div className={styles.trendChart}>
                {allMonths.map(m => {
                  const dtH = Math.round((m.doanhThuThucTe / maxVal) * 100);
                  const cpH = Math.round((m.chiPhiThucTe / maxVal) * 100);
                  const isActive = selectedSet.size === 0 || selectedSet.has(m.thang);
                  return (
                    <div key={m.thang} className={styles.trendCol} style={{ opacity: isActive ? 1 : 0.28 }}>
                      <div className={styles.trendBars}>
                        <div className={styles.trendBarDt} style={{ height: `${dtH}%` }} title={`Doanh thu T${m.thang}: ${m.doanhThuThucTe.toLocaleString('vi-VN')}đ`} />
                        <div className={styles.trendBarCp} style={{ height: `${cpH}%` }} title={`Chi phí T${m.thang}: ${m.chiPhiThucTe.toLocaleString('vi-VN')}đ`} />
                      </div>
                      <div className={styles.trendLabel} style={{ fontWeight: isActive && selectedSet.size > 0 ? 700 : 400 }}>T{m.thang}</div>
                      {m.loiNhuanThucTe !== 0 && isActive && (
                        <div className={styles.trendNet} style={{ color: m.loiNhuanThucTe >= 0 ? '#10b981' : '#ef4444' }}>
                          {m.loiNhuanThucTe >= 0 ? '+' : ''}{Math.abs(m.loiNhuanThucTe) >= 1000000
                            ? Math.round(m.loiNhuanThucTe / 1000000) + 'tr'
                            : Math.round(m.loiNhuanThucTe / 1000) + 'k'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />Doanh thu</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#f87171', borderRadius: 2, marginRight: 4 }} />Chi phí</span>
                <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Số nhỏ = Lãi/Lỗ từng tháng</span>
              </div>
            </div>
          );
        })()}

        {/* SECTION 1.8: CHI PHÍ DỰ KIẾN SẮP TỚI (gộp danh mục) */}
        {chiPhiDuKien && chiPhiDuKien.conLaiCoDinh > 0 && (
          <div className={`glass-card ${styles.duKienCard}`}>
            <h3 className={styles.duKienTitle}>Chi phí dự kiến sắp tới</h3>
            <p className={styles.duKienNote}>
              Các khoản cố định / đang chờ trả còn lại trong tháng — chưa tính vào “đã chi”.
            </p>
            <table className="custom-table">
              <thead>
                <tr><th>Danh mục</th><th style={{ textAlign: 'right' }}>Số tiền</th></tr>
              </thead>
              <tbody>
                {chiPhiDuKien.conLaiTheoDanhMuc.map((d) => (
                  <tr key={d.danhMucId}>
                    <td>{d.tenDanhMuc || '(Chưa rõ danh mục)'}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(d.soTien)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Tổng dự kiến còn lại</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{formatVND(chiPhiDuKien.conLaiCoDinh)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* SECTION 2: STATS SUMMARY WIDGET */}
        <div className={styles.summaryGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <div className={`${styles.sumCard} ${styles.greenBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Tổng thu tiền (Dòng vào){tongThuUocTinh ? ' *' : ''}</span>
              <TrendingUp className={styles.sumIcon} />
            </div>
            <h3>+{formatVND(tongThu)}</h3>
            <p>Doanh thu và dòng tiền nạp vào{tongThuUocTinh ? ' — ước tính từ doanh thu' : ''}</p>
          </div>

          <div className={`${styles.sumCard} ${styles.redBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Tổng chi tiền (Dòng ra)</span>
              <TrendingDown className={styles.sumIcon} />
            </div>
            <h3>-{formatVND(tongChi)}</h3>
            <p>Chi phí vận hành & giá vốn đã duyệt</p>
          </div>

          <div className={`${styles.sumCard} ${styles.blueBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Thặng dư dòng tiền (Net CF)</span>
              <DollarSign className={styles.sumIcon} />
            </div>
            <h3 style={{ color: netCashflow >= 0 ? '#34d399' : '#f87171' }}>
              {netCashflow >= 0 ? '+' : ''}{formatVND(netCashflow)}
            </h3>
            <p>Hiệu số thực tế thu chi kỳ này</p>
          </div>

          <div className={`${styles.sumCard} glass-card`} style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className={styles.sumHeader}>
              <span style={{ color: 'var(--brand-brown)', fontWeight: '700' }}>Tỉ lệ Chi / Thu</span>
              <BarChart3 className={styles.sumIcon} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 style={{ color: tileChiThu > 80 ? '#f87171' : 'var(--text-main)' }}>{tileChiThu}%</h3>
            <p>Ngưỡng an toàn tài chính (&lt; 80%)</p>
          </div>
        </div>

        {/* SECTION 3: DETAILED CHARTS GRID */}
        <div className={styles.chartsGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* CỘT TRÁI: DOANH THU & KHOẢN THU */}
          <div className={styles.chartsColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Nhóm Thu nhập */}
            <div className="glass-card">
              <div className={styles.cardHeader}>
                <Layers size={18} className={styles.cardTitleIcon} style={{ color: 'var(--success)' }} />
                <h2>Cơ cấu nguồn thu theo Nhóm</h2>
              </div>
              
              {dataLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
              ) : sortedThuGroups.length === 0 ? (
                <div className={styles.emptyState}>Chưa ghi nhận nguồn thu nào trong kỳ.</div>
              ) : (
                <div className={styles.statsBox}>
                  {sortedThuGroups.map((grp) => {
                    const percent = Math.round((grp.amount / tongThuTuNhom) * 100);
                    return (
                      <div key={grp.id} className={styles.statItem}>
                        <div className={styles.statHeader}>
                          <span>{grp.name}</span>
                          <span>{formatVND(grp.amount)} (<strong>{percent}%</strong>)</span>
                        </div>
                        <div className={styles.progressBarWrapper}>
                          <div 
                            className={styles.progressBar} 
                            style={{ 
                              width: `${percent}%`,
                              background: 'linear-gradient(90deg, #10b981 0%, #047857 100%)'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top danh mục Thu */}
            <div className="glass-card">
              <div className={styles.cardHeader}>
                <PieChart size={18} className={styles.cardTitleIcon} style={{ color: 'var(--success)' }} />
                <h2>Top danh mục thu nhiều nhất</h2>
              </div>
              
              {dataLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
              ) : sortedThuCats.length === 0 ? (
                <div className={styles.emptyState}>Chưa có danh mục thu nào phát sinh.</div>
              ) : (
                <div className={styles.statsBox}>
                  {sortedThuCats.map((cat) => {
                    const percent = Math.round((cat.amount / maxThuCatAmount) * 100);
                    return (
                      <div key={cat.id} className={styles.statItem}>
                        <div className={styles.statHeader}>
                          <span>{cat.name}</span>
                          <strong>{formatVND(cat.amount)}</strong>
                        </div>
                        <div className={styles.progressBarWrapper}>
                          <div 
                            className={styles.progressBar} 
                            style={{ 
                              width: `${percent}%`,
                              background: '#34d399'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIÊU & CHI PHÍ */}
          <div className={styles.chartsColumn} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Nhóm Chi phí */}
            <div className="glass-card">
              <div className={styles.cardHeader}>
                <Layers size={18} className={styles.cardTitleIcon} style={{ color: 'var(--danger)' }} />
                <h2>Cơ cấu chi phí theo Nhóm</h2>
              </div>
              
              {dataLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
              ) : sortedChiGroups.length === 0 ? (
                <div className={styles.emptyState}>Chưa ghi nhận chi phí nào trong kỳ.</div>
              ) : (
                <div className={styles.statsBox}>
                  {sortedChiGroups.map((grp) => {
                    const percent = Math.round((grp.amount / tongChiTuNhom) * 100);
                    return (
                      <div key={grp.id} className={styles.statItem}>
                        <div className={styles.statHeader}>
                          <span>{grp.name}</span>
                          <span>{formatVND(grp.amount)} (<strong>{percent}%</strong>)</span>
                        </div>
                        <div className={styles.progressBarWrapper}>
                          <div 
                            className={styles.progressBar} 
                            style={{ 
                              width: `${percent}%`,
                              background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top danh mục Chi */}
            <div className="glass-card">
              <div className={styles.cardHeader}>
                <PieChart size={18} className={styles.cardTitleIcon} style={{ color: 'var(--danger)' }} />
                <h2>Top danh mục chi nhiều nhất</h2>
              </div>
              
              {dataLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
              ) : sortedChiCats.length === 0 ? (
                <div className={styles.emptyState}>Chưa có danh mục chi nào phát sinh.</div>
              ) : (
                <div className={styles.statsBox}>
                  {sortedChiCats.map((cat) => {
                    const percent = Math.round((cat.amount / maxChiCatAmount) * 100);
                    return (
                      <div key={cat.id} className={styles.statItem}>
                        <div className={styles.statHeader}>
                          <span>{cat.name}</span>
                          <strong>{formatVND(cat.amount)}</strong>
                        </div>
                        <div className={styles.progressBarWrapper}>
                          <div 
                            className={styles.progressBar} 
                            style={{ 
                              width: `${percent}%`,
                              background: '#f87171'
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3.5: CHI PHÍ THEO NGƯỜI ĐỀ XUẤT */}
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <div className={styles.cardHeader}>
            <Users size={18} className={styles.cardTitleIcon} style={{ color: 'var(--danger)' }} />
            <h2>Chi phí theo người đề xuất</h2>
          </div>
          {dataLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
            </div>
          ) : sortedChiNguoi.length === 0 ? (
            <div className={styles.emptyState}>Chưa ghi nhận chi phí nào trong kỳ.</div>
          ) : (
            <div className={styles.statsBox}>
              {sortedChiNguoi.map((p) => {
                const isUnknown = p.id === '__unknown__';
                const percentOfTotal = Math.round((p.amount / tongChiNguoi) * 100);
                const barWidth = Math.round((p.amount / maxChiNguoiAmount) * 100);
                const av = getAvatarColor(p.id, isUnknown);
                return (
                  <div key={p.id} className={styles.statItem}>
                    <div className={styles.statHeader} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700, background: av.bg, color: av.color,
                      }}>{isUnknown ? '?' : getInitials(p.name)}</span>
                      <span style={{ flex: 1, minWidth: 0, color: isUnknown ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        {p.name}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}> · {p.count} phiếu</span>
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>{formatVND(p.amount)} (<strong>{percentOfTotal}%</strong>)</span>
                    </div>
                    <div className={styles.progressBarWrapper}>
                      <div
                        className={styles.progressBar}
                        style={{
                          width: `${barWidth}%`,
                          background: isUnknown
                            ? 'rgba(var(--brand-brown-rgb), 0.35)'
                            : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 4: TABLE OF FILTERED TRANSACTIONS */}
        <div className="glass-card">
          <div className={styles.cardHeader} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <FileSpreadsheet size={20} className={styles.cardTitleIcon} style={{ color: 'var(--brand-accent)' }} />
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Đối soát chi tiết các Giao dịch trong kỳ ({totalCount} giao dịch)</h2>
          </div>

          {filteredTx.length === 0 ? (
            <div className={styles.emptyState}>Không tìm thấy giao dịch dòng tiền nào phù hợp với bộ lọc đã chọn.</div>
          ) : (
            <>
              <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
                    <tr>
                      <th>Mã Giao Dịch</th>
                      <th>Ngày giao dịch</th>
                      <th>Loại</th>
                      <th>Quỹ thực hiện</th>
                      <th>Danh mục</th>
                      <th>Nội dung chi tiết</th>
                      <th style={{ textAlign: 'right' }}>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 'bold', color: tx.loaiGiaoDich === 'THU' ? '#34d399' : '#f87171' }}>{tx.maPhieu}</td>
                        <td suppressHydrationWarning>{formatDate(tx.ngayGiaoDich)}</td>
                        <td>
                          {tx.loaiGiaoDich === 'THU' ? (
                            <span className={styles.thuBadge}>THU</span>
                          ) : (
                            <span className={styles.chiBadge}>CHI</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600' }}>{tx.quy ? tx.quy.tenQuy : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Lịch sử</span>}</td>
                        <td>{tx.danhMuc.tenDanhMuc}</td>
                        <td>{tx.noiDung}</td>
                        <td style={{ 
                          fontWeight: '800', 
                          textAlign: 'right',
                          color: tx.loaiGiaoDich === 'THU' ? '#2e7d32' : '#8c5353' 
                        }}>
                          {tx.loaiGiaoDich === 'THU' ? '+' : '-'}{formatVND(tx.soTien)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.75rem', minWidth: '32px' }}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Trước
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                    if (totalPages > 5 && Math.abs(pageNum - currentPage) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        style={{ padding: '0.4rem 0.75rem', minWidth: '32px', border: currentPage === pageNum ? 'none' : '1px solid var(--border)' }}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.75rem', minWidth: '32px' }}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Sau
                  </button>
                  
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    Trang {currentPage} / {totalPages}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        {/* LÁ THƯ ARI — chỉ OWNER */}
        {user?.role === 'OWNER' && (
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginTop: '2rem' }}>
            <div className={styles.cardHeader} style={{ marginBottom: '0.75rem' }}>
              <Mail size={18} style={{ color: '#E6A2C5' }} />
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Lá thư ARI — Tổng kết tháng</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.855rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
              Gửi email tổng kết tài chính (doanh thu, chi phí, lãi/lỗ, top danh mục) cho tất cả quản lý.
              Nút <strong>Xem trước</strong> mở email mẫu trong tab mới — <strong>Gửi ngay</strong> gửi email thật.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {/* Chọn tháng */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem' }}>Tháng</label>
                <select
                  className="form-control"
                  style={{ minWidth: '90px' }}
                  value={letterThang}
                  onChange={(e) => { setLetterThang(Number(e.target.value)); setLetterResult(null); }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => (
                    <option key={t} value={t}>Tháng {t}</option>
                  ))}
                </select>
              </div>

              {/* Chọn năm */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem' }}>Năm</label>
                <select
                  className="form-control"
                  style={{ minWidth: '90px' }}
                  value={letterNam}
                  onChange={(e) => { setLetterNam(Number(e.target.value)); setLetterResult(null); }}
                >
                  {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Xem trước — mở tab mới trả text/html */}
              <button
                className="btn btn-secondary"
                onClick={() =>
                  window.open(
                    `/api/cron/thu-thang?preview=true&thang=${letterThang}&nam=${letterNam}`,
                    '_blank'
                  )
                }
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              >
                <Eye size={15} /> Xem trước
              </button>

              {/* Gửi ngay */}
              <button
                className="btn btn-primary"
                onClick={handleGuiThuThang}
                disabled={letterSending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'linear-gradient(135deg,#73485E,#C4778A)',
                  border: 'none', whiteSpace: 'nowrap',
                  opacity: letterSending ? 0.7 : 1,
                }}
              >
                <Send size={15} />
                {letterSending ? 'Đang gửi...' : 'Gửi ngay'}
              </button>
            </div>

            {/* Kết quả gửi */}
            {letterResult && (
              <div style={{
                marginTop: '0.85rem', padding: '0.6rem 0.9rem', borderRadius: '8px',
                background: letterResult.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                color: letterResult.ok ? '#065f46' : '#991b1b',
                fontSize: '0.855rem', fontWeight: 500,
              }}>
                {letterResult.ok
                  ? `✅ Đã gửi Lá thư ARI tháng ${letterResult.thang}/${letterResult.nam} tới ${letterResult.recipients} người.`
                  : `❌ ${letterResult.error || 'Không gửi được email.'}`}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
