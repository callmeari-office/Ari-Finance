'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckSquare, 
  Layers, 
  DollarSign, 
  User, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  Eye,
  X
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './duyet.module.css';

export default function DuyetPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'TH1' (Chờ thanh toán) hoặc 'TH3' (Chờ hoàn ứng gộp)
  const [activeTab, setActiveTab] = useState('TH1');

  // Core Data
  const [proposals, setProposals] = useState([]);
  const [funds, setFunds] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // States: TH1 (Duyệt đơn)
  const [selectedQuyId, setSelectedQuyId] = useState({}); // Lưu quỹ được chọn cho từng proposalId
  const [actionLoading, setActionLoading] = useState(false);

  // States: TH3 (Duyệt gộp hoàn ứng)
  const [selectedStaffId, setSelectedStaffId] = useState(''); // Nhân viên được chọn để hoàn ứng
  const [selectedProposalIds, setSelectedProposalIds] = useState([]); // Các đề xuất hoàn ứng được tích chọn
  const [gopQuyId, setGopQuyId] = useState(''); // Quỹ dùng để chi trả hoàn ứng gộp

  // Quick Preview state
  const [selectedPreviewProp, setSelectedPreviewProp] = useState(null);
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

  useEffect(() => {
    // 1. Kiểm tra session và vai trò (Chỉ OWNER được vào)
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
          if (!data.user.permissions?.duyet && data.user.role !== 'OWNER') {
            alert('Bạn không có quyền truy cập trang duyệt đề xuất.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch dữ liệu đề xuất & quỹ
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
      // Tải các đề xuất ở trạng thái chờ duyệt (CHO_THANH_TOAN hoặc CHO_HOAN_UNG)
      const propRes = await fetch('/api/de-xuat');
      if (propRes.ok) {
        const propData = await propRes.json();
        // Lấy các phiếu chờ thanh toán, chờ hoàn ứng, hoặc đã thanh toán sẵn nhưng chưa gán quỹ
        const pendingProps = propData.filter(
          (p) => p.trangThai === 'CHO_THANH_TOAN' || 
                 p.trangThai === 'CHO_HOAN_UNG' ||
                 (p.trangThai === 'DA_THANH_TOAN' && (p.quyThanhToanId === null || p.thuChiId === null))
        );
        setProposals(pendingProps);
      }

      // Tải các quỹ để chọn
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        setFunds(quyData);
        if (quyData.length > 0) {
          setGopQuyId(quyData[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching data for approval page:', e);
    } finally {
      setDataLoading(false);
    }
  };

  // TH1: Duyệt đề xuất đơn
  const handleApproveSingle = async (proposalId, maPhieu) => {
    const quyId = selectedQuyId[proposalId];
    if (!quyId) {
      alert('Vui lòng chọn Quỹ dùng để thanh toán trước khi duyệt!');
      return;
    }

    if (confirm(`Bạn có chắc chắn duyệt thanh toán đề xuất ${maPhieu}? Việc này sẽ sinh ra phiếu Chi và thay đổi số dư quỹ.`)) {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/de-xuat/${proposalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DUYET', quyThanhToanId: quyId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Duyệt đề xuất thất bại.');

        alert(`Đã duyệt thanh toán thành công đề xuất ${maPhieu}!`);
        fetchData(); // Tải lại danh sách
      } catch (err) {
        alert(err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // TH1: Hủy đề xuất đơn
  const handleCancelSingle = async (proposalId, maPhieu) => {
    if (confirm(`Bạn có chắc chắn muốn TỪ CHỐI / HỦY đề xuất ${maPhieu}?`)) {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/de-xuat/${proposalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'HUY' }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hủy thất bại.');

        alert(`Đã từ chối đề xuất ${maPhieu}.`);
        fetchData();
      } catch (err) {
        alert(err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // TH3: Xử lý chọn/bỏ chọn checkbox gộp hoàn ứng
  const handleCheckboxChange = (proposalId) => {
    if (selectedProposalIds.includes(proposalId)) {
      setSelectedProposalIds(selectedProposalIds.filter(id => id !== proposalId));
    } else {
      setSelectedProposalIds([...selectedProposalIds, proposalId]);
    }
  };

  // TH3: Duyệt hoàn ứng gộp
  const handleApproveMerge = async () => {
    if (selectedProposalIds.length === 0) {
      alert('Vui lòng tích chọn ít nhất một đề xuất cần hoàn ứng!');
      return;
    }

    if (!gopQuyId) {
      alert('Vui lòng chọn quỹ shop chi trả hoàn ứng!');
      return;
    }

    const selectedProps = reimbursementProps.filter(p => selectedProposalIds.includes(p.id));
    const totalAmount = selectedProps.reduce((sum, p) => sum + p.soTien, 0);

    const message = `Bạn có chắc chắn muốn DUYỆT GỘP ${selectedProposalIds.length} đề xuất hoàn ứng?\n` +
      `- Tổng tiền chi hoàn ứng: ${totalAmount.toLocaleString('vi-VN')} VND\n` +
      `- Quỹ thanh toán: ${funds.find(f => f.id === gopQuyId)?.tenQuy}\n` +
      `Hệ thống sẽ tạo MỘT phiếu Chi duy nhất và thanh toán toàn bộ đề xuất này.`;

    if (confirm(message)) {
      setActionLoading(true);
      try {
        const res = await fetch('/api/de-xuat/duyet-gop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: selectedProposalIds,
            quyThanhToanId: gopQuyId,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Duyệt gộp thất bại.');

        alert(data.message || 'Đã duyệt hoàn ứng gộp thành công!');
        setSelectedProposalIds([]);
        fetchData();
      } catch (err) {
        alert(err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Phân loại dữ liệu
  // 1. Tab TH1: Chờ thanh toán (Nguồn: TienShop, Trạng thái: CHO_THANH_TOAN)
  const pendingPaymentProps = proposals.filter(
    (p) => p.nguonTien === 'TIEN_SHOP' && p.trangThai === 'CHO_THANH_TOAN'
  );

  // 2. Tab TH2: Chờ gán quỹ (Nguồn: TienShop, Trạng thái: DA_THANH_TOAN, quyThanhToanId/thuChiId: null)
  const pendingAssignFundProps = proposals.filter(
    (p) => p.nguonTien === 'TIEN_SHOP' && p.trangThai === 'DA_THANH_TOAN' && (p.quyThanhToanId === null || p.thuChiId === null)
  );

  // 3. Tab TH3: Chờ hoàn ứng (Nguồn: TienCaNhan, Trạng thái: CHO_HOAN_UNG)
  const pendingReimburseProps = proposals.filter(
    (p) => p.nguonTien === 'TIEN_CA_NHAN' && p.trangThai === 'CHO_HOAN_UNG'
  );

  // Nhóm các đề xuất chờ hoàn ứng theo từng Nhân viên để duyệt gộp
  const staffGroups = {};
  pendingReimburseProps.forEach((p) => {
    const sId = p.nguoiTao.id;
    if (!staffGroups[sId]) {
      staffGroups[sId] = {
        nhanVien: p.nguoiTao,
        proposals: [],
      };
    }
    staffGroups[sId].proposals.push(p);
  });

  const reimbursementStaffs = Object.values(staffGroups);

  // Danh sách các đề xuất của nhân viên được chọn phục vụ cho tích chọn hoàn ứng
  const reimbursementProps = selectedStaffId 
    ? (staffGroups[selectedStaffId]?.proposals || []) 
    : [];

  // Tổng tiền các đề xuất đang được chọn gộp hoàn ứng
  const selectedMergeTotal = reimbursementProps
    .filter(p => selectedProposalIds.includes(p.id))
    .reduce((sum, p) => sum + p.soTien, 0);

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang xác thực quyền duyệt chi...</p>
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
            <h1>Duyệt đề xuất chi phí</h1>
            <p className={styles.pageDesc}>Chủ shop (Owner) thực hiện duyệt các đề xuất, xuất quỹ dòng tiền thực tế</p>
          </div>
        </div>

        {/* Dynamic Tabs */}
        <div className={styles.tabContainer}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'TH1' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('TH1');
              setSelectedProposalIds([]);
              setSelectedStaffId('');
            }}
          >
            <Clock size={18} />
            <span>Chờ thanh toán (Chi tiền Shop - TH1)</span>
            {pendingPaymentProps.length > 0 && (
              <span className={styles.tabBadge}>{pendingPaymentProps.length}</span>
            )}
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'TH2' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('TH2');
              setSelectedProposalIds([]);
              setSelectedStaffId('');
            }}
          >
            <TrendingDown size={18} />
            <span>Chờ gán Quỹ (Đã thanh toán - TH2)</span>
            {pendingAssignFundProps.length > 0 && (
              <span className={styles.tabBadge} style={{ backgroundColor: '#cf8d8d' }}>{pendingAssignFundProps.length}</span>
            )}
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'TH3' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('TH3');
              setSelectedProposalIds([]);
              setSelectedStaffId('');
            }}
          >
            <Layers size={18} />
            <span>Chờ hoàn ứng (Tiền cá nhân - TH3)</span>
            {pendingReimburseProps.length > 0 && (
              <span className={styles.tabBadge}>{pendingReimburseProps.length}</span>
            )}
          </button>
        </div>

        {/* TAB 1: CHỜ THANH TOÁN (TH1) */}
        {activeTab === 'TH1' && (
          <div className="glass-card fade-in">
            <div className={styles.cardHeader}>
              <h2>Danh sách đề xuất chờ duyệt chi quỹ</h2>
            </div>
            
            {dataLoading ? (
              <div className={styles.loaderSmall}>Đang tải đề xuất...</div>
            ) : pendingPaymentProps.length === 0 ? (
              <div className={styles.emptyState}>Không có đề xuất Chờ thanh toán nào cần duyệt.</div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Mã Phiếu</th>
                      <th>Ngày lập</th>
                      <th>Nhân viên</th>
                      <th>Danh mục</th>
                      <th>Nhà cung cấp</th>
                      <th>Nội dung</th>
                      <th>Số tiền</th>
                      <th>Chọn Quỹ chi</th>
                      <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPaymentProps.map((prop) => (
                      <tr key={prop.id}>
                        <td 
                          onClick={() => setSelectedPreviewProp(prop)}
                          style={{ fontWeight: 'bold', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click xem nhanh đề xuất"
                        >
                          {prop.maPhieu}
                        </td>
                        <td suppressHydrationWarning>
                          {new Date(prop.ngayPhatSinh).toLocaleDateString('vi-VN')}
                          {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                        </td>


                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                        </td>
                        <td>{prop.danhMuc.tenDanhMuc}</td>
                        <td>
                          {prop.nhaCungCap ? (
                            <div>
                              <div style={{ fontWeight: '600' }}>{prop.nhaCungCap.tenNCC}</div>
                              <small style={{ color: 'var(--text-muted)' }}>
                                {prop.nhaCungCap.tenNganHang} - {prop.nhaCungCap.soTaiKhoan}
                              </small>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Không có</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.noiDungBox}>{prop.noiDung}</div>
                          {prop.nhaCungCap && (
                            <small className={styles.nccLabel}>NCC: {prop.nhaCungCap.tenNCC}</small>
                          )}
                        </td>
                        <td style={{ fontWeight: '800', color: '#1e293b' }}>{formatVND(prop.soTien)}</td>

                        <td>
                          <select 
                            className="form-control form-control-sm"
                            style={{ minWidth: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            value={selectedQuyId[prop.id] || ''}
                            onChange={(e) => setSelectedQuyId({
                              ...selectedQuyId,
                              [prop.id]: e.target.value
                            })}
                            disabled={actionLoading}
                          >
                            <option value="">-- Chọn quỹ thanh toán --</option>
                            {funds.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.tenQuy} ({formatVND(f.soDuHienTai)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.approvalButtons}>
                            <button 
                              onClick={() => handleApproveSingle(prop.id, prop.maPhieu)}
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              disabled={actionLoading}
                            >
                              Duyệt chi
                            </button>
                            <button 
                              onClick={() => handleCancelSingle(prop.id, prop.maPhieu)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                              disabled={actionLoading}
                            >
                              Từ chối
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHỜ GÁN QUỸ (TH2) */}
        {activeTab === 'TH2' && (
          <div className="glass-card fade-in">
            <div className={styles.cardHeader}>
              <h2>Danh sách đề xuất đã thanh toán sẵn - Chờ gán quỹ trừ tiền</h2>
            </div>
            
            {dataLoading ? (
              <div className={styles.loaderSmall}>Đang tải đề xuất...</div>
            ) : pendingAssignFundProps.length === 0 ? (
              <div className={styles.emptyState}>Không có đề xuất Đã thanh toán nào cần gán Quỹ.</div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Mã Phiếu</th>
                      <th>Ngày lập</th>
                      <th>Nhân viên</th>
                      <th>Danh mục</th>
                      <th>Nhà cung cấp</th>
                      <th>Nội dung</th>
                      <th>Số tiền</th>
                      <th>Chọn Quỹ chi</th>
                      <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAssignFundProps.map((prop) => (
                      <tr key={prop.id}>
                        <td 
                          onClick={() => setSelectedPreviewProp(prop)}
                          style={{ fontWeight: 'bold', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click xem nhanh đề xuất"
                        >
                          {prop.maPhieu}
                        </td>
                        <td suppressHydrationWarning>
                          {new Date(prop.ngayPhatSinh).toLocaleDateString('vi-VN')}
                          {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                        </td>


                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiTao.role}</small>
                        </td>
                        <td>{prop.danhMuc.tenDanhMuc}</td>
                        <td>
                          {prop.nhaCungCap ? (
                            <div>
                              <div style={{ fontWeight: '600' }}>{prop.nhaCungCap.tenNCC}</div>
                              <small style={{ color: 'var(--text-muted)' }}>
                                {prop.nhaCungCap.tenNganHang} - {prop.nhaCungCap.soTaiKhoan}
                              </small>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Không có</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.noiDungBox}>{prop.noiDung}</div>
                          {prop.nhaCungCap && (
                            <small className={styles.nccLabel}>NCC: {prop.nhaCungCap.tenNCC}</small>
                          )}
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="badge badge-paid" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>Đã thanh toán sẵn</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800', color: '#1e293b' }}>{formatVND(prop.soTien)}</td>

                        <td>
                          <select 
                            className="form-control form-control-sm"
                            style={{ minWidth: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            value={selectedQuyId[prop.id] || ''}
                            onChange={(e) => setSelectedQuyId({
                              ...selectedQuyId,
                              [prop.id]: e.target.value
                            })}
                            disabled={actionLoading}
                          >
                            <option value="">-- Chọn quỹ thanh toán --</option>
                            {funds.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.tenQuy} ({formatVND(f.soDuHienTai)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className={styles.approvalButtons}>
                            <button 
                              onClick={() => handleApproveSingle(prop.id, prop.maPhieu)}
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                              disabled={actionLoading}
                            >
                              Gán Quỹ & Duyệt
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHỜ HOÀN ỨNG - DUYỆT GỘP (TH3) */}
        {activeTab === 'TH3' && (
          <div className={`${styles.splitLayout} fade-in`}>
            
            {/* Cột trái: Chọn Nhân viên */}
            <div className="glass-card" style={{ flex: '1 1 300px' }}>
              <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>
                <h2>1. Chọn Nhân viên</h2>
              </div>
              <p className={styles.splitDesc}>Chọn một nhân viên ứng tiền trước để xem và duyệt gộp phiếu hoàn ứng:</p>
              
              {dataLoading ? (
                <div className={styles.loaderSmall}>Đang tải...</div>
              ) : reimbursementStaffs.length === 0 ? (
                <div className={styles.emptyState}>Không có nhân viên nào đang chờ hoàn ứng.</div>
              ) : (
                <div className={styles.staffList}>
                  {reimbursementStaffs.map((group) => {
                    const isActive = selectedStaffId === group.nhanVien.id;
                    const totalPending = group.proposals.reduce((sum, p) => sum + p.soTien, 0);
                    return (
                      <button 
                        key={group.nhanVien.id}
                        className={`${styles.staffItem} ${isActive ? styles.activeStaff : ''}`}
                        onClick={() => {
                          setSelectedStaffId(group.nhanVien.id);
                          setSelectedProposalIds([]); // Reset tích chọn
                        }}
                        disabled={actionLoading}
                      >
                        <div className={styles.staffHeader}>
                          <User size={18} />
                          <span className={styles.staffName}>{group.nhanVien.tenNgan || group.nhanVien.hoTen}</span>
                        </div>
                        <div className={styles.staffFooter}>
                          <span>{group.proposals.length} đề xuất chờ hoàn</span>
                          <strong style={{ color: '#10b981' }}>{formatVND(totalPending)}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cột phải: Danh sách đề xuất và Duyệt gộp */}
            <div className="glass-card" style={{ flex: '2 1 600px' }}>
              <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>
                <h2>2. Danh sách đề xuất & Duyệt Gộp</h2>
              </div>

              {!selectedStaffId ? (
                <div className={styles.unselectedState}>
                  <AlertTriangle size={36} className={styles.alertIcon} />
                  <p>Vui lòng chọn một Nhân viên ở cột bên trái để tải danh sách đề xuất hoàn ứng và thực hiện nghiệp vụ Duyệt Gộp.</p>
                </div>
              ) : (
                <div className={styles.reimbursePanel}>
                  <div className={styles.mergeSummaryBar}>
                    <div className={styles.mergeSummaryText}>
                      <p>Nhân viên: <strong>{staffGroups[selectedStaffId]?.nhanVien.tenNgan || staffGroups[selectedStaffId]?.nhanVien.hoTen}</strong></p>
                      <p>Đã tích chọn: <strong style={{ color: '#60a5fa' }}>{selectedProposalIds.length}</strong> / {reimbursementProps.length} đề xuất</p>
                      <p>Tổng tiền hoàn gộp: <strong style={{ color: '#10b981', fontSize: '1.25rem' }}>{formatVND(selectedMergeTotal)}</strong></p>
                    </div>

                    <div className={styles.mergeActionBox}>
                      <label className="form-label" htmlFor="gopQuy">Chọn Quỹ shop chi trả:</label>
                      <select 
                        id="gopQuy"
                        className="form-control"
                        style={{ marginBottom: '0.75rem' }}
                        value={gopQuyId}
                        onChange={(e) => setGopQuyId(e.target.value)}
                        disabled={actionLoading}
                      >
                        <option value="">-- Chọn quỹ trả tiền --</option>
                        {funds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.tenQuy} ({formatVND(f.soDuHienTai)})
                          </option>
                        ))}
                      </select>

                      <button 
                        onClick={handleApproveMerge}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={actionLoading || selectedProposalIds.length === 0}
                      >
                        <TrendingDown size={18} />
                        <span>Duyệt Hoàn Ứng Gộp</span>
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProposalIds(reimbursementProps.map(p => p.id));
                                } else {
                                  setSelectedProposalIds([]);
                                }
                              }}
                              checked={selectedProposalIds.length === reimbursementProps.length && reimbursementProps.length > 0}
                              disabled={actionLoading}
                            />
                          </th>
                          <th>Mã Phiếu</th>
                          <th>Ngày lập</th>
                          <th>Danh mục</th>
                          <th>Nhà cung cấp</th>
                          <th>Nội dung chi</th>
                          <th>Số tiền</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reimbursementProps.map((prop) => {
                          const isChecked = selectedProposalIds.includes(prop.id);
                          return (
                            <tr key={prop.id} style={{ background: isChecked ? 'rgba(37, 99, 235, 0.05)' : '' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleCheckboxChange(prop.id)}
                                  disabled={actionLoading}
                                />
                              </td>
                              <td 
                                onClick={() => setSelectedPreviewProp(prop)}
                                style={{ fontWeight: 'bold', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click xem nhanh đề xuất"
                              >
                                {prop.maPhieu}
                              </td>
                              <td suppressHydrationWarning>
                                {new Date(prop.ngayPhatSinh).toLocaleDateString('vi-VN')}
                                {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                              </td>


                              <td>{prop.danhMuc.tenDanhMuc}</td>
                              <td>
                                {prop.nhaCungCap ? (
                                  <div>
                                    <div style={{ fontWeight: '600' }}>{prop.nhaCungCap.tenNCC}</div>
                                    <small style={{ color: 'var(--text-muted)' }}>
                                      {prop.nhaCungCap.tenNganHang} - {prop.nhaCungCap.soTaiKhoan}
                                    </small>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Không có</span>
                                )}
                              </td>
                              <td>
                                <div>{prop.noiDung}</div>
                                {prop.nhaCungCap && (
                                  <small className={styles.nccLabel}>NCC: {prop.nhaCungCap.tenNCC}</small>
                                )}
                              </td>
                              <td style={{ fontWeight: '800', color: '#1e293b' }}>{formatVND(prop.soTien)}</td>

                              <td>
                                <span className="badge badge-reimburse">Chờ hoàn ứng</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Modal: XEM CHI TIẾT ĐỀ XUẤT NHANH */}
        {selectedPreviewProp && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.detailContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Xem nhanh đề xuất {selectedPreviewProp.maPhieu}</h2>
                <button onClick={() => setSelectedPreviewProp(null)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Mã phiếu:</span>
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#60a5fa' }}>{selectedPreviewProp.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày lập:</span>
                  <span className={styles.detailValue} suppressHydrationWarning>{new Date(selectedPreviewProp.ngayPhatSinh).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Hạn thanh toán:</span>
                  <span className={styles.detailValue} style={{ color: selectedPreviewProp.ngayCanThanhToan ? '#fbbf24' : 'inherit', fontWeight: selectedPreviewProp.ngayCanThanhToan ? '600' : 'normal' }} suppressHydrationWarning>
                    {selectedPreviewProp.ngayCanThanhToan 
                      ? `📅 ${new Date(selectedPreviewProp.ngayCanThanhToan).toLocaleDateString('vi-VN')}` 
                      : 'Không có'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedPreviewProp.nguoiTao.hoTen} ({selectedPreviewProp.nguoiTao.role})</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Nguồn tiền:</span>
                  <span className={styles.detailValue}>
                    {selectedPreviewProp.nguonTien === 'TIEN_SHOP' ? '🏦 Tiền Shop chi' : '👤 Cá nhân nhân viên ứng'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Danh mục chi:</span>
                  <span className={styles.detailValue}>{selectedPreviewProp.danhMuc.tenDanhMuc}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Số tiền chi:</span>
                  <span className={styles.detailValue} style={{ fontWeight: '800', color: '#34d399', fontSize: '1.1rem' }}>{formatVND(selectedPreviewProp.soTien)}</span>
                </div>
                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Nội dung chi:</span>
                  <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>{selectedPreviewProp.noiDung}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Nhà cung cấp:</span>
                  <span className={styles.detailValue}>{selectedPreviewProp.nhaCungCap ? `${selectedPreviewProp.nhaCungCap.tenNCC} (${selectedPreviewProp.nhaCungCap.tenNganHang})` : 'Không có'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Trạng thái:</span>
                  <span className={styles.detailValue}>
                    {selectedPreviewProp.trangThai === 'DA_THANH_TOAN' && selectedPreviewProp.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                    {selectedPreviewProp.trangThai === 'DA_THANH_TOAN' && selectedPreviewProp.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn (Chờ duyệt)</span>}
                    {selectedPreviewProp.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                    {selectedPreviewProp.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                    {selectedPreviewProp.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                  </span>
                </div>

                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.detailLabel}>Ghi chú:</span>
                  <span className={styles.detailValue}>{selectedPreviewProp.ghiChu || 'Không có ghi chú thêm.'}</span>
                </div>

                {selectedPreviewProp.anhHoaDon && (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Hóa đơn đính kèm:</span>
                    <div className={styles.invoiceImgWrapper}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedPreviewProp.anhHoaDon} alt="Hóa đơn chứng từ" className={styles.invoiceImg} />
                    </div>
                  </div>
                )}

                {selectedPreviewProp.nhaCungCap && (
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
                          <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.95rem' }}>{selectedPreviewProp.nhaCungCap.tenNCC}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tài khoản (STK)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: '#fbbf24' }}>
                              {selectedPreviewProp.nhaCungCap.soTaiKhoan}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedPreviewProp.nhaCungCap.soTaiKhoan, 'stk')}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              {copiedField === 'stk' ? '✓ Đã chép' : 'Sao chép'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngân hàng</div>
                          <div style={{ fontWeight: '600', color: '#f8fafc' }}>{selectedPreviewProp.nhaCungCap.tenNganHang}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tiền thanh toán</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontWeight: '800', color: '#34d399', fontSize: '1.1rem' }}>
                              {formatVND(selectedPreviewProp.soTien)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedPreviewProp.soTien.toString(), 'sotien')}
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
                              {selectedPreviewProp.maPhieu}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedPreviewProp.maPhieu, 'memo')}
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
                          src={generateVietQRUrl(selectedPreviewProp.nhaCungCap, selectedPreviewProp.soTien, selectedPreviewProp.maPhieu)}
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

              <div className={styles.modalActions} style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {(selectedPreviewProp.trangThai === 'CHO_THANH_TOAN' || (selectedPreviewProp.trangThai === 'DA_THANH_TOAN' && selectedPreviewProp.quyThanhToanId === null)) && (
                    <>
                      <select 
                        className="form-control form-control-sm"
                        style={{ minWidth: '160px', display: 'inline-block' }}
                        value={selectedQuyId[selectedPreviewProp.id] || ''}
                        onChange={(e) => setSelectedQuyId({
                          ...selectedQuyId,
                          [selectedPreviewProp.id]: e.target.value
                        })}
                        disabled={actionLoading}
                      >
                        <option value="">-- Chọn quỹ chi --</option>
                        {funds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.tenQuy} ({formatVND(f.soDuHienTai)})
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={async () => {
                          const qId = selectedQuyId[selectedPreviewProp.id];
                          if (!qId) {
                            alert('Vui lòng chọn Quỹ thanh toán!');
                            return;
                          }
                          await handleApproveSingle(selectedPreviewProp.id, selectedPreviewProp.maPhieu);
                          setSelectedPreviewProp(null);
                        }}
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem' }}
                        disabled={actionLoading}
                      >
                        Duyệt chi ngay
                      </button>
                    </>
                  )}
                </div>
                <button onClick={() => setSelectedPreviewProp(null)} className="btn btn-secondary">
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
