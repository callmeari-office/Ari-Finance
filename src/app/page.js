'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DateInput from '@/components/DateInput';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  PlusCircle,
  Scale,
  Target,
  AlertTriangle,
  CalendarClock,
  Gauge,
  Banknote,
  Activity,
  Wallet,
  BarChart3,
  Megaphone,
  Pencil,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AriLoader from '@/components/AriLoader';
import AnimatedNumber from '@/components/AnimatedNumber';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { isRestrictedToOwnProposals, canViewMenu } from '@/lib/roles';
import { formatDate } from '@/lib/date';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dashboard states
  const [funds, setFunds] = useState([]);
  const [proposals, setProposals] = useState([]); // chỉ dùng cho thống kê cá nhân (STAFF/LEADER)
  const [pendingPayment, setPendingPayment] = useState(0); // OWNER/MANAGER: đếm nhẹ
  const [pendingReimburse, setPendingReimburse] = useState(0); // OWNER/MANAGER: đếm nhẹ
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  // Sức khỏe tài chính tháng + cảnh báo (theo quyền tq*)
  const [profitMonths, setProfitMonths] = useState([]);
  const [canhBao, setCanhBao] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  // Dự báo dòng tiền
  const [duBao, setDuBao] = useState(null);
  const [duBaoLoading, setDuBaoLoading] = useState(true);
  const [chiPhiDuKien, setChiPhiDuKien] = useState(null);
  // Ngân sách danh mục + doanh thu mini (STAFF/LEADER)
  const [nganSachThang, setNganSachThang] = useState(null);
  const [nganSachLoading, setNganSachLoading] = useState(true);
  const [doanhThuSummary, setDoanhThuSummary] = useState(null);
  const [doanhThuSummaryLoading, setDoanhThuSummaryLoading] = useState(true);

  // Bảng thông báo nội bộ
  const [thongBaoList, setThongBaoList] = useState([]);
  const [tbModal, setTbModal] = useState(null); // null | 'create' | { id, tieuDe, noiDung, tag, ngayHetHan }
  const [tbForm, setTbForm] = useState({ tieuDe: '', noiDung: '', tag: 'THONG_TIN', ngayHetHan: '' });
  const [tbSaving, setTbSaving] = useState(false);
  const [tbExpanded, setTbExpanded] = useState({}); // id -> bool (xem thêm nội dung dài)

  useEffect(() => {
    // 1. Kiểm tra session
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
          const u = data.user;
          setUser(u);
          setLoading(false);

          // 2. Fetch toàn bộ dữ liệu Dashboard qua 1 request duy nhất.
          //    Server tự kiểm tra quyền, trả null cho phần không được xem.
          fetchDashboard(u);
        }
      })
      .catch((err) => {
        console.error('Session verification error:', err);
        router.push('/login');
      });
  }, [router]);

  const fetchDashboard = async (u) => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) return;
      const data = await res.json();

      // Đề xuất
      setProposals(data.proposals || []);
      setPendingPayment(data.pendingPayment || 0);
      setPendingReimburse(data.pendingReimburse || 0);
      setProposalsLoading(false);

      // Quỹ
      if (data.funds !== null) setFunds(data.funds || []);
      setFundsLoading(false);

      // Thu-chi 6 tháng — build rolling window giống fetchTransactions cũ
      if (data.thongKeThang !== null) {
        const rawData = data.thongKeThang || [];
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const key = `${year}-${String(month).padStart(2, '0')}`;
          const found = rawData.find((r) => r.thang === key);
          months.push({ year, month, thu: found?.thu || 0, chi: found?.chi || 0, thuLaUocTinh: found?.thuLaUocTinh ?? false });
        }
        setTransactions(months);
      }
      setTxLoading(false);

      // Sức khỏe tài chính + cảnh báo
      if (data.loiNhuan !== null) setProfitMonths(data.loiNhuan?.months || []);
      if (data.canhBao !== null) setCanhBao(data.canhBao);
      setInsightsLoading(false);

      // Dự báo dòng tiền
      if (data.duBao !== null) setDuBao(data.duBao);
      setDuBaoLoading(false);

      // Chi phí dự kiến cả tháng
      if (data.chiPhiDuKien != null) setChiPhiDuKien(data.chiPhiDuKien);

      // Ngân sách danh mục (STAFF/LEADER)
      if (data.nganSach !== null) setNganSachThang(data.nganSach);
      setNganSachLoading(false);

      // Doanh thu mini (STAFF/LEADER)
      if (data.doanhThu !== null) setDoanhThuSummary(data.doanhThu);
      setDoanhThuSummaryLoading(false);

      // Thông báo nội bộ
      setThongBaoList(data.thongBao || []);
    } catch (e) {
      console.error('Error fetching dashboard:', e);
      // Reset tất cả loading dù lỗi
      setProposalsLoading(false);
      setFundsLoading(false);
      setTxLoading(false);
      setInsightsLoading(false);
      setDuBaoLoading(false);
      setNganSachLoading(false);
      setDoanhThuSummaryLoading(false);
    }
  };

  const fetchThongBao = async () => {
    try {
      const res = await fetch('/api/thong-bao-noi-bo');
      if (res.ok) setThongBaoList(await res.json());
    } catch (e) {
      console.error('Error fetching thongBao:', e);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <AriLoader text="Đang tải dữ liệu tài chính..." />
      </div>
    );
  }

  const formatVND = (num) => (num || 0).toLocaleString('vi-VN') + ' ₫';
  const currentYear = new Date().getFullYear();

  // ===== Thông báo nội bộ helpers =====
  const TB_TAG_META = {
    QUAN_TRONG: { label: 'Quan trọng', bg: '#ef4444', color: '#fff' },
    NHAC_NHO:   { label: 'Nhắc nhở',   bg: '#f59e0b', color: '#fff' },
    THONG_TIN:  { label: 'Thông tin',  bg: '#60a5fa', color: '#fff' },
  };
  const canManageTB = user && (user.role === 'OWNER' || user.role === 'MANAGER');

  const openCreateTB = () => {
    setTbForm({ tieuDe: '', noiDung: '', tag: 'THONG_TIN', ngayHetHan: '' });
    setTbModal('create');
  };

  const openEditTB = (tb) => {
    const hetHan = tb.ngayHetHan ? new Date(tb.ngayHetHan).toISOString().split('T')[0] : '';
    setTbForm({ tieuDe: tb.tieuDe, noiDung: tb.noiDung, tag: tb.tag, ngayHetHan: hetHan });
    setTbModal({ id: tb.id, tieuDe: tb.tieuDe });
  };

  const saveTB = async () => {
    if (!tbForm.tieuDe.trim() || !tbForm.noiDung.trim()) return;
    setTbSaving(true);
    try {
      const body = {
        tieuDe: tbForm.tieuDe,
        noiDung: tbForm.noiDung,
        tag: tbForm.tag,
        ngayHetHan: tbForm.ngayHetHan || null,
      };
      const isEdit = tbModal && tbModal.id;
      const res = await fetch(
        isEdit ? `/api/thong-bao-noi-bo/${tbModal.id}` : '/api/thong-bao-noi-bo',
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (res.ok) {
        setTbModal(null);
        await fetchThongBao();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Lỗi khi lưu thông báo.');
      }
    } finally {
      setTbSaving(false);
    }
  };

  const archiveTB = async (id) => {
    const res = await fetch(`/api/thong-bao-noi-bo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trangThai: 'ARCHIVED' }),
    });
    if (res.ok) fetchThongBao();
  };

  const deleteTB = async (id, tieuDe) => {
    const ok = await showConfirm({
      message: `Xóa vĩnh viễn thông báo "${tieuDe}"?`,
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/thong-bao-noi-bo/${id}`, { method: 'DELETE' });
    if (res.ok) fetchThongBao();
    else {
      const d = await res.json();
      toast.error(d.error || 'Lỗi khi xóa thông báo.');
    }
  };
  const thisMonth = new Date().getMonth() + 1;

  // Lời nhắn ấm áp giọng "Call Me Ari" — đổi theo buổi trong ngày, xoay theo ngày.
  const getAriMotto = () => {
    const now = new Date();
    const h = now.getHours();
    const day = now.getDate();
    let pool;
    if (h < 11) {
      pool = [
        'Chào buổi sáng — năng lượng hồng cho một ngày rực rỡ ✿',
        'Một ngày mới của Ari bắt đầu, nhẹ nhàng mà bừng sáng ✿',
        'Cà phê thơm, sổ sách gọn gàng, ngày mới thật xinh ✿',
      ];
    } else if (h < 14) {
      pool = [
        'Giữa ngày bận rộn, đừng quên mỉm cười nhé ✿',
        'Trưa rồi — nghỉ tay một chút cho lại sức nha ✿',
      ];
    } else if (h < 18) {
      pool = [
        'Buổi chiều dịu dàng, từng con số đang vào nếp ✿',
        'Chiều nay tài chính của shop vẫn xinh đẹp lắm đó ✿',
      ];
    } else {
      pool = [
        'Tối an lành — khép lại một ngày thật trọn vẹn ✿',
        'Đêm về, để Ari trông sổ sách giúp, bạn nghỉ ngơi nhé ✿',
      ];
    }
    return pool[day % pool.length];
  };

  // ===== Quyền hiển thị từng khối Dashboard (widget con tq*) =====
  const canKPI = canViewMenu(user, 'tqKPITaiChinh');
  const canXuLy = canViewMenu(user, 'tqCanXuLy');
  const canQuy = canViewMenu(user, 'tqQuy');
  const canXuHuong = canViewMenu(user, 'tqXuHuong');
  const canDuBao = canViewMenu(user, 'tqDuBao');
  // Khối cá nhân chỉ dành cho vai trò bị giới hạn xem đề xuất của chính mình.
  const canPersonal = isRestrictedToOwnProposals(user.role) && canViewMenu(user, 'tqDeXuatCuaToi');
  // Widget bổ sung cho STAFF/LEADER
  const canNganSach = canPersonal && canViewMenu(user, 'keHoach');
  const canDoanhThuMini = canPersonal && canViewMenu(user, 'doanhThuDBThang');

  // ===== Thống kê đề xuất =====
  // pendingPayment / pendingReimburse: nay là STATE (đếm nhẹ ở server cho OWNER/MANAGER).

  // Cá nhân (LEADER/STAFF) — tính từ proposals (chỉ STAFF/LEADER mới tải về list này)
  const myTotalAmount = proposals.reduce((sum, p) => sum + p.soTien, 0);
  const myPending = proposals.filter((p) => p.trangThai === 'CHO_THANH_TOAN' || p.trangThai === 'CHO_HOAN_UNG').length;
  const myPaid = proposals.filter((p) => p.trangThai === 'DA_THANH_TOAN').length;
  const myRejected = proposals.filter((p) => p.trangThai === 'HUY');

  // Tổng số dư các quỹ (Tiền đang có)
  const tongSoDuQuy = funds.reduce((sum, f) => sum + f.soDuHienTai, 0);

  // ===== Sức khỏe tài chính THÁNG NÀY =====
  const lnThang = profitMonths.find((m) => m.thang === thisMonth) || null;
  const doanhThuThang = lnThang?.doanhThuThucTe || 0;
  const chiTieuThang = lnThang?.doanhThuChiTieu || 0;
  const chiPhiThang = lnThang?.chiPhiThucTe || 0;
  const chiPhiKeHoachThang = lnThang?.chiPhiKeHoach || 0;
  const laiLoThang = lnThang?.loiNhuanThucTe || 0;
  const tileChiTieu = chiTieuThang > 0 ? Math.round((doanhThuThang / chiTieuThang) * 100) : 0;
  const tileColor = tileChiTieu >= 90 ? '#10b981' : tileChiTieu >= 70 ? '#f59e0b' : '#ef4444';
  const tileChiPhi = chiPhiKeHoachThang > 0 ? Math.round((chiPhiThang / chiPhiKeHoachThang) * 100) : 0;
  const bienLoiNhuan = doanhThuThang > 0 ? Math.round((laiLoThang / doanhThuThang) * 100) : 0;
  const conLaiCoDinh = chiPhiDuKien?.conLaiCoDinh || 0;
  const duKienCaThang = chiPhiDuKien ? chiPhiDuKien.duKienCaThang : chiPhiThang;
  const laiDuKienCaThang = doanhThuThang - duKienCaThang;

  // ===== Ngân sách theo danh mục — STAFF/LEADER =====
  const nganSachRows = (() => {
    if (!nganSachThang) return [];
    const { keHoach, thucTeByMonth } = nganSachThang;
    const khThisMonth = keHoach.filter((kh) => kh.thang === thisMonth && kh.soTien > 0);
    const ttMap = {};
    thucTeByMonth
      .filter((tt) => Number(tt.thang) === thisMonth)
      .forEach((tt) => { ttMap[tt.danhMucId] = (ttMap[tt.danhMucId] || 0) + Number(tt.total); });
    return khThisMonth.map((kh) => {
      const daChi = ttMap[kh.danhMucId] || 0;
      const pct = kh.soTien > 0 ? Math.round((daChi / kh.soTien) * 100) : 0;
      return {
        tenDanhMuc: kh.danhMuc.tenDanhMuc,
        keHoach: kh.soTien,
        daChi,
        con: kh.soTien - daChi,
        pct,
        color: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981',
      };
    }).sort((a, b) => b.pct - a.pct);
  })();

  // ===== Doanh thu tháng mini — STAFF/LEADER =====
  const doanhThuThangMini = (() => {
    if (!doanhThuSummary) return null;
    const { kenhBan, data } = doanhThuSummary;
    const tmData = data.filter((d) => d.thang === thisMonth);
    const chiTieuTong = tmData.reduce((s, d) => s + (d.chiTieu || 0), 0);
    const thucTeTong = tmData.reduce((s, d) => s + (d.thucTe || 0), 0);
    if (chiTieuTong === 0) return null;
    const pct = Math.round((thucTeTong / chiTieuTong) * 100);
    const pctColor = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    const byKenh = kenhBan
      .map((k) => {
        const row = tmData.find((d) => d.kenhBanId === k.id);
        if (!row || !row.chiTieu) return null;
        const kPct = Math.round(((row.thucTe || 0) / row.chiTieu) * 100);
        return {
          tenKenh: k.tenKenh,
          mauSac: k.mauSac || '#60a5fa',
          chiTieu: row.chiTieu,
          thucTe: row.thucTe || 0,
          pct: kPct,
          color: kPct >= 90 ? '#10b981' : kPct >= 70 ? '#f59e0b' : '#ef4444',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct);
    return { chiTieuTong, thucTeTong, pct, pctColor, byKenh };
  })();

  // ===== Phiếu của tôi sắp đến hạn — STAFF/LEADER (dùng proposals đã tải) =====
  const soonDue = proposals
    .filter((p) => {
      if (p.trangThai !== 'CHO_THANH_TOAN' && p.trangThai !== 'CHO_HOAN_UNG') return false;
      if (!p.ngayCanThanhToan) return false;
      const diffDays = Math.round((new Date(p.ngayCanThanhToan) - new Date()) / 86400000);
      return diffDays <= 3;
    })
    .sort((a, b) => new Date(a.ngayCanThanhToan) - new Date(b.ngayCanThanhToan));

  // ===== Biểu đồ Thu-Chi 6 tháng + đường Lãi/Lỗ =====
  // transactions đã được fetch từ /api/thu-chi/thong-ke-thang, shape { year, month, thu, chi }[]
  const monthlyData = transactions;
  const maxMonthly = Math.max(...monthlyData.flatMap((m) => [m.thu, m.chi]), 1);

  // Đường Lãi/Lỗ overlay: chỉ có dữ liệu cho các tháng thuộc năm hiện tại (API lợi nhuận theo năm).
  const lnByMonth = {};
  profitMonths.forEach((m) => { lnByMonth[m.thang] = m.loiNhuanThucTe; });
  const lnVals = monthlyData.map((m) => (m.year === currentYear && typeof lnByMonth[m.month] === 'number') ? lnByMonth[m.month] : null);
  const lnPresent = lnVals.filter((v) => v !== null);
  let lnLine = null;
  if (lnPresent.length >= 1) {
    const lo = Math.min(...lnPresent);
    const hi = Math.max(...lnPresent);
    const span = (hi - lo) || 1;
    const yOf = (v) => 90 - ((v - lo) / span) * 80; // y trong [10,90], cao = lời nhiều
    const xOf = (i) => ((i + 0.5) / monthlyData.length) * 100;
    const markers = lnVals
      .map((v, i) => (v === null ? null : { x: xOf(i), y: yOf(v), v, month: monthlyData[i].month }))
      .filter(Boolean);
    lnLine = { points: markers.map((m) => `${m.x},${m.y}`).join(' '), markers };
  }

  const fmtHan = (n) => (n < 0 ? `Quá hạn ${Math.abs(n)} ngày` : n === 0 ? 'Đến hạn hôm nay' : `Còn ${n} ngày`);
  const hasCanhBao = canhBao && canhBao.tongSo > 0;
  const hasPending = pendingPayment + pendingReimburse > 0;

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        {/* Welcome Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h1>Xin chào, {user.hoTen}!</h1>
            <p>Hôm nay là ngày {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="brand-motto" style={{ display: 'none' }}>{getAriMotto()}</p>
          </div>
          {/* Nút tạo trên banner: ẩn cho Staff/Leader vì thẻ "Gửi một khoản chi mới"
              bên dưới đã có nút này (tránh trùng lặp). OWNER/MANAGER vẫn giữ. */}
          {!canPersonal && (
            <div className={styles.actions}>
              <button onClick={() => router.push('/de-xuat?open=new')} className="btn btn-primary">
                <PlusCircle size={18} />
                <span>Tạo đề xuất chi</span>
              </button>
            </div>
          )}
        </div>

        {/* ===== THẺ HÀNH ĐỘNG CHO NHÂN VIÊN (STAFF/LEADER) ===== */}
        {canPersonal && (
          <div className={`glass-card ${styles.staffAction}`}>
            <div className={styles.staffActionMain}>
              <h2 className={styles.staffActionTitle}>Gửi một khoản chi mới</h2>
              <p className={styles.staffActionDesc}>Chỉ vài bước đơn giản, Ari lo phần còn lại giúp bạn.</p>
              <button onClick={() => router.push('/de-xuat?open=new')} className="btn btn-primary">
                <PlusCircle size={20} />
                <span>Tạo đề xuất chi phí</span>
              </button>
            </div>
            <div className={styles.staffActionStats}>
              <button className={styles.staffStat} onClick={() => router.push('/de-xuat')} title="Xem các phiếu đang chờ duyệt">
                <span className={styles.staffStatNum}>{proposalsLoading ? '–' : myPending}</span>
                <span className={styles.staffStatLbl}>Chờ duyệt</span>
              </button>
              <button className={styles.staffStat} onClick={() => router.push('/de-xuat')} title="Xem các phiếu đã được duyệt">
                <span className={styles.staffStatNum}>{proposalsLoading ? '–' : myPaid}</span>
                <span className={styles.staffStatLbl}>Đã duyệt</span>
              </button>
              {!proposalsLoading && myRejected.length > 0 && (
                <button className={`${styles.staffStat} ${styles.staffStatWarn}`} onClick={() => router.push('/de-xuat')} title="Xem các phiếu bị từ chối">
                  <span className={styles.staffStatNum}>{myRejected.length}</span>
                  <span className={styles.staffStatLbl}>Bị từ chối</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== BẢNG THÔNG BÁO NỘI BỘ ===== */}
        {(thongBaoList.length > 0 || canManageTB) && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: thongBaoList.length > 0 ? '0.75rem' : 0 }}>
              <Megaphone size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', flex: 1 }}>Thông báo nội bộ</span>
              {canManageTB && (
                <button
                  onClick={openCreateTB}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px', borderRadius: '6px' }}
                  title="Thêm thông báo mới"
                >
                  <PlusCircle size={14} /> Thêm
                </button>
              )}
            </div>

            {thongBaoList.length === 0 && canManageTB && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>Chưa có thông báo nào. Bấm &ldquo;Thêm&rdquo; để tạo mới.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {thongBaoList.map((tb) => {
                const meta = TB_TAG_META[tb.tag] || TB_TAG_META.THONG_TIN;
                const isLong = tb.noiDung.length > 120;
                const isExpanded = tbExpanded[tb.id];
                const shownContent = isLong && !isExpanded ? tb.noiDung.slice(0, 120) + '…' : tb.noiDung;
                const hetHanDate = tb.ngayHetHan ? new Date(tb.ngayHetHan) : null;
                const hetHanStr = hetHanDate
                  ? `Hết hạn ${formatDate(hetHanDate)}`
                  : null;

                return (
                  <div key={tb.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.55rem 0.75rem', borderRadius: '8px',
                    background: 'rgba(var(--surface-rgb, 255,255,255), 0.04)',
                    border: '1px solid rgba(var(--border-rgb, 200,200,200), 0.18)',
                    flexWrap: 'wrap',
                  }}>
                    {/* Badge tag */}
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
                      borderRadius: '999px', background: meta.bg, color: meta.color,
                      flexShrink: 0, marginTop: '2px',
                    }}>{meta.label}</span>

                    {/* Nội dung */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', marginRight: '0.4rem' }}>{tb.tieuDe}</span>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{shownContent}</span>
                      {isLong && (
                        <button
                          onClick={() => setTbExpanded((p) => ({ ...p, [tb.id]: !p[tb.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, padding: '0 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                        >
                          {isExpanded ? <><ChevronUp size={12} /> Thu gọn</> : <><ChevronDown size={12} /> Xem thêm</>}
                        </button>
                      )}
                    </div>

                    {/* Ngày hết hạn */}
                    {hetHanStr && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, alignSelf: 'center', whiteSpace: 'nowrap' }}>{hetHanStr}</span>
                    )}

                    {/* Nút quản lý (OWNER/MANAGER) */}
                    {canManageTB && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0, alignSelf: 'center' }}>
                        <button
                          onClick={() => openEditTB(tb)}
                          title="Sửa thông báo"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', borderRadius: '4px', display: 'flex' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => archiveTB(tb.id)}
                          title="Ẩn thông báo"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', borderRadius: '4px', display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                        {user.role === 'OWNER' && (
                          <button
                            onClick={() => deleteTB(tb.id, tb.tieuDe)}
                            title="Xóa vĩnh viễn"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '3px', borderRadius: '4px', display: 'flex', fontSize: '0.7rem', fontWeight: 700 }}
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal tạo/sửa thông báo */}
        {tbModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {tbModal === 'create' ? 'Tạo thông báo mới' : `Sửa: ${tbModal.tieuDe}`}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Tiêu đề <span style={{ color: 'var(--danger)' }}>*</span> ({tbForm.tieuDe.length}/80)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={tbForm.tieuDe}
                    onChange={(e) => setTbForm((p) => ({ ...p, tieuDe: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    placeholder="Nhập tiêu đề ngắn gọn..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Nội dung <span style={{ color: 'var(--danger)' }}>*</span> ({tbForm.noiDung.length}/500)
                  </label>
                  <textarea
                    maxLength={500}
                    rows={4}
                    value={tbForm.noiDung}
                    onChange={(e) => setTbForm((p) => ({ ...p, noiDung: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="Nhập nội dung chi tiết..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Loại thông báo</label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {Object.entries(TB_TAG_META).map(([key, m]) => (
                        <button
                          key={key}
                          onClick={() => setTbForm((p) => ({ ...p, tag: key }))}
                          style={{
                            padding: '3px 10px', borderRadius: '999px', border: '2px solid',
                            borderColor: tbForm.tag === key ? m.bg : 'transparent',
                            background: tbForm.tag === key ? m.bg : 'rgba(var(--brand-brown-rgb), 0.08)',
                            color: tbForm.tag === key ? m.color : 'var(--text-muted)',
                            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                          }}
                        >{m.label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ngày hết hạn (tùy chọn)</label>
                    <DateInput
                      value={tbForm.ngayHetHan}
                      onChange={(e) => setTbForm((p) => ({ ...p, ngayHetHan: e.target.value }))}
                      style={{ width: '100%' }}
                      inputStyle={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setTbModal(null)}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >Hủy</button>
                <button
                  onClick={saveTB}
                  disabled={tbSaving || !tbForm.tieuDe.trim() || !tbForm.noiDung.trim()}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >{tbSaving ? 'Đang lưu…' : 'Lưu'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ❹ ================= FUND HERO + FUND STRIP ================= */}
        {canQuy && (
          <>
            {/* Fund Hero — tổng tiền đang có */}
            <div className={styles.fundHero}>
              <div>
                <div className={styles.fundHeroLabel}>
                  Tiền đang có · tổng {funds.length} quỹ
                </div>
                <div className={styles.fundHeroVal}>
                  {fundsLoading
                    ? <span className="skeleton" style={{ display: 'block', width: '200px', height: '2.2rem', borderRadius: '6px', background: 'rgba(255,255,255,0.2)' }} />
                    : formatVND(tongSoDuQuy)
                  }
                </div>
                <div className={styles.fundHeroMeta}>
                  Cập nhật realtime
                  {pendingReimburse > 0 && ` · ${pendingReimburse} phiếu NV đang ứng chưa hoàn`}
                </div>
              </div>
              <button
                onClick={() => router.push('/quy')}
                className="btn"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}
              >
                <span>Chi tiết quỹ</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Fund Strip — chip từng quỹ */}
            <div className={styles.fundStrip}>
              {fundsLoading
                ? [1, 2, 3].map((i) => (
                    <div key={i} className={styles.fundChip}>
                      <span className="skeleton skeletonText" style={{ display: 'block', width: '80%', marginBottom: '0.4rem' }} />
                      <span className="skeleton skeletonText" style={{ display: 'block', width: '60%' }} />
                    </div>
                  ))
                : funds.map((fund) => (
                    <div
                      key={fund.id}
                      className={`${styles.fundChip} ${fund.soDuHienTai < 0 ? styles.fundChipNeg : ''}`}
                    >
                      <div className={styles.fundChipName}>
                        <Wallet size={13} />
                        {fund.tenQuy}
                      </div>
                      <div className={styles.fundChipVal}>{formatVND(fund.soDuHienTai)}</div>
                    </div>
                  ))
              }
            </div>
          </>
        )}

        {/* ❷ ================= CẦN XỬ LÝ ================= */}
        {canXuLy && !insightsLoading && (hasPending || hasCanhBao) && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
            <div className={styles.cardTitleBar}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--warning)' }} /> Cần xử lý
                {hasCanhBao && (
                  <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px' }}>{canhBao.tongSo}</span>
                )}
              </h2>
            </div>

            {/* Strip chờ duyệt */}
            {hasPending && (
              <div
                onClick={() => router.push('/de-xuat/duyet')}
                className={`${styles.alertRow} ${styles.alertInfo} ${styles.alertClickable}`}
                style={{ marginBottom: '1rem' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Clock size={16} style={{ color: 'var(--info)' }} />
                  <span><b>{pendingPayment}</b> phiếu chờ thanh toán · <b>{pendingReimburse}</b> phiếu chờ hoàn ứng</span>
                </span>
                <span className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>Duyệt đề xuất <ArrowRight size={13} /></span>
              </div>
            )}

            {/* Nhắc hạn thanh toán */}
            {hasCanhBao && canhBao.nhacHan.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarClock size={15} /> Hạn thanh toán ({canhBao.nhacHan.length})
                </p>
                {canhBao.nhacHan.map((p) => (
                  <div key={p.id} onClick={() => router.push('/de-xuat/duyet')} className={`${styles.alertRow} ${styles.alertClickable} ${p.quaHan ? styles.alertCritical : styles.alertWarning}`}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span className={styles.alertCode}>{p.maPhieu}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> — {p.noiDung}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>{formatVND(p.soTien)}</span>
                    <span className="badge" style={{ background: p.quaHan ? '#ef4444' : '#f59e0b', color: '#fff', whiteSpace: 'nowrap' }}>{fmtHan(p.soNgay)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Vượt / sắp chạm hạn mức */}
            {hasCanhBao && canhBao.vuotHanMuc.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Gauge size={15} /> Hạn mức chi tháng ({canhBao.vuotHanMuc.length})
                </p>
                {canhBao.vuotHanMuc.map((h) => (
                  <div key={h.danhMucId} className={`${styles.alertRow} ${h.vuot ? styles.alertCritical : styles.alertWarning}`}>
                    <span style={{ flex: 1, minWidth: '140px', fontWeight: 500 }}>{h.tenDanhMuc}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatVND(h.daChi)} / {formatVND(h.hanMuc)}</span>
                    <span className="badge" style={{ background: h.vuot ? '#ef4444' : '#f59e0b', color: '#fff' }}>{h.tile}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Vượt kế hoạch */}
            {hasCanhBao && canhBao.vuotKeHoach.length > 0 && (
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={15} /> Vượt kế hoạch chi tháng ({canhBao.vuotKeHoach.length})
                </p>
                {canhBao.vuotKeHoach.map((k) => (
                  <div key={k.danhMucId} onClick={() => router.push('/ke-hoach')} className={`${styles.alertRow} ${styles.alertCritical} ${styles.alertClickable}`}>
                    <span style={{ flex: 1, minWidth: '140px', fontWeight: 500 }}>{k.tenDanhMuc}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chi {formatVND(k.daChi)} / KH {formatVND(k.keHoach)}</span>
                    <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>{k.tile}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ❶ ================= BỨC TRANH THÁNG NÀY (KPI) ================= */}
        {canKPI && (
          <>
            <h2 className={styles.sectionTitle}>
              Sức khỏe tài chính — Tháng {thisMonth}/{currentYear}
            </h2>
            <div className={styles.dashboardGrid} style={{ marginBottom: '1.5rem' }}>
              {/* Doanh thu vs chỉ tiêu */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: `4px solid ${tileColor}` }}>
                <div className={styles.cardHeader}>
                  <span>Doanh thu tháng này</span>
                  <Target className={styles.cardIcon} style={{ color: tileColor }} />
                </div>
                <h3 style={{ color: tileColor }}>{insightsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '65%' }} /> : <AnimatedNumber value={doanhThuThang} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>Đạt {tileChiTieu}% chỉ tiêu ({formatVND(chiTieuThang)})</p>
              </div>

              {/* Chi phí vs kế hoạch */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className={styles.cardHeader}>
                  <span>Chi phí tháng này</span>
                  <TrendingDown className={styles.cardIcon} style={{ color: 'var(--danger)' }} />
                </div>
                <h3 style={{ color: 'var(--danger)' }}>{insightsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '65%' }} /> : <AnimatedNumber value={chiPhiThang} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>
                  {chiPhiKeHoachThang > 0 ? `${tileChiPhi}% kế hoạch (${formatVND(chiPhiKeHoachThang)})` : 'Chưa đặt kế hoạch chi tháng'}
                </p>
                {conLaiCoDinh > 0 && (
                  <p className={styles.cardInfo} style={{ marginTop: '0.15rem' }}>
                    đã chi {formatVND(chiPhiThang)} · dự kiến thêm ~{formatVND(conLaiCoDinh)} → ước cả tháng ~{formatVND(duKienCaThang)}
                  </p>
                )}
              </div>

              {/* Lãi/Lỗ tháng + biên lợi nhuận */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: `4px solid ${laiLoThang >= 0 ? '#10b981' : '#ef4444'}` }}>
                <div className={styles.cardHeader}>
                  <span>{laiLoThang >= 0 ? 'Lãi tháng này' : 'Lỗ tháng này'}</span>
                  <Scale className={styles.cardIcon} style={{ color: laiLoThang >= 0 ? '#10b981' : '#ef4444' }} />
                </div>
                <h3 style={{ color: laiLoThang >= 0 ? '#10b981' : '#ef4444' }}>
                  {insightsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '65%' }} /> : <AnimatedNumber value={laiLoThang} format={formatVND} />}
                </h3>
                <p className={styles.cardInfo}>Biên lợi nhuận {bienLoiNhuan}% · <span style={{ cursor: 'pointer', color: 'var(--info)' }} onClick={() => router.push('/loi-nhuan')}>Xem 12 tháng →</span></p>
                {conLaiCoDinh > 0 && (
                  <p className={styles.cardInfo} style={{ marginTop: '0.15rem', color: laiDuKienCaThang >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    Lãi ước cả tháng ~{formatVND(laiDuKienCaThang)}
                  </p>
                )}
              </div>

              {/* Tiền đang có (số dư quỹ) */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: '4px solid var(--info)' }}>
                <div className={styles.cardHeader}>
                  <span>Tiền đang có</span>
                  <Banknote className={styles.cardIcon} style={{ color: 'var(--info)' }} />
                </div>
                <h3>{fundsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '65%' }} /> : <AnimatedNumber value={tongSoDuQuy} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>Tổng số dư {funds.length} quỹ (thực tế dùng thanh toán)</p>
              </div>
            </div>
          </>
        )}

        {/* ❷.5 ================= DỰ BÁO DÒNG TIỀN ================= */}
        {canDuBao && (
          <div className={`glass-card ${styles.forecastCard}`}>
            <div className={styles.forecastHead}>
              <h2 className={styles.forecastTitle}>
                <Activity size={18} style={{ color: 'var(--info)' }} />
                Dự báo dòng tiền — cuối tháng
              </h2>
              <button
                onClick={() => router.push('/quy')}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                <span>Chi tiết quỹ</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {duBaoLoading ? (
              <div style={{ padding: '0.25rem 0' }}>
                <span className="skeleton skeletonTitle" style={{ display: 'block', width: '48%', marginBottom: '0.75rem' }} />
                <span className="skeleton skeletonText" style={{ display: 'block', width: '82%', marginBottom: '0.5rem' }} />
                <span className="skeleton skeletonText" style={{ display: 'block', width: '64%' }} />
              </div>
            ) : !duBao ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Không tải được dữ liệu dự báo.</p>
            ) : (
              <>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  Số dư ước tính cuối tháng
                </p>
                <p
                  className={styles.forecastKpi}
                  style={{ color: duBao.soDuDuBaoCuoiKy >= 0 ? '#10b981' : '#ef4444', cursor: 'help' }}
                  title={[
                    `Số dư hiện tại: ${formatVND(duBao.soDuHomNay)}`,
                    `Thu dự kiến: ${formatVND(duBao.giaDinh.avgThuNgay)}/ngày × ${duBao.soNgayForecast} ngày${duBao.giaDinh.nguonThu === 'ke-hoach' ? ' (theo KH tháng)' : ' (xu hướng 30 ngày)'}`,
                    `Chi xu hướng: ${formatVND(duBao.giaDinh.avgChiNgay)}/ngày (ngày có phiếu dùng số thực)`,
                    duBao.giaDinh.tongChiCommitted > 0 ? `Phiếu cam kết: ${formatVND(duBao.giaDinh.tongChiCommitted)} (${duBao.giaDinh.soPhieuSapToi} phiếu)` : '',
                    `─────────────────────────`,
                    `→ Ước tính ${duBao.soDuDuBaoCuoiKy >= 0 ? 'còn dư' : '⚠️ âm quỹ'}: ${duBao.soDuDuBaoCuoiKy >= 0 ? '+' : '−'}${formatVND(Math.abs(duBao.soDuDuBaoCuoiKy))}`,
                  ].filter(Boolean).join('\n')}
                >
                  {duBao.soDuDuBaoCuoiKy >= 0 ? '+' : '−'}~{formatVND(Math.abs(duBao.soDuDuBaoCuoiKy))}
                  {duBao.soDuDuBaoCuoiKy < 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: '0.4rem' }}>(ÂM)</span>}
                </p>
                <p className={styles.forecastSub}>
                  Số dư hôm nay {formatVND(duBao.soDuHomNay)} · Còn {duBao.soNgayForecast} ngày
                  {` · Thu ${duBao.giaDinh.nguonThu === 'ke-hoach' ? 'KH' : 'xu hướng'} ${formatVND(duBao.giaDinh.avgThuNgay)}/ngày`}
                  {` · Chi xu hướng ${formatVND(duBao.giaDinh.avgChiNgay)}/ngày`}
                  {duBao.giaDinh.soPhieuSapToi > 0 && ` · ${duBao.giaDinh.soPhieuSapToi} phiếu cam kết (${formatVND(duBao.giaDinh.tongChiCommitted)})`}
                </p>

                {duBao.canhBaoAm && (
                  <div className={styles.forecastWarning}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      Quỹ có thể âm khoảng ngày{' '}
                      <strong>
                        {(() => {
                          const d = new Date(duBao.ngayCoTheAm + 'T00:00:00');
                          const dd = String(d.getDate()).padStart(2, '0');
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          return `${dd}/${mm}`;
                        })()}
                      </strong>{' '}
                      nếu chi theo xu hướng hiện tại — cần bổ sung thu hoặc cắt giảm chi.
                    </span>
                  </div>
                )}

                {duBao.timeline.length > 0 && (
                  <div className={styles.forecastTimeline}>
                    {duBao.timeline.map((w, i) => (
                      <div key={i} className={styles.forecastWeek}>
                        <span className={styles.forecastWeekLabel}>{w.nhan}</span>
                        <span
                          className={styles.forecastWeekVal}
                          style={{ color: w.soDuCuoiTuan >= 0 ? '#10b981' : '#ef4444' }}
                        >
                          {w.soDuCuoiTuan >= 0 ? '' : '-'}
                          {Math.abs(w.soDuCuoiTuan) >= 1_000_000
                            ? `${Math.round(Math.abs(w.soDuCuoiTuan) / 1_000_000)}tr`
                            : Math.abs(w.soDuCuoiTuan) >= 1_000
                            ? `${Math.round(Math.abs(w.soDuCuoiTuan) / 1_000)}k`
                            : formatVND(Math.abs(w.soDuCuoiTuan))}
                        </span>
                        {w.chiCommitted > 0 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--warning)', textAlign: 'center' }} title={`Cam kết: ${formatVND(w.chiCommitted)}`}>
                            📌
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ❸ ================= BIỂU ĐỒ XU HƯỚNG (Thu-Chi + Lãi/Lỗ) ================= */}
        {canXuHuong && (
          <div className={`glass-card ${styles.largeCard}`} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.cardTitleBar}>
              <h2>Thu - Chi & Lãi/Lỗ 6 tháng gần nhất</h2>
              <button onClick={() => router.push('/bao-cao')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <span>Báo cáo đầy đủ</span>
                <ArrowRight size={14} />
              </button>
            </div>
            {txLoading ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', padding: '0 0.5rem' }}>
                {[68, 85, 55, 78, 45, 72].map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <div className="skeleton" style={{ width: '100%', height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
                    <span className="skeleton skeletonText" style={{ width: '32px', display: 'block' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', padding: '0 0.5rem' }}>
                {monthlyData.map((m) => (
                  <div key={`${m.year}-${m.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', height: '140px', justifyContent: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div title={`Thu${m.thuLaUocTinh ? ' (doanh thu ước tính)' : ''}: ${formatVND(m.thu)}`} style={{ width: '100%', height: `${Math.round((m.thu / maxMonthly) * 100)}%`, minHeight: m.thu > 0 ? '4px' : '0', background: m.thuLaUocTinh ? 'var(--chart-thu-gradient-est, linear-gradient(180deg, #6ee7b7 0%, #34d399 100%))' : 'var(--chart-thu-gradient, linear-gradient(180deg, #34d399 0%, #10b981 100%))', opacity: m.thuLaUocTinh ? 0.7 : 1, borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div title={`Chi: ${formatVND(m.chi)}`} style={{ width: '100%', height: `${Math.round((m.chi / maxMonthly) * 100)}%`, minHeight: m.chi > 0 ? '4px' : '0', background: 'var(--chart-chi-gradient, linear-gradient(180deg, #fca5a5 0%, #ef4444 100%))', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>T{m.month}/{String(m.year).slice(-2)}</span>
                  </div>
                ))}

                {/* Overlay đường Lãi/Lỗ */}
                {lnLine && (
                  <div style={{ position: 'absolute', left: '0.5rem', right: '0.5rem', top: 0, height: '140px', pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {lnLine.markers.length >= 2 && (
                        <polyline points={lnLine.points} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      )}
                    </svg>
                    {lnLine.markers.map((mk, i) => (
                      <div
                        key={i}
                        title={`Lãi/Lỗ T${mk.month}: ${formatVND(mk.v)}`}
                        style={{ position: 'absolute', left: `${mk.x}%`, top: `${mk.y}%`, transform: 'translate(-50%,-50%)', width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', border: '2px solid var(--surface)', pointerEvents: 'auto', cursor: 'help' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {!txLoading && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981', display: 'inline-block' }}></span>
                  Thu vào{monthlyData.some((m) => m.thuLaUocTinh) ? ' *' : ''}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }}></span>
                  Chi ra
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }}></span>
                  Lãi/Lỗ
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>Di chuột vào cột/điểm để xem số tiền</span>
                {monthlyData.some((m) => m.thuLaUocTinh) && (
                  <span style={{ width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    * Tháng chưa hợp thức hoá: Thu vào = doanh thu thực tế (ước tính)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= KHỐI CÁ NHÂN (LEADER/STAFF) ================= */}
        {canPersonal && (
          <>
            <div className={styles.dashboardGrid}>
              <div className={`${styles.statCard} ${styles.blueCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Tổng tiền bạn đề xuất</span>
                  <TrendingDown className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '65%' }} /> : formatVND(myTotalAmount)}</h3>
                <p className={styles.cardInfo}>Tổng các phiếu bạn đã lập</p>
              </div>

              <div className={`${styles.statCard} ${styles.yellowCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đang chờ duyệt</span>
                  <Clock className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '55%' }} /> : `${myPending} phiếu`}</h3>
                <p className={styles.cardInfo}>Chờ thanh toán hoặc chờ hoàn ứng</p>
              </div>

              <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đã được thanh toán</span>
                  <CheckCircle className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '55%' }} /> : `${myPaid} phiếu`}</h3>
                <p className={styles.cardInfo}>Khoản chi đã được shop thanh toán</p>
              </div>

              <div className={`${styles.statCard} ${styles.redCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đề xuất bị Hủy</span>
                  <XCircle className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? <span className="skeleton skeletonTitle" style={{ display: 'block', width: '55%' }} /> : `${myRejected.length} phiếu`}</h3>
                <p className={styles.cardInfo}>Đề xuất bị từ chối hoặc bạn đã hủy</p>
              </div>
            </div>

            {/* ⚠ Phiếu sắp đến hạn thanh toán */}
            {!proposalsLoading && soonDue.length > 0 && (
              <div className="glass-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
                  <CalendarClock size={18} style={{ color: 'var(--warning)' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Phiếu sắp đến hạn thanh toán
                  </span>
                  <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px' }}>
                    {soonDue.length}
                  </span>
                </div>
                {soonDue.map((p) => {
                  const diffDays = Math.round((new Date(p.ngayCanThanhToan) - new Date()) / 86400000);
                  const quaHan = diffDays < 0;
                  const label = quaHan ? `Quá hạn ${Math.abs(diffDays)} ngày` : diffDays === 0 ? 'Đến hạn hôm nay' : `Còn ${diffDays} ngày`;
                  return (
                    <div key={p.id} onClick={() => router.push('/de-xuat')} className={`${styles.alertRow} ${styles.alertClickable} ${quaHan ? styles.alertCritical : styles.alertWarning}`}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <span className={styles.alertCode} style={{ fontSize: '0.88rem' }}>{p.maPhieu}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}> — {p.noiDung}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatVND(p.soTien)}</span>
                      <span className="badge" style={{ background: quaHan ? '#ef4444' : '#f59e0b', color: '#fff', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cần bổ sung — phiếu bị từ chối/hủy */}
            {!proposalsLoading && myRejected.length > 0 && (
              <div className="glass-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
                <div className={styles.cardTitleBar}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} style={{ color: 'var(--danger)' }} /> Cần xem lại
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px' }}>{myRejected.length}</span>
                  </h2>
                </div>
                {myRejected.slice(0, 5).map((p) => (
                  <div key={p.id} onClick={() => router.push('/de-xuat')} className={`${styles.alertRow} ${styles.alertCritical} ${styles.alertClickable}`}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span className={styles.alertCode}>{p.maPhieu}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> — {p.noiDung}</span>
                      {p.ghiChu && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}> · {p.ghiChu}</span>}
                    </div>
                    <span style={{ fontWeight: 700 }}>{formatVND(p.soTien)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ❺ ================= NGÂN SÁCH THEO DANH MỤC (STAFF/LEADER) ================= */}
        {canNganSach && (
          <div className="glass-card" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            <div className={styles.cardTitleBar}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={19} style={{ color: 'var(--info)' }} />
                Ngân sách danh mục — Tháng {thisMonth}
              </h2>
              <button onClick={() => router.push('/ke-hoach')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <span>Kế hoạch chi phí</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {nganSachLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <span className="skeleton skeletonText" style={{ display: 'block', width: '55%', marginBottom: '0.45rem' }} />
                    <span className="skeleton" style={{ display: 'block', height: '8px', borderRadius: '4px' }} />
                  </div>
                ))}
              </div>
            ) : nganSachRows.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>
                Chưa có kế hoạch chi nào được đặt cho tháng này.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {nganSachRows.map((row, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', flex: 1, minWidth: '120px' }}>{row.tenDanhMuc}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatVND(row.daChi)} / {formatVND(row.keHoach)}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: row.color, whiteSpace: 'nowrap', minWidth: '38px', textAlign: 'right' }}>{row.pct}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(var(--brand-brown-rgb), 0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: row.color, borderRadius: '3px', transition: 'width 0.35s ease' }} />
                    </div>
                    <p style={{ fontSize: '0.74rem', color: row.con >= 0 ? 'var(--text-muted)' : '#ef4444', marginTop: '0.2rem' }}>
                      {row.con >= 0 ? `Còn lại ${formatVND(row.con)}` : `Vượt kế hoạch ${formatVND(Math.abs(row.con))}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ❻ ================= DOANH THU THÁNG MINI (STAFF/LEADER) ================= */}
        {canDoanhThuMini && (
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <div className={styles.cardTitleBar}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={19} style={{ color: 'var(--success)' }} />
                Doanh thu shop — Tháng {thisMonth}
              </h2>
              <button onClick={() => router.push('/doanh-thu')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <span>Chi tiết</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {doanhThuSummaryLoading ? (
              <div>
                <span className="skeleton skeletonTitle" style={{ display: 'block', width: '50%', marginBottom: '1rem' }} />
                <span className="skeleton" style={{ display: 'block', height: '8px', borderRadius: '4px', marginBottom: '1rem' }} />
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ marginBottom: '0.6rem' }}>
                    <span className="skeleton skeletonText" style={{ display: 'block', width: '60%', marginBottom: '0.2rem' }} />
                    <span className="skeleton" style={{ display: 'block', height: '4px', borderRadius: '2px' }} />
                  </div>
                ))}
              </div>
            ) : !doanhThuThangMini ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>
                Chưa có chỉ tiêu doanh thu cho tháng này.
              </p>
            ) : (
              <>
                {/* KPI tổng */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Chỉ tiêu tháng</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>{formatVND(doanhThuThangMini.chiTieuTong)}</p>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Thực tế</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, color: doanhThuThangMini.pctColor }}>{formatVND(doanhThuThangMini.thucTeTong)}</p>
                  </div>
                  <div style={{ flex: 0, minWidth: '60px', textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Đạt</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, color: doanhThuThangMini.pctColor }}>{doanhThuThangMini.pct}%</p>
                  </div>
                </div>
                {/* Progress tổng */}
                <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(var(--brand-brown-rgb), 0.08)', overflow: 'hidden', marginBottom: '1rem' }}>
                  <div style={{ width: `${Math.min(doanhThuThangMini.pct, 100)}%`, height: '100%', background: doanhThuThangMini.pctColor, borderRadius: '4px', transition: 'width 0.35s ease' }} />
                </div>
                {/* Per kênh */}
                {doanhThuThangMini.byKenh.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {doanhThuThangMini.byKenh.map((k, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)', flex: 1, minWidth: '100px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: k.mauSac, flexShrink: 0 }} />
                            {k.tenKenh}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatVND(k.thucTe)} / {formatVND(k.chiTieu)}</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: k.color, minWidth: '36px', textAlign: 'right' }}>{k.pct}%</span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(var(--brand-brown-rgb), 0.08)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(k.pct, 100)}%`, height: '100%', background: k.mauSac, borderRadius: '2px', transition: 'width 0.35s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
