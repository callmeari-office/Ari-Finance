'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Wallet,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { isRestrictedToOwnProposals } from '@/lib/roles';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dashboard states
  const [funds, setFunds] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [fundsLoading, setFundsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);

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
          setUser(data.user);
          setLoading(false);
          
          // 2. Fetch dữ liệu Dashboard
          fetchProposals();
          if (data.user.role === 'OWNER' || data.user.role === 'MANAGER') {
            fetchFunds();
            fetchTransactions();
          } else {
            setFundsLoading(false);
            setTxLoading(false);
          }
        }
      })
      .catch((err) => {
        console.error('Session verification error:', err);
        router.push('/login');
      });
  }, [router]);

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/de-xuat?limit=1000');
      if (res.ok) {
        const data = await res.json();
        setProposals(data.data || []);
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

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải dữ liệu tài chính...</p>
      </div>
    );
  }

  // TÍNH TOÁN CÁC CHỈ SỐ THỐNG KÊ (Dựa trên Role)
  
  // 1. Đối với STAFF: Thống kê đề xuất cá nhân
  const staffProposals = proposals;
  const staffTotalAmount = staffProposals.reduce((sum, p) => sum + p.soTien, 0);
  const staffPending = staffProposals.filter(p => p.trangThai === 'CHO_THANH_TOAN' || p.trangThai === 'CHO_HOAN_UNG').length;
  const staffPaid = staffProposals.filter(p => p.trangThai === 'DA_THANH_TOAN').length;
  const staffCancelled = staffProposals.filter(p => p.trangThai === 'HUY').length;

  // 2. Đối với MANAGER: Thống kê toàn bộ đề xuất của shop (trừ nhạy cảm)
  const managerProposals = proposals;
  const managerTotalAmount = managerProposals.reduce((sum, p) => sum + p.soTien, 0);
  const managerPending = managerProposals.filter(p => p.trangThai === 'CHO_THANH_TOAN' || p.trangThai === 'CHO_HOAN_UNG').length;
  const managerPaid = managerProposals.filter(p => p.trangThai === 'DA_THANH_TOAN').length;

  // 3. Đối với OWNER: Thống kê quỹ + ThuChi + Đề xuất
  const ownerProposals = proposals;
  const ownerTotalBalance = funds.reduce((sum, f) => sum + f.soDuHienTai, 0);
  const ownerPendingPayment = ownerProposals.filter(p => p.trangThai === 'CHO_THANH_TOAN').length;
  const ownerPendingReimburse = ownerProposals.filter(p => p.trangThai === 'CHO_HOAN_UNG').length;
  const ownerTotalPaidExpense = ownerProposals
    .filter(p => p.trangThai === 'DA_THANH_TOAN')
    .reduce((sum, p) => sum + p.soTien, 0);

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  // Tính dữ liệu biểu đồ 6 tháng gần nhất (chỉ OWNER/MANAGER)
  const buildMonthlyChart = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, thu: 0, chi: 0 });
    }
    transactions.forEach((tx) => {
      const d = new Date(tx.ngayGiaoDich);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const found = months.find((x) => x.year === y && x.month === m);
      if (!found) return;
      if (tx.loaiGiaoDich === 'THU') found.thu += tx.soTien;
      else found.chi += tx.soTien;
    });
    return months;
  };

  const monthlyData = buildMonthlyChart();
  const maxMonthly = Math.max(...monthlyData.flatMap((m) => [m.thu, m.chi]), 1);

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />
      
      <main className={styles.mainContent}>
        {/* Welcome Banner */}
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h1>Xin chào, {user.hoTen}!</h1>
            <p>Hôm nay là ngày {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className={styles.actions}>
            <button onClick={() => router.push('/de-xuat')} className="btn btn-primary">
              <PlusCircle size={18} />
              <span>Tạo đề xuất chi</span>
            </button>
          </div>
        </div>

        {/* ================= OWNER/MANAGER DASHBOARD VIEW ================= */}
        {(user.role === 'OWNER' || user.role === 'MANAGER') && (
          <div className={styles.dashboardGrid}>
            {/* Stat Cards */}
            <div className={`${styles.statCard} ${styles.blueCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Tổng số dư các Quỹ</span>
                <Wallet className={styles.cardIcon} />
              </div>
              <h3>{fundsLoading ? 'Đang tính...' : formatVND(ownerTotalBalance)}</h3>
              <p className={styles.cardInfo}>Số dư thực tế dùng trong thanh toán</p>
            </div>

            <div className={`${styles.statCard} ${styles.yellowCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Đề xuất Chờ thanh toán</span>
                <Clock className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : ownerPendingPayment} phiếu</h3>
              <p className={styles.cardInfo}>Đề xuất nguồn Tiền Shop chờ duyệt</p>
            </div>

            <div className={`${styles.statCard} ${styles.purpleCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Đề xuất Chờ hoàn ứng</span>
                <Layers className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : ownerPendingReimburse} phiếu</h3>
              <p className={styles.cardInfo}>Nhân viên ứng tiền cá nhân, hỗ trợ duyệt gộp</p>
            </div>

            <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Tổng chi phí đã thanh toán</span>
                <TrendingDown className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : formatVND(ownerTotalPaidExpense)}</h3>
              <p className={styles.cardInfo}>Tổng tiền chi ra từ các đề xuất đã hoàn tất</p>
            </div>

            {/* Funds Balance Table */}
            <div className={`${styles.largeCard} glass-card`}>
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
                          <td>
                            {fund.loaiQuy === 'TIEN_MAT' ? '💵 Tiền mặt' : fund.loaiQuy === 'NGAN_HANG' ? '🏦 Ngân hàng' : '📱 Ví điện tử / Khác'}
                          </td>
                          <td>{formatVND(fund.soDuDauKy)}</td>
                          <td style={{ fontWeight: '700', color: fund.soDuHienTai >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatVND(fund.soDuHienTai)}
                          </td>
                          <td>
                            <span className="badge badge-paid">Đang dùng</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= BIỂU ĐỒ 6 THÁNG (OWNER/MANAGER) ================= */}
        {(user.role === 'OWNER' || user.role === 'MANAGER') && (
          <div className={`glass-card ${styles.largeCard}`} style={{ marginTop: '1.5rem' }}>
            <div className={styles.cardTitleBar}>
              <h2>Thu - Chi 6 tháng gần nhất</h2>
              <button onClick={() => router.push('/bao-cao')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <span>Báo cáo đầy đủ</span>
                <ArrowRight size={14} />
              </button>
            </div>
            {txLoading ? (
              <div className={styles.loaderSmall}>Đang tải dữ liệu...</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px', padding: '0 0.5rem' }}>
                {monthlyData.map((m) => (
                  <div key={`${m.year}-${m.month}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', height: '140px', justifyContent: 'center' }}>
                      {/* Cột THU */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div
                          title={`Thu: ${formatVND(m.thu)}`}
                          style={{
                            width: '100%',
                            height: `${Math.round((m.thu / maxMonthly) * 100)}%`,
                            minHeight: m.thu > 0 ? '4px' : '0',
                            background: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                      </div>
                      {/* Cột CHI */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div
                          title={`Chi: ${formatVND(m.chi)}`}
                          style={{
                            width: '100%',
                            height: `${Math.round((m.chi / maxMonthly) * 100)}%`,
                            minHeight: m.chi > 0 ? '4px' : '0',
                            background: 'linear-gradient(180deg, #fca5a5 0%, #ef4444 100%)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>T{m.month}/{String(m.year).slice(-2)}</span>
                  </div>
                ))}
              </div>
            )}
            {!txLoading && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981', display: 'inline-block' }}></span>
                  Thu vào
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }}></span>
                  Chi ra
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>Hover vào cột để xem số tiền</span>
              </div>
            )}
          </div>
        )}

        {/* ================= STAFF / LEADER DASHBOARD VIEW ================= */}
        {isRestrictedToOwnProposals(user.role) && (
          <div className={styles.dashboardGrid}>
            <div className={`${styles.statCard} ${styles.blueCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Tổng tiền bạn đề xuất</span>
                <TrendingDown className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : formatVND(staffTotalAmount)}</h3>
              <p className={styles.cardInfo}>Tổng các phiếu bạn đã lập</p>
            </div>

            <div className={`${styles.statCard} ${styles.yellowCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Đang chờ duyệt</span>
                <Clock className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : staffPending} phiếu</h3>
              <p className={styles.cardInfo}>Chờ thanh toán hoặc chờ hoàn ứng</p>
            </div>

            <div className={`${styles.statCard} ${styles.greenCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Đã được thanh toán</span>
                <CheckCircle className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : staffPaid} phiếu</h3>
              <p className={styles.cardInfo}>Khoản chi đã được shop thanh toán</p>
            </div>

            <div className={`${styles.statCard} ${styles.redCard} glass-card`}>
              <div className={styles.cardHeader}>
                <span>Đề xuất bị Hủy</span>
                <XCircle className={styles.cardIcon} />
              </div>
              <h3>{proposalsLoading ? '...' : staffCancelled} phiếu</h3>
              <p className={styles.cardInfo}>Đề xuất bị từ chối hoặc bạn đã hủy</p>
            </div>
          </div>
        )}

        {/* ================= RECENT PROPOSALS LIST (Common for all) ================= */}
        <div className="glass-card" style={{ marginTop: '2rem' }}>
          <div className={styles.cardTitleBar}>
            <h2>Đề xuất chi phí gần đây</h2>
            <button onClick={() => router.push('/de-xuat')} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              <span>Tất cả đề xuất</span>
              <ArrowRight size={14} />
            </button>
          </div>
          {proposalsLoading ? (
            <div className={styles.loaderSmall}>Đang tải danh sách...</div>
          ) : proposals.length === 0 ? (
            <div className={styles.emptyState}>Chưa có đề xuất chi phí nào được lập.</div>
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
                  {proposals.slice(0, 5).map((prop) => (
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
                          <span style={{ color: '#60a5fa' }}>🏦 Tiền Shop</span>
                        ) : (
                          <span style={{ color: '#a7f3d0' }}>👤 Cá nhân ứng</span>
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
