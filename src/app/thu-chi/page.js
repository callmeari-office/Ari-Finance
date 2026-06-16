'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DateInput from '@/components/DateInput';
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
  FileSpreadsheet,
  Trash2,
  Pencil,
  History,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import FilterDropdown from '@/components/FilterDropdown';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/date';
import styles from './thu-chi.module.css';

export default function ThuChiPage() {
  const router = useRouter();
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [funds, setFunds] = useState([]);
  const [categories, setCategories] = useState([]); // Danh mục THU để tạo phiếu thu
  const [allCategories, setAllCategories] = useState([]); // Tất cả danh mục để phục vụ filter
  const [dataLoading, setDataLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states (array-based cho FilterDropdown)
  const [filterLoai, setFilterLoai] = useState([]);
  const [filterQuy, setFilterQuy] = useState([]);
  const [filterThang, setFilterThang] = useState([String(new Date().getMonth() + 1)]);
  const [filterDanhMuc, setFilterDanhMuc] = useState([]);
  const [filterNam, setFilterNam] = useState(String(new Date().getFullYear()));
  const [filterSearch, setFilterSearch] = useState('');

  // Modal: TẠO PHIẾU THU TRỰC TIẾP (TH4)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal: NHẬP LỊCH SỬ QUỸ (BÙ TRỪ)
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const [btLoading, setBtLoading] = useState(false);
  const [btError, setBtError] = useState('');
  const [btSuccess, setBtSuccess] = useState('');
  const [btNgay, setBtNgay] = useState(new Date().toISOString().split('T')[0]);
  const [btQuyId, setBtQuyId] = useState('');
  const [btDanhMucId, setBtDanhMucId] = useState('');
  const [btSoTien, setBtSoTien] = useState('');
  const [btNoiDung, setBtNoiDung] = useState('');
  const [btGhiChu, setBtGhiChu] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form inputs (Chỉ cho phép tạo THU trực tiếp theo nghiệp vụ)
  const [ngayGiaoDich, setNgayGiaoDich] = useState(new Date().toISOString().split('T')[0]);
  const [quyId, setQuyId] = useState('');
  const [danhMucId, setDanhMucId] = useState('');
  const [soTien, setSoTien] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  // Sửa ngày giao dịch (Chỉ Owner được phép)
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState('');
  const [editDateLoading, setEditDateLoading] = useState(false);

  const handleBtSubmit = async (e) => {
    e.preventDefault();
    setBtError(''); setBtSuccess('');
    if (!btNgay || !btQuyId || !btDanhMucId || !btSoTien || !btNoiDung.trim()) {
      setBtError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    if (Number(btSoTien) <= 0) { setBtError('Số tiền phải lớn hơn 0.'); return; }
    setBtLoading(true);
    try {
      const res = await fetch('/api/thu-chi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngayGiaoDich: btNgay,
          loaiGiaoDich: 'CHI',
          soTien: Number(btSoTien),
          quyId: btQuyId,
          danhMucId: btDanhMucId,
          noiDung: btNoiDung.trim(),
          ghiChu: btGhiChu,
          buTruLichSu: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo thất bại.');
      setBtSuccess(data.message || 'Đã nhập lịch sử quỹ thành công!');
      setBtSoTien(''); setBtNoiDung(''); setBtGhiChu('');
      setTimeout(() => { setIsBtModalOpen(false); setBtSuccess(''); fetchData(); }, 1200);
    } catch (err) {
      setBtError(err.message);
    } finally {
      setBtLoading(false);
    }
  };

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
          if (data.user.role !== 'OWNER' && data.user.role !== 'MANAGER' && !data.user.permissions?.thuChi) {
            toast.error('Bạn không có quyền truy cập trang quản lý Thu-Chi.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch static config
          fetchStaticData();
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const fetchData = async (page = currentPage) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '50');
      if (filterLoai.length > 0) params.append('loaiGiaoDich', filterLoai.join(','));
      if (filterQuy.length > 0) params.append('quyId', filterQuy.join(','));
      if (filterThang.length > 0) params.append('thang', filterThang.join(','));
      if (filterDanhMuc.length > 0) params.append('danhMucId', filterDanhMuc.join(','));
      if (filterNam) params.append('nam', filterNam);
      if (filterSearch.trim()) params.append('search', filterSearch.trim());

      const txRes = await fetch(`/api/thu-chi?${params.toString()}`);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.data || []);
        if (txData.pagination) {
          setTotalPages(txData.pagination.totalPages || 1);
          setTotalCount(txData.pagination.total || 0);
        }
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchStaticData = async () => {
    try {
      // Fetch funds
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(quyData);
        if (quyData.length > 0) setQuyId(quyData[0].id);
      }

      // Fetch categories
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
      console.error('Error fetching static data:', e);
    }
  };

  // Áp lọc theo quỹ từ URL (vd: /thu-chi?quyId=Q_001 — link "Xem tất cả" từ trang Quỹ)
  useEffect(() => {
    if (!user) return;
    const sp = new URLSearchParams(window.location.search);
    const quyParam = sp.get('quyId');
    if (quyParam) {
      setFilterQuy(quyParam.split(',').map(s => s.trim()).filter(Boolean));
      setFilterThang([]); // bỏ lọc tháng để thấy toàn bộ phiếu của quỹ
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Lấy transactions khi page thay đổi
  useEffect(() => {
    if (user) {
      fetchData(currentPage);
    }
  }, [currentPage, user]);

  // Reset trạng thái sửa ngày khi đóng modal chi tiết
  useEffect(() => {
    if (!selectedTx) {
      setIsEditingDate(false);
      setEditDateValue('');
    }
  }, [selectedTx]);

  // Reset page về 1 khi filters thay đổi
  useEffect(() => {
    if (user) {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchData(1);
      }
    }
  }, [filterLoai, filterQuy, filterThang, filterDanhMuc, filterNam, filterSearch]);

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

  const handleCancelTransaction = async (id, maPhieu, soTien, loaiGiaoDich) => {
    const loaiText = loaiGiaoDich === 'THU' ? 'Phiếu Thu' : 'Phiếu Chi';
    const ok = await showConfirm({
      title: `Hủy/Xóa ${loaiText}`,
      message: `Bạn có chắc chắn muốn hủy/xóa ${loaiText} ${maPhieu} (${soTien.toLocaleString('vi-VN')} ₫)?\n\n` +
        (loaiGiaoDich === 'CHI'
          ? 'Hệ thống sẽ xóa phiếu chi này và tự động khôi phục trạng thái các đề xuất chi phí liên quan trở lại trạng thái chờ duyệt (Chờ thanh toán hoặc Chờ hoàn ứng), đồng thời số dư quỹ sẽ được hoàn trả lại.'
          : 'Hệ thống sẽ xóa vĩnh viễn phiếu thu này và giảm số dư quỹ tương ứng.'),
      confirmLabel: 'Xác nhận hủy',
      danger: true,
    });
    if (!ok) return;

    setDataLoading(true);
    try {
      const res = await fetch(`/api/thu-chi/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hủy giao dịch thất bại.');

      toast.success(data.message || `Đã hủy ${loaiText} ${maPhieu} thành công.`);
      fetchData(currentPage);
    } catch (err) {
      toast.error(err.message);
      setDataLoading(false);
    }
  };

  const handleSaveDate = async () => {
    if (!editDateValue) {
      toast.error('Vui lòng chọn ngày hợp lệ.');
      return;
    }

    const ok = await showConfirm({
      title: 'Xác nhận đổi ngày giao dịch',
      message: `Bạn có chắc chắn muốn đổi ngày giao dịch của phiếu ${selectedTx.maPhieu} từ ${formatDate(selectedTx.ngayGiaoDich)} thành ${formatDate(editDateValue)}?`,
      confirmLabel: 'Xác nhận lưu',
    });
    if (!ok) return;

    setEditDateLoading(true);
    try {
      const res = await fetch(`/api/thu-chi/${selectedTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngayGiaoDich: editDateValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật ngày giao dịch thất bại.');

      toast.success(data.message || 'Cập nhật ngày giao dịch thành công.');
      setIsEditingDate(false);

      // Cập nhật selectedTx state tại chỗ để hiển thị ngày mới lập tức
      setSelectedTx(prev => ({
        ...prev,
        ngayGiaoDich: new Date(editDateValue).toISOString(),
      }));

      // Chuyển filter về tháng/năm của ngày mới để record vẫn hiển thị sau khi đóng modal
      const newDate = new Date(editDateValue);
      const newMonth = String(newDate.getMonth() + 1);
      const newYear = String(newDate.getFullYear());
      const filterChanged = filterNam !== newYear || filterThang.join(',') !== newMonth;
      if (filterChanged) {
        // useEffect theo dõi filterThang/filterNam sẽ tự gọi fetchData
        setFilterNam(newYear);
        setFilterThang([newMonth]);
      } else {
        fetchData(currentPage);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditDateLoading(false);
    }
  };

  // Lọc danh sách trên client (Đã lọc ở Server, nên chỉ cần gán thẳng)
  const filteredTransactions = transactions;

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
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {user?.role === 'OWNER' && (
              <button
                onClick={() => { setBtError(''); setBtSuccess(''); setBtNgay(new Date().toISOString().split('T')[0]); setBtQuyId(funds[0]?.id || ''); setBtDanhMucId(''); setBtSoTien(''); setBtNoiDung(''); setBtGhiChu(''); setIsBtModalOpen(true); }}
                className="btn btn-secondary"
              >
                <History size={16} />
                <span>Nhập lịch sử quỹ</span>
              </button>
            )}
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <PlusCircle size={20} />
              <span>Ghi nhận Phiếu Thu (TH4)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={`${styles.filterCard} glass-card`}>
          {/* Hàng 1: Tìm kiếm + Năm */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Tìm mã phiếu, nội dung..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{ paddingLeft: '2rem' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem' }}>Năm</label>
              <select className="form-control" style={{ minWidth: '100px' }} value={filterNam} onChange={(e) => setFilterNam(e.target.value)}>
                <option value="">Tất cả</option>
                {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Hàng 2: Dropdown filters */}
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
        <div style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.92rem', color: 'var(--text-muted)' }}>
          Tổng cộng cả kỳ: <strong style={{ color: 'var(--info)' }}>{totalCount}</strong> giao dịch
        </div>

        <div className="glass-card" style={{ marginTop: '0.5rem' }}>
          {dataLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton skeletonRow" />)}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className={styles.emptyState}>Chưa có giao dịch dòng tiền nào được ghi nhận.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className={`${styles.desktopTable} table-responsive`}>
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
                      <th>Người tạo</th>
                      <th>Nguồn gốc</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{tx.maPhieu}</td>
                        <td>{formatDate(tx.ngayGiaoDich)}</td>
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
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {tx.nguoiTao ? (tx.nguoiTao.tenNgan || tx.nguoiTao.hoTen) : '—'}
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
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button 
                              onClick={() => setSelectedTx(tx)}
                              className={styles.viewDetailBtn}
                              title="Xem chi tiết"
                            >
                              <Eye size={16} />
                            </button>
                            {user?.role === 'OWNER' && (
                              <button 
                                onClick={() => handleCancelTransaction(tx.id, tx.maPhieu, tx.soTien, tx.loaiGiaoDich)}
                                className={styles.cancelTxBtn}
                                title="Hủy/Xóa giao dịch"
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

              {/* Mobile Cards View */}
              <div className={styles.mobileCards}>
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className={styles.mobileCard}>
                    <div className={styles.cardHeaderRow}>
                      <span className={styles.cardMaPhieu} style={{ color: tx.loaiGiaoDich === 'THU' ? '#34d399' : '#f87171' }}>
                        {tx.maPhieu}
                      </span>
                      <span className={styles.cardDate}>{formatDate(tx.ngayGiaoDich)}</span>
                    </div>
                    <div className={styles.cardBodyRow}>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardLabel}>Loại:</span>
                        <span>
                          {tx.loaiGiaoDich === 'THU' ? (
                            <span className={styles.thuBadge}>THU</span>
                          ) : (
                            <span className={styles.chiBadge}>CHI</span>
                          )}
                        </span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardLabel}>Quỹ thực hiện:</span>
                        <span className={styles.cardValue}>{tx.quy.tenQuy}</span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardLabel}>Danh mục:</span>
                        <span className={styles.cardValue}>{tx.danhMuc.tenDanhMuc}</span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardLabel}>Nội dung:</span>
                        <span className={styles.cardValue} style={{ textAlign: 'right', maxWidth: '70%' }}>{tx.noiDung}</span>
                      </div>
                      <div className={styles.cardDetailItem} style={{ marginTop: '0.25rem' }}>
                        <span className={styles.cardLabel}>Số tiền:</span>
                        <span className={styles.cardAmount} style={{ color: tx.loaiGiaoDich === 'THU' ? '#34d399' : '#f87171' }}>
                          {tx.loaiGiaoDich === 'THU' ? '+' : '-'}{formatVND(tx.soTien)}
                        </span>
                      </div>
                      {tx.nguoiTao && (
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Người tạo:</span>
                          <span className={styles.cardValue} style={{ color: 'var(--text-muted)' }}>
                            {tx.nguoiTao.tenNgan || tx.nguoiTao.hoTen}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.cardFooterRow}>
                      <div>
                        {tx.soPhieuDeXuat === 1 ? (
                          <span className={styles.originMergeBadge} style={{ background: 'var(--info-bg)', color: '#536978' }}>
                            Đề xuất {tx.deXuatChiPhi[0]?.maPhieu}
                          </span>
                        ) : tx.soPhieuDeXuat > 1 ? (
                          <span className={styles.originMergeBadge}>
                            Gộp {tx.soPhieuDeXuat} đề xuất
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ghi trực tiếp (TH4)</span>
                        )}
                      </div>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button 
                          onClick={() => setSelectedTx(tx)}
                          className={styles.viewDetailBtn}
                          style={{ width: '28px', height: '28px' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={14} />
                        </button>
                        {user?.role === 'OWNER' && (
                          <button 
                            onClick={() => handleCancelTransaction(tx.id, tx.maPhieu, tx.soTien, tx.loaiGiaoDich)}
                            className={styles.cancelTxBtn}
                            style={{ width: '28px', height: '28px' }}
                            title="Hủy/Xóa giao dịch"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Trước
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                    if (totalPages > 5 && Math.abs(pageNum - currentPage) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`${styles.pageBtn} ${currentPage === pageNum ? styles.pageActive : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Sau
                  </button>
                  
                  <span className={styles.pageInfo}>
                    Trang {currentPage} / {totalPages} (Tổng {totalCount} giao dịch)
                  </span>
                </div>
              )}
            </>
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
                    <DateInput
                      id="ngayGiaoDich"
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
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: 'var(--success)' }}>{selectedTx.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày Giao Dịch:</span>
                  {user?.role === 'OWNER' ? (
                    isEditingDate ? (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem' }}>
                        <DateInput
                          className="form-control"
                          value={editDateValue}
                          onChange={(e) => setEditDateValue(e.target.value)}
                          style={{ width: '130px' }}
                          inputStyle={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                          disabled={editDateLoading}
                        />
                        <button
                          type="button"
                          onClick={handleSaveDate}
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={editDateLoading}
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingDate(false)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          disabled={editDateLoading}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={styles.detailValue}>{formatDate(selectedTx.ngayGiaoDich)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(selectedTx.ngayGiaoDich);
                            const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            setEditDateValue(localDateStr);
                            setIsEditingDate(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--info)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          title="Sửa ngày giao dịch"
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                    )
                  ) : (
                    <span className={styles.detailValue}>{formatDate(selectedTx.ngayGiaoDich)}</span>
                  )}
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Loại dòng tiền:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold' }}>
                    {selectedTx.loaiGiaoDich === 'THU' ? '📈 Dòng tiền vào (THU)' : '📉 Dòng tiền ra (CHI)'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Tác động Quỹ:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: 'var(--info)' }}>{selectedTx.quy.tenQuy}</span>
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
                {selectedTx.nguoiTao && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Người tạo phiếu:</span>
                    <span className={styles.detailValue} style={{ fontWeight: '600' }}>
                      {selectedTx.nguoiTao.tenNgan || selectedTx.nguoiTao.hoTen}
                    </span>
                  </div>
                )}
              </div>

              {/* PHẦN HIỂN THỊ CÁC ĐỀ XUẤT CON ĐƯỢC GỘP (MỐI QUAN HỆ N:1) */}
              {selectedTx.loaiGiaoDich === 'CHI' && selectedTx.soPhieuDeXuat > 0 && (
                <div className={styles.subProposalsSection}>
                  <div className={styles.subProposalsHeader}>
                    <Layers size={18} style={{ color: 'var(--info)' }} />
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
                            <td style={{ fontWeight: 'bold', color: 'var(--info)' }}>{dx.maPhieu}</td>
                            <td>{dx.nguoiTao.hoTen}</td>
                            <td>{dx.noiDung}</td>
                            <td style={{ fontWeight: '700', textAlign: 'right' }}>{formatVND(dx.soTien)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td colSpan="3" style={{ fontWeight: 'bold', textAlign: 'right' }}>Tổng cộng tiền đề xuất:</td>
                          <td style={{ fontWeight: '800', color: 'var(--success)', textAlign: 'right' }}>{formatVND(selectedTx.tongTienDeXuat)}</td>
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
        {/* Modal: NHẬP LỊCH SỬ QUỸ (BÙ TRỪ) */}
        {isBtModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Nhập lịch sử quỹ (bù trừ)</h2>
                <button onClick={() => setIsBtModalOpen(false)} className={styles.closeBtn}><X size={20} /></button>
              </div>

              <div style={{ background: 'rgba(var(--brand-brown-rgb), 0.08)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.65rem 0.875rem', fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
                <strong style={{ color: 'var(--text-main)' }}>Hợp thức hóa dữ liệu lịch sử.</strong> Tự động tạo cặp phiếu <strong>CHI + THU</strong> cùng số tiền, cùng ngày → số dư quỹ <strong>không đổi</strong>, dự báo không bị ảnh hưởng. Dùng khi cần ghi nhận giao dịch của tháng cũ vào lịch sử quỹ.
              </div>

              {btError && (
                <div className={styles.errorAlert}><AlertCircle size={16} /><span>{btError}</span></div>
              )}
              {btSuccess && (
                <div className={styles.successAlert}><Check size={16} /><span>{btSuccess}</span></div>
              )}

              <form onSubmit={handleBtSubmit} className={styles.form}>
                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Ngày lịch sử *</label>
                    <DateInput
                      className="form-control"
                      value={btNgay}
                      onChange={(e) => setBtNgay(e.target.value)}
                      required
                      disabled={btLoading}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Quỹ *</label>
                    <select className="form-control" value={btQuyId} onChange={(e) => setBtQuyId(e.target.value)} required disabled={btLoading}>
                      <option value="">-- Chọn quỹ --</option>
                      {funds.map((f) => <option key={f.id} value={f.id}>{f.tenQuy}</option>)}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Danh mục chi *</label>
                    <select className="form-control" value={btDanhMucId} onChange={(e) => setBtDanhMucId(e.target.value)} required disabled={btLoading}>
                      <option value="">-- Chọn danh mục --</option>
                      {allCategories.filter((c) => c.loaiGiaoDich === 'CHI' && c.trangThai === 'ACTIVE').map((c) => (
                        <option key={c.id} value={c.id}>{c.tenDanhMuc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Số tiền (VND) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      placeholder="Nhập số tiền..."
                      value={btSoTien ? Number(btSoTien).toLocaleString('vi-VN') : ''}
                      onChange={(e) => setBtSoTien(e.target.value.replace(/\D/g, ''))}
                      required
                      disabled={btLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nội dung khoản chi *</label>
                  <input type="text" className="form-control" placeholder="VD: Tiền thuê mặt bằng T1/2026..." value={btNoiDung} onChange={(e) => setBtNoiDung(e.target.value)} required disabled={btLoading} maxLength={200} />
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú (tùy chọn)</label>
                  <input type="text" className="form-control" placeholder="Ghi chú thêm..." value={btGhiChu} onChange={(e) => setBtGhiChu(e.target.value)} disabled={btLoading} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setIsBtModalOpen(false)} className="btn btn-secondary" disabled={btLoading}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={btLoading}>
                    {btLoading ? 'Đang tạo...' : 'Nhập lịch sử (CHI + THU)'}
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
