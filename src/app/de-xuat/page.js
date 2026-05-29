'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  X, 
  Check, 
  Info,
  Calendar,
  AlertCircle,
  FileImage,
  Edit3
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './de-xuat.module.css';

export default function DeXuatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [proposals, setProposals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filter states
  const [filterTrangThai, setFilterTrangThai] = useState('');
  const [filterNguonTien, setFilterNguonTien] = useState('');
  const [filterThang, setFilterThang] = useState('');
  const [filterDanhMuc, setFilterDanhMuc] = useState('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form inputs
  const [ngayPhatSinh, setNgayPhatSinh] = useState(new Date().toISOString().split('T')[0]);
  const [danhMucId, setDanhMucId] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [soTien, setSoTien] = useState('');
  const [nhaCungCapId, setNhaCungCapId] = useState('');
  const [nguonTien, setNguonTien] = useState('TIEN_SHOP');
  const [trangThai, setTrangThai] = useState('CHO_THANH_TOAN');
  const [ghiChu, setGhiChu] = useState('');
  const [anhHoaDon, setAnhHoaDon] = useState(''); // base64 giả lập hoặc URL ảnh
  const [ngayCanThanhToan, setNgayCanThanhToan] = useState('');
  const [formType, setFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [editingId, setEditingId] = useState(null);

  // Quick NCC popup states
  const [isQuickNccOpen, setIsQuickNccOpen] = useState(false);
  const [quickTenNcc, setQuickTenNcc] = useState('');
  const [quickSoTaiKhoan, setQuickSoTaiKhoan] = useState('');
  const [quickTenNganHang, setQuickTenNganHang] = useState('');
  const [quickMaQr, setQuickMaQr] = useState('');
  const [quickError, setQuickError] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // Detail Modal state
  const [selectedProp, setSelectedProp] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const generateVietQRUrl = (vendor, amount, memo) => {
    if (!vendor) return '';
    let bankCode = '';
    const nameUpper = vendor.tenNganHang.toUpperCase();
    if (nameUpper.includes('-')) {
      bankCode = nameUpper.split('-')[0].trim();
    } else {
      bankCode = nameUpper.trim();
    }
    
    let qrBank = bankCode.toLowerCase();
    if (qrBank === 'vcb') qrBank = 'vietcombank';
    else if (qrBank === 'tcb') qrBank = 'techcombank';
    else if (qrBank === 'ctg') qrBank = 'vietinbank';
    else if (qrBank === 'mb' || qrBank === 'mbbank') qrBank = 'mbb';
    else if (qrBank === 'vpb') qrBank = 'vpbank';
    else if (qrBank === 'hdb') qrBank = 'hdbank';
    else if (qrBank === 'stb') qrBank = 'sacombank';
    
    return `https://img.vietqr.io/image/${qrBank}-${vendor.soTaiKhoan}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(vendor.tenNCC)}`;
  };


  // Lấy thông tin danh mục đang chọn để check xem có yêu cầu chọn NCC không
  const currentCategory = categories.find(c => c.id === danhMucId);

  useEffect(() => {
    // 1. Check auth
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
          // 2. Fetch danh sách đề xuất, danh mục, NCC
          fetchData(data.user);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  // Tự động set trạng thái mặc định dựa trên nguồn tiền khi người dùng chọn nguồn
  useEffect(() => {
    if (nguonTien === 'TIEN_CA_NHAN') {
      setTrangThai('CHO_HOAN_UNG');
    } else {
      setTrangThai('CHO_THANH_TOAN');
    }
  }, [nguonTien]);

  const fetchData = async (currentUser) => {
    setDataLoading(true);
    try {
      // Fetch Proposals
      const propRes = await fetch('/api/de-xuat');
      if (propRes.ok) {
        const propData = await propRes.json();
        setProposals(propData);
      }

      // Fetch Categories
      const catRes = await fetch('/api/danh-muc');
      if (catRes.ok) {
        const catData = await catRes.json();
        
        // Lọc danh mục:
        // 1. Chỉ lấy loại CHI (đề xuất chi phí)
        // 2. Phân quyền vai trò được xem cho từng đối tượng (OWNER, MANAGER, STAFF)
        const activeUser = currentUser || user;
        const userRole = activeUser ? activeUser.role : 'STAFF';

        const allowedCategories = catData.categories.filter(cat => {
          if (cat.loaiGiaoDich !== 'CHI') return false;
          try {
            const roles = JSON.parse(cat.chucVuDuocXem);
            return roles.includes(userRole);
          } catch (e) {
            return true;
          }
        });
        
        setCategories(allowedCategories);
      }

      // Fetch Vendors
      const venRes = await fetch('/api/ncc');
      if (venRes.ok) {
        const venData = await venRes.json();
        setVendors(venData);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleCancelProp = async (id, maPhieu) => {
    if (confirm(`Bạn có chắc chắn muốn HỦY đề xuất ${maPhieu}? Đề xuất đã thanh toán sẽ không thể hủy.`)) {
      try {
        const res = await fetch(`/api/de-xuat/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'HUY' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hủy thất bại');
        
        alert(`Đã hủy phiếu đề xuất ${maPhieu} thành công!`);
        fetchData(); // Tải lại danh sách
        if (selectedProp && selectedProp.id === id) {
          setSelectedProp(null);
        }
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const canEdit = (prop) => {
    if (!user) return false;
    if (user.role === 'OWNER') return true;
    if (user.role === 'STAFF' && prop.nguoiTaoId !== user.id) return false;
    if (prop.trangThai === 'HUY') return false;
    if (prop.trangThai === 'DA_THANH_TOAN' && prop.thuChiId !== null) return false;
    return true;
  };

  const handleOpenAdd = () => {
    setFormType('ADD');
    setEditingId(null);
    setNgayPhatSinh(new Date().toISOString().split('T')[0]);
    setNgayCanThanhToan('');
    setNguonTien('TIEN_SHOP');
    setTrangThai('CHO_THANH_TOAN');
    setDanhMucId('');
    setSoTien('');
    setNhaCungCapId('');
    setGhiChu('');
    setNoiDung('');
    setAnhHoaDon('');
    
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prop) => {
    setFormType('EDIT');
    setEditingId(prop.id);
    setNgayPhatSinh(new Date(prop.ngayPhatSinh).toISOString().split('T')[0]);
    setNgayCanThanhToan(prop.ngayCanThanhToan ? new Date(prop.ngayCanThanhToan).toISOString().split('T')[0] : '');
    setNguonTien(prop.nguonTien);
    setTrangThai(prop.trangThai);
    setDanhMucId(prop.danhMucId);
    setSoTien(prop.soTien.toString());
    setNhaCungCapId(prop.nhaCungCapId || '');
    setGhiChu(prop.ghiChu || '');
    setNoiDung(prop.noiDung);
    setAnhHoaDon(prop.anhHoaDon || '');
    
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Kiểm tra dữ liệu
    if (!danhMucId || !noiDung || !soTien) {
      setFormError('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }

    if (Number(soTien) <= 0) {
      setFormError('Số tiền phải lớn hơn 0.');
      return;
    }

    if (currentCategory?.yeuCauNCC && !nhaCungCapId) {
      setFormError(`Danh mục "${currentCategory.tenDanhMuc}" bắt buộc phải chọn Nhà cung cấp.`);
      return;
    }

    setFormLoading(true);

    try {
      const url = formType === 'ADD' ? '/api/de-xuat' : `/api/de-xuat/${editingId}`;
      const method = formType === 'ADD' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngayPhatSinh,
          danhMucId,
          noiDung,
          soTien: Number(soTien),
          nhaCungCapId: nhaCungCapId || null,
          anhHoaDon: anhHoaDon || null,
          nguonTien,
          trangThai,
          ghiChu,
          ngayCanThanhToan: ngayCanThanhToan || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu đề xuất thất bại.');

      setFormSuccess(data.message || (formType === 'ADD' ? 'Đã tạo đề xuất thành công!' : 'Đã cập nhật đề xuất thành công!'));
      
      // Reset form
      setDanhMucId('');
      setNoiDung('');
      setSoTien('');
      setNhaCungCapId('');
      setGhiChu('');
      setAnhHoaDon('');
      setNgayCanThanhToan('');

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

  // Lọc dữ liệu hiển thị trên Client
  const filteredProposals = proposals.filter((p) => {
    if (filterTrangThai && p.trangThai !== filterTrangThai) return false;
    if (filterNguonTien && p.nguonTien !== filterNguonTien) return false;
    
    // Lọc theo Tháng
    if (filterThang) {
      const propMonth = new Date(p.ngayPhatSinh).getMonth() + 1;
      if (propMonth !== Number(filterThang)) return false;
    }

    // Lọc theo Danh mục
    if (filterDanhMuc && p.danhMucId !== filterDanhMuc) return false;

    return true;
  });

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải danh sách đề xuất...</p>
      </div>
    );
  }

  const formatVND = (num) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  const getDeadlineBadge = (ngayCanThanhToan, trangThai) => {
    if (!ngayCanThanhToan) return null;
    
    const isCompleted = trangThai === 'DA_THANH_TOAN' || trangThai === 'HUY';
    
    if (isCompleted) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '600', backgroundColor: 'rgba(16,185,129,0.08)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            ✓ Hạn: {new Date(ngayCanThanhToan).toLocaleDateString('vi-VN')}
          </span>
        </div>
      );
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(ngayCanThanhToan);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: '800', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block', border: '1px solid rgba(239,68,68,0.2)' }}>
            🚨 Trễ hạn {Math.abs(diffDays)} ngày ({new Date(ngayCanThanhToan).toLocaleDateString('vi-VN')})
          </span>
        </div>
      );
    } else if (diffDays === 0) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: '800', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block', border: '1px solid rgba(245,158,11,0.2)' }}>
            🚨 CẦN CHI HÔM NAY ({new Date(ngayCanThanhToan).toLocaleDateString('vi-VN')})
          </span>
        </div>
      );
    } else if (diffDays <= 2) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: '700', backgroundColor: 'rgba(251,191,36,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            ⏳ Sắp đến hạn ({new Date(ngayCanThanhToan).toLocaleDateString('vi-VN')})
          </span>
        </div>
      );
    } else {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#4b5563', fontWeight: '600', backgroundColor: 'rgba(75,85,99,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            📅 Hạn: {new Date(ngayCanThanhToan).toLocaleDateString('vi-VN')}
          </span>
        </div>
      );
    }
  };


  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Đề xuất chi phí</h1>
            <p className={styles.pageDesc}>
              {user.role === 'STAFF' 
                ? 'Quản lý và tạo mới các đề xuất chi tiêu cá nhân của bạn' 
                : 'Xem danh sách và quản lý các đề xuất chi tiêu nội bộ của shop'}
            </p>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <PlusCircle size={20} />
            <span>Tạo đề xuất chi</span>
          </button>
        </div>

        {/* Filter Section */}
        <div className={`${styles.filterCard} glass-card`}>
          <div className={styles.filterGroup} style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className={styles.filterItem} style={{ minWidth: '200px', flex: 1 }}>
              <label className="form-label">Lọc theo trạng thái</label>
              <select 
                className="form-control"
                value={filterTrangThai}
                onChange={(e) => setFilterTrangThai(e.target.value)}
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="CHO_THANH_TOAN">Chờ thanh toán (Tiền Shop)</option>
                <option value="CHO_HOAN_UNG">Chờ hoàn ứng (Cá nhân ứng)</option>
                <option value="DA_THANH_TOAN">Đã thanh toán (Hoàn tất)</option>
                <option value="HUY">Đã hủy</option>
              </select>
            </div>
            
            <div className={styles.filterItem} style={{ minWidth: '200px', flex: 1 }}>
              <label className="form-label">Lọc theo nguồn tiền</label>
              <select 
                className="form-control"
                value={filterNguonTien}
                onChange={(e) => setFilterNguonTien(e.target.value)}
              >
                <option value="">-- Tất cả nguồn tiền --</option>
                <option value="TIEN_SHOP">🏦 Tiền Shop (Shop chi)</option>
                <option value="TIEN_CA_NHAN">👤 Tiền cá nhân (Nhân viên ứng trước)</option>
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '150px', flex: 1 }}>
              <label className="form-label">Lọc theo Tháng</label>
              <select 
                className="form-control"
                value={filterThang}
                onChange={(e) => setFilterThang(e.target.value)}
              >
                <option value="">-- Tất cả tháng --</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '220px', flex: 1 }}>
              <label className="form-label">Lọc theo Danh mục</label>
              <select 
                className="form-control"
                value={filterDanhMuc}
                onChange={(e) => setFilterDanhMuc(e.target.value)}
              >
                <option value="">-- Tất cả danh mục --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.tenDanhMuc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Proposals Table */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          {dataLoading ? (
            <div className={styles.loaderSmall}>Đang tải dữ liệu đề xuất...</div>
          ) : filteredProposals.length === 0 ? (
            <div className={styles.emptyState}>Không tìm thấy đề xuất chi phí nào phù hợp với bộ lọc.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Ngày phát sinh</th>
                    <th>Người đề xuất</th>
                    <th>Danh mục</th>
                    <th>Nguồn tiền</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map((prop) => (
                    <tr key={prop.id}>
                      <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{prop.maPhieu}</td>
                      <td suppressHydrationWarning>
                        {new Date(prop.ngayPhatSinh).toLocaleDateString('vi-VN')}
                        {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                      </td>

                      <td>
                        <span style={{ fontWeight: '600' }} title={prop.nguoiTao.hoTen}>
                          {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                        </span>
                        <br />
                        <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                      </td>
                      <td>{prop.danhMuc.tenDanhMuc}</td>
                      <td>
                        {prop.nguonTien === 'TIEN_SHOP' ? (
                          <span style={{ color: '#60a5fa', fontWeight: '500' }}>🏦 Tiền Shop</span>
                        ) : (
                          <span style={{ color: '#a7f3d0', fontWeight: '500' }}>👤 Cá nhân ứng</span>
                        )}
                      </td>
                      <td style={{ fontWeight: '800', color: '#1e293b' }}>{formatVND(prop.soTien)}</td>

                      <td>
                        {prop.trangThai === 'DA_THANH_TOAN' && prop.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                        {prop.trangThai === 'DA_THANH_TOAN' && prop.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn (Chờ duyệt)</span>}
                        {prop.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                        {prop.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                        {prop.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionButtons}>
                          <button 
                            onClick={() => setSelectedProp(prop)} 
                            className={`${styles.actionBtn} ${styles.viewBtn}`} 
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </button>

                          {canEdit(prop) && (
                            <button 
                              onClick={() => handleOpenEdit(prop)} 
                              className={`${styles.actionBtn} ${styles.editBtn}`} 
                              title="Sửa đề xuất"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}
                          
                          {/* Cho phép hủy nếu không phải trạng thái DA_THANH_TOAN và HUY */}
                          {prop.trangThai !== 'DA_THANH_TOAN' && prop.trangThai !== 'HUY' && (
                            <button 
                              onClick={() => handleCancelProp(prop.id, prop.maPhieu)} 
                              className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                              title="Hủy đề xuất"
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

        {/* Modal: TẠO ĐỀ XUẤT MỚI */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{formType === 'ADD' ? 'Tạo Đề xuất chi phí mới' : 'Sửa đề xuất chi phí'}</h2>
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

              <form onSubmit={handleCreateProposal} className={styles.form}>
                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="ngayPhatSinh">Ngày phát sinh *</label>
                    <input
                      id="ngayPhatSinh"
                      type="date"
                      className="form-control"
                      value={ngayPhatSinh}
                      onChange={(e) => setNgayPhatSinh(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="ngayCanThanhToan">Ngày cần thanh toán (Nếu có)</label>
                    <input
                      id="ngayCanThanhToan"
                      type="date"
                      className="form-control"
                      value={ngayCanThanhToan}
                      onChange={(e) => setNgayCanThanhToan(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="nguonTien">Nguồn tiền *</label>
                    <select
                      id="nguonTien"
                      className="form-control"
                      value={nguonTien}
                      onChange={(e) => setNguonTien(e.target.value)}
                      required
                      disabled={formLoading}
                    >
                      <option value="TIEN_SHOP">🏦 Tiền Shop (Shop chi trả)</option>
                      <option value="TIEN_CA_NHAN">👤 Tiền cá nhân (Nhân viên ứng trước)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="trangThai">Trạng thái ban đầu *</label>
                    <select
                      id="trangThai"
                      className="form-control"
                      value={trangThai}
                      onChange={(e) => setTrangThai(e.target.value)}
                      required
                      disabled={formLoading || nguonTien === 'TIEN_CA_NHAN'} // Khóa nếu là tiền cá nhân ứng (bắt buộc hoàn ứng)
                    >
                      {nguonTien === 'TIEN_SHOP' ? (
                        <>
                          <option value="CHO_THANH_TOAN">Chờ thanh toán (TH1)</option>
                          <option value="DA_THANH_TOAN">Đã thanh toán sẵn (TH2)</option>
                        </>
                      ) : (
                        <option value="CHO_HOAN_UNG">Chờ hoàn ứng (TH3)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="danhMucId">Danh mục chi phí *</label>
                    <select
                      id="danhMucId"
                      className="form-control"
                      value={danhMucId}
                      onChange={(e) => setDanhMucId(e.target.value)}
                      required
                      disabled={formLoading}
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.tenDanhMuc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="soTien">Số tiền (VND) *</label>
                    <input
                      id="soTien"
                      type="number"
                      placeholder="Nhập số tiền chi..."
                      className="form-control"
                      value={soTien}
                      onChange={(e) => setSoTien(e.target.value)}
                      required
                      disabled={formLoading}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" htmlFor="nhaCungCapId" style={{ margin: 0 }}>
                        Nhà cung cấp {currentCategory?.yeuCauNCC && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setIsQuickNccOpen(true)}
                        style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: 0 }}
                      >
                        + Thêm nhanh NCC
                      </button>
                    </div>
                    <select
                      id="nhaCungCapId"
                      className="form-control"
                      value={nhaCungCapId}
                      onChange={(e) => setNhaCungCapId(e.target.value)}
                      disabled={formLoading}
                    >
                      <option value="">-- Chọn NCC (Nếu có) --</option>
                      {vendors.map((ven) => (
                        <option key={ven.id} value={ven.id}>
                          {ven.tenNCC} ({ven.tenNganHang})
                        </option>
                      ))}
                    </select>
                    {nhaCungCapId && (
                      (() => {
                        const selVendor = vendors.find(v => v.id === nhaCungCapId);
                        if (selVendor) {
                          return (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '6px', fontSize: '0.8rem', color: '#60a5fa' }}>
                              👉 <strong>{selVendor.tenNCC}</strong> | STK: <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fbbf24' }}>{selVendor.soTaiKhoan}</span> | {selVendor.tenNganHang}
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="ghiChu">Ghi chú</label>
                    <input
                      id="ghiChu"
                      type="text"
                      placeholder="Nhập ghi chú thêm nếu cần..."
                      className="form-control"
                      value={ghiChu}
                      onChange={(e) => setGhiChu(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="noiDung">Nội dung chi tiết *</label>
                  <textarea
                    id="noiDung"
                    placeholder="Mô tả cụ thể lý do đề xuất chi chi tiết..."
                    className="form-control"
                    rows={2}
                    value={noiDung}
                    onChange={(e) => setNoiDung(e.target.value)}
                    required
                    disabled={formLoading}
                  />
                </div>


                <div className="form-group">
                  <label className="form-label">Ảnh hóa đơn chứng từ (Simulate)</label>
                  <div className={styles.uploadBox}>
                    <FileImage size={24} />
                    <span>Hóa đơn đính kèm tự động lưu (Base64)</span>
                    <input 
                      type="button" 
                      value="Gắn hóa đơn demo" 
                      onClick={() => setAnhHoaDon('https://via.placeholder.com/600x400.png?text=Hoa+Don+Chung+Tu')} 
                      className="btn btn-secondary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    />
                    {anhHoaDon && <span className={styles.uploadedBadge}>Đã gắn 1 ảnh</span>}
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading}>
                    {formLoading ? 'Đang lưu...' : formType === 'ADD' ? 'Gửi Đề xuất' : 'Lưu Thay Đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: XEM CHI TIẾT ĐỀ XUẤT */}
        {selectedProp && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.detailContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Chi tiết đề xuất {selectedProp.maPhieu}</h2>
                <button onClick={() => setSelectedProp(null)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Mã phiếu:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#60a5fa' }}>{selectedProp.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày lập:</span>
                  <span className={styles.detailValue} suppressHydrationWarning>{new Date(selectedProp.ngayPhatSinh).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Hạn thanh toán:</span>
                  <span className={styles.detailValue} style={{ color: selectedProp.ngayCanThanhToan ? '#fbbf24' : 'inherit', fontWeight: selectedProp.ngayCanThanhToan ? '600' : 'normal' }} suppressHydrationWarning>
                    {selectedProp.ngayCanThanhToan 
                      ? `📅 ${new Date(selectedProp.ngayCanThanhToan).toLocaleDateString('vi-VN')}` 
                      : 'Không có'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedProp.nguoiTao.hoTen} ({selectedProp.nguoiTao.role})</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Nguồn tiền:</span>
                  <span className={styles.detailValue}>
                    {selectedProp.nguonTien === 'TIEN_SHOP' ? '🏦 Tiền Shop chi' : '👤 Cá nhân nhân viên ứng'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Danh mục chi:</span>
                  <span className={styles.detailValue}>{selectedProp.danhMuc.tenDanhMuc}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Số tiền chi:</span>
                  <span className={styles.detailValue} style={{ fontWeight: '800', color: '#34d399', fontSize: '1.1rem' }}>{formatVND(selectedProp.soTien)}</span>
                </div>
                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Nội dung chi:</span>
                  <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{selectedProp.noiDung}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Nhà cung cấp:</span>
                  <span className={styles.detailValue}>{selectedProp.nhaCungCap ? `${selectedProp.nhaCungCap.tenNCC} (${selectedProp.nhaCungCap.tenNganHang})` : 'Không có'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Trạng thái:</span>
                  <span className={styles.detailValue}>
                    {selectedProp.trangThai === 'DA_THANH_TOAN' && selectedProp.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                    {selectedProp.trangThai === 'DA_THANH_TOAN' && selectedProp.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn (Chờ duyệt)</span>}
                    {selectedProp.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                    {selectedProp.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                    {selectedProp.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                  </span>
                </div>

                {selectedProp.trangThai === 'DA_THANH_TOAN' && (
                  <>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Người duyệt thanh toán:</span>
                      <span className={styles.detailValue}>{selectedProp.nguoiDuyet?.hoTen || 'Chủ shop'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Ngày duyệt chi:</span>
                      <span className={styles.detailValue} suppressHydrationWarning>{new Date(selectedProp.ngayThanhToan).toLocaleDateString('vi-VN')}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Quỹ thanh toán:</span>
                      <span className={styles.detailValue} style={{ fontWeight: 'bold' }}>{selectedProp.quyThanhToan?.tenQuy || 'Quỹ của Shop'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Liên kết Phiếu Cashflow:</span>
                      <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#34d399' }}>{selectedProp.thuChiId ? 'Đã liên kết phiếu Thu-Chi' : 'Có lỗi dòng tiền'}</span>
                    </div>
                  </>
                )}

                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Ghi chú:</span>
                  <span className={styles.detailValue}>{selectedProp.ghiChu || 'Không có ghi chú thêm.'}</span>
                </div>

                {selectedProp.anhHoaDon && (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Hóa đơn đính kèm:</span>
                    <div className={styles.invoiceImgWrapper}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedProp.anhHoaDon} alt="Hóa đơn chứng từ" className={styles.invoiceImg} />
                    </div>
                  </div>
                )}

                {selectedProp.nhaCungCap && (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                    <span className={styles.detailLabel} style={{ color: '#60a5fa', fontWeight: 'bold' }}>THÔNG TIN THANH TOÁN (VIETQR ĐỘNG):</span>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1.5rem',
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid rgba(96, 165, 250, 0.25)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginTop: '0.5rem',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chủ tài khoản / NCC</div>
                          <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.95rem' }}>{selectedProp.nhaCungCap.tenNCC}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tài khoản (STK)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: '#fbbf24' }}>
                              {selectedProp.nhaCungCap.soTaiKhoan}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedProp.nhaCungCap.soTaiKhoan, 'stk')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {copiedField === 'stk' ? '✓ Đã chép' : 'Sao chép'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngân hàng</div>
                          <div style={{ fontWeight: '600', color: '#f8fafc' }}>{selectedProp.nhaCungCap.tenNganHang}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tiền thanh toán</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontWeight: '800', color: '#34d399', fontSize: '1.1rem' }}>
                              {formatVND(selectedProp.soTien)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedProp.soTien.toString(), 'sotien')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {copiedField === 'sotien' ? '✓ Đã chép' : 'Sao chép số tiền'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nội dung chuyển khoản (Memo)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              {selectedProp.maPhieu}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedProp.maPhieu, 'memo')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {copiedField === 'memo' ? '✓ Đã chép' : 'Sao chép ND'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        flex: '0 0 160px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: '#ffffff',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.15)'
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={generateVietQRUrl(selectedProp.nhaCungCap, selectedProp.soTien, selectedProp.maPhieu)}
                          alt="Mã VietQR động chuyển khoản"
                          style={{ width: '130px', height: '130px', objectFit: 'contain' }}
                        />
                        <div style={{ fontSize: '0.65rem', color: '#1e293b', fontWeight: 'bold', textAlign: 'center' }}>
                          Quét QR để tự điền tiền & nội dung
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
                {selectedProp.trangThai !== 'DA_THANH_TOAN' && selectedProp.trangThai !== 'HUY' && (
                  <button 
                    onClick={() => handleCancelProp(selectedProp.id, selectedProp.maPhieu)} 
                    className="btn btn-danger"
                  >
                    Hủy đề xuất này
                  </button>
                )}
                
                {/* Chủ shop duyệt trực tiếp tại popup chi tiết */}
                {user.role === 'OWNER' && selectedProp.trangThai === 'CHO_THANH_TOAN' && (
                  <button 
                    onClick={() => {
                      setSelectedProp(null);
                      router.push('/de-xuat/duyet');
                    }} 
                    className="btn btn-primary"
                  >
                    Đi duyệt thanh toán
                  </button>
                )}

                <button onClick={() => setSelectedProp(null)} className="btn btn-secondary">
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal lồng: THÊM NHANH NHÀ CUNG CẤP */}
        {isQuickNccOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
            <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: '480px' }}>
              <div className={styles.modalHeader}>
                <h2>Thêm Nhanh Nhà Cung Cấp</h2>
                <button type="button" onClick={() => setIsQuickNccOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {quickError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={18} />
                  <span>{quickError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Tên nhà cung cấp *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Nhập tên đối tác..."
                  value={quickTenNcc}
                  onChange={(e) => setQuickTenNcc(e.target.value)}
                  disabled={quickLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Số tài khoản chuyển khoản *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Nhập số tài khoản..."
                  value={quickSoTaiKhoan}
                  onChange={(e) => setQuickSoTaiKhoan(e.target.value)}
                  disabled={quickLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Ngân hàng chuyển khoản *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ví dụ: Vietcombank, Techcombank..."
                  value={quickTenNganHang}
                  onChange={(e) => setQuickTenNganHang(e.target.value)}
                  disabled={quickLoading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Mã QR ngân hàng (Nếu có)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      if (!quickSoTaiKhoan || !quickTenNganHang) {
                        alert('Vui lòng điền Số tài khoản và Ngân hàng trước!');
                        return;
                      }
                      setQuickMaQr(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=AriFinance-QuickTransfer-${quickSoTaiKhoan.trim()}-${quickTenNganHang.trim()}`);
                    }}
                    disabled={!quickSoTaiKhoan || !quickTenNganHang}
                  >
                    Tạo mã QR Demo
                  </button>
                  {quickMaQr && <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>✓ Đã tạo mã QR</span>}
                </div>
              </div>

              <div className={styles.formActions} style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setIsQuickNccOpen(false)} className="btn btn-secondary" disabled={quickLoading}>
                  Hủy bỏ
                </button>
                <button 
                  type="button" 
                  onClick={async () => {
                    setQuickError('');
                    if (!quickTenNcc || !quickSoTaiKhoan || !quickTenNganHang) {
                      setQuickError('Vui lòng nhập đầy đủ các trường bắt buộc (*).');
                      return;
                    }
                    setQuickLoading(true);
                    try {
                      const res = await fetch('/api/ncc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tenNCC: quickTenNcc,
                          soTaiKhoan: quickSoTaiKhoan,
                          tenNganHang: quickTenNganHang,
                          maQR: quickMaQr || null
                        })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

                      // Re-fetch vendors list
                      const vendorListRes = await fetch('/api/ncc');
                      if (vendorListRes.ok) {
                        const newVendors = await vendorListRes.json();
                        setVendors(newVendors);
                      }

                      // Auto select the newly created vendor
                      setNhaCungCapId(data.vendor.id);

                      // Reset quick form
                      setQuickTenNcc('');
                      setQuickSoTaiKhoan('');
                      setQuickTenNganHang('');
                      setQuickMaQr('');

                      // Close nested popup
                      setIsQuickNccOpen(false);
                    } catch (err) {
                      setQuickError(err.message);
                    } finally {
                      setQuickLoading(false);
                    }
                  }}
                  className="btn btn-primary"
                  disabled={quickLoading}
                >
                  {quickLoading ? 'Đang tạo...' : 'Lưu & Chọn'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
