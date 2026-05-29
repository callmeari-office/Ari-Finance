'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './quy.module.css';

export default function QuyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

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
          if (!data.user.permissions?.quy && data.user.role !== 'OWNER') {
            alert('Bạn không có quyền truy cập trang Thông tin Quỹ.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch data
          fetchData();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Fetch funds
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(quyData);
      }

      // Fetch all transactions
      const txRes = await fetch('/api/thu-chi');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (e) {
      console.error('Error fetching fund data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải thông tin quỹ...</p>
      </div>
    );
  }

  // TÍNH TOÁN CÁC CHỈ SỐ QUỸ REALTIME
  
  // 1. Tổng số dư khả dụng (Tổng tất cả các quỹ)
  const tongSoDuQuy = funds.reduce((sum, f) => sum + f.soDuHienTai, 0);

  // 2. Dòng tiền Cashflow lũy kế
  const tongDongTienVao = transactions
    .filter(t => t.loaiGiaoDich === 'THU')
    .reduce((sum, t) => sum + t.soTien, 0);

  const tongDongTienRa = transactions
    .filter(t => t.loaiGiaoDich === 'CHI')
    .reduce((sum, t) => sum + t.soTien, 0);

  const netCashflow = tongDongTienVao - tongDongTienRa;

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Thông tin Quỹ</h1>
            <p className={styles.pageDesc}>Theo dõi trạng thái số dư realtime chi tiết và lịch sử dòng tiền vào ra trên các quỹ</p>
          </div>
        </div>

        {/* Realtime Fund Summary Widgets */}
        <div className={styles.summaryGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className={`${styles.sumCard} glass-card`} style={{ borderLeft: '4px solid var(--brand-brown)' }}>
            <div className={styles.sumHeader}>
              <span style={{ color: 'var(--brand-brown)', fontWeight: '700' }}>Tổng số dư các Quỹ</span>
              <Wallet className={styles.sumIcon} style={{ color: 'var(--brand-brown)' }} />
            </div>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--text-main)' }}>{formatVND(tongSoDuQuy)}</h3>
            <p>Tổng tiền mặt & ngân hàng thực tế khả dụng</p>
          </div>

          <div className={`${styles.sumCard} ${styles.greenBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Tổng dòng tiền VÀO (THU)</span>
              <TrendingUp className={styles.sumIcon} />
            </div>
            <h3>+{formatVND(tongDongTienVao)}</h3>
            <p>Doanh thu lũy kế nạp vào quỹ shop</p>
          </div>

          <div className={`${styles.sumCard} ${styles.redBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Tổng dòng tiền RA (CHI)</span>
              <TrendingDown className={styles.sumIcon} />
            </div>
            <h3>-{formatVND(tongDongTienRa)}</h3>
            <p>Chi tiêu thanh toán & hoàn ứng lũy kế</p>
          </div>

          <div className={`${styles.sumCard} ${styles.blueBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Dòng tiền thuần (Net Cashflow)</span>
              <DollarSign className={styles.sumIcon} />
            </div>
            <h3 style={{ color: netCashflow >= 0 ? '#34d399' : '#f87171' }}>
              {netCashflow >= 0 ? '+' : ''}{formatVND(netCashflow)}
            </h3>
            <p>Hiệu số thu chi tích lũy dòng tiền</p>
          </div>
        </div>

        {/* Quys Status Table */}
        <div className="glass-card">
          <div className={styles.cardHeader}>
            <Wallet size={20} className={styles.cardTitleIcon} />
            <h2>Bảng kê số dư chi tiết các Quỹ tiền</h2>
          </div>
          {dataLoading ? (
            <div className={styles.loaderSmall}>Đang tải danh sách quỹ...</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Mã Quỹ</th>
                    <th>Tên Quỹ</th>
                    <th>Loại Quỹ</th>
                    <th>Đầu Kỳ</th>
                    <th>Tổng Thu (+)</th>
                    <th>Tổng Chi (-)</th>
                    <th>Số dư Hiện Tại</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.id}>
                      <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{fund.id}</td>
                      <td style={{ fontWeight: '600' }}>{fund.tenQuy}</td>
                      <td>
                        {fund.loaiQuy === 'TIEN_MAT' && '💵 Tiền mặt'}
                        {fund.loaiQuy === 'NGAN_HANG' && '🏦 Ngân hàng'}
                        {fund.loaiQuy === 'CA_NHAN' && '👤 Cá nhân ứng'}
                      </td>
                      <td>{formatVND(fund.soDuDauKy)}</td>
                      <td style={{ color: '#34d399', fontWeight: '500' }}>+{formatVND(fund.tongThu)}</td>
                      <td style={{ color: '#f87171', fontWeight: '500' }}>-{formatVND(fund.tongChi)}</td>
                      <td style={{ fontWeight: '800', color: fund.soDuHienTai >= 0 ? '#34d399' : '#f87171', fontSize: '1rem' }}>
                        {formatVND(fund.soDuHienTai)}
                      </td>
                      <td>
                        <span className="badge badge-paid">Hoạt động</span>
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
