'use client';

import { useEffect, useState } from 'react';
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
  Download
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import FilterDropdown from '@/components/FilterDropdown';
import styles from './bao-cao.module.css';

export default function BaoCaoThuChiPage() {
  const router = useRouter();
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
            alert('Bạn không có quyền truy cập trang Báo cáo Thu - Chi.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch dữ liệu
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
      // 1. Fetch transactions
      const txRes = await fetch('/api/thu-chi?limit=2000&includeHistory=true');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
      }

      // 2. Fetch categories & groups
      const configRes = await fetch('/api/cau-hinh');
      if (configRes.ok) {
        const configData = await configRes.json();
        setCategories(configData.categories || []);
        setGroups(configData.groups || []);
      }
    } catch (e) {
      console.error('Error fetching report data:', e);
    } finally {
      setDataLoading(false);
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

  // --- LỌC DỮ LIỆU PHÁT SINH THEO BỘ LỌC CHỌN ---
  const filteredTx = transactions.filter((tx) => {
    const txDate = new Date(tx.ngayGiaoDich);
    if (filterNam && txDate.getFullYear().toString() !== filterNam) return false;
    if (filterThang.length > 0 && !filterThang.includes(String(txDate.getMonth() + 1))) return false;
    if (filterNhom.length > 0 && !filterNhom.includes(tx.danhMuc.nhomChiPhiId)) return false;
    if (filterDanhMuc.length > 0 && !filterDanhMuc.includes(tx.danhMucId)) return false;
    return true;
  });

  // --- TÍNH TOÁN CÁC CHỈ SỐ THỐNG KÊ ---
  const tongThu = filteredTx
    .filter(t => t.loaiGiaoDich === 'THU')
    .reduce((sum, t) => sum + t.soTien, 0);

  const tongChi = filteredTx
    .filter(t => t.loaiGiaoDich === 'CHI')
    .reduce((sum, t) => sum + t.soTien, 0);

  const netCashflow = tongThu - tongChi;
  
  // Tỉ lệ Chi / Thu (%)
  const tileChiThu = tongThu > 0 ? Math.round((tongChi / tongThu) * 100) : 0;

  // --- THỐNG KÊ CHI TIÊU THEO NHÓM CHI PHÍ ---
  const chiGroupStats = {};
  filteredTx
    .filter(t => t.loaiGiaoDich === 'CHI')
    .forEach((tx) => {
      const gId = tx.danhMuc.nhomChiPhiId;
      const gName = tx.danhMuc.nhomChiPhi?.tenNhom || 'Khác';
      if (!chiGroupStats[gId]) {
        chiGroupStats[gId] = { id: gId, name: gName, amount: 0 };
      }
      chiGroupStats[gId].amount += tx.soTien;
    });

  const sortedChiGroups = Object.values(chiGroupStats).sort((a, b) => b.amount - a.amount);
  const tongChiTuNhom = sortedChiGroups.reduce((sum, g) => sum + g.amount, 0) || 1;

  // --- THỐNG KÊ DOANH THU THEO NHÓM THU ---
  const thuGroupStats = {};
  filteredTx
    .filter(t => t.loaiGiaoDich === 'THU')
    .forEach((tx) => {
      const gId = tx.danhMuc.nhomChiPhiId;
      const gName = tx.danhMuc.nhomChiPhi?.tenNhom || 'Khác';
      if (!thuGroupStats[gId]) {
        thuGroupStats[gId] = { id: gId, name: gName, amount: 0 };
      }
      thuGroupStats[gId].amount += tx.soTien;
    });

  const sortedThuGroups = Object.values(thuGroupStats).sort((a, b) => b.amount - a.amount);
  const tongThuTuNhom = sortedThuGroups.reduce((sum, g) => sum + g.amount, 0) || 1;

  // --- TOP 5 DANH MỤC CHI PHÍ CAO NHẤT ---
  const chiCatStats = {};
  filteredTx
    .filter(t => t.loaiGiaoDich === 'CHI')
    .forEach((tx) => {
      const catId = tx.danhMucId;
      const catName = tx.danhMuc.tenDanhMuc;
      if (!chiCatStats[catId]) {
        chiCatStats[catId] = { id: catId, name: catName, amount: 0 };
      }
      chiCatStats[catId].amount += tx.soTien;
    });

  const sortedChiCats = Object.values(chiCatStats).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const maxChiCatAmount = sortedChiCats.length > 0 ? sortedChiCats[0].amount : 1;

  // --- TOP 5 DANH MỤC THU CAO NHẤT ---
  const thuCatStats = {};
  filteredTx
    .filter(t => t.loaiGiaoDich === 'THU')
    .forEach((tx) => {
      const catId = tx.danhMucId;
      const catName = tx.danhMuc.tenDanhMuc;
      if (!thuCatStats[catId]) {
        thuCatStats[catId] = { id: catId, name: catName, amount: 0 };
      }
      thuCatStats[catId].amount += tx.soTien;
    });

  const sortedThuCats = Object.values(thuCatStats).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const maxThuCatAmount = sortedThuCats.length > 0 ? sortedThuCats[0].amount : 1;

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  const handleExportCSV = () => {
    if (filteredTx.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }

    const periodLabel = filterThang.length === 1
      ? `Tháng ${filterThang[0]}-${filterNam || 'TatCa'}`
      : filterThang.length > 1
      ? `T${filterThang.join('_')}-${filterNam || 'TatCa'}`
      : filterNam
      ? `Nam ${filterNam}`
      : 'TatCa';

    const headers = ['Mã Giao Dịch', 'Ngày Giao Dịch', 'Loại', 'Quỹ', 'Nhóm Danh Mục', 'Danh Mục', 'Nội Dung', 'Số Tiền (VND)'];

    const rows = filteredTx.map((tx) => [
      tx.maPhieu,
      new Date(tx.ngayGiaoDich).toLocaleDateString('vi-VN'),
      tx.loaiGiaoDich === 'THU' ? 'Thu' : 'Chi',
      tx.quy?.tenQuy || '',
      tx.danhMuc?.nhomChiPhi?.tenNhom || '',
      tx.danhMuc?.tenDanhMuc || '',
      `"${(tx.noiDung || '').replace(/"/g, '""')}"`,
      tx.loaiGiaoDich === 'THU' ? tx.soTien : -tx.soTien,
    ]);

    const summaryRows = [
      [],
      ['TỔNG KẾT', '', '', '', '', '', '', ''],
      ['Tổng Thu', '', '', '', '', '', '', tongThu],
      ['Tổng Chi', '', '', '', '', '', '', -tongChi],
      ['Net Cashflow', '', '', '', '', '', '', netCashflow],
    ];

    const csvContent =
      '﻿' +
      [headers, ...rows, ...summaryRows]
        .map((r) => r.join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCaoThuChi_${periodLabel}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
            disabled={dataLoading}
          >
            <Download size={16} />
            Xuất Excel / CSV
          </button>
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
                <option value="2026">2026</option>
                <option value="2025">2025</option>
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

        {/* SECTION 2: STATS SUMMARY WIDGET */}
        <div className={styles.summaryGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <div className={`${styles.sumCard} ${styles.greenBg} glass-card`}>
            <div className={styles.sumHeader}>
              <span>Tổng thu tiền (Dòng vào)</span>
              <TrendingUp className={styles.sumIcon} />
            </div>
            <h3>+{formatVND(tongThu)}</h3>
            <p>Doanh thu và dòng tiền nạp vào</p>
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
                <Layers size={18} className={styles.cardTitleIcon} style={{ color: '#10b981' }} />
                <h2>Cơ cấu nguồn thu theo Nhóm</h2>
              </div>
              
              {dataLoading ? (
                <div className={styles.loaderSmall}>Đang tải...</div>
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
                <PieChart size={18} className={styles.cardTitleIcon} style={{ color: '#10b981' }} />
                <h2>Top danh mục thu nhiều nhất</h2>
              </div>
              
              {dataLoading ? (
                <div className={styles.loaderSmall}>Đang tải...</div>
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
                <Layers size={18} className={styles.cardTitleIcon} style={{ color: '#ef4444' }} />
                <h2>Cơ cấu chi phí theo Nhóm</h2>
              </div>
              
              {dataLoading ? (
                <div className={styles.loaderSmall}>Đang tải...</div>
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
                <PieChart size={18} className={styles.cardTitleIcon} style={{ color: '#ef4444' }} />
                <h2>Top danh mục chi nhiều nhất</h2>
              </div>
              
              {dataLoading ? (
                <div className={styles.loaderSmall}>Đang tải...</div>
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

        {/* SECTION 4: TABLE OF FILTERED TRANSACTIONS */}
        <div className="glass-card">
          <div className={styles.cardHeader} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <FileSpreadsheet size={20} className={styles.cardTitleIcon} style={{ color: 'var(--brand-accent)' }} />
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Đối soát chi tiết các Giao dịch trong kỳ ({filteredTx.length} giao dịch)</h2>
          </div>

          {filteredTx.length === 0 ? (
            <div className={styles.emptyState}>Không tìm thấy giao dịch dòng tiền nào phù hợp với bộ lọc đã chọn.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                <thead>
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
                      <td suppressHydrationWarning>{new Date(tx.ngayGiaoDich).toLocaleDateString('vi-VN')}</td>
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
          )}
        </div>
      </main>
    </div>
  );
}
