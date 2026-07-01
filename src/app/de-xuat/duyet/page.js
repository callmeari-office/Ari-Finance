'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DateInput from '@/components/DateInput';
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
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AriCameo from '@/components/AriCameo';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/date';
import styles from './duyet.module.css';

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function DuyetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openHandledRef = useRef(false);
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState(null);

  // Cache today's date string once per render
  const todayStr = getTodayString();

  // Active Tab: 'TH1' (Chờ thanh toán) hoặc 'TH3' (Chờ hoàn ứng gộp)
  const [activeTab, setActiveTab] = useState('TH1');

  // Core Data
  const [proposals, setProposals] = useState([]);
  const [funds, setFunds] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // States: TH1 (Duyệt đơn)
  const [selectedQuyId, setSelectedQuyId] = useState({}); // Lưu quỹ được chọn cho từng proposalId
  const [selectedNgayGD, setSelectedNgayGD] = useState({}); // Lưu ngày giao dịch cho từng proposalId
  const [actionLoading, setActionLoading] = useState(false);

  // States: TH1/TH2 (Duyệt nhiều phiếu cùng lúc)
  const [selectedPayIds, setSelectedPayIds] = useState([]); // Các phiếu được tích chọn để duyệt hàng loạt
  const [bulkQuyId, setBulkQuyId] = useState(''); // Quỹ áp dụng chung cho các phiếu chưa chọn quỹ riêng
  const [bulkNgayGD, setBulkNgayGD] = useState(todayStr); // Ngày giao dịch áp dụng hàng loạt
  const [filterNvDuyet, setFilterNvDuyet] = useState(''); // Lọc theo người đề xuất (NV) cho TH1/TH2

  // States: TH3 (Duyệt gộp hoàn ứng)
  const [selectedStaffId, setSelectedStaffId] = useState(''); // Nhân viên được chọn để hoàn ứng
  const [selectedProposalIds, setSelectedProposalIds] = useState([]); // Các đề xuất hoàn ứng được tích chọn
  const [gopQuyId, setGopQuyId] = useState(''); // Quỹ dùng để chi trả hoàn ứng gộp
  const [gopNgayGD, setGopNgayGD] = useState(todayStr); // Ngày giao dịch hoàn gộp

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState({ open: false, id: '', maPhieu: '' });
  const [cancelReason, setCancelReason] = useState('');

  // Quick Preview state
  const [selectedPreviewProp, setSelectedPreviewProp] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  const [sortBy, setSortBy] = useState('maPhieu');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortedProposals = (propsArray) => {
    const sorted = [...propsArray];
    sorted.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'ngayPhatSinh') {
        valA = new Date(a.ngayPhatSinh).getTime();
        valB = new Date(b.ngayPhatSinh).getTime();
      } else if (sortBy === 'soTien') {
        valA = a.soTien;
        valB = b.soTien;
      } else if (sortBy === 'maPhieu') {
        return sortOrder === 'asc' 
          ? a.maPhieu.localeCompare(b.maPhieu) 
          : b.maPhieu.localeCompare(a.maPhieu);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const generateVietQRUrl = (vendor, amount, memo) => {
    if (!vendor) return '';
    const nameUpper = vendor.tenNganHang.toUpperCase();
    let bankCode = nameUpper.includes('-') ? nameUpper.split('-')[0].trim() : nameUpper.trim();

    const bankMap = {
      'vcb': 'vietcombank', 'tcb': 'techcombank', 'ctg': 'vietinbank',
      'mb': 'mb', 'mbbank': 'mb', 'vpb': 'vpbank', 'hdb': 'hdbank',
      'stb': 'sacombank', 'tpb': 'tpbank', 'msb': 'msb', 'shb': 'shb',
      'eib': 'eximbank', 'ocb': 'ocb', 'lpb': 'lpbank', 'abb': 'abbank',
      'nab': 'namabank', 'cake': 'cake'
    };
    let qrBank = bankMap[bankCode.toLowerCase()] || bankCode.toLowerCase();
    const accountName = vendor.tenTaiKhoan || vendor.tenNCC;

    return `https://img.vietqr.io/image/${qrBank}-${vendor.soTaiKhoan}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(accountName)}`;
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
            toast.error('Bạn không có quyền truy cập trang duyệt đề xuất.');
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

  // Deep-link: notification click với ?open=ID → chuyển đúng tab, scroll + highlight phiếu
  useEffect(() => {
    if (dataLoading) return;
    if (openHandledRef.current) return;
    const openId = searchParams.get('open');
    if (!openId) return;
    openHandledRef.current = true;

    const target = proposals.find((p) => p.id === openId);
    if (!target) return;

    // Xác định tab chứa phiếu và chuyển sang tab đó
    if (target.nguonTien === 'TIEN_SHOP' && target.trangThai === 'CHO_THANH_TOAN') {
      setActiveTab('TH1');
    } else if (target.nguonTien === 'TIEN_SHOP' && target.trangThai === 'DA_THANH_TOAN') {
      setActiveTab('TH2');
    } else if (target.nguonTien === 'TIEN_CA_NHAN' && target.trangThai === 'CHO_HOAN_UNG') {
      setActiveTab('TH3');
      setSelectedStaffId(target.nguoiDeXuatId);
    }

    setHighlightId(openId);
    router.replace('/de-xuat/duyet');

    // Delay để React render tab mới rồi mới scroll
    setTimeout(() => {
      const row = document.querySelector(`tr[data-proposal-id="${openId}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightId(null), 2500);
    }, 200);
  }, [dataLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Tải các đề xuất ở trạng thái chờ duyệt (TH1, TH2, TH3)
      const propRes = await fetch('/api/de-xuat?trangThai=CHO_THANH_TOAN,CHO_HOAN_UNG,DA_THANH_TOAN&onlyPending=true&limit=500');
      if (propRes.ok) {
        const propData = await propRes.json();
        const pendingProps = (propData.data || []).filter(p => !p.laLichSu);
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
      toast.error('Vui lòng chọn Quỹ dùng để thanh toán trước khi duyệt!');
      return;
    }
    const ngayGD = selectedNgayGD[proposalId] || todayStr;

    const ok = await showConfirm({
      message: `Duyệt thanh toán đề xuất ${maPhieu}?\nViệc này sẽ sinh ra phiếu Chi và thay đổi số dư quỹ.`,
      confirmLabel: 'Duyệt chi',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/de-xuat/${proposalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUYET', quyThanhToanId: quyId, ngayGiaoDich: ngayGD }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duyệt đề xuất thất bại.');

      toast.success(`Đã duyệt thanh toán thành công đề xuất ${maPhieu}`);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('ari:celebrate'));
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // TH1: Hủy đề xuất đơn — mở modal nhập lý do
  const handleCancelSingle = (proposalId, maPhieu) => {
    setCancelReason('');
    setCancelModal({ open: true, id: proposalId, maPhieu });
  };

  const handleConfirmCancel = async () => {
    const { id, maPhieu } = cancelModal;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/de-xuat/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'HUY', ghiChu: cancelReason.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hủy thất bại.');

      setCancelModal({ open: false, id: '', maPhieu: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // OWNER: Xóa vĩnh viễn đề xuất rác (chỉ phiếu chưa gắn dòng tiền)
  const handleDeleteProposal = async () => {
    const { id, maPhieu } = cancelModal;
    const ok = await showConfirm({
      title: 'Xóa vĩnh viễn đề xuất',
      message: `Xóa vĩnh viễn đề xuất ${maPhieu}?\nThao tác này KHÔNG THỂ hoàn tác và sẽ xóa hẳn dữ liệu khỏi hệ thống.`,
      confirmLabel: 'Xóa vĩnh viễn',
      danger: true,
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/de-xuat/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');

      setCancelModal({ open: false, id: '', maPhieu: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // TH1/TH2: Tích chọn / bỏ chọn một phiếu để duyệt hàng loạt
  const handleTogglePay = (proposalId) => {
    setSelectedPayIds((prev) =>
      prev.includes(proposalId)
        ? prev.filter((id) => id !== proposalId)
        : [...prev, proposalId]
    );
  };

  // TH1/TH2: Duyệt nhiều phiếu cùng lúc (mỗi phiếu sinh 1 phiếu Chi riêng)
  const handleApproveBulk = async (listProps) => {
    if (selectedPayIds.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất một phiếu để duyệt!');
      return;
    }

    // Mỗi phiếu dùng quỹ đã chọn riêng (nếu có), nếu chưa chọn thì dùng quỹ chung
    const items = [];
    const missing = [];
    let total = 0;
    for (const id of selectedPayIds) {
      const prop = listProps.find((p) => p.id === id);
      if (!prop) continue;
      const quyId = selectedQuyId[id] || bulkQuyId;
      if (!quyId) {
        missing.push(prop.maPhieu);
        continue;
      }
      const ngayGD = selectedNgayGD[id] || bulkNgayGD || todayStr;
      items.push({ id, quyThanhToanId: quyId, ngayGiaoDich: ngayGD });
      total += prop.soTien;
    }

    if (missing.length > 0) {
      toast.error(
        `Các phiếu chưa chọn quỹ chi: ${missing.join(', ')}.\n` +
        `Hãy chọn "Quỹ chi cho tất cả" hoặc chọn quỹ riêng từng phiếu.`
      );
      return;
    }

    const ok = await showConfirm({
      title: `Duyệt chi ${items.length} phiếu`,
      message:
        `Tổng tiền chi: ${total.toLocaleString('vi-VN')} VND\n` +
        `Hệ thống sẽ sinh ${items.length} phiếu Chi riêng và trừ tiền các quỹ tương ứng.`,
      confirmLabel: `Duyệt ${items.length} phiếu`,
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/de-xuat/duyet-nhieu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duyệt hàng loạt thất bại.');

      if (data.failCount > 0) {
        const failed = (data.results || [])
          .filter((r) => !r.success)
          .map((r) => `${r.maPhieu || r.id}: ${r.error}`)
          .join('\n');
        toast.warning(`${data.message}\n\nChi tiết phiếu lỗi:\n${failed}`);
      } else {
        toast.success(data.message);
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('ari:celebrate'));
      }

      setSelectedPayIds([]);
      setBulkQuyId('');
      setSelectedNgayGD({});
      setBulkNgayGD(todayStr);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
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
      toast.error('Vui lòng tích chọn ít nhất một đề xuất cần hoàn ứng!');
      return;
    }

    if (!gopQuyId) {
      toast.error('Vui lòng chọn quỹ shop chi trả hoàn ứng!');
      return;
    }

    const selectedProps = reimbursementProps.filter(p => selectedProposalIds.includes(p.id));
    const totalAmount = selectedProps.reduce((sum, p) => sum + p.soTien, 0);

    const ok = await showConfirm({
      title: `Duyệt gộp ${selectedProposalIds.length} đề xuất hoàn ứng`,
      message:
        `Tổng tiền chi hoàn ứng: ${totalAmount.toLocaleString('vi-VN')} VND\n` +
        `Quỹ thanh toán: ${funds.find(f => f.id === gopQuyId)?.tenQuy}\n` +
        `Hệ thống sẽ tạo MỘT phiếu Chi duy nhất cho toàn bộ đề xuất này.`,
      confirmLabel: 'Duyệt gộp',
    });
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/de-xuat/duyet-gop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedProposalIds,
          quyThanhToanId: gopQuyId,
          ngayGiaoDich: gopNgayGD || todayStr,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duyệt gộp thất bại.');

      toast.success(data.message || 'Đã duyệt hoàn ứng gộp thành công');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('ari:celebrate'));
      setSelectedProposalIds([]);
      setGopNgayGD(todayStr);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
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

  // Lọc "Người đề xuất" cho TH1/TH2: danh sách người đề xuất distinct + danh sách phiếu đã lọc.
  const distinctStaffOf = (arr) => {
    const map = new Map();
    arr.forEach((p) => {
      if (p.nguoiDeXuat && !map.has(p.nguoiDeXuat.id)) map.set(p.nguoiDeXuat.id, p.nguoiDeXuat);
    });
    return Array.from(map.values());
  };
  const staffOptionsTH1 = distinctStaffOf(pendingPaymentProps);
  const staffOptionsTH2 = distinctStaffOf(pendingAssignFundProps);
  const filteredPaymentProps = filterNvDuyet
    ? pendingPaymentProps.filter((p) => p.nguoiDeXuat?.id === filterNvDuyet)
    : pendingPaymentProps;
  const filteredAssignFundProps = filterNvDuyet
    ? pendingAssignFundProps.filter((p) => p.nguoiDeXuat?.id === filterNvDuyet)
    : pendingAssignFundProps;

  // Khi đổi người lọc: bỏ chọn các phiếu không còn hiển thị để tránh duyệt nhầm.
  const handleChangeFilterNv = (value, baseProps) => {
    setFilterNvDuyet(value);
    if (value) {
      const visibleIds = baseProps
        .filter((p) => p.nguoiDeXuat?.id === value)
        .map((p) => p.id);
      setSelectedPayIds((prev) => prev.filter((id) => visibleIds.includes(id)));
    }
  };

  // Nhóm các đề xuất chờ hoàn ứng theo từng người đề xuất để duyệt gộp
  const staffGroups = {};
  pendingReimburseProps.forEach((p) => {
    const sId = p.nguoiDeXuat.id;
    if (!staffGroups[sId]) {
      staffGroups[sId] = {
        nhanVien: p.nguoiDeXuat,
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
          <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: '600', backgroundColor: 'var(--success-bg)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            ✓ Hạn: {formatDate(ngayCanThanhToan)}
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
          <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: '800', backgroundColor: 'var(--danger-bg)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block', border: '1px solid var(--danger)' }}>
            🚨 Trễ hạn {Math.abs(diffDays)} ngày ({formatDate(ngayCanThanhToan)})
          </span>
        </div>
      );
    } else if (diffDays === 0) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--warning)', fontWeight: '800', backgroundColor: 'var(--warning-bg)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block', border: '1px solid var(--warning)' }}>
            🚨 CẦN CHI HÔM NAY ({formatDate(ngayCanThanhToan)})
          </span>
        </div>
      );
    } else if (diffDays <= 2) {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: '700', backgroundColor: 'rgba(251,191,36,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            ⏳ Sắp đến hạn ({formatDate(ngayCanThanhToan)})
          </span>
        </div>
      );
    } else {
      return (
        <div style={{ marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.65rem', color: '#4b5563', fontWeight: '600', backgroundColor: 'rgba(75,85,99,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block' }}>
            📅 Hạn: {formatDate(ngayCanThanhToan)}
          </span>
        </div>
      );
    }
  };


  const getRowUrgencyClass = (ngayCanThanhToan, trangThai) => {
    if (!ngayCanThanhToan) return '';
    if (trangThai === 'DA_THANH_TOAN' || trangThai === 'HUY') return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deadline = new Date(ngayCanThanhToan); deadline.setHours(0, 0, 0, 0);
    const diff = Math.ceil((deadline - today) / 86400000);
    if (diff < 0) return styles.overdueRow;
    if (diff <= 1) return styles.urgentRow;
    return '';
  };

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      {highlightId && (
        <style>{`
          @keyframes ari-row-highlight {
            0%   { background-color: rgba(37,99,235,0.22); outline: 2px solid rgba(37,99,235,0.45); }
            70%  { background-color: rgba(37,99,235,0.08); }
            100% { background-color: transparent; outline: none; }
          }
          tr[data-proposal-id="${highlightId}"] {
            animation: ari-row-highlight 2.5s ease-out forwards;
          }
        `}</style>
      )}

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
              setSelectedPayIds([]);
              setBulkQuyId('');
              setSelectedNgayGD({});
              setBulkNgayGD(todayStr);
              setFilterNvDuyet('');
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
              setSelectedPayIds([]);
              setBulkQuyId('');
              setSelectedNgayGD({});
              setBulkNgayGD(todayStr);
              setFilterNvDuyet('');
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
              setSelectedPayIds([]);
              setBulkQuyId('');
              setSelectedNgayGD({});
              setGopNgayGD(todayStr);
              setFilterNvDuyet('');
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
            ) : pendingPaymentProps.length === 0 ? (
              <div className={styles.emptyState}>
                <AriCameo size={56} />
                <span className={styles.emptyStateTitle}>Không có đề xuất nào đang chờ</span>
                <span>Tất cả phiếu chi quỹ đã được xử lý.</span>
              </div>
            ) : (
              <>
                {staffOptionsTH1.length > 1 && (
                  <div className={styles.filterToolbar}>
                    <User size={16} style={{ color: 'var(--text-muted)' }} />
                    <label htmlFor="filterNvTH1" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lọc theo nhân viên:</label>
                    <select
                      id="filterNvTH1"
                      className="form-control form-control-sm"
                      style={{ minWidth: '180px', maxWidth: '240px' }}
                      value={filterNvDuyet}
                      onChange={(e) => handleChangeFilterNv(e.target.value, pendingPaymentProps)}
                      disabled={actionLoading}
                    >
                      <option value="">Tất cả nhân viên ({pendingPaymentProps.length})</option>
                      {staffOptionsTH1.map((nv) => (
                        <option key={nv.id} value={nv.id}>{nv.tenNgan || nv.hoTen}</option>
                      ))}
                    </select>
                    {filterNvDuyet && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleChangeFilterNv('', pendingPaymentProps)}
                        disabled={actionLoading}
                      >
                        Xóa lọc
                      </button>
                    )}
                  </div>
                )}
                {selectedPayIds.length > 0 && (
                  <div className={styles.bulkBar}>
                    <div className={styles.bulkInfo}>
                      <CheckSquare size={18} />
                      <span>Đã chọn <strong>{selectedPayIds.length}</strong> phiếu — Tổng <strong style={{ color: 'var(--success)' }}>{formatVND(filteredPaymentProps.filter(p => selectedPayIds.includes(p.id)).reduce((s, p) => s + p.soTien, 0))}</strong></span>
                    </div>
                    <div className={styles.bulkActions}>
                      <select
                        className="form-control form-control-sm"
                        style={{ minWidth: '180px' }}
                        value={bulkQuyId}
                        onChange={(e) => setBulkQuyId(e.target.value)}
                        disabled={actionLoading}
                        title="Quỹ áp dụng cho các phiếu chưa chọn quỹ riêng"
                      >
                        <option value="">-- Quỹ chi cho tất cả --</option>
                        {funds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.tenQuy} ({formatVND(f.soDuHienTai)})
                          </option>
                        ))}
                      </select>
                      <DateInput
                        className="form-control form-control-sm"
                        style={{ width: '130px', display: 'inline-block' }}
                        value={bulkNgayGD}
                        onChange={(e) => setBulkNgayGD(e.target.value)}
                        disabled={actionLoading}
                        title="Ngày giao dịch chung áp dụng cho các phiếu chưa chọn ngày riêng"
                      />
                      <button
                        onClick={() => handleApproveBulk(filteredPaymentProps)}
                        className="btn btn-primary"
                        style={{ whiteSpace: 'nowrap' }}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={16} />
                        <span>Duyệt {selectedPayIds.length} phiếu đã chọn</span>
                      </button>
                      <button
                        onClick={() => { setSelectedPayIds([]); setBulkQuyId(''); setSelectedNgayGD({}); setBulkNgayGD(todayStr); }}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                )}
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => setSelectedPayIds(e.target.checked ? filteredPaymentProps.map(p => p.id) : [])}
                          checked={selectedPayIds.length === filteredPaymentProps.length && filteredPaymentProps.length > 0}
                          disabled={actionLoading}
                          title="Chọn tất cả"
                        />
                      </th>
                      <th 
                        onClick={() => handleSort('maPhieu')} 
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>Mã Phiếu</span>
                          {sortBy === 'maPhieu' ? (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ChevronDown size={14} style={{ opacity: 0.2 }} />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('ngayPhatSinh')} 
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>Ngày lập</span>
                          {sortBy === 'ngayPhatSinh' ? (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ChevronDown size={14} style={{ opacity: 0.2 }} />
                          )}
                        </div>
                      </th>
                      <th>Nhân viên</th>
                      <th>Danh mục</th>
                      <th>Nhà cung cấp</th>
                      <th>Nội dung</th>
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
                      <th>Chọn Quỹ chi</th>
                      <th>Ngày GD</th>
                      <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedProposals(filteredPaymentProps).map((prop) => (
                      <tr key={prop.id} data-proposal-id={prop.id} className={getRowUrgencyClass(prop.ngayCanThanhToan, prop.trangThai)} style={{ background: selectedPayIds.includes(prop.id) ? 'rgba(37, 99, 235, 0.05)' : '' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedPayIds.includes(prop.id)}
                            onChange={() => handleTogglePay(prop.id)}
                            disabled={actionLoading}
                          />
                        </td>
                        <td
                          onClick={() => setSelectedPreviewProp(prop)}
                          style={{ fontWeight: 'bold', color: 'var(--info)', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click xem nhanh đề xuất"
                        >
                          {prop.maPhieu}
                        </td>
                        <td suppressHydrationWarning>
                          {formatDate(prop.ngayPhatSinh)}
                          {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                        </td>


                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiDeXuat.tenNgan || prop.nguoiDeXuat.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiDeXuat.role}</small>
                          {prop.nguoiDeXuatId !== prop.nguoiTaoId && (
                            <>
                              <br />
                              <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                tạo bởi {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                              </small>
                            </>
                          )}
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
                        <td style={{ fontWeight: '800', color: 'var(--text-main)' }}>{formatVND(prop.soTien)}</td>

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
                        <td>
                          <DateInput
                            className="form-control form-control-sm"
                            style={{ width: '130px' }}
                            value={selectedNgayGD[prop.id] || todayStr}
                            onChange={(e) => setSelectedNgayGD({
                              ...selectedNgayGD,
                              [prop.id]: e.target.value
                            })}
                            disabled={actionLoading}
                          />
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
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--danger)', border: '1px solid var(--danger)' }}
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
              </>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton skeletonRow" />)}
              </div>
            ) : pendingAssignFundProps.length === 0 ? (
              <div className={styles.emptyState}>
                <AriCameo size={56} />
                <span className={styles.emptyStateTitle}>Không có phiếu nào chờ gán Quỹ</span>
                <span>Các phiếu đã thanh toán đều đã được gán quỹ trừ tiền.</span>
              </div>
            ) : (
              <>
                {staffOptionsTH2.length > 1 && (
                  <div className={styles.filterToolbar}>
                    <User size={16} style={{ color: 'var(--text-muted)' }} />
                    <label htmlFor="filterNvTH2" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lọc theo nhân viên:</label>
                    <select
                      id="filterNvTH2"
                      className="form-control form-control-sm"
                      style={{ minWidth: '180px', maxWidth: '240px' }}
                      value={filterNvDuyet}
                      onChange={(e) => handleChangeFilterNv(e.target.value, pendingAssignFundProps)}
                      disabled={actionLoading}
                    >
                      <option value="">Tất cả nhân viên ({pendingAssignFundProps.length})</option>
                      {staffOptionsTH2.map((nv) => (
                        <option key={nv.id} value={nv.id}>{nv.tenNgan || nv.hoTen}</option>
                      ))}
                    </select>
                    {filterNvDuyet && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleChangeFilterNv('', pendingAssignFundProps)}
                        disabled={actionLoading}
                      >
                        Xóa lọc
                      </button>
                    )}
                  </div>
                )}
                {selectedPayIds.length > 0 && (
                  <div className={styles.bulkBar}>
                    <div className={styles.bulkInfo}>
                      <CheckSquare size={18} />
                      <span>Đã chọn <strong>{selectedPayIds.length}</strong> phiếu — Tổng <strong style={{ color: 'var(--success)' }}>{formatVND(filteredAssignFundProps.filter(p => selectedPayIds.includes(p.id)).reduce((s, p) => s + p.soTien, 0))}</strong></span>
                    </div>
                    <div className={styles.bulkActions}>
                      <select
                        className="form-control form-control-sm"
                        style={{ minWidth: '180px' }}
                        value={bulkQuyId}
                        onChange={(e) => setBulkQuyId(e.target.value)}
                        disabled={actionLoading}
                        title="Quỹ áp dụng cho các phiếu chưa chọn quỹ riêng"
                      >
                        <option value="">-- Quỹ chi cho tất cả --</option>
                        {funds.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.tenQuy} ({formatVND(f.soDuHienTai)})
                          </option>
                        ))}
                      </select>
                      <DateInput
                        className="form-control form-control-sm"
                        style={{ width: '130px', display: 'inline-block' }}
                        value={bulkNgayGD}
                        onChange={(e) => setBulkNgayGD(e.target.value)}
                        disabled={actionLoading}
                        title="Ngày giao dịch chung áp dụng cho các phiếu chưa chọn ngày riêng"
                      />
                      <button
                        onClick={() => handleApproveBulk(filteredAssignFundProps)}
                        className="btn btn-primary"
                        style={{ whiteSpace: 'nowrap' }}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={16} />
                        <span>Gán quỹ & Duyệt {selectedPayIds.length} phiếu</span>
                      </button>
                      <button
                        onClick={() => { setSelectedPayIds([]); setBulkQuyId(''); setSelectedNgayGD({}); setBulkNgayGD(todayStr); }}
                        className="btn btn-secondary"
                        disabled={actionLoading}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                )}
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => setSelectedPayIds(e.target.checked ? filteredAssignFundProps.map(p => p.id) : [])}
                          checked={selectedPayIds.length === filteredAssignFundProps.length && filteredAssignFundProps.length > 0}
                          disabled={actionLoading}
                          title="Chọn tất cả"
                        />
                      </th>
                      <th 
                        onClick={() => handleSort('maPhieu')} 
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>Mã Phiếu</span>
                          {sortBy === 'maPhieu' ? (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ChevronDown size={14} style={{ opacity: 0.2 }} />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('ngayPhatSinh')} 
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>Ngày lập</span>
                          {sortBy === 'ngayPhatSinh' ? (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ChevronDown size={14} style={{ opacity: 0.2 }} />
                          )}
                        </div>
                      </th>
                      <th>Nhân viên</th>
                      <th>Danh mục</th>
                      <th>Nhà cung cấp</th>
                      <th>Nội dung</th>
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
                      <th>Chọn Quỹ chi</th>
                      <th>Ngày GD</th>
                      <th style={{ textAlign: 'center' }}>Thao tác duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedProposals(filteredAssignFundProps).map((prop) => (
                      <tr key={prop.id} data-proposal-id={prop.id} className={getRowUrgencyClass(prop.ngayCanThanhToan, prop.trangThai)} style={{ background: selectedPayIds.includes(prop.id) ? 'rgba(37, 99, 235, 0.05)' : '' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedPayIds.includes(prop.id)}
                            onChange={() => handleTogglePay(prop.id)}
                            disabled={actionLoading}
                          />
                        </td>
                        <td
                          onClick={() => setSelectedPreviewProp(prop)}
                          style={{ fontWeight: 'bold', color: 'var(--info)', cursor: 'pointer', textDecoration: 'underline' }}
                          title="Click xem nhanh đề xuất"
                        >
                          {prop.maPhieu}
                        </td>
                        <td suppressHydrationWarning>
                          {formatDate(prop.ngayPhatSinh)}
                          {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                        </td>


                        <td>
                          <span style={{ fontWeight: '600' }}>{prop.nguoiDeXuat.tenNgan || prop.nguoiDeXuat.hoTen}</span>
                          <br />
                          <small style={{ color: 'var(--text-muted)' }}>{prop.nguoiDeXuat.role}</small>
                          {prop.nguoiDeXuatId !== prop.nguoiTaoId && (
                            <>
                              <br />
                              <small style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                tạo bởi {prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}
                              </small>
                            </>
                          )}
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
                        <td style={{ fontWeight: '800', color: 'var(--text-main)' }}>{formatVND(prop.soTien)}</td>

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
                        <td>
                          <DateInput
                            className="form-control form-control-sm"
                            style={{ width: '130px' }}
                            value={selectedNgayGD[prop.id] || todayStr}
                            onChange={(e) => setSelectedNgayGD({
                              ...selectedNgayGD,
                              [prop.id]: e.target.value
                            })}
                            disabled={actionLoading}
                          />
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
              </>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton skeletonRow" />)}
                </div>
              ) : reimbursementStaffs.length === 0 ? (
                <div className={styles.emptyState}>
                  <AriCameo size={56} />
                  <span className={styles.emptyStateTitle}>Không có hoàn ứng nào đang chờ</span>
                  <span>Tất cả nhân viên đã được hoàn ứng tiền.</span>
                </div>
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
                          <strong style={{ color: 'var(--success)' }}>{formatVND(totalPending)}</strong>
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
                      <p>Đã tích chọn: <strong style={{ color: 'var(--info)' }}>{selectedProposalIds.length}</strong> / {reimbursementProps.length} đề xuất</p>
                      <p>Tổng tiền hoàn gộp: <strong style={{ color: 'var(--success)', fontSize: '1.25rem' }}>{formatVND(selectedMergeTotal)}</strong></p>
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

                      <label className="form-label" htmlFor="gopNgayGD" style={{ marginTop: '0.5rem' }}>Ngày giao dịch:</label>
                      <DateInput
                        id="gopNgayGD"
                        className="form-control"
                        style={{ marginBottom: '0.75rem' }}
                        value={gopNgayGD}
                        onChange={(e) => setGopNgayGD(e.target.value)}
                        disabled={actionLoading}
                      />

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
                          <th 
                            onClick={() => handleSort('maPhieu')} 
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>Mã Phiếu</span>
                              {sortBy === 'maPhieu' ? (
                                sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : (
                                <ChevronDown size={14} style={{ opacity: 0.2 }} />
                              )}
                            </div>
                          </th>
                          <th 
                            onClick={() => handleSort('ngayPhatSinh')} 
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>Ngày lập</span>
                              {sortBy === 'ngayPhatSinh' ? (
                                sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              ) : (
                                <ChevronDown size={14} style={{ opacity: 0.2 }} />
                              )}
                            </div>
                          </th>
                          <th>Danh mục</th>
                          <th>Nhà cung cấp</th>
                          <th>Nội dung chi</th>
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
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedProposals(reimbursementProps).map((prop) => {
                          const isChecked = selectedProposalIds.includes(prop.id);
                          return (
                            <tr key={prop.id} data-proposal-id={prop.id} style={{ background: isChecked ? 'rgba(37, 99, 235, 0.05)' : '' }}>
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
                                style={{ fontWeight: 'bold', color: 'var(--info)', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click xem nhanh đề xuất"
                              >
                                {prop.maPhieu}
                              </td>
                              <td suppressHydrationWarning>
                                {formatDate(prop.ngayPhatSinh)}
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
                              <td style={{ fontWeight: '800', color: 'var(--text-main)' }}>{formatVND(prop.soTien)}</td>

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
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: 'var(--info)' }}>{selectedPreviewProp.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày lập:</span>
                  <span className={styles.detailValue} suppressHydrationWarning>{formatDate(selectedPreviewProp.ngayPhatSinh)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Hạn thanh toán:</span>
                  <span className={styles.detailValue} style={{ color: selectedPreviewProp.ngayCanThanhToan ? '#fbbf24' : 'inherit', fontWeight: selectedPreviewProp.ngayCanThanhToan ? '600' : 'normal' }} suppressHydrationWarning>
                    {selectedPreviewProp.ngayCanThanhToan 
                      ? `📅 ${formatDate(selectedPreviewProp.ngayCanThanhToan)}` 
                      : 'Không có'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedPreviewProp.nguoiTao.tenNgan || selectedPreviewProp.nguoiTao.hoTen} ({selectedPreviewProp.nguoiTao.role})</span>
                </div>
                {selectedPreviewProp.nguoiDeXuatId !== selectedPreviewProp.nguoiTaoId && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Người đề xuất:</span>
                    <span className={styles.detailValue}>{selectedPreviewProp.nguoiDeXuat.tenNgan || selectedPreviewProp.nguoiDeXuat.hoTen} ({selectedPreviewProp.nguoiDeXuat.role})</span>
                  </div>
                )}
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
                  <span className={styles.detailValue} style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1.1rem' }}>{formatVND(selectedPreviewProp.soTien)}</span>
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

                {selectedPreviewProp.trangThai === 'HUY' && selectedPreviewProp.ghiChu ? (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Lý do từ chối:</span>
                    <span className={styles.detailValue} style={{
                      color: 'var(--danger)',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      display: 'block',
                      fontWeight: '600'
                    }}>
                      {selectedPreviewProp.ghiChu}
                    </span>
                  </div>
                ) : (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Nội dung CK:</span>
                    <span className={styles.detailValue}>{selectedPreviewProp.ghiChu || 'Không có ghi chú thêm.'}</span>
                  </div>
                )}

                {selectedPreviewProp.nhaCungCap && (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                    <span className={styles.detailLabel} style={{ color: 'var(--info)', fontWeight: 'bold' }}>THÔNG TIN THANH TOÁN (VIETQR ĐỘNG):</span>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1.5rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginTop: '0.5rem',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chủ tài khoản</div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>{selectedPreviewProp.nhaCungCap.tenTaiKhoan || selectedPreviewProp.nhaCungCap.tenNCC}</div>
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
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{selectedPreviewProp.nhaCungCap.tenNganHang}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tiền thanh toán</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1.1rem' }}>
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
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--info)', backgroundColor: 'var(--info-bg)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              {selectedPreviewProp.ghiChu || selectedPreviewProp.maPhieu}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedPreviewProp.ghiChu || selectedPreviewProp.maPhieu, 'memo')}
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
                          src={generateVietQRUrl(selectedPreviewProp.nhaCungCap, selectedPreviewProp.soTien, selectedPreviewProp.ghiChu || selectedPreviewProp.maPhieu)}
                          alt="Mã VietQR động chuyển khoản"
                          style={{ width: '130px', height: '130px', objectFit: 'contain' }}
                        />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold', textAlign: 'center' }}>
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
                      <DateInput
                        className="form-control form-control-sm"
                        style={{ width: '130px', display: 'inline-block' }}
                        value={selectedNgayGD[selectedPreviewProp.id] || todayStr}
                        onChange={(e) => setSelectedNgayGD({
                          ...selectedNgayGD,
                          [selectedPreviewProp.id]: e.target.value
                        })}
                        disabled={actionLoading}
                      />
                      <button
                        onClick={async () => {
                          const qId = selectedQuyId[selectedPreviewProp.id];
                          if (!qId) {
                            toast.error('Vui lòng chọn Quỹ thanh toán!');
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

      {/* CANCEL MODAL — Nhập lý do từ chối */}
      {cancelModal.open && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal({ open: false, id: '', maPhieu: '' })}>
          <div
            className={`${styles.modalContent} glass-card`}
            style={{ maxWidth: '480px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Từ chối / Hủy đề xuất {cancelModal.maPhieu}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Nhập lý do từ chối để người tạo phiếu biết lý do cụ thể. Bỏ trống nếu không muốn ghi lý do.
            </p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Lý do từ chối</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Ví dụ: Chi phí vượt hạn mức, thiếu chứng từ..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ resize: 'vertical' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {user?.role === 'OWNER' && (
                <button
                  className="btn btn-secondary"
                  onClick={handleDeleteProposal}
                  disabled={actionLoading}
                  style={{ marginRight: 'auto', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', fontWeight: '600' }}
                  title="Xóa hẳn dữ liệu khỏi hệ thống (chứng từ rác)"
                >
                  🗑 Xác nhận xóa
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setCancelModal({ open: false, id: '', maPhieu: '' })}
                disabled={actionLoading}
              >
                Quay lại
              </button>
              <button className="btn btn-danger" onClick={handleConfirmCancel} disabled={actionLoading}>
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DuyetPageWrapper() {
  return (
    <Suspense>
      <DuyetPage />
    </Suspense>
  );
}
