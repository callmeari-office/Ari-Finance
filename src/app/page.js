'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AriLoader from '@/components/AriLoader';
import AriCameo from '@/components/AriCameo';
import AnimatedNumber from '@/components/AnimatedNumber';
import { isRestrictedToOwnProposals, canViewMenu } from '@/lib/roles';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dashboard states
  const [funds, setFunds] = useState([]);
  const [proposals, setProposals] = useState([]); // chỉ dùng cho thống kê cá nhân (STAFF/LEADER)
  const [recentProposals, setRecentProposals] = useState([]); // 5 phiếu gần đây (mọi vai trò)
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

          // 2. Fetch dữ liệu Dashboard — chỉ tải những gì vai trò được xem.
          //    Các API tài chính (/quy, /thu-chi, /loi-nhuan, /canh-bao) chỉ phục vụ
          //    OWNER/MANAGER ở server; nếu cấp quyền widget cho vai trò khác thì cần
          //    mở thêm quyền ở API tương ứng (ngoài phạm vi trang này).
          fetchProposals(u);
          const seeFunds = canViewMenu(u, 'tqQuy') || canViewMenu(u, 'tqKPITaiChinh');
          const seeTx = canViewMenu(u, 'tqXuHuong') || canViewMenu(u, 'tqKPITaiChinh');
          const seeInsights = canViewMenu(u, 'tqKPITaiChinh') || canViewMenu(u, 'tqCanXuLy');
          const seeDuBao = canViewMenu(u, 'tqDuBao');
          if (seeFunds) fetchFunds(); else setFundsLoading(false);
          if (seeTx) fetchTransactions(); else setTxLoading(false);
          if (seeInsights) fetchInsights(); else setInsightsLoading(false);
          if (seeDuBao) fetchDuBao(); else setDuBaoLoading(false);
        }
      })
      .catch((err) => {
        console.error('Session verification error:', err);
        router.push('/login');
      });
  }, [router]);

  const fetchProposals = async (u) => {
    try {
      if (isRestrictedToOwnProposals(u.role)) {
        // STAFF/LEADER: chỉ có đề xuất của mình (số lượng nhỏ) → tải về để tính thống kê
        // cá nhân + danh sách gần đây, giữ nguyên 100% cách tính cũ.
        const res = await fetch('/api/de-xuat?limit=1000');
        if (res.ok) {
          const data = await res.json();
          const list = data.data || [];
          setProposals(list);
          setRecentProposals(list.slice(0, 5));
        }
      } else {
        // OWNER/MANAGER: KHÔNG kéo toàn bộ phiếu nữa. Chỉ tải 5 phiếu gần đây + đếm nhẹ
        // số phiếu chờ thanh toán / chờ hoàn ứng qua pagination.total (truy vấn count ở server).
        const [recentRes, payRes, reimRes] = await Promise.all([
          fetch('/api/de-xuat?limit=5'),
          fetch('/api/de-xuat?trangThai=CHO_THANH_TOAN&limit=1'),
          fetch('/api/de-xuat?trangThai=CHO_HOAN_UNG&limit=1'),
        ]);
        if (recentRes.ok) {
          const d = await recentRes.json();
          setRecentProposals(d.data || []);
        }
        if (payRes.ok) {
          const d = await payRes.json();
          setPendingPayment(d.pagination?.total || 0);
        }
        if (reimRes.ok) {
          const d = await reimRes.json();
          setPendingReimburse(d.pagination?.total || 0);
        }
      }
    } catch (e) {
      console.error('Error fetching proposals:', e);
    } finally {
      setProposalsLoading(false);
    }
  };

  const fetchFunds = async () => {
    try {
      const res = await fetch('/api/quy');
      if (res.ok) {
        const data = await res.json();
        setFunds(data);
      }
    } catch (e) {
      console.error('Error fetching funds:', e);
    } finally {
      setFundsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/thu-chi?limit=2000&includeHistory=true');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setTxLoading(false);
    }
  };

  const fetchDuBao = async () => {
    try {
      const res = await fetch('/api/du-bao-dong-tien?days=thang');
      if (res.ok) setDuBao(await res.json());
    } catch (e) {
      console.error('Error fetching duBao:', e);
    } finally {
      setDuBaoLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const nam = new Date().getFullYear();
      const [resLn, resCb] = await Promise.all([
        fetch(`/api/loi-nhuan?nam=${nam}`),
        fetch('/api/canh-bao'),
      ]);
      if (resLn.ok) {
        const d = await resLn.json();
        setProfitMonths(d.months || []);
      }
      if (resCb.ok) {
        setCanhBao(await resCb.json());
      }
    } catch (e) {
      console.error('Error fetching insights:', e);
    } finally {
      setInsightsLoading(false);
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

  // ===== Biểu đồ Thu-Chi 6 tháng + đường Lãi/Lỗ =====
  const buildMonthlyChart = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, thu: 0, chi: 0 });
    }
    transactions.forEach((tx) => {
      const d = new Date(tx.ngayGiaoDich);
      const found = months.find((x) => x.year === d.getFullYear() && x.month === d.getMonth() + 1);
      if (!found) return;
      if (tx.loaiGiaoDich === 'THU') found.thu += tx.soTien;
      else found.chi += tx.soTien;
    });
    return months;
  };
  const monthlyData = buildMonthlyChart();
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
          <div className={styles.actions}>
            <button onClick={() => router.push('/de-xuat')} className="btn btn-primary">
              <PlusCircle size={18} />
              <span>Tạo đề xuất chi</span>
            </button>
          </div>
        </div>

        {/* ❶ ================= BỨC TRANH THÁNG NÀY (KPI) ================= */}
        {canKPI && (
          <>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 1rem' }}>
              Sức khỏe tài chính — Tháng {thisMonth}/{currentYear}
            </h2>
            <div className={styles.dashboardGrid} style={{ marginBottom: '1.5rem' }}>
              {/* Doanh thu vs chỉ tiêu */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: `4px solid ${tileColor}` }}>
                <div className={styles.cardHeader}>
                  <span>Doanh thu tháng này</span>
                  <Target className={styles.cardIcon} style={{ color: tileColor }} />
                </div>
                <h3 style={{ color: tileColor }}>{insightsLoading ? '...' : <AnimatedNumber value={doanhThuThang} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>Đạt {tileChiTieu}% chỉ tiêu ({formatVND(chiTieuThang)})</p>
              </div>

              {/* Chi phí vs kế hoạch */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: '4px solid #ef4444' }}>
                <div className={styles.cardHeader}>
                  <span>Chi phí tháng này</span>
                  <TrendingDown className={styles.cardIcon} style={{ color: '#ef4444' }} />
                </div>
                <h3 style={{ color: '#ef4444' }}>{insightsLoading ? '...' : <AnimatedNumber value={chiPhiThang} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>
                  {chiPhiKeHoachThang > 0 ? `${tileChiPhi}% kế hoạch (${formatVND(chiPhiKeHoachThang)})` : 'Chưa đặt kế hoạch chi tháng'}
                </p>
              </div>

              {/* Lãi/Lỗ tháng + biên lợi nhuận */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: `4px solid ${laiLoThang >= 0 ? '#10b981' : '#ef4444'}` }}>
                <div className={styles.cardHeader}>
                  <span>{laiLoThang >= 0 ? 'Lãi tháng này' : 'Lỗ tháng này'}</span>
                  <Scale className={styles.cardIcon} style={{ color: laiLoThang >= 0 ? '#10b981' : '#ef4444' }} />
                </div>
                <h3 style={{ color: laiLoThang >= 0 ? '#10b981' : '#ef4444' }}>
                  {insightsLoading ? '...' : <AnimatedNumber value={laiLoThang} format={formatVND} />}
                </h3>
                <p className={styles.cardInfo}>Biên lợi nhuận {bienLoiNhuan}% · <span style={{ cursor: 'pointer', color: 'var(--info)' }} onClick={() => router.push('/loi-nhuan')}>Xem 12 tháng →</span></p>
              </div>

              {/* Tiền đang có (số dư quỹ) */}
              <div className={`${styles.statCard} glass-card`} style={{ borderLeft: '4px solid var(--info)' }}>
                <div className={styles.cardHeader}>
                  <span>Tiền đang có</span>
                  <Banknote className={styles.cardIcon} style={{ color: 'var(--info)' }} />
                </div>
                <h3>{fundsLoading ? '...' : <AnimatedNumber value={tongSoDuQuy} format={formatVND} />}</h3>
                <p className={styles.cardInfo}>Tổng số dư {funds.length} quỹ (thực tế dùng thanh toán)</p>
              </div>
            </div>
          </>
        )}

        {/* ❷ ================= CẦN XỬ LÝ ================= */}
        {canXuLy && !insightsLoading && (hasPending || hasCanhBao) && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
            <div className={styles.cardTitleBar}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} style={{ color: '#f59e0b' }} /> Cần xử lý
                {hasCanhBao && (
                  <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px' }}>{canhBao.tongSo}</span>
                )}
              </h2>
            </div>

            {/* Strip chờ duyệt */}
            {hasPending && (
              <div
                onClick={() => router.push('/de-xuat/duyet')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: '10px', background: 'rgba(96,165,250,0.08)', marginBottom: '1rem', cursor: 'pointer', flexWrap: 'wrap' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Clock size={16} style={{ color: '#60a5fa' }} />
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
                  <div key={p.id} onClick={() => router.push('/de-xuat/duyet')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: p.quaHan ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.07)', marginBottom: '0.4rem', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span style={{ fontWeight: 600, color: '#60a5fa' }}>{p.maPhieu}</span>
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
                  <div key={h.danhMucId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: h.vuot ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.07)', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
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
                  <div key={k.danhMucId} onClick={() => router.push('/ke-hoach')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', marginBottom: '0.4rem', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: '140px', fontWeight: 500 }}>{k.tenDanhMuc}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chi {formatVND(k.daChi)} / KH {formatVND(k.keHoach)}</span>
                    <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>{k.tile}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              <div className={styles.loaderSmall}>Đang tính dự báo...</div>
            ) : !duBao ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Không tải được dữ liệu dự báo.</p>
            ) : (
              <>
                <p className={styles.forecastKpi} style={{ color: duBao.soDuDuBaoCuoiKy >= 0 ? '#10b981' : '#ef4444' }}>
                  ~{formatVND(Math.abs(duBao.soDuDuBaoCuoiKy))}
                  {duBao.soDuDuBaoCuoiKy < 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: '0.4rem' }}>(âm)</span>}
                </p>
                <p className={styles.forecastSub}>
                  Còn {duBao.soNgayForecast} ngày đến cuối tháng · Số dư hiện tại {formatVND(duBao.soDuHomNay)}
                  {duBao.giaDinh.soPhieuSapToi > 0 && ` · ${duBao.giaDinh.soPhieuSapToi} phiếu cam kết sắp tới`}
                  {duBao.giaDinh.nguonThu === 'ke-hoach' ? ' · Thu theo chỉ tiêu tháng' : ' · Thu theo xu hướng 30 ngày'}
                </p>

                {duBao.canhBaoAm && (
                  <div className={styles.forecastWarning}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      Quỹ có thể âm khoảng ngày{' '}
                      <strong>
                        {new Date(duBao.ngayCoTheAm + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
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
                          <span style={{ fontSize: '0.65rem', color: '#f59e0b', textAlign: 'center' }} title={`Cam kết: ${formatVND(w.chiCommitted)}`}>
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
              <div className={styles.loaderSmall}>Đang tải dữ liệu...</div>
            ) : (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', padding: '0 0.5rem' }}>
                {monthlyData.map((m) => (
                  <div key={`${m.year}-${m.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', height: '140px', justifyContent: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div title={`Thu: ${formatVND(m.thu)}`} style={{ width: '100%', height: `${Math.round((m.thu / maxMonthly) * 100)}%`, minHeight: m.thu > 0 ? '4px' : '0', background: 'var(--chart-thu-gradient, linear-gradient(180deg, #34d399 0%, #10b981 100%))', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
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
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981', display: 'inline-block' }}></span>
                  Thu vào
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
              </div>
            )}
          </div>
        )}

        {/* ❹ ================= SỐ DƯ CÁC QUỸ (Realtime) ================= */}
        {canQuy && (
          <div className={`glass-card ${styles.largeCard}`} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.cardTitleBar}>
              <h2>Trạng thái số dư các Quỹ (Realtime)</h2>
              <button onClick={() => router.push('/quy')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <span>Chi tiết</span>
                <ArrowRight size={14} />
              </button>
            </div>
            {fundsLoading ? (
              <div className={styles.loaderSmall}>Đang tính toán số dư...</div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Mã Quỹ</th>
                      <th>Tên Quỹ</th>
                      <th>Loại quỹ</th>
                      <th>Số dư đầu kỳ</th>
                      <th>Số dư hiện tại</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((fund) => (
                      <tr key={fund.id}>
                        <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{fund.id}</td>
                        <td>{fund.tenQuy}</td>
                        <td>{fund.loaiQuy === 'TIEN_MAT' ? '💵 Tiền mặt' : fund.loaiQuy === 'NGAN_HANG' ? '🏦 Ngân hàng' : '📱 Ví điện tử / Khác'}</td>
                        <td>{formatVND(fund.soDuDauKy)}</td>
                        <td style={{ fontWeight: '700', color: fund.soDuHienTai >= 0 ? '#10b981' : '#ef4444' }}>{formatVND(fund.soDuHienTai)}</td>
                        <td><span className="badge badge-paid">Đang dùng</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <h3>{proposalsLoading ? '...' : formatVND(myTotalAmount)}</h3>
                <p className={styles.cardInfo}>Tổng các phiếu bạn đã lập</p>
              </div>

              <div className={`${styles.statCard} ${styles.yellowCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đang chờ duyệt</span>
                  <Clock className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? '...' : myPending} phiếu</h3>
                <p className={styles.cardInfo}>Chờ thanh toán hoặc chờ hoàn ứng</p>
              </div>

              <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đã được thanh toán</span>
                  <CheckCircle className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? '...' : myPaid} phiếu</h3>
                <p className={styles.cardInfo}>Khoản chi đã được shop thanh toán</p>
              </div>

              <div className={`${styles.statCard} ${styles.redCard} glass-card`}>
                <div className={styles.cardHeader}>
                  <span>Đề xuất bị Hủy</span>
                  <XCircle className={styles.cardIcon} />
                </div>
                <h3>{proposalsLoading ? '...' : myRejected.length} phiếu</h3>
                <p className={styles.cardInfo}>Đề xuất bị từ chối hoặc bạn đã hủy</p>
              </div>
            </div>

            {/* Cần bổ sung — phiếu bị từ chối/hủy */}
            {!proposalsLoading && myRejected.length > 0 && (
              <div className="glass-card" style={{ marginTop: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                <div className={styles.cardTitleBar}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} style={{ color: '#ef4444' }} /> Cần xem lại
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px' }}>{myRejected.length}</span>
                  </h2>
                </div>
                {myRejected.slice(0, 5).map((p) => (
                  <div key={p.id} onClick={() => router.push('/de-xuat')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', marginBottom: '0.4rem', cursor: 'pointer', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <span style={{ fontWeight: 600, color: '#60a5fa' }}>{p.maPhieu}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> — {p.noiDung}</span>
                      {p.ghiChu && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}> · {p.ghiChu}</span>}
                    </div>
                    <span style={{ fontWeight: 700 }}>{formatVND(p.soTien)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ================= ĐỀ XUẤT GẦN ĐÂY (chung) ================= */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          <div className={styles.cardTitleBar}>
            <h2>Đề xuất chi phí gần đây</h2>
            <button onClick={() => router.push('/de-xuat')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              <span>Tất cả đề xuất</span>
              <ArrowRight size={14} />
            </button>
          </div>
          {proposalsLoading ? (
            <div className={styles.loaderSmall}>Đang tải danh sách...</div>
          ) : recentProposals.length === 0 ? (
            <div className={styles.emptyState}>
              <AriCameo size={64} className={styles.emptyCameo} />
              <p>Chưa có đề xuất chi phí nào được lập.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Ngày lập</th>
                    <th>Người đề xuất</th>
                    <th>Danh mục</th>
                    <th>Nguồn tiền</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProposals.slice(0, 5).map((prop) => (
                    <tr key={prop.id}>
                      <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{prop.maPhieu}</td>
                      <td>{new Date(prop.ngayPhatSinh).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span style={{ fontWeight: '500' }}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                        <br />
                        <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                      </td>
                      <td>{prop.danhMuc.tenDanhMuc}</td>
                      <td>
                        {prop.nguonTien === 'TIEN_SHOP' ? (
                          <span style={{ color: 'var(--info)' }}>🏦 Tiền Shop</span>
                        ) : (
                          <span style={{ color: 'var(--success)' }}>👤 Cá nhân ứng</span>
                        )}
                      </td>
                      <td style={{ fontWeight: '700' }}>{formatVND(prop.soTien)}</td>
                      <td>
                        {prop.trangThai === 'DA_THANH_TOAN' && <span className="badge badge-paid">Đã thanh toán</span>}
                        {prop.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                        {prop.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                        {prop.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
