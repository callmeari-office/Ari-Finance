'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ExternalLink
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
  const [expandedFund, setExpandedFund] = useState(null);

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
          if (data.user.role !== 'OWNER' && data.user.role !== 'MANAGER' && !data.user.permissions?.quy) {
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
      const txRes = await fetch('/api/thu-chi?limit=100');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
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

  // 2. Dòng tiền Cashflow lũy kế (tính toán từ danh sách quỹ được trả về từ API)
  const tongDongTienVao = funds.reduce((sum, f) => sum + (f.tongThu || 0), 0);
  const tongDongTienRa = funds.reduce((sum, f) => sum + (f.tongChi || 0), 0);

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
                    <th>Phiếu TC</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => {
                    const fundTxs = transactions.filter(t => t.quyId === fund.id);
                    const isExpanded = expandedFund === fund.id;
                    return (
                      <React.Fragment key={fund.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedFund(isExpanded ? null : fund.id)}>
                          <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {fund.id}
                            </span>
                          </td>
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
                            <span className="badge badge-paid">{fundTxs.length} phiếu</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ padding: 0 }}>
                              <div style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem 1.5rem', borderTop: '1px solid rgba(96,165,250,0.15)', borderBottom: '1px solid rgba(96,165,250,0.15)' }}>
                                <div style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: '700', marginBottom: '0.75rem' }}>
                                  PHIẾU THU-CHI LIÊN KẾT VỚI QUỸ: {fund.tenQuy}
                                </div>
                                {fundTxs.length === 0 ? (
                                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Chưa có phiếu thu-chi nào từ quỹ này.</p>
                                ) : (
                                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Mã phiếu</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Ngày</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Loại</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600' }}>Nội dung</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600' }}>Số tiền</th>
                                        <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>Đề xuất</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {fundTxs.map(tx => (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 'bold', color: '#60a5fa' }}>{tx.maPhieu}</td>
                                          <td style={{ padding: '0.4rem 0.6rem' }} suppressHydrationWarning>{new Date(tx.ngayGiaoDich).toLocaleDateString('vi-VN')}</td>
                                          <td style={{ padding: '0.4rem 0.6rem' }}>
                                            {tx.loaiGiaoDich === 'THU'
                                              ? <span style={{ color: '#34d399', fontWeight: '600' }}>THU +</span>
                                              : <span style={{ color: '#f87171', fontWeight: '600' }}>CHI -</span>}
                                          </td>
                                          <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-main)' }}>{tx.noiDung}</td>
                                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: '700', color: tx.loaiGiaoDich === 'THU' ? '#34d399' : '#f87171' }}>
                                            {tx.loaiGiaoDich === 'THU' ? '+' : '-'}{formatVND(tx.soTien)}
                                          </td>
                                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                                            {tx.deXuatChiPhi && tx.deXuatChiPhi.length > 0 ? (
                                              <a
                                                href="/de-xuat"
                                                style={{ color: '#60a5fa', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                                                title={`Liên kết ${tx.deXuatChiPhi.length} đề xuất`}
                                              >
                                                <ExternalLink size={12} />
                                                {tx.deXuatChiPhi.length} phiếu
                                              </a>
                                            ) : (
                                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
