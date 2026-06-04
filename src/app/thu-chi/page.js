'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Eye, 
  X, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle,
  Clock,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import FilterDropdown from '@/components/FilterDropdown';
import styles from './thu-chi.module.css';

export default function ThuChiPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [funds, setFunds] = useState([]);
  const [categories, setCategories] = useState([]); // Danh mục THU để tạo phiếu thu
  const [allCategories, setAllCategories] = useState([]); // Tất cả danh mục để phục vụ filter
  const [dataLoading, setDataLoading] = useState(true);

  // Filter states (array-based cho FilterDropdown)
  const [filterLoai, setFilterLoai] = useState([]);
  const [filterQuy, setFilterQuy] = useState([]);
  const [filterThang, setFilterThang] = useState([String(new Date().getMonth() + 1)]);
  const [filterDanhMuc, setFilterDanhMuc] = useState([]);

  // Modal: TẠO PHIẾU THU TRỰC TIẾP (TH4)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form inputs (Chỉ cho phép tạo THU trực tiếp theo nghiệp vụ)
  const [ngayGiaoDich, setNgayGiaoDich] = useState(new Date().toISOString().split('T')[0]);
  const [quyId, setQuyId] = useState('');
  const [danhMucId, setDanhMucId] = useState('');
  const [soTien, setSoTien] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  const handleSoTienChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setSoTien(raw);
  };

  const formatSoTienDisplay = (raw) => {
    if (!raw) return '';
    const num = parseInt(raw, 10);
    return isNaN(num) ? '' : num.toLocaleString('vi-VN');
  };

  // Modal: XEM CHI TIẾT PHIẾU CHI (HIỂN THỊ CÁC ĐỀ XUẤT CON)
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    // 1. Kiểm tra session & vai trò (Chỉ OWNER được vào)
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
          if (!data.user.permissions?.thuChi && data.user.role !== 'OWNER') {
            alert('Bạn không có quyền truy cập trang quản lý Thu-Chi.');
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
      // 1. Fetch transactions
      const txRes = await fetch('/api/thu-chi?limit=1000');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
      }

      // 2. Fetch funds
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(quyData);
        if (quyData.length > 0) setQuyId(quyData[0].id);
      }

      // 3. Fetch categories
      const catRes = await fetch('/api/danh-muc');
      if (catRes.ok) {
        const catData = await catRes.json();
        setAllCategories(catData.categories);
        
        // Chỉ lấy danh mục loại THU để Owner làm TH4
        const thuCategories = catData.categories.filter(c => c.loaiGiaoDich === 'THU');
        setCategories(thuCategories);
        if (thuCategories.length > 0) setDanhMucId(thuCategories[0].id);
      }
    } catch (e) {
      console.error('Error fetching cashflow data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!ngayGiaoDich || !quyId || !danhMucId || !soTien || !noiDung) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }

    if (Number(soTien) <= 0) {
      setFormError('Số tiền thu phải lớn hơn 0.');
      return;
    }

    setFormLoading(true);

    try {
      const res = await fetch('/api/thu-chi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngayGiaoDich,
          loaiGiaoDich: 'THU', // Ép buộc loại THU theo TH4
          soTien: Number(soTien),
          quyId,
          danhMucId,
          noiDung,
          ghiChu,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo phiếu thu thất bại.');

      setFormSuccess(data.message || 'Đã tạo phiếu thu thành công! Số dư quỹ đã tăng.');
      
      // Reset form
      setSoTien('');
      setNoiDung('');
      setGhiChu('');

      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess('');
        fetchData(); // Tải lại dữ liệu
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Lọc danh sách trên client
  const filteredTransactions = transactions.filter((tx) => {
    if (filterLoai.length > 0 && !filterLoai.includes(tx.loaiGiaoDich)) return false;
    if (filterQuy.length > 0 && !filterQuy.includes(tx.quyId)) return false;

    if (filterThang.length > 0) {
      const txMonth = String(new Date(tx.ngayGiaoDich).getMonth() + 1);
      if (!filterThang.includes(txMonth)) return false;
    }

    if (filterDanhMuc.length > 0 && !filterDanhMuc.includes(tx.danhMucId)) return false;

    return true;
  });

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải lịch sử giao dịch quỹ...</p>
      </div>
    );
  }

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Giao dịch dòng tiền (Thu - Chi)</h1>
            <p className={styles.pageDesc}>Lớp ghi nhận dòng tiền thật tác động trực tiếp lên quỹ của shop</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <PlusCircle size={20} />
            <span>Ghi nhận Phiếu Thu (TH4)</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className={`${styles.filterCard} glass-card`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
            <FilterDropdown
              label="Loại giao dịch"
              options={[
                { value: 'THU', label: 'Phiếu THU (Dòng vào)' },
                { value: 'CHI', label: 'Phiếu CHI (Dòng ra)' },
              ]}
              selected={filterLoai}
              onChange={setFilterLoai}
            />

            <FilterDropdown
              label="Quỹ"
              options={funds.map((f) => ({ value: f.id, label: f.tenQuy }))}
              selected={filterQuy}
              onChange={setFilterQuy}
            />

            <FilterDropdown
              label="Tháng"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }))}
              selected={filterThang}
              onChange={setFilterThang}
            />

            <FilterDropdown
              label="Danh mục"
              options={allCategories.map((c) => ({ value: c.id, label: c.tenDanhMuc }))}
              selected={filterDanhMuc}
              onChange={setFilterDanhMuc}
            />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          {dataLoading ? (
            <div className={styles.loaderSmall}>Đang tải lịch sử giao dịch...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className={styles.emptyState}>Chưa có giao dịch dòng tiền nào được ghi nhận.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Mã Giao Dịch</th>
                    <th>Ngày giao dịch</th>
                    <th>Loại</th>
                    <th>Quỹ thực hiện</th>
                    <th>Danh mục</th>
                    <th>Nội dung</th>
                    <th>Số tiền</th>
                    <th>Nguồn gốc</th>
                    <th style={{ textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: 'bold', color: '#34d399' }}>{tx.maPhieu}</td>
                      <td>{new Date(tx.ngayGiaoDich).toLocaleDateString('vi-VN')}</td>
                      <td>
                        {tx.loaiGiaoDich === 'THU' ? (
                          <span className={styles.thuBadge}>
                            <ArrowUpRight size={14} />
                            <span>THU</span>
                          </span>
                        ) : (
                          <span className={styles.chiBadge}>
                            <ArrowDownLeft size={14} />
                            <span>CHI</span>
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: '600' }}>{tx.quy.tenQuy}</td>
                      <td>{tx.danhMuc.tenDanhMuc}</td>
                      <td>
                        <div className={styles.noiDungBox}>{tx.noiDung}</div>
                        {tx.nhaCungCap && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="badge badge-reimburse" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: 'rgba(99, 77, 62, 0.05)', color: 'var(--brand-brown)', textTransform: 'none', letterSpacing: 'normal' }}>
                              NCC: {tx.nhaCungCap.tenNCC} ({tx.nhaCungCap.tenNganHang} - {tx.nhaCungCap.soTaiKhoan})
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ 
                        fontWeight: '800', 
                        color: tx.loaiGiaoDich === 'THU' ? '#2e7d32' : '#8c5353' 
                      }}>
                        {tx.loaiGiaoDich === 'THU' ? '+' : '-'}{formatVND(tx.soTien)}
                      </td>
                      <td>
                        {tx.soPhieuDeXuat === 1 ? (
                          <span className={styles.originMergeBadge} style={{ background: 'var(--info-bg)', color: '#536978' }}>
                            <Layers size={12} />
                            <span>Đề xuất {tx.deXuatChiPhi[0]?.maPhieu}</span>
                          </span>
                        ) : tx.soPhieuDeXuat > 1 ? (
                          <span className={styles.originMergeBadge}>
                            <Layers size={12} />
                            <span>Gộp {tx.soPhieuDeXuat} đề xuất</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ghi trực tiếp (TH4)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => setSelectedTx(tx)}
                          className={styles.viewDetailBtn}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: TẠO PHIẾU THU TRỰC TIẾP (TH4) */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Ghi nhận Phiếu Thu tiền trực tiếp vào Quỹ (TH4)</h2>
                <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className={styles.successAlert}>
                  <Check size={18} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateReceipt} className={styles.form}>
                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="ngayGiaoDich">Ngày giao dịch *</label>
                    <input
                      id="ngayGiaoDich"
                      type="date"
                      className="form-control"
                      value={ngayGiaoDich}
                      onChange={(e) => setNgayGiaoDich(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="quyId">Quỹ nhận tiền *</label>
                    <select
                      id="quyId"
                      className="form-control"
                      value={quyId}
                      onChange={(e) => setQuyId(e.target.value)}
                      required
                      disabled={formLoading}
                    >
                      {funds.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.tenQuy} ({formatVND(f.soDuHienTai)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="danhMucId">Danh mục thu *</label>
                    <select
                      id="danhMucId"
                      className="form-control"
                      value={danhMucId}
                      onChange={(e) => setDanhMucId(e.target.value)}
                      required
                      disabled={formLoading}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.tenDanhMuc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="soTien">Số tiền thu (VND) *</label>
                    <input
                      id="soTien"
                      type="text"
                      inputMode="numeric"
                      placeholder="Nhập số tiền thu vào quỹ..."
                      className="form-control"
                      value={formatSoTienDisplay(soTien)}
                      onChange={handleSoTienChange}
                      required
                      disabled={formLoading}
                    />
                    {soTien && (
                      <small style={{ color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                        = {Number(soTien).toLocaleString('vi-VN')} ₫
                      </small>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="noiDung">Nội dung thu *</label>
                  <textarea
                    id="noiDung"
                    placeholder="Mô tả cụ thể nguồn gốc khoản thu tiền (Ví dụ: Thu doanh thu bán hàng ngày 27/05...)"
                    className="form-control"
                    rows={3}
                    value={noiDung}
                    onChange={(e) => setNoiDung(e.target.value)}
                    required
                    disabled={formLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ghiChu">Ghi chú thêm</label>
                  <input
                    id="ghiChu"
                    type="text"
                    placeholder="Nhập ghi chú khác..."
                    className="form-control"
                    value={ghiChu}
                    onChange={(e) => setGhiChu(e.target.value)}
                    disabled={formLoading}
                  />
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading}>
                    {formLoading ? 'Đang ghi...' : 'Ghi nhận Phiếu Thu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: CHI TIẾT PHIẾU THUCHI & DANH SÁCH ĐỀ XUẤT CON (N:1 GỘP) */}
        {selectedTx && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Chi tiết Giao dịch dòng tiền {selectedTx.maPhieu}</h2>
                <button onClick={() => setSelectedTx(null)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.detailCardGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Mã Giao Dịch:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#34d399' }}>{selectedTx.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày Giao Dịch:</span>
                  <span className={styles.detailValue}>{new Date(selectedTx.ngayGiaoDich).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Loại dòng tiền:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold' }}>
                    {selectedTx.loaiGiaoDich === 'THU' ? '📈 Dòng tiền vào (THU)' : '📉 Dòng tiền ra (CHI)'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Tác động Quỹ:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#60a5fa' }}>{selectedTx.quy.tenQuy}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Danh mục kế toán:</span>
                  <span className={styles.detailValue}>{selectedTx.danhMuc.tenDanhMuc}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Số tiền giao dịch:</span>
                  <span className={styles.detailValue} style={{ 
                    fontWeight: '800', 
                    fontSize: '1.25rem',
                    color: selectedTx.loaiGiaoDich === 'THU' ? '#2e7d32' : '#8c5353' 
                  }}>
                    {selectedTx.loaiGiaoDich === 'THU' ? '+' : '-'}{formatVND(selectedTx.soTien)}
                  </span>
                </div>
                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Nội dung chi tiết:</span>
                  <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{selectedTx.noiDung}</span>
                </div>
                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Ghi chú:</span>
                  <span className={styles.detailValue}>{selectedTx.ghiChu || 'Không có ghi chú.'}</span>
                </div>
              </div>

              {/* PHẦN HIỂN THỊ CÁC ĐỀ XUẤT CON ĐƯỢC GỘP (MỐI QUAN HỆ N:1) */}
              {selectedTx.loaiGiaoDich === 'CHI' && selectedTx.soPhieuDeXuat > 0 && (
                <div className={styles.subProposalsSection}>
                  <div className={styles.subProposalsHeader}>
                    <Layers size={18} style={{ color: '#60a5fa' }} />
                    <h3>Danh sách các Đề xuất chi phí được gộp ({selectedTx.soPhieuDeXuat} phiếu)</h3>
                  </div>
                  <p className={styles.subProposalsDesc}>Phiếu chi {selectedTx.maPhieu} được sinh ra từ việc duyệt gộp các đề xuất chi của nhân viên dưới đây:</p>

                  <div className="table-responsive">
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Mã đề xuất</th>
                          <th>Nhân viên lập</th>
                          <th>Nội dung chi</th>
                          <th style={{ textAlign: 'right' }}>Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTx.deXuatChiPhi.map((dx) => (
                          <tr key={dx.id}>
                            <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{dx.maPhieu}</td>
                            <td>{dx.nguoiTao.hoTen}</td>
                            <td>{dx.noiDung}</td>
                            <td style={{ fontWeight: '700', textAlign: 'right' }}>{formatVND(dx.soTien)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td colSpan="3" style={{ fontWeight: 'bold', textAlign: 'right' }}>Tổng cộng tiền đề xuất:</td>
                          <td style={{ fontWeight: '800', color: '#34d399', textAlign: 'right' }}>{formatVND(selectedTx.tongTienDeXuat)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
                <button onClick={() => setSelectedTx(null)} className="btn btn-secondary">
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
