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
  ArrowLeft
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

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form Inputs
  const [id, setId] = useState('');
  const [tenNCC, setTenNCC] = useState('');
  const [soTaiKhoan, setSoTaiKhoan] = useState('');
  const [tenNganHang, setTenNganHang] = useState('');
  const [maQR, setMaQR] = useState(''); // base64 hoặc URL

  // Detail Modal State
  const [selectedVendor, setSelectedVendor] = useState(null);

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

  // Convert uploaded image to base64
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Kích thước ảnh phải nhỏ hơn 2MB!');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaQR(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDemoQR = () => {
    if (!soTaiKhoan || !tenNganHang) {
      alert('Vui lòng điền Số tài khoản và Tên ngân hàng trước khi sinh QR demo!');
      return;
    }
    const mockQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=AriFinance-Transfer-To-${soTaiKhoan.trim()}-${tenNganHang.trim()}`;
    setMaQR(mockQRUrl);
  };

  const handleOpenAdd = () => {
    setFormType('ADD');
    setId('');
    setTenNCC('');
    setSoTaiKhoan('');
    setTenNganHang('');
    setMaQR('');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v) => {
    setFormType('EDIT');
    setId(v.id);
    setTenNCC(v.tenNCC);
    setSoTaiKhoan(v.soTaiKhoan);
    setTenNganHang(v.tenNganHang);
    setMaQR(v.maQR || '');
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
      soTaiKhoan: soTaiKhoan.trim(),
      tenNganHang: tenNganHang.trim(),
      maQR: maQR || null
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
          {user.role !== 'STAFF' && (
            <button onClick={handleOpenAdd} className="btn btn-primary">
              <Plus size={20} />
              <span>Thêm nhà cung cấp</span>
            </button>
          )}
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
                    <th>Số tài khoản</th>
                    <th>Ngân hàng</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Giao dịch</th>
                    <th style={{ textAlign: 'right', width: '180px' }}>Tổng đã chi</th>
                    <th style={{ textAlign: 'center', width: '140px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{v.id}</td>
                      <td style={{ fontWeight: '600' }}>{v.tenNCC}</td>
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
                            title="Quét mã QR / Chi tiết"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {user.role !== 'STAFF' && (
                            <button 
                              onClick={() => handleOpenEdit(v)} 
                              className={`${styles.actionBtn} ${styles.editBtn}`} 
                              title="Sửa thông tin"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}

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
                  <label className="form-label">Mã Đối Tác (Bỏ trống để tự sinh)</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: IN-ARI hoặc NCC-001"
                    className="form-control"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    disabled={formLoading || formType === 'EDIT'}
                  />
                  {formType === 'ADD' && (
                    <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                      Nên viết in hoa liền không dấu. Nếu bỏ trống hệ thống tự đặt mã NCC-XXXX.
                    </small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Tên Nhà Cung Cấp *</label>
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
                          {b.tenVietTat} - {b.tenDayDu}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className="form-label">Mã QR Thanh Toán (Đính kèm hoặc Sinh tự động)</label>
                  <div className={styles.uploadBox}>
                    <QrCode size={24} />
                    <span>Tải lên hình ảnh mã QR chuyển khoản của đối tác</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        id="qr-file-upload"
                      />
                      <label htmlFor="qr-file-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                        Tải ảnh lên
                      </label>
                      <button 
                        type="button" 
                        onClick={handleDemoQR}
                        className="btn btn-secondary btn-sm"
                        disabled={!soTaiKhoan || !tenNganHang}
                      >
                        Sinh QR Demo
                      </button>
                    </div>
                    {maQR && (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className={styles.uploadedBadge}>Đã đính kèm ảnh QR</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={maQR} alt="QR Preview" style={{ width: '120px', height: '120px', objectFit: 'contain', marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: '8px' }} />
                        <button type="button" onClick={() => setMaQR('')} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          Xóa ảnh
                        </button>
                      </div>
                    )}
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

        {/* MODAL: XEM CHI TIẾT & MÃ QR */}
        {selectedVendor && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.detailContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Quét Mã Thanh Toán - {selectedVendor.tenNCC}</h2>
                <button onClick={() => setSelectedVendor(null)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.detailCard}>
                <div className={styles.qrContainer}>
                  {selectedVendor.maQR ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedVendor.maQR} alt="QR Code Chuyển Khoản" className={styles.qrImg} />
                  ) : (
                    <div className={styles.noQrText}>
                      <QrCode size={40} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                      Chưa có mã QR.
                      <br />
                      <small style={{ fontWeight: 'normal', color: '#94a3b8' }}>Chủ shop có thể sửa đối tác để tải lên mã QR ngân hàng.</small>
                    </div>
                  )}
                </div>

                <div className={styles.bankDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Tên đối tác:</span>
                    <span className={styles.value}>{selectedVendor.tenNCC}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Mã đối tác:</span>
                    <span className={styles.value} style={{ color: '#60a5fa' }}>{selectedVendor.id}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Số tài khoản:</span>
                    <span className={styles.value} style={{ fontFamily: 'monospace', fontSize: '1rem', color: '#fbbf24' }}>{selectedVendor.soTaiKhoan}</span>
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
                <h2>Thêm Nhanh Ngân Hàng Danh Mục</h2>
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
    </div>
  );
}
