'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  AlertCircle,
  Eye,
  Search,
  Building,
  DollarSign,
  QrCode,
  History,
  Copy
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './ncc.module.css';

export default function VendorsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core Data
  const [vendors, setVendors] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [banks, setBanks] = useState([]);

  // Quick Bank popup states
  const [isQuickBankOpen, setIsQuickBankOpen] = useState(false);
  const [quickBankVietTat, setQuickBankVietTat] = useState('');
  const [quickBankDayDu, setQuickBankDayDu] = useState('');
  const [quickBankLoading, setQuickBankLoading] = useState(false);
  const [quickBankError, setQuickBankError] = useState('');
  const [deletingBankId, setDeletingBankId] = useState(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form Inputs
  const [id, setId] = useState('');
  const [tenNCC, setTenNCC] = useState('');
  const [tenTaiKhoan, setTenTaiKhoan] = useState('');
  const [soTaiKhoan, setSoTaiKhoan] = useState('');
  const [tenNganHang, setTenNganHang] = useState('');

  // Detail Modal State
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // History Modal State
  const [historyVendor, setHistoryVendor] = useState(null);
  const [vendorHistory, setVendorHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    // 1. Check Auth
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
          // 2. Fetch Vendors & Banks
          fetchVendors();
          fetchBanks();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchVendors = async () => {
    setDataLoading(true);
    try {
      const res = await fetch('/api/ncc');
      if (res.ok) {
        const data = await res.json();
        setVendors(data || []);
      }
    } catch (e) {
      console.error('Error fetching vendors:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await fetch('/api/ngan-hang');
      if (res.ok) {
        const data = await res.json();
        setBanks(data || []);
      }
    } catch (e) {
      console.error('Error fetching banks:', e);
    }
  };

  const generateVietQRUrl = (vendor) => {
    if (!vendor || !vendor.soTaiKhoan || !vendor.tenNganHang) return '';
    const nameUpper = vendor.tenNganHang.toUpperCase();
    let bankCode = nameUpper.includes('-') ? nameUpper.split('-')[0].trim() : nameUpper.trim();
    const bankMap = {
      'vcb': 'vietcombank', 'tcb': 'techcombank', 'ctg': 'vietinbank',
      'mb': 'mbb', 'mbbank': 'mbb', 'vpb': 'vpbank', 'hdb': 'hdbank',
      'stb': 'sacombank', 'tpb': 'tpbank', 'msb': 'msb', 'shb': 'shb',
      'eib': 'eximbank', 'ocb': 'ocb', 'lpb': 'lpbank', 'abb': 'abbank',
      'nab': 'namabank', 'cake': 'cake'
    };
    let qrBank = bankMap[bankCode.toLowerCase()] || bankCode.toLowerCase();
    const accountName = vendor.tenTaiKhoan || vendor.tenNCC;
    return `https://img.vietqr.io/image/${qrBank}-${vendor.soTaiKhoan}-compact.png?accountName=${encodeURIComponent(accountName)}`;
  };

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleOpenHistory = async (vendor) => {
    setHistoryVendor(vendor);
    setVendorHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/de-xuat?nhaCungCapId=${vendor.id}&limit=1000`);
      if (res.ok) {
        const data = await res.json();
        setVendorHistory(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching vendor history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormType('ADD');
    setId('');
    setTenNCC('');
    setTenTaiKhoan('');
    setSoTaiKhoan('');
    setTenNganHang('');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v) => {
    setFormType('EDIT');
    setId(v.id);
    setTenNCC(v.tenNCC);
    setTenTaiKhoan(v.tenTaiKhoan || '');
    setSoTaiKhoan(v.soTaiKhoan);
    setTenNganHang(v.tenNganHang);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!tenNCC || !soTaiKhoan || !tenNganHang) {
      setFormError('Vui lòng nhập đầy đủ thông tin bắt buộc (*).');
      return;
    }

    setFormLoading(true);

    const payload = {
      id: id.trim(),
      tenNCC: tenNCC.trim(),
      tenTaiKhoan: tenTaiKhoan.trim() || null,
      soTaiKhoan: soTaiKhoan.trim(),
      tenNganHang: tenNganHang.trim(),
    };

    try {
      const url = formType === 'ADD' ? '/api/ncc' : `/api/ncc/${id}`;
      const method = formType === 'ADD' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

      setFormSuccess(data.message || 'Lưu thông tin nhà cung cấp thành công!');
      fetchVendors();

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (vId, vName) => {
    if (confirm(`Bạn có chắc chắn muốn XÓA nhà cung cấp "${vName}" [${vId}]?\nHành động này chỉ thành công nếu nhà cung cấp chưa có giao dịch phát sinh.`)) {
      try {
        const res = await fetch(`/api/ncc/${vId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');
        
        alert(`Đã xóa nhà cung cấp "${vName}" thành công.`);
        fetchVendors();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang xác thực thông tin...</p>
      </div>
    );
  }

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  // Filter vendors on client
  const filteredVendors = vendors.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      v.id.toLowerCase().includes(q) ||
      v.tenNCC.toLowerCase().includes(q) ||
      (v.tenTaiKhoan && v.tenTaiKhoan.toLowerCase().includes(q)) ||
      v.soTaiKhoan.toLowerCase().includes(q) ||
      v.tenNganHang.toLowerCase().includes(q)
    );
  });

  const totalSpent = vendors.reduce((sum, v) => sum + (v.tongDaChi || 0), 0);

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Quản Lý Nhà Cung Cấp</h1>
            <p className={styles.pageDesc}>Danh mục thông tin đối tác, số tài khoản, mã QR và thống kê chi phí</p>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <Plus size={20} />
            <span>Thêm nhà cung cấp</span>
          </button>
        </div>

        {/* KPI Summaries */}
        <div className={styles.kpiGrid}>
          <div className={`${styles.kpiCard} glass-card`}>
            <div className={styles.kpiIcon}>
              <Building size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <h3>Tổng số đối tác</h3>
              <p className={styles.kpiValue}>{vendors.length} NCC</p>
            </div>
          </div>

          <div className={`${styles.kpiCard} glass-card`}>
            <div className={styles.kpiIcon} style={{ color: '#10b981' }}>
              <DollarSign size={24} />
            </div>
            <div className={styles.kpiInfo}>
              <h3>Tổng tiền đã chi cho NCC</h3>
              <p className={styles.kpiValue} style={{ color: '#34d399' }}>{formatVND(totalSpent)}</p>
            </div>
          </div>
        </div>

        {/* Filter / Search section */}
        <div className={`${styles.filterCard} glass-card`}>
          <div className={styles.searchBox}>
            <Search className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhà cung cấp theo mã, tên, số tài khoản hoặc ngân hàng..."
              className="form-control search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
        </div>

        {/* Vendors Table */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          {dataLoading ? (
            <div className={styles.loaderSmall}>Đang tải danh sách nhà cung cấp...</div>
          ) : filteredVendors.length === 0 ? (
            <div className={styles.emptyState}>Không tìm thấy nhà cung cấp nào.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Mã NCC</th>
                    <th>Tên đối tác</th>
                    <th>Tên TK ngân hàng</th>
                    <th>Số tài khoản</th>
                    <th>Ngân hàng</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>Giao dịch</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>Tổng đã chi</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{v.id}</td>
                      <td style={{ fontWeight: '600' }}>{v.tenNCC}</td>
                      <td style={{ fontWeight: '500', color: v.tenTaiKhoan ? '#f8fafc' : 'var(--text-muted)', fontStyle: v.tenTaiKhoan ? 'normal' : 'italic' }}>
                        {v.tenTaiKhoan || 'Chưa có'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{v.soTaiKhoan}</td>
                      <td style={{ fontWeight: '500' }}>{v.tenNganHang}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-reimburse" style={{ backgroundColor: 'rgba(251,191,36,0.06)', color: '#fbbf24', fontSize: '0.75rem' }}>
                          {v.soPhieuChi || 0} lần
                        </span>
                      </td>
                      <td style={{ fontWeight: '800', color: '#34d399', textAlign: 'right' }}>
                        {formatVND(v.tongDaChi || 0)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionButtons}>
                          <button
                            onClick={() => setSelectedVendor(v)}
                            className={`${styles.actionBtn} ${styles.viewBtn}`}
                            title="Xem QR & Chi tiết"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenHistory(v)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Lịch sử giao dịch"
                            style={{ color: '#a78bfa' }}
                          >
                            <History size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(v)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Sửa thông tin"
                          >
                            <Edit3 size={16} />
                          </button>

                          {user.role === 'OWNER' && (
                            <button
                              onClick={() => handleDelete(v.id, v.tenNCC)}
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              disabled={v.tongDaChi > 0 || v.soPhieuChi > 0}
                              title={v.tongDaChi > 0 ? "Không thể xóa đối tác đã phát sinh giao dịch chi" : "Xóa nhà cung cấp"}
                              style={v.tongDaChi > 0 ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL FORM: THÊM / SỬA VENDOR */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{formType === 'ADD' ? 'Thêm Nhà Cung Cấp Mới' : 'Sửa Thông Tin Nhà Cung Cấp'}</h2>
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

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label className="form-label">Tên Nhà Cung Cấp / Đối Tác *</label>
                  <input
                    type="text"
                    placeholder="Nhập tên đối tác/nhà cung cấp..."
                    className="form-control"
                    value={tenNCC}
                    onChange={(e) => setTenNCC(e.target.value)}
                    required
                    disabled={formLoading}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Tên Chủ Tài Khoản Ngân Hàng</label>
                  <input
                    type="text"
                    placeholder="Nhập tên chủ tài khoản (in hoa không dấu)..."
                    className="form-control"
                    value={tenTaiKhoan}
                    onChange={(e) => setTenTaiKhoan(e.target.value)}
                    disabled={formLoading}
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Tên hiển thị khi quét QR chuyển khoản. Để trống sẽ dùng tên đối tác.
                  </small>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label className="form-label">Số Tài Khoản Chuyển Khoản *</label>
                    <input
                      type="text"
                      placeholder="Nhập STK ngân hàng..."
                      className="form-control"
                      value={soTaiKhoan}
                      onChange={(e) => setSoTaiKhoan(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Ngân Hàng *</label>
                      <button
                        type="button"
                        onClick={() => setIsQuickBankOpen(true)}
                        style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', padding: 0 }}
                      >
                        + Thêm nhanh NH
                      </button>
                    </div>
                    <select
                      className="form-control"
                      value={tenNganHang}
                      onChange={(e) => setTenNganHang(e.target.value)}
                      required
                      disabled={formLoading}
                    >
                      <option value="">-- Chọn ngân hàng --</option>
                      {banks.map(b => (
                        <option key={b.id} value={`${b.tenVietTat} - ${b.tenDayDu}`}>
                          {b.tenDayDu} - {b.tenVietTat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading}>
                    {formLoading ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: XEM CHI TIẾT & MÃ QR ĐỘNG */}
        {selectedVendor && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.detailContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Thông tin NCC - {selectedVendor.tenNCC}</h2>
                <button onClick={() => setSelectedVendor(null)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.detailCard}>
                <div className={styles.qrContainer}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generateVietQRUrl(selectedVendor)}
                    alt="Mã VietQR động"
                    className={styles.qrImg}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginTop: '0.25rem' }}>
                    Quét QR để tự điền STK & ngân hàng
                  </div>
                </div>

                <div className={styles.bankDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Tên đối tác:</span>
                    <span className={styles.value}>{selectedVendor.tenNCC}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Tên chủ TK:</span>
                    <span className={styles.value} style={{ fontWeight: selectedVendor.tenTaiKhoan ? '600' : '400', color: selectedVendor.tenTaiKhoan ? '#f8fafc' : 'var(--text-muted)', fontStyle: selectedVendor.tenTaiKhoan ? 'normal' : 'italic' }}>
                      {selectedVendor.tenTaiKhoan || 'Chưa có (dùng tên đối tác)'}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Mã đối tác:</span>
                    <span className={styles.value} style={{ color: '#60a5fa' }}>{selectedVendor.id}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Số tài khoản:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={styles.value} style={{ fontFamily: 'monospace', fontSize: '1rem', color: '#fbbf24' }}>{selectedVendor.soTaiKhoan}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedVendor.soTaiKhoan, 'stk')}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                      >
                        {copiedField === 'stk' ? '✓' : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Ngân hàng:</span>
                    <span className={styles.value}>{selectedVendor.tenNganHang}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Tổng tiền đã chi:</span>
                    <span className={styles.value} style={{ color: '#34d399', fontSize: '1.05rem' }}>{formatVND(selectedVendor.tongDaChi || 0)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Tổng số giao dịch:</span>
                    <span className={styles.value}>{selectedVendor.soPhieuChi || 0} lần</span>
                  </div>
                </div>

                <button onClick={() => setSelectedVendor(null)} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal lồng: THÊM NHANH NGÂN HÀNG VÀO DANH MỤC */}
        {isQuickBankOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
            <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: '440px' }}>
              <div className={styles.modalHeader}>
                <h2>Quản Lý Ngân Hàng</h2>
                <button type="button" onClick={() => setIsQuickBankOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {quickBankError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={18} />
                  <span>{quickBankError}</span>
                </div>
              )}

              {/* Danh sách ngân hàng hiện có — chỉ OWNER thấy nút xóa */}
              {banks.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Danh sách hiện có ({banks.length})
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    {banks.map((b) => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--border)', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem' }}>
                          <b style={{ color: 'var(--brand-accent)' }}>{b.tenVietTat}</b>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{b.tenDayDu}</span>
                        </span>
                        {user?.role === 'OWNER' && (
                          <button
                            type="button"
                            disabled={deletingBankId === b.id}
                            title={`Xóa ${b.tenVietTat}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px', flexShrink: 0, opacity: deletingBankId === b.id ? 0.5 : 1 }}
                            onClick={async () => {
                              if (!confirm(`Xóa ngân hàng "${b.tenVietTat} - ${b.tenDayDu}"?\nNCC đã lưu sẽ không bị ảnh hưởng.`)) return;
                              setDeletingBankId(b.id);
                              try {
                                const res = await fetch(`/api/ngan-hang/${b.id}`, { method: 'DELETE' });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');
                                await fetchBanks();
                              } catch (err) {
                                setQuickBankError(err.message);
                              } finally {
                                setDeletingBankId(null);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thêm ngân hàng mới
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Tên viết tắt (Ví dụ: VCB, TCB, MB) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Viết hoa liền không dấu..."
                  value={quickBankVietTat}
                  onChange={(e) => setQuickBankVietTat(e.target.value)}
                  disabled={quickBankLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Tên đầy đủ (Ví dụ: Vietcombank, Techcombank) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Nhập tên đầy đủ..."
                  value={quickBankDayDu}
                  onChange={(e) => setQuickBankDayDu(e.target.value)}
                  disabled={quickBankLoading}
                />
              </div>

              <div className={styles.formActions} style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsQuickBankOpen(false)} className="btn btn-secondary" disabled={quickBankLoading}>
                  Hủy bỏ
                </button>
                <button 
                  type="button" 
                  onClick={async () => {
                    setQuickBankError('');
                    if (!quickBankVietTat || !quickBankDayDu) {
                      setQuickBankError('Vui lòng điền đầy đủ thông tin bắt buộc.');
                      return;
                    }
                    setQuickBankLoading(true);
                    try {
                      const res = await fetch('/api/ngan-hang', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenVietTat: quickBankVietTat,
                          tenDayDu: quickBankDayDu
                        })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

                      // Re-fetch banks list
                      await fetchBanks();

                      // Auto select newly created bank
                      setTenNganHang(`${data.bank.tenVietTat} - ${data.bank.tenDayDu}`);

                      // Reset quick form
                      setQuickBankVietTat('');
                      setQuickBankDayDu('');

                      // Close nested popup
                      setIsQuickBankOpen(false);
                    } catch (err) {
                      setQuickBankError(err.message);
                    } finally {
                      setQuickBankLoading(false);
                    }
                  }}
                  className="btn btn-primary"
                  disabled={quickBankLoading}
                >
                  {quickBankLoading ? 'Đang tạo...' : 'Lưu & Chọn'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: LỊCH SỬ GIAO DỊCH NCC */}
      {historyVendor && (
        <div className={styles.modalOverlay} onClick={() => setHistoryVendor(null)}>
          <div
            className={`${styles.modalContent} glass-card`}
            style={{ maxWidth: '780px', padding: '2rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader} style={{ marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ marginBottom: '0.25rem' }}>Lịch sử giao dịch — {historyVendor.tenNCC}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {historyVendor.soTaiKhoan} · {historyVendor.tenNganHang}
                </p>
              </div>
              <button onClick={() => setHistoryVendor(null)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {historyLoading ? (
              <div className={styles.loaderSmall}>Đang tải lịch sử...</div>
            ) : vendorHistory.length === 0 ? (
              <div className={styles.emptyState}>Chưa có giao dịch nào với nhà cung cấp này.</div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{vendorHistory.length} phiếu</span>
                  <span style={{ fontWeight: '700', color: '#34d399' }}>
                    Tổng: {formatVND(vendorHistory.reduce((s, p) => s + p.soTien, 0))}
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="custom-table" style={{ fontSize: '0.88rem' }}>
                    <thead>
                      <tr>
                        <th>Mã phiếu</th>
                        <th>Ngày phát sinh</th>
                        <th>Nội dung</th>
                        <th>Người tạo</th>
                        <th style={{ textAlign: 'right' }}>Số tiền</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorHistory.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{p.maPhieu}</td>
                          <td suppressHydrationWarning>{new Date(p.ngayPhatSinh).toLocaleDateString('vi-VN')}</td>
                          <td>{p.noiDung}</td>
                          <td>{p.nguoiTao?.hoTen || '—'}</td>
                          <td style={{ fontWeight: '700', textAlign: 'right', color: '#fbbf24' }}>{formatVND(p.soTien)}</td>
                          <td>
                            {p.trangThai === 'DA_THANH_TOAN' && <span className="badge badge-paid">Đã thanh toán</span>}
                            {p.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                            {p.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                            {p.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', textAlign: 'right' }}>
              <button onClick={() => setHistoryVendor(null)} className="btn btn-secondary">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
