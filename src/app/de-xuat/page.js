'use client';
// Reverted VietQR quick transfer feature to restore clean codebase

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Edit3,
  Upload,
  Download,
  FileSpreadsheet,
  Rows3,
  Plus,
  CheckSquare
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import FilterDropdown from '@/components/FilterDropdown';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { canViewCategory, isRestrictedToOwnProposals } from '@/lib/roles';
import { formatDate, formatDateOrEmpty } from '@/lib/date';
import styles from './de-xuat.module.css';

function DeXuatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openHandledRef = useRef(false);
  const toast = useToast();
  const showConfirm = useConfirm();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [proposals, setProposals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [creators, setCreators] = useState([]); // Danh sách nhân viên làm bộ lọc
  const [dataLoading, setDataLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSum, setTotalSum] = useState(0);

  // Filter states (arrays = multi-select, string = single)
  const [filterTrangThai, setFilterTrangThai] = useState([]);
  const [filterNguonTien, setFilterNguonTien] = useState([]);
  const [filterThang, setFilterThang] = useState([String(new Date().getMonth() + 1)]);
  const [filterNam, setFilterNam] = useState(String(new Date().getFullYear()));
  const [filterDanhMuc, setFilterDanhMuc] = useState([]);
  const [filterNguoiTao, setFilterNguoiTao] = useState([]);
  const [filterSearch, setFilterSearch] = useState('');

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
  const [ngayCanThanhToan, setNgayCanThanhToan] = useState('');
  const [formType, setFormType] = useState('ADD'); // 'ADD' hoặc 'EDIT'
  const [editingId, setEditingId] = useState(null);

  // Ảnh hóa đơn đính kèm
  const [anhHoaDon, setAnhHoaDon] = useState('');
  const [anhLoading, setAnhLoading] = useState(false);

  // Quick NCC popup states
  const [isQuickNccOpen, setIsQuickNccOpen] = useState(false);
  const [quickTenNcc, setQuickTenNcc] = useState('');
  const [quickTenTaiKhoan, setQuickTenTaiKhoan] = useState('');
  const [quickSoTaiKhoan, setQuickSoTaiKhoan] = useState('');
  const [quickTenNganHang, setQuickTenNganHang] = useState('');
  const [quickError, setQuickError] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [banks, setBanks] = useState([]);

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState({ open: false, id: '', maPhieu: '' });
  const [cancelReason, setCancelReason] = useState('');

  // Detail Modal state
  const [selectedProp, setSelectedProp] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // Import Excel state (chỉ OWNER)
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);   // dữ liệu đã đọc từ file
  const [importFileName, setImportFileName] = useState('');
  const [importParseError, setImportParseError] = useState('');
  const [importResult, setImportResult] = useState(null); // kết quả từ server
  const [importLoading, setImportLoading] = useState(false);

  // Tạo nhiều phiếu cùng lúc (bulk)
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const [bulkRowErrors, setBulkRowErrors] = useState([]); // [{ dong, message }]
  const [bulkCommon, setBulkCommon] = useState({
    ngayPhatSinh: new Date().toISOString().split('T')[0],
    nguonTien: 'TIEN_SHOP',
    trangThai: 'CHO_THANH_TOAN',
    ngayCanThanhToan: '',
  });
  const [bulkRows, setBulkRows] = useState([]);

  // Duyệt nhanh (OWNER/MANAGER) ngay tại trang danh sách
  const [funds, setFunds] = useState([]);
  const [duyetModal, setDuyetModal] = useState({ open: false, id: '', maPhieu: '', soTien: 0, noiDung: '' });
  const [duyetQuyId, setDuyetQuyId] = useState('');
  const [duyetLoading, setDuyetLoading] = useState(false);

  const handleSoTienChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setSoTien(raw);
  };

  const formatSoTienDisplay = (raw) => {
    if (!raw) return '';
    const num = parseInt(raw, 10);
    return isNaN(num) ? '' : num.toLocaleString('vi-VN');
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


  // Lấy thông tin danh mục đang chọn
  const currentCategory = categories.find(c => c.id === danhMucId);

  // Dùng soTienDaThuong từ /api/danh-muc (tính trên toàn DB — đúng ngay cả khi phân trang)
  const monthlySpentForCategory = currentCategory?.soTienDaThuong || 0;

  const hanMucWarning = currentCategory?.hanMucThang
    ? monthlySpentForCategory >= currentCategory.hanMucThang * 0.8
    : false;
  const hanMucExceeded = currentCategory?.hanMucThang
    ? monthlySpentForCategory >= currentCategory.hanMucThang
    : false;

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
          // 2. Fetch danh mục, NCC, ngân hàng, nhân sự một lần
          fetchStaticData(data.user);
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

  const fetchData = async (currentUser, page = currentPage) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '20');
      if (filterTrangThai.length > 0) params.append('trangThai', filterTrangThai.join(','));
      if (filterNguonTien.length > 0) params.append('nguonTien', filterNguonTien.join(','));
      if (filterNam) params.append('nam', filterNam);
      if (filterThang.length > 0) params.append('thang', filterThang.join(','));
      if (filterDanhMuc.length > 0) params.append('danhMucId', filterDanhMuc.join(','));
      if (filterNguoiTao.length > 0) params.append('nguoiTaoId', filterNguoiTao.join(','));
      if (filterSearch) params.append('search', filterSearch);

      const propRes = await fetch(`/api/de-xuat?${params.toString()}`);
      if (propRes.ok) {
        const propData = await propRes.json();
        setProposals(propData.data || []);
        if (propData.pagination) {
          setTotalPages(propData.pagination.totalPages || 1);
          setTotalCount(propData.pagination.total || 0);
          setTotalSum(propData.pagination.totalSum || 0);
        }
      }
    } catch (e) {
      console.error('Error fetching proposals:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchStaticData = async (currentUser) => {
    try {
      // Fetch Categories
      const catRes = await fetch('/api/danh-muc');
      if (catRes.ok) {
        const catData = await catRes.json();
        const activeUser = currentUser || user;
        const userRole = activeUser ? activeUser.role : 'STAFF';

        const allowedCategories = catData.categories.filter(cat => {
          if (cat.loaiGiaoDich !== 'CHI') return false;
          try {
            const roles = JSON.parse(cat.chucVuDuocXem);
            return canViewCategory(userRole, roles);
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

      // Fetch Banks for quick NCC dropdown
      const bankRes = await fetch('/api/ngan-hang');
      if (bankRes.ok) {
        const bankData = await bankRes.json();
        setBanks(bankData);
      }

      // Fetch Creators (nhân viên) và Quỹ cho OWNER/MANAGER
      const activeUser = currentUser || user;
      if (activeUser && (activeUser.role === 'OWNER' || activeUser.role === 'MANAGER')) {
        const [creatorsRes, quyRes] = await Promise.all([
          fetch('/api/nhan-su'),
          fetch('/api/quy'),
        ]);
        if (creatorsRes.ok) {
          const creatorsData = await creatorsRes.json();
          setCreators(creatorsData || []);
        }
        if (quyRes.ok) {
          const quyData = await quyRes.json();
          setFunds(quyData || []);
          if (quyData?.length > 0) setDuyetQuyId(quyData[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching static data:', e);
    }
  };

  // Lấy proposals khi page thay đổi
  useEffect(() => {
    if (user) {
      fetchData(user, currentPage);
    }
  }, [currentPage, user]);

  // Reset page về 1 khi filters thay đổi
  useEffect(() => {
    if (user) {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchData(user, 1);
      }
    }
  }, [filterTrangThai, filterNguonTien, filterThang, filterNam, filterDanhMuc, filterNguoiTao, filterSearch]);

  // Deep-link: notification click với ?open=ID → tự mở modal xem nhanh phiếu đó
  useEffect(() => {
    if (dataLoading) return;
    if (openHandledRef.current) return;
    const openId = searchParams.get('open');
    if (!openId) return;
    openHandledRef.current = true;
    const target = proposals.find((p) => p.id === openId);
    if (target) {
      setSelectedProp(target);
      router.replace('/de-xuat');
    } else {
      // Phiếu không có trong trang hiện tại (khác tháng / đã lọc ra) → fetch riêng
      fetch(`/api/de-xuat/${openId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setSelectedProp(data);
            router.replace('/de-xuat');
          }
        })
        .catch(() => {});
    }
  }, [dataLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelProp = (id, maPhieu) => {
    setCancelReason('');
    setCancelModal({ open: true, id, maPhieu });
  };

  const handleConfirmCancel = async () => {
    const { id, maPhieu } = cancelModal;
    try {
      const res = await fetch(`/api/de-xuat/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'HUY', ghiChu: cancelReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hủy thất bại');

      setCancelModal({ open: false, id: '', maPhieu: '' });
      fetchData();
      if (selectedProp && selectedProp.id === id) {
        setSelectedProp(null);
      }
    } catch (err) {
      toast.error(err.message);
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
    try {
      const res = await fetch(`/api/de-xuat/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xóa thất bại');

      setCancelModal({ open: false, id: '', maPhieu: '' });
      fetchData();
      if (selectedProp && selectedProp.id === id) {
        setSelectedProp(null);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canEdit = (prop) => {
    if (!user) return false;
    if (user.role === 'OWNER') return true;
    if (isRestrictedToOwnProposals(user.role) && prop.nguoiTaoId !== user.id) return false;
    if (prop.trangThai === 'HUY') return false;
    if (prop.trangThai === 'DA_THANH_TOAN' && prop.thuChiId !== null) return false;
    return true;
  };

  const handleAnhHoaDonChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh (jpg, png, webp...).');
      return;
    }
    setAnhLoading(true);
    try {
      const { compressImage } = await import('@/lib/compressImage');
      const dataUrl = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.7 });

      const res = await fetch('/api/upload-anh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload ảnh thất bại.');
      setAnhHoaDon(data.url);
    } catch (err) {
      toast.error('Không thể tải ảnh lên: ' + err.message);
    } finally {
      setAnhLoading(false);
    }
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

  // ===== IMPORT EXCEL (dữ liệu cũ) =====

  // Tải file Excel mẫu: 1 sheet dữ liệu + 2 sheet tra cứu (danh mục + quỹ)
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');

    // Fetch danh sách quỹ ACTIVE để liệt kê trong sheet tra cứu
    let quyList = [];
    try {
      const quyRes = await fetch('/api/quy');
      if (quyRes.ok) {
        const quyData = await quyRes.json();
        quyList = (quyData || []).filter((q) => q.trangThai === 'ACTIVE' || !q.trangThai);
      }
    } catch (_) {}

    const headers = [
      'Ngày chi (dd/mm/yyyy)',
      'Danh mục',
      'Nội dung',
      'Số tiền',
      'Nhà cung cấp (nếu có)',
      'Ghi chú (nếu có)',
      'Ngày thanh toán (dd/mm/yyyy)',
      'Quỹ thanh toán',
    ];
    const exampleRow = [
      '01/01/2025',
      categories[0]?.tenDanhMuc || 'Tên danh mục chi',
      'Ví dụ: Mua văn phòng phẩm',
      500000,
      '',
      '',
      '',
      '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    ws['!cols'] = [
      { wch: 22 }, { wch: 24 }, { wch: 32 }, { wch: 14 },
      { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 22 },
    ];

    // Sheet phụ: danh mục CHI hợp lệ
    const dmSheet = XLSX.utils.aoa_to_sheet([
      ['DANH MỤC CHI HỢP LỆ (copy đúng tên vào cột "Danh mục")'],
      ...categories.map((c) => [c.tenDanhMuc]),
    ]);
    dmSheet['!cols'] = [{ wch: 40 }];

    // Sheet phụ: quỹ hợp lệ
    const quySheet = XLSX.utils.aoa_to_sheet([
      ['QUỸ HỢP LỆ (copy đúng tên vào cột "Quỹ thanh toán" — tùy chọn)'],
      ...quyList.map((q) => [q.tenQuy]),
    ]);
    quySheet['!cols'] = [{ wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Phiếu chi');
    XLSX.utils.book_append_sheet(wb, dmSheet, 'DanhMuc hợp lệ');
    XLSX.utils.book_append_sheet(wb, quySheet, 'Quy hợp lệ');
    XLSX.writeFile(wb, 'mau-nhap-phieu-chi-cu.xlsx');
  };

  // Chuyển 1 ô ngày (Date của Excel hoặc chuỗi dd/mm/yyyy) -> 'yyyy-mm-dd'
  const parseDateCell = (v) => {
    if (!v && v !== 0) return null;
    if (v instanceof Date && !isNaN(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    // dd/mm/yyyy hoặc dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // yyyy-mm-dd
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
    return null;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng file
    if (!file) return;

    setImportParseError('');
    setImportResult(null);
    setImportRows([]);
    setImportFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

      if (aoa.length < 2) {
        setImportParseError('File không có dòng dữ liệu nào (chỉ có tiêu đề).');
        return;
      }

      // Dò vị trí cột theo tiêu đề (linh hoạt thứ tự cột)
      const norm = (s) => String(s || '').trim().toLowerCase();
      const headers = (aoa[0] || []).map(norm);
      const findCol = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
      const ci = {
        ngay: findCol('ngày chi', 'ngay chi', 'ngày', 'ngay'),
        danhMuc: findCol('danh m'),
        noiDung: findCol('nội dung', 'noi dung'),
        soTien: findCol('số tiền', 'so tien', 'tiền'),
        ncc: findCol('cung cấp', 'cung cap', 'ncc'),
        ghiChu: findCol('ghi chú', 'ghi chu'),
        ngayTT: findCol('ngày thanh toán', 'ngay thanh toan', 'ngày tt', 'ngay tt'),
        tenQuy: findCol('quỹ thanh toán', 'quy thanh toan', 'quỹ', 'quy'),
      };

      if (ci.ngay < 0 || ci.danhMuc < 0 || ci.noiDung < 0 || ci.soTien < 0) {
        setImportParseError('File thiếu cột bắt buộc (Ngày chi / Danh mục / Nội dung / Số tiền). Hãy dùng đúng file mẫu.');
        return;
      }

      const rows = [];
      for (let i = 1; i < aoa.length; i++) {
        const r = aoa[i];
        const get = (idx) => (idx >= 0 ? r[idx] : '');
        const rawTien = get(ci.soTien);
        const soTien = typeof rawTien === 'number'
          ? rawTien
          : parseInt(String(rawTien).replace(/[^\d]/g, ''), 10);

        // Bỏ dòng hoàn toàn trống
        if (!get(ci.ngay) && !get(ci.danhMuc) && !get(ci.noiDung) && !rawTien) continue;

        const rawNgayTT = ci.ngayTT >= 0 ? get(ci.ngayTT) : '';
        const parsedNgayTT = rawNgayTT ? parseDateCell(rawNgayTT) : null;

        rows.push({
          ngayPhatSinh: parseDateCell(get(ci.ngay)),
          ngayGoc: String(get(ci.ngay)),
          danhMuc: String(get(ci.danhMuc) || '').trim(),
          noiDung: String(get(ci.noiDung) || '').trim(),
          soTien: Number.isFinite(soTien) ? soTien : 0,
          nhaCungCap: ci.ncc >= 0 ? String(get(ci.ncc) || '').trim() : '',
          ghiChu: ci.ghiChu >= 0 ? String(get(ci.ghiChu) || '').trim() : '',
          ngayThanhToan: parsedNgayTT,
          ngayTTGoc: rawNgayTT ? String(rawNgayTT) : '',
          tenQuy: ci.tenQuy >= 0 ? String(get(ci.tenQuy) || '').trim() : '',
        });
      }

      if (rows.length === 0) {
        setImportParseError('Không đọc được dòng dữ liệu hợp lệ nào.');
        return;
      }
      setImportRows(rows);
    } catch (err) {
      console.error(err);
      setImportParseError('Không đọc được file. Hãy chắc chắn đây là file Excel (.xlsx) đúng mẫu.');
    }
  };

  const handleSubmitImport = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/de-xuat/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json();
      setImportResult(data);
      if (res.ok && data.successCount > 0) {
        fetchData(); // tải lại danh sách
      }
    } catch (err) {
      setImportResult({ error: 'Lỗi kết nối khi gửi dữ liệu.' });
    } finally {
      setImportLoading(false);
    }
  };

  const closeImportModal = () => {
    setIsImportOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportParseError('');
    setImportResult(null);
  };

  // ===== TẠO NHIỀU PHIẾU CÙNG LÚC (BULK) =====

  const makeBulkRow = () => ({ danhMucId: '', noiDung: '', soTien: '', nhaCungCapId: '', ghiChu: '' });

  const handleOpenBulk = () => {
    setBulkError('');
    setBulkRowErrors([]);
    setBulkSuccess('');
    setBulkCommon({
      ngayPhatSinh: new Date().toISOString().split('T')[0],
      nguonTien: 'TIEN_SHOP',
      trangThai: 'CHO_THANH_TOAN',
      ngayCanThanhToan: '',
    });
    setBulkRows([makeBulkRow(), makeBulkRow(), makeBulkRow()]);
    setIsBulkOpen(true);
  };

  // ===== DUYỆT NHANH (OWNER/MANAGER) =====

  const handleOpenDuyet = (prop) => {
    setDuyetModal({ open: true, id: prop.id, maPhieu: prop.maPhieu, soTien: prop.soTien, noiDung: prop.noiDung });
  };

  const handleConfirmDuyet = async () => {
    if (!duyetQuyId) {
      toast.error('Vui lòng chọn Quỹ thanh toán.');
      return;
    }
    const ok = await showConfirm({
      message: `Duyệt thanh toán ${duyetModal.maPhieu} — ${duyetModal.soTien.toLocaleString('vi-VN')}₫?\nHành động này sẽ sinh phiếu Chi và thay đổi số dư quỹ.`,
      confirmLabel: 'Duyệt chi',
    });
    if (!ok) return;

    setDuyetLoading(true);
    try {
      const res = await fetch(`/api/de-xuat/${duyetModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUYET', quyThanhToanId: duyetQuyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duyệt thất bại.');
      toast.success(`Đã duyệt thanh toán thành công ${duyetModal.maPhieu}`);
      setDuyetModal({ open: false, id: '', maPhieu: '', soTien: 0, noiDung: '' });
      fetchData(user);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDuyetLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (totalCount === 0) return;
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('limit', '1000');
    if (filterTrangThai.length > 0) params.append('trangThai', filterTrangThai.join(','));
    if (filterNguonTien.length > 0) params.append('nguonTien', filterNguonTien.join(','));
    if (filterNam) params.append('nam', filterNam);
    if (filterThang.length > 0) params.append('thang', filterThang.join(','));
    if (filterDanhMuc.length > 0) params.append('danhMucId', filterDanhMuc.join(','));
    if (filterNguoiTao.length > 0) params.append('nguoiTaoId', filterNguoiTao.join(','));
    if (filterSearch) params.append('search', filterSearch);

    try {
      const res = await fetch(`/api/de-xuat?${params.toString()}`);
      if (!res.ok) { toast.error('Không thể tải dữ liệu để xuất.'); return; }
      const resp = await res.json();
      const all = resp.data || [];
      if (all.length === 0) { toast.info('Không có dữ liệu để xuất.'); return; }

      const XLSX = await import('xlsx');
      const TRANG_THAI_LABEL = {
        CHO_THANH_TOAN: 'Chờ thanh toán',
        CHO_HOAN_UNG: 'Chờ hoàn ứng',
        DA_THANH_TOAN: 'Đã thanh toán',
        HUY: 'Đã hủy',
      };

      const headers = [
        'Mã phiếu', 'Ngày phát sinh', 'Hạn thanh toán',
        'Người đề xuất', 'Danh mục', 'Nội dung',
        'Nhà cung cấp', 'Nguồn tiền', 'Trạng thái', 'Số tiền (VND)',
      ];

      const rows = all.map((p) => [
        p.maPhieu,
        formatDateOrEmpty(p.ngayPhatSinh),
        formatDateOrEmpty(p.ngayCanThanhToan),
        p.nguoiTao ? (p.nguoiTao.tenNgan || p.nguoiTao.hoTen) : '',
        p.danhMuc?.tenDanhMuc || '',
        p.noiDung || '',
        p.nhaCungCap?.tenNCC || '',
        p.nguonTien === 'TIEN_SHOP' ? 'Tiền shop' : 'Tiền cá nhân',
        TRANG_THAI_LABEL[p.trangThai] || p.trangThai,
        p.soTien,
      ]);

      const filterLabel = filterThang.length === 1
        ? `T${filterThang[0]}-${filterNam || new Date().getFullYear()}`
        : filterNam ? `Nam${filterNam}` : 'TatCa';

      const aoa = [
        headers,
        ...rows,
        [],
        [`TỔNG: ${resp.pagination.total} phiếu`, '', '', '', '', '', '', '', '', resp.pagination.totalSum],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
        { wch: 20 }, { wch: 36 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Đề xuất chi phí');
      const date = formatDate(new Date()).replace(/\//g, '-');
      XLSX.writeFile(wb, `DeXuatChiPhi_${filterLabel}_${date}.xlsx`);
    } catch {
      toast.error('Xuất Excel thất bại.');
    }
  };

  const handleBulkNguonTien = (val) => {
    setBulkCommon((prev) => ({
      ...prev,
      nguonTien: val,
      trangThai: val === 'TIEN_CA_NHAN' ? 'CHO_HOAN_UNG' : 'CHO_THANH_TOAN',
    }));
  };

  const updateBulkRow = (idx, field, value) => {
    setBulkRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const addBulkRow = () => setBulkRows((prev) => [...prev, makeBulkRow()]);
  const removeBulkRow = (idx) => setBulkRows((prev) => prev.filter((_, i) => i !== idx));

  // Các dòng "có nhập" (ít nhất 1 trong: danh mục / nội dung / số tiền)
  const filledBulkRows = bulkRows.filter((r) => r.danhMucId || r.noiDung.trim() || r.soTien);
  const bulkTongTien = bulkRows.reduce((s, r) => s + (Number(r.soTien) || 0), 0);

  const handleSubmitBulk = async () => {
    setBulkError('');
    setBulkRowErrors([]);
    setBulkSuccess('');

    if (filledBulkRows.length === 0) {
      setBulkError('Chưa nhập dòng nào. Hãy điền ít nhất 1 phiếu.');
      return;
    }

    // Validate phía client (đánh số theo các dòng có nhập)
    const rowErrors = [];
    filledBulkRows.forEach((r, i) => {
      const dong = i + 1;
      if (!r.danhMucId || !r.noiDung.trim() || !r.soTien || Number(r.soTien) <= 0) {
        rowErrors.push({ dong, message: 'Cần đủ Danh mục, Nội dung và Số tiền > 0.' });
        return;
      }
      const cat = categories.find((c) => c.id === r.danhMucId);
      if (cat?.yeuCauNCC && !r.nhaCungCapId) {
        rowErrors.push({ dong, message: `Danh mục "${cat.tenDanhMuc}" bắt buộc chọn NCC.` });
        return;
      }
      if (r.nhaCungCapId && !r.ghiChu.trim()) {
        rowErrors.push({ dong, message: 'Có NCC thì cần nhập Nội dung CK.' });
      }
    });
    if (rowErrors.length > 0) {
      setBulkRowErrors(rowErrors);
      setBulkError('Một số dòng chưa hợp lệ, vui lòng kiểm tra.');
      return;
    }

    const payloadRows = filledBulkRows.map((r) => ({
      ngayPhatSinh: bulkCommon.ngayPhatSinh,
      danhMucId: r.danhMucId,
      noiDung: r.noiDung,
      soTien: Number(r.soTien),
      nhaCungCapId: r.nhaCungCapId || null,
      nguonTien: bulkCommon.nguonTien,
      trangThai: bulkCommon.trangThai,
      ghiChu: r.ghiChu || null,
      ngayCanThanhToan: bulkCommon.ngayCanThanhToan || null,
    }));

    setBulkLoading(true);
    try {
      const res = await fetch('/api/de-xuat/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payloadRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkError(data.error || 'Tạo phiếu thất bại.');
        if (data.errors) setBulkRowErrors(data.errors);
        return;
      }
      setBulkSuccess(data.message || `Đã tạo ${data.successCount} phiếu.`);
      setTimeout(() => {
        setIsBulkOpen(false);
        setBulkSuccess('');
        fetchData();
      }, 1200);
    } catch {
      setBulkError('Lỗi kết nối khi gửi dữ liệu.');
    } finally {
      setBulkLoading(false);
    }
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

    if (nhaCungCapId && !ghiChu.trim()) {
      setFormError('Vui lòng nhập Nội dung CK khi chọn Nhà cung cấp (dùng làm nội dung chuyển khoản).');
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
          nguonTien,
          trangThai,
          ghiChu,
          ngayCanThanhToan: ngayCanThanhToan || null,
          anhHoaDon: anhHoaDon || null,
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

  // Tập hợp danh sách năm và người tạo từ data
  const availableYears = [2027, 2026, 2025, 2024];
  const availableCreators = creators;

  // Lọc dữ liệu hiển thị trên Client (Đã lọc ở Server, nên chỉ cần gán thẳng)
  const filteredProposals = proposals;

  // Tổng kết phiếu đang hiển thị
  const tongTienHienThi = totalSum;

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


  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Đề xuất chi phí</h1>
            <p className={styles.pageDesc}>
              {isRestrictedToOwnProposals(user.role)
                ? 'Quản lý và tạo mới các đề xuất chi tiêu cá nhân của bạn'
                : 'Xem danh sách và quản lý các đề xuất chi tiêu nội bộ của shop'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {totalCount > 0 && (
              <button onClick={handleExportExcel} className="btn btn-secondary" title="Xuất danh sách ra Excel">
                <Download size={18} />
                <span>Xuất Excel</span>
              </button>
            )}
            {user.role === 'OWNER' && (
              <button onClick={() => setIsImportOpen(true)} className="btn btn-secondary" title="Nhập phiếu chi cũ từ file Excel">
                <Upload size={18} />
                <span>Nhập từ Excel</span>
              </button>
            )}
            <button onClick={handleOpenBulk} className="btn btn-secondary" title="Tạo nhiều phiếu chi cùng lúc">
              <Rows3 size={18} />
              <span>Tạo nhiều phiếu</span>
            </button>
            <button onClick={handleOpenAdd} className="btn btn-primary">
              <PlusCircle size={20} />
              <span>Tạo đề xuất chi</span>
            </button>
          </div>
        </div>

        {/* Nút nổi "Tạo đề xuất" — chỉ hiện trên điện thoại, luôn trong tầm ngón tay */}
        <button onClick={handleOpenAdd} className={styles.fab} aria-label="Tạo đề xuất chi" title="Tạo đề xuất chi">
          <PlusCircle size={26} />
        </button>

        {/* Filter Section */}
        <div className={`${styles.filterCard} glass-card`}>
          {/* Hàng 1: Tìm kiếm nhanh */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Tìm kiếm nhanh</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Tìm theo mã phiếu, nội dung, tên NCC..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {/* Hàng 2: filter dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
            {/* Năm — dropdown đơn */}
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Năm</label>
              <select className="form-control" style={{ minWidth: '100px' }} value={filterNam} onChange={(e) => setFilterNam(e.target.value)}>
                <option value="">Tất cả</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <FilterDropdown
              label="Tháng"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }))}
              selected={filterThang}
              onChange={setFilterThang}
            />

            <FilterDropdown
              label="Trạng thái"
              options={[
                { value: 'CHO_THANH_TOAN', label: 'Chờ thanh toán' },
                { value: 'CHO_HOAN_UNG', label: 'Chờ hoàn ứng' },
                { value: 'DA_THANH_TOAN', label: 'Đã thanh toán' },
                { value: 'HUY', label: 'Đã hủy' },
              ]}
              selected={filterTrangThai}
              onChange={setFilterTrangThai}
            />

            <FilterDropdown
              label="Nguồn tiền"
              options={[
                { value: 'TIEN_SHOP', label: 'Tiền Shop' },
                { value: 'TIEN_CA_NHAN', label: 'Cá nhân ứng' },
              ]}
              selected={filterNguonTien}
              onChange={setFilterNguonTien}
            />

            <FilterDropdown
              label="Danh mục"
              options={categories.map((c) => ({ value: c.id, label: c.tenDanhMuc }))}
              selected={filterDanhMuc}
              onChange={setFilterDanhMuc}
            />

            {(user.role === 'OWNER' || user.role === 'MANAGER') && (
              <FilterDropdown
                label="Người đề xuất"
                options={availableCreators.map((nv) => ({ value: nv.id, label: nv.tenNgan || nv.hoTen }))}
                selected={filterNguoiTao}
                onChange={setFilterNguoiTao}
              />
            )}
          </div>
        </div>

        {/* Proposals Table */}
        <div style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.92rem', color: 'var(--text-muted)' }}>
          Tổng cộng cả kỳ: <strong style={{ color: 'var(--info)' }}>{totalCount}</strong> phiếu — <strong style={{ color: 'var(--success)' }}>{formatVND(totalSum)}</strong>
        </div>

        <div className="glass-card" style={{ marginTop: '0.5rem' }}>
          {dataLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton skeletonRow" />)}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className={`${styles.desktopTable} table-responsive`}>
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
                    {filteredProposals.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontStyle: 'italic' }}>
                          Không tìm thấy đề xuất phù hợp với bộ lọc.
                        </td>
                      </tr>
                    )}
                    {filteredProposals.map((prop) => (
                      <tr key={prop.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--info)' }}>{prop.maPhieu}</td>
                        <td suppressHydrationWarning>
                          {formatDate(prop.ngayPhatSinh)}
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
                            <span style={{ color: 'var(--info)', fontWeight: '500' }}>🏦 Tiền Shop</span>
                          ) : (
                            <span style={{ color: 'var(--success)', fontWeight: '500' }}>👤 Cá nhân ứng</span>
                          )}
                        </td>
                        <td style={{ fontWeight: '800', color: 'var(--text-main)' }}>{formatVND(prop.soTien)}</td>

                        <td>
                          {prop.trangThai === 'DA_THANH_TOAN' && prop.laLichSu && <span className="badge badge-paid" style={{ opacity: 0.85 }} title="Phiếu nhập từ dữ liệu cũ">Đã thanh toán (Lịch sử)</span>}
                          {prop.trangThai === 'DA_THANH_TOAN' && !prop.laLichSu && prop.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                          {prop.trangThai === 'DA_THANH_TOAN' && !prop.laLichSu && prop.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn (Chờ duyệt)</span>}
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

                            {/* Duyệt nhanh: OWNER/MANAGER, phiếu đang chờ */}
                            {(user.role === 'OWNER' || user.role === 'MANAGER') &&
                              (prop.trangThai === 'CHO_THANH_TOAN' || prop.trangThai === 'CHO_HOAN_UNG') && (
                              <button
                                onClick={() => handleOpenDuyet(prop)}
                                className={`${styles.actionBtn}`}
                                style={{ color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', background: 'var(--success-bg)' }}
                                title="Duyệt thanh toán"
                              >
                                <CheckSquare size={16} />
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
                  {filteredProposals.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'rgba(var(--primary-rgb),0.06)', borderTop: '2px solid var(--border)' }}>
                        <td colSpan={5} style={{ fontWeight: '700', color: 'var(--info)', padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                          TỔNG CẢ KỲ: {totalCount} phiếu
                        </td>
                        <td style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1rem', padding: '0.75rem 1rem' }}>
                          {formatVND(totalSum)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className={styles.mobileCards}>
                {filteredProposals.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: '2rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    Không tìm thấy đề xuất phù hợp với bộ lọc.
                  </div>
                ) : (
                  filteredProposals.map((prop) => (
                    <div key={prop.id} className={styles.mobileCard}>
                      <div className={styles.cardHeaderRow}>
                        <span className={styles.cardMaPhieu}>{prop.maPhieu}</span>
                        <span className={styles.cardDate}>{formatDate(prop.ngayPhatSinh)}</span>
                      </div>
                      <div className={styles.cardBodyRow}>
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Người đề xuất:</span>
                          <span className={styles.cardValue}>{prop.nguoiTao.tenNgan || prop.nguoiTao.hoTen}</span>
                        </div>
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Danh mục:</span>
                          <span className={styles.cardValue}>{prop.danhMuc.tenDanhMuc}</span>
                        </div>
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Nguồn tiền:</span>
                          <span className={styles.cardValue}>
                            {prop.nguonTien === 'TIEN_SHOP' ? '🏦 Tiền Shop' : '👤 Cá nhân ứng'}
                          </span>
                        </div>
                        <div className={styles.cardDetailItem}>
                          <span className={styles.cardLabel}>Nội dung:</span>
                          <span className={styles.cardValue} style={{ textAlign: 'right', maxWidth: '70%' }}>{prop.noiDung}</span>
                        </div>
                        <div className={styles.cardDetailItem} style={{ marginTop: '0.25rem' }}>
                          <span className={styles.cardLabel}>Số tiền:</span>
                          <span className={styles.cardAmount}>{formatVND(prop.soTien)}</span>
                        </div>
                      </div>
                      <div className={styles.cardFooterRow}>
                        <div>
                          {prop.trangThai === 'DA_THANH_TOAN' && prop.laLichSu && <span className="badge badge-paid" style={{ opacity: 0.85 }}>Lịch sử</span>}
                          {prop.trangThai === 'DA_THANH_TOAN' && !prop.laLichSu && prop.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                          {prop.trangThai === 'DA_THANH_TOAN' && !prop.laLichSu && prop.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn</span>}
                          {prop.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                          {prop.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                          {prop.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                        </div>
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
                          {(user.role === 'OWNER' || user.role === 'MANAGER') &&
                            (prop.trangThai === 'CHO_THANH_TOAN' || prop.trangThai === 'CHO_HOAN_UNG') && (
                            <button
                              onClick={() => handleOpenDuyet(prop)}
                              className={`${styles.actionBtn}`}
                              style={{ color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', background: 'var(--success-bg)' }}
                              title="Duyệt thanh toán"
                            >
                              <CheckSquare size={16} />
                            </button>
                          )}
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
                      </div>
                      {getDeadlineBadge(prop.ngayCanThanhToan, prop.trangThai)}
                    </div>
                  ))
                )}
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
                    Trang {currentPage} / {totalPages} (Tổng {totalCount} phiếu)
                  </span>
                </div>
              )}
            </>
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
                    {currentCategory?.hanMucThang && (
                      <small style={{
                        marginTop: '0.3rem', display: 'block',
                        color: hanMucExceeded ? '#ef4444' : hanMucWarning ? '#f59e0b' : 'var(--text-muted)',
                        fontWeight: hanMucWarning ? '600' : '400'
                      }}>
                        {hanMucExceeded ? '⚠️ Đã vượt hạn mức' : hanMucWarning ? '⚠️ Gần đạt hạn mức' : '✓ Trong hạn mức'} —
                        Đã dùng: {monthlySpentForCategory.toLocaleString('vi-VN')}₫ / {Number(currentCategory.hanMucThang).toLocaleString('vi-VN')}₫ tháng này
                      </small>
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="soTien">Số tiền (VND) *</label>
                    <input
                      id="soTien"
                      type="text"
                      inputMode="numeric"
                      placeholder="Nhập số tiền chi..."
                      className="form-control"
                      value={formatSoTienDisplay(soTien)}
                      onChange={handleSoTienChange}
                      required
                      disabled={formLoading}
                    />
                    {soTien && Number(soTien) > 0 && (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--success)', fontWeight: '600' }}>
                        = {Number(soTien).toLocaleString('vi-VN')} ₫
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" htmlFor="nhaCungCapId" style={{ margin: 0 }}>
                        Nhà cung cấp {currentCategory?.yeuCauNCC && <span style={{ color: 'var(--danger)' }}>*</span>}
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setIsQuickNccOpen(true)}
                        style={{ color: 'var(--info)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: 0 }}
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
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--info)' }}>
                              👉 <strong>{selVendor.tenNCC}</strong> | STK: <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fbbf24' }}>{selVendor.soTaiKhoan}</span> | {selVendor.tenNganHang}
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="ghiChu">
                      Nội dung CK {nhaCungCapId && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </label>
                    <input
                      id="ghiChu"
                      type="text"
                      placeholder={nhaCungCapId ? "Nhập nội dung chuyển khoản..." : "Nhập nội dung CK nếu cần..."}
                      className="form-control"
                      value={ghiChu}
                      onChange={(e) => setGhiChu(e.target.value)}
                      disabled={formLoading}
                      required={!!nhaCungCapId}
                    />
                    {nhaCungCapId && !ghiChu && (
                      <small style={{ color: 'var(--warning)', marginTop: '0.25rem', display: 'block' }}>
                        Nội dung này sẽ hiển thị khi quét QR chuyển khoản
                      </small>
                    )}
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

                {/* Upload ảnh hóa đơn */}
                <div className="form-group">
                  <label className="form-label">Ảnh hóa đơn / chứng từ (tùy chọn, tối đa 2 MB)</label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: '0.35rem', border: '1.5px dashed var(--border)', borderRadius: '10px',
                      padding: '0.75rem 1.25rem', cursor: 'pointer', fontSize: '0.82rem',
                      color: 'var(--text-muted)', minWidth: '120px', transition: 'border-color 0.15s',
                    }}>
                      <Upload size={20} style={{ color: 'var(--primary)' }} />
                      <span>{anhLoading ? 'Đang tải lên...' : 'Chọn ảnh'}</span>
                      <input type="file" accept="image/*" onChange={handleAnhHoaDonChange} style={{ display: 'none' }} disabled={formLoading || anhLoading} />
                    </label>
                    {anhHoaDon && (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={anhHoaDon} alt="Ảnh hóa đơn" style={{ height: '80px', width: 'auto', maxWidth: '140px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border)' }} />
                        <button
                          type="button"
                          onClick={() => setAnhHoaDon('')}
                          style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          title="Xóa ảnh"
                          disabled={formLoading}
                        >
                          <X size={12} color="#fff" />
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
                    {formLoading ? 'Đang lưu...' : formType === 'ADD' ? 'Gửi Đề xuất' : 'Lưu Thay Đổi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: TẠO NHIỀU PHIẾU CÙNG LÚC */}
        {isBulkOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.bulkContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Tạo nhiều phiếu chi cùng lúc</h2>
                <button onClick={() => setIsBulkOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {bulkError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={18} />
                  <span>{bulkError}</span>
                </div>
              )}
              {bulkSuccess && (
                <div className={styles.successAlert}>
                  <Check size={18} />
                  <span>{bulkSuccess}</span>
                </div>
              )}

              {/* Cài đặt chung — áp dụng cho tất cả các phiếu */}
              <div className={styles.bulkCommonBar}>
                <div className={styles.bulkCommonItem}>
                  <label className="form-label">Ngày phát sinh *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={bulkCommon.ngayPhatSinh}
                    onChange={(e) => setBulkCommon((p) => ({ ...p, ngayPhatSinh: e.target.value }))}
                    disabled={bulkLoading}
                  />
                </div>
                <div className={styles.bulkCommonItem}>
                  <label className="form-label">Nguồn tiền *</label>
                  <select
                    className="form-control"
                    value={bulkCommon.nguonTien}
                    onChange={(e) => handleBulkNguonTien(e.target.value)}
                    disabled={bulkLoading}
                  >
                    <option value="TIEN_SHOP">🏦 Tiền Shop</option>
                    <option value="TIEN_CA_NHAN">👤 Cá nhân ứng</option>
                  </select>
                </div>
                <div className={styles.bulkCommonItem}>
                  <label className="form-label">Trạng thái *</label>
                  <select
                    className="form-control"
                    value={bulkCommon.trangThai}
                    onChange={(e) => setBulkCommon((p) => ({ ...p, trangThai: e.target.value }))}
                    disabled={bulkLoading || bulkCommon.nguonTien === 'TIEN_CA_NHAN'}
                  >
                    {bulkCommon.nguonTien === 'TIEN_SHOP' ? (
                      <>
                        <option value="CHO_THANH_TOAN">Chờ thanh toán</option>
                        <option value="DA_THANH_TOAN">Đã thanh toán sẵn</option>
                      </>
                    ) : (
                      <option value="CHO_HOAN_UNG">Chờ hoàn ứng</option>
                    )}
                  </select>
                </div>
                <div className={styles.bulkCommonItem}>
                  <label className="form-label">Ngày cần thanh toán</label>
                  <input
                    type="date"
                    className="form-control"
                    value={bulkCommon.ngayCanThanhToan}
                    onChange={(e) => setBulkCommon((p) => ({ ...p, ngayCanThanhToan: e.target.value }))}
                    disabled={bulkLoading}
                  />
                </div>
              </div>

              {/* Danh sách lỗi từng dòng (nếu có) */}
              {bulkRowErrors.length > 0 && (
                <div style={{ marginBottom: '1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.5rem 0.75rem', maxHeight: '140px', overflow: 'auto' }}>
                  {bulkRowErrors.map((er, i) => (
                    <div key={i} className={styles.bulkRowError}>• Dòng {er.dong}: {er.message}</div>
                  ))}
                </div>
              )}

              {/* Bảng nhập theo dòng ngang */}
              <div className={styles.bulkTableWrap}>
                <table className={styles.bulkTable}>
                  <thead>
                    <tr>
                      <th className={styles.bulkIndex}>#</th>
                      <th style={{ minWidth: '170px' }}>Danh mục *</th>
                      <th style={{ minWidth: '200px' }}>Nội dung chi tiết *</th>
                      <th style={{ minWidth: '130px' }}>Số tiền *</th>
                      <th style={{ minWidth: '180px' }}>Nhà cung cấp</th>
                      <th style={{ minWidth: '160px' }}>Nội dung CK</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, idx) => {
                      const cat = categories.find((c) => c.id === r.danhMucId);
                      return (
                        <tr key={idx}>
                          <td className={styles.bulkIndex}>{idx + 1}</td>
                          <td>
                            <select
                              className="form-control"
                              value={r.danhMucId}
                              onChange={(e) => updateBulkRow(idx, 'danhMucId', e.target.value)}
                              disabled={bulkLoading}
                            >
                              <option value="">-- Chọn --</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.tenDanhMuc}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Mô tả lý do chi..."
                              value={r.noiDung}
                              onChange={(e) => updateBulkRow(idx, 'noiDung', e.target.value)}
                              disabled={bulkLoading}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-control"
                              placeholder="0"
                              style={{ textAlign: 'right' }}
                              value={formatSoTienDisplay(r.soTien)}
                              onChange={(e) => updateBulkRow(idx, 'soTien', e.target.value.replace(/\D/g, ''))}
                              disabled={bulkLoading}
                            />
                          </td>
                          <td>
                            <select
                              className="form-control"
                              value={r.nhaCungCapId}
                              onChange={(e) => updateBulkRow(idx, 'nhaCungCapId', e.target.value)}
                              disabled={bulkLoading}
                            >
                              <option value="">{cat?.yeuCauNCC ? '-- Bắt buộc --' : '-- Không --'}</option>
                              {vendors.map((v) => (
                                <option key={v.id} value={v.id}>{v.tenNCC} ({v.tenNganHang})</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              placeholder={r.nhaCungCapId ? 'Nội dung CK *' : '—'}
                              value={r.ghiChu}
                              onChange={(e) => updateBulkRow(idx, 'ghiChu', e.target.value)}
                              disabled={bulkLoading}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={styles.bulkDelBtn}
                              onClick={() => removeBulkRow(idx)}
                              disabled={bulkLoading || bulkRows.length <= 1}
                              title="Xóa dòng"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button type="button" onClick={addBulkRow} className="btn btn-secondary" disabled={bulkLoading} style={{ marginBottom: '1rem' }}>
                <Plus size={16} />
                <span>Thêm dòng</span>
              </button>

              <div className={styles.bulkFooter}>
                <div className={styles.bulkTotal}>
                  Tổng: <strong>{filledBulkRows.length} phiếu</strong> — <strong>{bulkTongTien.toLocaleString('vi-VN')} ₫</strong>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={() => setIsBulkOpen(false)} className="btn btn-secondary" disabled={bulkLoading}>
                  Hủy bỏ
                </button>
                <button type="button" onClick={handleSubmitBulk} className="btn btn-primary" disabled={bulkLoading || filledBulkRows.length === 0}>
                  {bulkLoading ? 'Đang tạo...' : `Tạo ${filledBulkRows.length} phiếu`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: NHẬP PHIẾU CHI CŨ TỪ EXCEL (chỉ OWNER) */}
        {isImportOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>Nhập phiếu chi cũ từ Excel</h2>
                <button onClick={closeImportModal} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {/* Hướng dẫn + tải mẫu */}
              <div style={{ background: 'var(--info-bg)', border: '1px solid rgba(96,165,250,0.18)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--info)' }}>Cách dùng:</strong> Tải file mẫu → điền dữ liệu → tải file lên.<br />
                Cột bắt buộc: <em>Ngày chi, Danh mục, Nội dung, Số tiền</em>.<br />
                Cột tùy chọn mới: <strong style={{ color: '#fbbf24' }}>Ngày thanh toán</strong> (phải cùng tháng ngày chi) và <strong style={{ color: 'var(--success)' }}>Quỹ thanh toán</strong> (nếu điền → tự tạo phiếu Thu-Chi và trừ số dư quỹ).<br />
                Nếu không điền Quỹ: phiếu ở trạng thái <strong>Đã thanh toán (Lịch sử)</strong>, <strong>không trừ số dư quỹ</strong>.
              </div>

              <button type="button" onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ marginBottom: '1.25rem' }}>
                <Download size={18} />
                <span>Tải file Excel mẫu</span>
              </button>

              {/* Chọn file */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Chọn file Excel (.xlsx) đã điền</label>
                <label className={styles.uploadBox} style={{ cursor: 'pointer' }}>
                  <FileSpreadsheet size={28} style={{ color: 'var(--success)' }} />
                  <span>{importFileName ? `📄 ${importFileName}` : 'Bấm để chọn file .xlsx / .xls'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                    disabled={importLoading}
                  />
                </label>
              </div>

              {importParseError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={18} />
                  <span>{importParseError}</span>
                </div>
              )}

              {/* Xem trước dữ liệu */}
              {importRows.length > 0 && !importResult && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>Xem trước: {importRows.length} dòng</span>
                    {importRows.filter((r) => r.tenQuy).length > 0 && (
                      <span style={{ fontSize: '0.78rem', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '4px', padding: '0.1rem 0.45rem', fontWeight: '600' }}>
                        ✓ {importRows.filter((r) => r.tenQuy).length} dòng sẽ tạo phiếu Thu-Chi
                      </span>
                    )}
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '260px', overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Danh mục</th>
                          <th>Nội dung</th>
                          <th>Số tiền</th>
                          <th>NCC</th>
                          <th>Ngày TT</th>
                          <th>Quỹ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map((r, i) => {
                          const badDate = !r.ngayPhatSinh;
                          const badTien = !(r.soTien > 0);
                          const badNgayTT = r.ngayTTGoc && !r.ngayThanhToan;
                          return (
                            <tr key={i} style={r.tenQuy ? { background: 'var(--success-bg)' } : {}}>
                              <td style={{ color: badDate ? '#ef4444' : 'inherit' }}>{badDate ? `⚠️ ${r.ngayGoc || 'trống'}` : formatDate(r.ngayPhatSinh)}</td>
                              <td>{r.danhMuc || <span style={{ color: 'var(--danger)' }}>⚠️ trống</span>}</td>
                              <td style={{ maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.noiDung}>{r.noiDung || <span style={{ color: 'var(--danger)' }}>⚠️ trống</span>}</td>
                              <td style={{ color: badTien ? '#ef4444' : '#34d399', fontWeight: '600' }}>{badTien ? '⚠️ 0' : r.soTien.toLocaleString('vi-VN')}</td>
                              <td>{r.nhaCungCap || '—'}</td>
                              <td style={{ color: badNgayTT ? '#ef4444' : 'inherit' }}>
                                {badNgayTT
                                  ? `⚠️ ${r.ngayTTGoc}`
                                  : r.ngayThanhToan
                                    ? formatDate(r.ngayThanhToan)
                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                              <td>
                                {r.tenQuy
                                  ? <span style={{ color: 'var(--success)', fontWeight: '600' }}>{r.tenQuy}</span>
                                  : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {importRows.length > 50 && (
                    <small style={{ color: 'var(--text-muted)' }}>...và {importRows.length - 50} dòng nữa. Hệ thống sẽ kiểm tra toàn bộ khi nhập.</small>
                  )}
                </div>
              )}

              {/* Kết quả nhập */}
              {importResult && (
                <div style={{ marginBottom: '1rem' }}>
                  {importResult.successCount > 0 && (
                    <div className={styles.successAlert}>
                      <Check size={18} />
                      <span>{importResult.message || `Đã nhập ${importResult.successCount} phiếu.`}</span>
                    </div>
                  )}
                  {importResult.error && importResult.successCount === undefined && (
                    <div className={styles.errorAlert} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={18} />
                        <span>{importResult.error}</span>
                      </div>
                      {importResult.detail && (
                        <small style={{ marginTop: '0.35rem', opacity: 0.85, wordBreak: 'break-word' }}>
                          Chi tiết: {importResult.detail}
                        </small>
                      )}
                    </div>
                  )}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: '700', color: 'var(--warning)', marginBottom: '0.35rem' }}>
                        {importResult.errors.length} dòng bị bỏ qua do lỗi:
                      </div>
                      <div style={{ maxHeight: '180px', overflow: 'auto', fontSize: '0.82rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                        {importResult.errors.map((er, i) => (
                          <div key={i} style={{ color: 'var(--alert-error-text)', padding: '0.15rem 0' }}>
                            • Dòng {er.dong}: {er.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.formActions}>
                <button type="button" onClick={closeImportModal} className="btn btn-secondary" disabled={importLoading}>
                  {importResult?.successCount > 0 ? 'Đóng' : 'Hủy bỏ'}
                </button>
                {importRows.length > 0 && !importResult && (
                  <button type="button" onClick={handleSubmitImport} className="btn btn-primary" disabled={importLoading}>
                    {importLoading ? 'Đang nhập...' : `Nhập ${importRows.length} dòng`}
                  </button>
                )}
              </div>
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
                  <span className={styles.detailValue} style={{ fontWeight: 'bold', color: 'var(--info)' }}>{selectedProp.maPhieu}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Ngày lập:</span>
                  <span className={styles.detailValue} suppressHydrationWarning>{formatDate(selectedProp.ngayPhatSinh)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Hạn thanh toán:</span>
                  <span className={styles.detailValue} style={{ color: selectedProp.ngayCanThanhToan ? '#fbbf24' : 'inherit', fontWeight: selectedProp.ngayCanThanhToan ? '600' : 'normal' }} suppressHydrationWarning>
                    {selectedProp.ngayCanThanhToan 
                      ? `📅 ${formatDate(selectedProp.ngayCanThanhToan)}` 
                      : 'Không có'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Người lập:</span>
                  <span className={styles.detailValue}>{selectedProp.nguoiTao.tenNgan || selectedProp.nguoiTao.hoTen} ({selectedProp.nguoiTao.role})</span>
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
                  <span className={styles.detailValue} style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1.1rem' }}>{formatVND(selectedProp.soTien)}</span>
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
                    {selectedProp.trangThai === 'DA_THANH_TOAN' && selectedProp.laLichSu && <span className="badge badge-paid" style={{ opacity: 0.85 }}>Đã thanh toán (Lịch sử)</span>}
                    {selectedProp.trangThai === 'DA_THANH_TOAN' && !selectedProp.laLichSu && selectedProp.thuChiId !== null && <span className="badge badge-paid">Đã thanh toán</span>}
                    {selectedProp.trangThai === 'DA_THANH_TOAN' && !selectedProp.laLichSu && selectedProp.thuChiId === null && <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Thanh toán sẵn (Chờ duyệt)</span>}
                    {selectedProp.trangThai === 'CHO_THANH_TOAN' && <span className="badge badge-pending">Chờ thanh toán</span>}
                    {selectedProp.trangThai === 'CHO_HOAN_UNG' && <span className="badge badge-reimburse">Chờ hoàn ứng</span>}
                    {selectedProp.trangThai === 'HUY' && <span className="badge badge-cancelled">Đã hủy</span>}
                  </span>
                </div>

                {selectedProp.trangThai === 'DA_THANH_TOAN' && selectedProp.laLichSu && (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Ghi chú hệ thống:</span>
                    <span className={styles.detailValue} style={{ color: '#a78bfa', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem', display: 'block' }}>
                      📜 Phiếu nhập từ dữ liệu cũ (lịch sử). Không tạo phiếu Thu-Chi và không ảnh hưởng số dư quỹ.
                    </span>
                  </div>
                )}

                {selectedProp.trangThai === 'DA_THANH_TOAN' && !selectedProp.laLichSu && (
                  <>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Người duyệt thanh toán:</span>
                      <span className={styles.detailValue}>{selectedProp.nguoiDuyet ? (selectedProp.nguoiDuyet.tenNgan || selectedProp.nguoiDuyet.hoTen) : 'Chủ shop'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Ngày duyệt chi:</span>
                      <span className={styles.detailValue} suppressHydrationWarning>{formatDate(selectedProp.ngayThanhToan)}</span>
                    </div>

                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Quỹ thanh toán:</span>
                      <span className={styles.detailValue} style={{ fontWeight: 'bold' }}>{selectedProp.quyThanhToan?.tenQuy || 'Quỹ của Shop'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Liên kết Phiếu Cashflow:</span>
                      <span className={styles.detailValue} style={{ fontWeight: 'bold', color: 'var(--success)' }}>{selectedProp.thuChiId ? 'Đã liên kết phiếu Thu-Chi' : 'Có lỗi dòng tiền'}</span>
                    </div>
                  </>
                )}

                {selectedProp.trangThai === 'HUY' && selectedProp.ghiChu ? (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Lý do hủy:</span>
                    <span className={styles.detailValue} style={{
                      color: 'var(--danger)',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      display: 'block',
                      fontWeight: '600'
                    }}>
                      {selectedProp.ghiChu}
                    </span>
                  </div>
                ) : (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Nội dung CK:</span>
                    <span className={styles.detailValue}>{selectedProp.ghiChu || 'Không có ghi chú thêm.'}</span>
                  </div>
                )}

                {selectedProp.nhaCungCap && (
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
                          <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>{selectedProp.nhaCungCap.tenTaiKhoan || selectedProp.nhaCungCap.tenNCC}</div>
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
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{selectedProp.nhaCungCap.tenNganHang}</div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Số tiền thanh toán</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <span style={{ fontWeight: '800', color: 'var(--success)', fontSize: '1.1rem' }}>
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
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--info)', backgroundColor: 'var(--info-bg)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              {selectedProp.ghiChu || selectedProp.maPhieu}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(selectedProp.ghiChu || selectedProp.maPhieu, 'memo')}
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
                          src={generateVietQRUrl(selectedProp.nhaCungCap, selectedProp.soTien, selectedProp.ghiChu || selectedProp.maPhieu)}
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

              {/* Ảnh hóa đơn nếu có */}
              {selectedProp.anhHoaDon && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Ảnh hóa đơn / chứng từ:
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProp.anhHoaDon}
                    alt="Ảnh hóa đơn"
                    style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                    onClick={() => {
                      const win = window.open();
                      if (win) {
                        win.document.write(`
                          <html>
                            <head>
                              <title>Xem ảnh hóa đơn - ${selectedProp.maPhieu}</title>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                              <style>
                                body {
                                  margin: 0;
                                  background-color: #1a1512;
                                  display: flex;
                                  flex-direction: column;
                                  justify-content: center;
                                  align-items: center;
                                  min-height: 100vh;
                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                                  color: #ece3da;
                                  cursor: pointer;
                                  user-select: none;
                                }
                                .container {
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  width: 100%;
                                  min-height: 100vh;
                                  padding: 16px;
                                  box-sizing: border-box;
                                }
                                img {
                                  max-width: 100%;
                                  max-height: 75vh;
                                  object-fit: contain;
                                  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                                  border-radius: 8px;
                                  margin-bottom: 20px;
                                }
                                .close-btn {
                                  background: #cf8d8d;
                                  color: #3e2723;
                                  border: none;
                                  padding: 12px 28px;
                                  border-radius: 999px;
                                  font-size: 15px;
                                  font-weight: bold;
                                  cursor: pointer;
                                  box-shadow: 0 4px 12px rgba(207, 141, 141, 0.2);
                                  transition: transform 0.1s;
                                }
                                .close-btn:active {
                                  transform: scale(0.95);
                                }
                                .tip {
                                  font-size: 11px;
                                  color: #a89c90;
                                  margin-top: 10px;
                                  opacity: 0.8;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="container" onclick="window.close()">
                                <img src="${selectedProp.anhHoaDon}" alt="Hóa đơn" onclick="event.stopPropagation()" />
                                <button class="close-btn" onclick="window.close()">Đóng ảnh</button>
                                <div class="tip">Chạm vùng trống bên ngoài ảnh để đóng nhanh</div>
                              </div>
                            </body>
                          </html>
                        `);
                        win.document.close();
                      }
                    }}
                    title="Bấm để xem ảnh đầy đủ"
                  />
                </div>
              )}

              <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
                {selectedProp.trangThai !== 'DA_THANH_TOAN' && selectedProp.trangThai !== 'HUY' && (
                  <button 
                    onClick={() => handleCancelProp(selectedProp.id, selectedProp.maPhieu)} 
                    className="btn btn-danger"
                  >
                    Hủy đề xuất này
                  </button>
                )}
                
                {/* OWNER/MANAGER: nút duyệt nhanh ngay tại popup chi tiết */}
                {(user.role === 'OWNER' || user.role === 'MANAGER') &&
                  (selectedProp.trangThai === 'CHO_THANH_TOAN' || selectedProp.trangThai === 'CHO_HOAN_UNG') && (
                  <button
                    onClick={() => {
                      const prop = selectedProp;
                      setSelectedProp(null);
                      handleOpenDuyet(prop);
                    }}
                    className="btn btn-primary"
                  >
                    <CheckSquare size={18} />
                    Duyệt thanh toán
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
                <label className="form-label">Tên chủ tài khoản ngân hàng</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nhập tên chủ TK (in hoa không dấu)..."
                  value={quickTenTaiKhoan}
                  onChange={(e) => setQuickTenTaiKhoan(e.target.value)}
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
                <select
                  className="form-control"
                  value={quickTenNganHang}
                  onChange={(e) => setQuickTenNganHang(e.target.value)}
                  disabled={quickLoading}
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  {banks.map((b) => (
                    <option key={b.tenVietTat} value={`${b.tenVietTat} - ${b.tenDayDu}`}>
                      {b.tenDayDu} - {b.tenVietTat}
                    </option>
                  ))}
                </select>
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
                          tenTaiKhoan: quickTenTaiKhoan || null,
                          soTaiKhoan: quickSoTaiKhoan,
                          tenNganHang: quickTenNganHang,
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
                      setQuickTenTaiKhoan('');
                      setQuickSoTaiKhoan('');
                      setQuickTenNganHang('');

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

      {/* MODAL DUYỆT NHANH — OWNER/MANAGER chọn quỹ và xác nhận */}
      {duyetModal.open && (
        <div className={styles.modalOverlay} onClick={() => setDuyetModal({ open: false, id: '', maPhieu: '', soTien: 0, noiDung: '' })}>
          <div
            className={`${styles.modalContent} glass-card`}
            style={{ maxWidth: '480px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader} style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ color: 'var(--success)' }}>Duyệt thanh toán {duyetModal.maPhieu}</h3>
              <button onClick={() => setDuyetModal({ open: false, id: '', maPhieu: '', soTien: 0, noiDung: '' })} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              <div><strong>Nội dung:</strong> {duyetModal.noiDung}</div>
              <div style={{ marginTop: '0.4rem' }}><strong>Số tiền:</strong> <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.05rem' }}>{duyetModal.soTien.toLocaleString('vi-VN')} ₫</span></div>
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Chọn Quỹ thanh toán *</label>
              <select
                className="form-control"
                value={duyetQuyId}
                onChange={(e) => setDuyetQuyId(e.target.value)}
                disabled={duyetLoading}
              >
                <option value="">-- Chọn quỹ --</option>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>{f.tenQuy}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDuyetModal({ open: false, id: '', maPhieu: '', soTien: 0, noiDung: '' })}
                disabled={duyetLoading}
              >
                Hủy bỏ
              </button>
              <button className="btn btn-primary" onClick={handleConfirmDuyet} disabled={duyetLoading || !duyetQuyId}>
                {duyetLoading ? 'Đang duyệt...' : 'Xác nhận duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL — Nhập lý do hủy */}
      {cancelModal.open && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal({ open: false, id: '', maPhieu: '' })}>
          <div
            className={`${styles.modalContent} glass-card`}
            style={{ maxWidth: '480px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Hủy đề xuất {cancelModal.maPhieu}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Nhập lý do hủy để người tạo phiếu biết lý do cụ thể. Bỏ trống nếu không muốn ghi lý do.
            </p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Lý do hủy</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Ví dụ: Chi phí vượt hạn mức, chưa đủ chứng từ..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ resize: 'vertical' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              {user?.role === 'OWNER' && proposals.find((p) => p.id === cancelModal.id)?.thuChiId == null && (
                <button
                  className="btn btn-secondary"
                  onClick={handleDeleteProposal}
                  style={{ marginRight: 'auto', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', fontWeight: '600' }}
                  title="Xóa hẳn dữ liệu khỏi hệ thống (chứng từ rác)"
                >
                  🗑 Xác nhận xóa
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setCancelModal({ open: false, id: '', maPhieu: '' })}
              >
                Quay lại
              </button>
              <button className="btn btn-danger" onClick={handleConfirmCancel}>
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeXuatPageWrapper() {
  return (
    <Suspense>
      <DeXuatPage />
    </Suspense>
  );
}
