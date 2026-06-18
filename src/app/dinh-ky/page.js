'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Check, AlertCircle, Edit3, Trash2,
  ToggleLeft, ToggleRight, CalendarCheck, BarChart2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import styles from './dinh-ky.module.css';

const NGUON_TIEN_LABEL = { TIEN_SHOP: '🏦 Tiền Shop', TIEN_CA_NHAN: '👤 Cá nhân ứng' };
const TRANG_THAI_LABEL = { CHO_THANH_TOAN: 'Chờ thanh toán', CHO_HOAN_UNG: 'Chờ hoàn ứng' };

export default function DinhKyPage() {
  const router = useRouter();
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const [sortBy, setSortBy] = useState('createdAt'); // default to newest
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'tenMau' || field === 'ngayChiTrongThang' ? 'asc' : 'desc');
    }
  };

  const getSortedTemplates = (tplsArray) => {
    const sorted = [...tplsArray];
    sorted.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortBy === 'soTien') {
        valA = a.soTien;
        valB = b.soTien;
      } else if (sortBy === 'ngayChiTrongThang') {
        valA = a.ngayChiTrongThang;
        valB = b.ngayChiTrongThang;
      } else if (sortBy === 'tenMau') {
        return sortOrder === 'asc' 
          ? a.tenMau.localeCompare(b.tenMau) 
          : b.tenMau.localeCompare(a.tenMau);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('ADD'); // ADD | EDIT
  const [editingId, setEditingId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form fields
  const [tenMau, setTenMau] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [soTien, setSoTien] = useState('');
  const [danhMucId, setDanhMucId] = useState('');
  const [nhaCungCapId, setNhaCungCapId] = useState('');
  const [nguonTien, setNguonTien] = useState('TIEN_SHOP');
  const [trangThaiMacDinh, setTrangThaiMacDinh] = useState('CHO_THANH_TOAN');
  const [ngayChiTrongThang, setNgayChiTrongThang] = useState(1);
  const [ghiChu, setGhiChu] = useState('');

  // Tạo phiếu tháng này
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState('');
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.status === 401 ? (router.push('/login'), null) : r.json()))
      .then((d) => {
        if (!d?.authenticated) return;
        if (!['OWNER', 'MANAGER'].includes(d.user.role)) {
          toast.error('Chỉ OWNER/MANAGER được truy cập trang này.');
          router.push('/');
          return;
        }
        setUser(d.user);
        setLoading(false);
        fetchAll();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchAll = async () => {
    setDataLoading(true);
    try {
      const [tplRes, catRes, venRes] = await Promise.all([
        fetch('/api/dinh-ky?active=false'),
        fetch('/api/danh-muc'),
        fetch('/api/ncc'),
      ]);
      if (tplRes.ok) setTemplates(await tplRes.json());
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories((d.categories || []).filter((c) => c.loaiGiaoDich === 'CHI'));
      }
      if (venRes.ok) setVendors(await venRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const resetForm = () => {
    setTenMau(''); setNoiDung(''); setSoTien(''); setDanhMucId('');
    setNhaCungCapId(''); setNguonTien('TIEN_SHOP'); setTrangThaiMacDinh('CHO_THANH_TOAN');
    setNgayChiTrongThang(1); setGhiChu('');
    setFormError(''); setFormSuccess('');
  };

  const handleOpenAdd = () => {
    setFormType('ADD'); setEditingId(null); resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tpl) => {
    setFormType('EDIT'); setEditingId(tpl.id);
    setTenMau(tpl.tenMau); setNoiDung(tpl.noiDung);
    setSoTien(String(tpl.soTien)); setDanhMucId(tpl.danhMucId);
    setNhaCungCapId(tpl.nhaCungCapId || ''); setNguonTien(tpl.nguonTien);
    setTrangThaiMacDinh(tpl.trangThaiMacDinh || 'CHO_THANH_TOAN');
    setNgayChiTrongThang(tpl.ngayChiTrongThang || 1); setGhiChu(tpl.ghiChu || '');
    setFormError(''); setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!tenMau.trim() || !noiDung.trim() || !soTien || !danhMucId || !nguonTien) {
      setFormError('Vui lòng điền đủ Tên mẫu, Nội dung, Số tiền, Danh mục, Nguồn tiền.');
      return;
    }
    if (Number(soTien) <= 0) { setFormError('Số tiền phải lớn hơn 0.'); return; }
    setFormLoading(true);
    try {
      const url = formType === 'ADD' ? '/api/dinh-ky' : `/api/dinh-ky/${editingId}`;
      const method = formType === 'ADD' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenMau, noiDung, soTien: Number(soTien), danhMucId, nhaCungCapId: nhaCungCapId || null, nguonTien, trangThaiMacDinh, ngayChiTrongThang: Number(ngayChiTrongThang), ghiChu }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');
      setFormSuccess(data.message || 'Đã lưu!');
      fetchAll();
      setTimeout(() => setIsModalOpen(false), 900);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (tpl) => {
    try {
      const res = await fetch(`/api/dinh-ky/${tpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !tpl.active }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Thao tác thất bại.'); return; }
      fetchAll();
    } catch { toast.error('Lỗi kết nối.'); }
  };

  const handleDelete = async (tpl) => {
    const ok = await showConfirm({
      title: `Xóa mẫu "${tpl.tenMau}"`,
      message: `Các phiếu đã tạo trước đây không bị ảnh hưởng.`,
      confirmLabel: 'Xóa mẫu',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/dinh-ky/${tpl.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');
      fetchAll();
    } catch (err) { toast.error(err.message); }
  };

  const handleTaoThangNay = async () => {
    setCreateResult('');
    const ok = await showConfirm({
      message: `Tạo phiếu định kỳ tháng ${createMonth}/${createYear}?\nHệ thống sẽ tạo phiếu cho tất cả mẫu đang hoạt động. Mẫu đã có phiếu trong tháng sẽ bị bỏ qua.`,
      confirmLabel: 'Tạo phiếu',
    });
    if (!ok) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/dinh-ky/tao-thang-nay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nam: createYear, thang: createMonth }),
      });
      const data = await res.json();
      setCreateResult(data.message || (res.ok ? 'Hoàn thành!' : data.error || 'Thất bại.'));
      if (res.ok && data.created > 0) {
        setTimeout(() => router.push('/de-xuat'), 1500);
      }
    } catch { setCreateResult('Lỗi kết nối.'); }
    finally { setCreateLoading(false); }
  };

  const handleSoTienChange = (e) => setSoTien(e.target.value.replace(/\D/g, ''));
  const formatVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' ₫';

  const displayed = showAll ? templates : templates.filter((t) => t.active);
  const sortedDisplayed = getSortedTemplates(displayed);

  const activeTemplates = templates.filter((t) => t.active);
  const totalMonth = activeTemplates.reduce((sum, t) => sum + Number(t.soTien), 0);
  const categoryMap = {};
  for (const t of activeTemplates) {
    const key = t.tenDanhMuc || t.danhMucId;
    categoryMap[key] = (categoryMap[key] || 0) + Number(t.soTien);
  }
  const categoryList = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const dayMap = {};
  for (const t of activeTemplates) {
    const day = t.ngayChiTrongThang || 1;
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(t);
  }
  const dayList = Object.entries(dayMap).sort((a, b) => Number(a[0]) - Number(b[0]));

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner} />
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />
      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Chi phí định kỳ</h1>
            <p className={styles.pageDesc}>Quản lý các phiếu chi lặp lại hàng tháng (tiền thuê, dịch vụ, v.v.)</p>
          </div>
          <div className={styles.headerActions}>
            {templates.length > 0 && (
              <button
                onClick={() => setShowDashboard((v) => !v)}
                className="btn btn-secondary"
                style={showDashboard ? { background: 'rgba(var(--brand-brown-rgb), 0.18)' } : {}}
              >
                <BarChart2 size={16} /> <span>Tổng quan</span>
              </button>
            )}
            <button onClick={handleOpenAdd} className="btn btn-primary">
              <Plus size={18} /> <span>Thêm mẫu</span>
            </button>
          </div>
        </div>

        {/* Tạo phiếu tháng này */}
        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label className="form-label">Tháng</label>
              <select className="form-control" value={createMonth} onChange={(e) => setCreateMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Năm</label>
              <select className="form-control" value={createYear} onChange={(e) => setCreateYear(Number(e.target.value))}>
                {Array.from({ length: new Date().getFullYear() - 2024 + 3 }, (_, i) => 2024 + i).reverse().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleTaoThangNay} className="btn btn-secondary" disabled={createLoading}>
              <CalendarCheck size={16} />
              <span>{createLoading ? 'Đang tạo...' : `Tạo phiếu tháng ${createMonth}/${createYear}`}</span>
            </button>
            {createResult && (
              <span style={{ color: createResult.includes('thất bại') || createResult.includes('Lỗi') ? '#ef4444' : '#10b981', fontSize: '0.9rem', fontWeight: '600' }}>
                {createResult}
              </span>
            )}
          </div>
        </div>

        {/* Dashboard tổng quan */}
        {showDashboard && activeTemplates.length > 0 && (
          <div className={`glass-card ${styles.dashboardSection}`}>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Chi phí cố định / tháng</span>
                <span className={styles.kpiValue}>{formatVND(totalMonth)}</span>
                <span className={styles.kpiSub}>Mẫu đang hoạt động</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Số khoản định kỳ</span>
                <span className={styles.kpiValue}>{activeTemplates.length}</span>
                <span className={styles.kpiSub}>/ {templates.length} tổng cộng</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Trung bình / khoản</span>
                <span className={styles.kpiValue}>{formatVND(Math.round(totalMonth / (activeTemplates.length || 1)))}</span>
                <span className={styles.kpiSub}>{categoryList.length} danh mục</span>
              </div>
            </div>
            <div className={styles.dashBody}>
              <div>
                <div className={styles.dashSectionTitle}>Cơ cấu theo danh mục</div>
                {categoryList.map(([cat, amt]) => (
                  <div key={cat} className={styles.breakdownRow}>
                    <div className={styles.breakdownMeta}>
                      <span className={styles.breakdownCat}>{cat}</span>
                      <span className={styles.breakdownAmt}>{formatVND(amt)}</span>
                      <span className={styles.breakdownPct}>{totalMonth > 0 ? Math.round((amt / totalMonth) * 100) : 0}%</span>
                    </div>
                    <div className={styles.bar}>
                      <div className={styles.barFill} style={{ width: `${totalMonth > 0 ? (amt / totalMonth) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className={styles.dashSectionTitle}>Lịch chi trong tháng</div>
                {dayList.map(([day, items]) => (
                  <div key={day} className={styles.calGroup}>
                    <span className={styles.calDayBadge}>Ngày {day}</span>
                    <div className={styles.calItems}>
                      {items.map((t) => (
                        <div key={t.id} className={styles.calItem}>
                          <span className={styles.calName}>{t.tenMau}</span>
                          <span className={styles.calAmt}>{formatVND(t.soTien)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.92rem', color: 'var(--text-muted)' }}>
            {displayed.length} mẫu phiếu{showAll ? ' (tất cả)' : ' đang hoạt động'}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Hiển thị cả mẫu đã tắt
          </label>
        </div>

        {/* Table */}
        <div className="glass-card">
          {dataLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Chưa có mẫu phiếu định kỳ nào. Bấm "Thêm mẫu" để bắt đầu.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('tenMau')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Tên mẫu</span>
                        {sortBy === 'tenMau' ? (
                          sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronDown size={14} style={{ opacity: 0.2 }} />
                        )}
                      </div>
                    </th>
                    <th>Nội dung</th>
                    <th>Danh mục</th>
                    <th 
                      onClick={() => handleSort('soTien')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Số tiền</span>
                        {sortBy === 'soTien' ? (
                          sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronDown size={14} style={{ opacity: 0.2 }} />
                        )}
                      </div>
                    </th>
                    <th>Nguồn tiền</th>
                    <th 
                      onClick={() => handleSort('ngayChiTrongThang')} 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Ngày trong tháng</span>
                        {sortBy === 'ngayChiTrongThang' ? (
                          sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronDown size={14} style={{ opacity: 0.2 }} />
                        )}
                      </div>
                    </th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDisplayed.map((tpl) => (
                    <tr key={tpl.id} style={{ opacity: tpl.active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{tpl.tenMau}</td>
                      <td style={{ maxWidth: '200px' }}>
                        <span title={tpl.noiDung}>{tpl.noiDung}</span>
                        {tpl.ghiChu && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{tpl.ghiChu}</div>}
                      </td>
                      <td>{tpl.tenDanhMuc || tpl.danhMucId}</td>
                      <td style={{ fontWeight: '800', color: 'var(--success)' }}>{formatVND(tpl.soTien)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{NGUON_TIEN_LABEL[tpl.nguonTien] || tpl.nguonTien}</td>
                      <td style={{ textAlign: 'center' }}>Ngày {tpl.ngayChiTrongThang}</td>
                      <td>
                        {tpl.active
                          ? <span className="badge badge-paid" style={{ color: '#4b6656', background: 'var(--success-bg)' }}>Đang dùng</span>
                          : <span className="badge badge-cancelled" style={{ color: '#8c5353', background: 'var(--danger-bg)' }}>Tắt</span>
                        }
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button onClick={() => handleOpenEdit(tpl)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} title="Sửa">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleToggle(tpl)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} title={tpl.active ? 'Tắt mẫu' : 'Bật mẫu'}>
                            {tpl.active ? <ToggleRight size={14} color="#10b981" /> : <ToggleLeft size={14} />}
                          </button>
                          {user?.role === 'OWNER' && (
                            <button onClick={() => handleDelete(tpl)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger)' }} title="Xóa">
                              <Trash2 size={14} />
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

        {/* Modal Form */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>{formType === 'ADD' ? 'Thêm mẫu phiếu định kỳ' : 'Sửa mẫu phiếu định kỳ'}</h2>
                <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}><X size={20} /></button>
              </div>

              {formError && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.65rem 0.875rem', color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} /> {formError}
                </div>
              )}
              {formSuccess && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '0.65rem 0.875rem', color: 'var(--success)', fontSize: '0.88rem', marginBottom: '1rem' }}>
                  <Check size={16} /> {formSuccess}
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className="form-group">
                  <label className="form-label">Tên mẫu phiếu *</label>
                  <input type="text" className="form-control" placeholder="Ví dụ: Phí thuê mặt bằng tháng..." value={tenMau} onChange={(e) => setTenMau(e.target.value)} disabled={formLoading} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Danh mục chi phí *</label>
                    <select className="form-control" value={danhMucId} onChange={(e) => setDanhMucId(e.target.value)} disabled={formLoading} required>
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.tenDanhMuc}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số tiền (VND) *</label>
                    <input type="text" inputMode="numeric" className="form-control" placeholder="Nhập số tiền..." value={soTien ? Number(soTien).toLocaleString('vi-VN') : ''} onChange={handleSoTienChange} disabled={formLoading} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nội dung chi tiết *</label>
                  <input type="text" className="form-control" placeholder="Mô tả chi tiết khoản chi..." value={noiDung} onChange={(e) => setNoiDung(e.target.value)} disabled={formLoading} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nguồn tiền *</label>
                    <select className="form-control" value={nguonTien} onChange={(e) => { setNguonTien(e.target.value); setTrangThaiMacDinh(e.target.value === 'TIEN_CA_NHAN' ? 'CHO_HOAN_UNG' : 'CHO_THANH_TOAN'); }} disabled={formLoading}>
                      <option value="TIEN_SHOP">🏦 Tiền Shop</option>
                      <option value="TIEN_CA_NHAN">👤 Cá nhân ứng</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Trạng thái mặc định *</label>
                    <select className="form-control" value={trangThaiMacDinh} onChange={(e) => setTrangThaiMacDinh(e.target.value)} disabled={formLoading || nguonTien === 'TIEN_CA_NHAN'}>
                      {nguonTien === 'TIEN_SHOP'
                        ? <><option value="CHO_THANH_TOAN">Chờ thanh toán</option><option value="DA_THANH_TOAN">Đã thanh toán sẵn</option></>
                        : <option value="CHO_HOAN_UNG">Chờ hoàn ứng</option>
                      }
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nhà cung cấp (nếu có)</label>
                    <select className="form-control" value={nhaCungCapId} onChange={(e) => setNhaCungCapId(e.target.value)} disabled={formLoading}>
                      <option value="">-- Không có --</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.tenNCC}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngày tạo phiếu trong tháng (1–28)</label>
                    <input type="number" min={1} max={28} className="form-control" value={ngayChiTrongThang} onChange={(e) => setNgayChiTrongThang(e.target.value)} disabled={formLoading} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú / Nội dung CK (tùy chọn)</label>
                  <input type="text" className="form-control" placeholder="Nội dung chuyển khoản, ghi chú thêm..." value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} disabled={formLoading} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading}>
                    {formLoading ? 'Đang lưu...' : formType === 'ADD' ? 'Tạo mẫu' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
