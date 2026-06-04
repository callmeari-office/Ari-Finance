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
  Edit3,
  Upload,
  Download,
  FileSpreadsheet
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
  const [filterThang, setFilterThang] = useState(String(new Date().getMonth() + 1));
  const [filterNam, setFilterNam] = useState(String(new Date().getFullYear()));
  const [filterDanhMuc, setFilterDanhMuc] = useState('');
  const [filterNguoiTao, setFilterNguoiTao] = useState('');
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
      'mb': 'mbb', 'mbbank': 'mbb', 'vpb': 'vpbank', 'hdb': 'hdbank',
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

  // Tính tổng chi tháng hiện tại cho danh mục đang chọn
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlySpentForCategory = danhMucId
    ? proposals
        .filter((p) => {
          if (p.danhMucId !== danhMucId) return false;
          if (p.trangThai === 'HUY') return false;
          const d = new Date(p.ngayPhatSinh);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.soTien, 0)
    : 0;

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
      const propRes = await fetch('/api/de-xuat?limit=1000');
      if (propRes.ok) {
        const propData = await propRes.json();
        setProposals(propData.data || []);
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

      // Fetch Banks for quick NCC dropdown
      const bankRes = await fetch('/api/ngan-hang');
      if (bankRes.ok) {
        const bankData = await bankRes.json();
        setBanks(bankData);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setDataLoading(false);
    }
  };

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
      alert(err.message);
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
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  // ===== IMPORT EXCEL (dữ liệu cũ) =====

  // Tải file Excel mẫu: 1 sheet dữ liệu + 1 sheet danh mục hợp lệ để tra cứu
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const headers = ['Ngày chi (dd/mm/yyyy)', 'Danh mục', 'Nội dung', 'Số tiền', 'Nhà cung cấp (nếu có)', 'Ghi chú (nếu có)'];
    const exampleRow = ['01/01/2025', categories[0]?.tenDanhMuc || 'Tên danh mục chi', 'Ví dụ: Mua văn phòng phẩm', 500000, '', ''];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];

    // Sheet phụ: danh sách danh mục CHI hợp lệ để copy cho đúng tên
    const dmSheet = XLSX.utils.aoa_to_sheet([
      ['DANH MỤC CHI HỢP LỆ (copy đúng tên vào cột "Danh mục")'],
      ...categories.map((c) => [c.tenDanhMuc]),
    ]);
    dmSheet['!cols'] = [{ wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Phiếu chi');
    XLSX.utils.book_append_sheet(wb, dmSheet, 'DanhMuc hợp lệ');
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
        ngay: findCol('ngày', 'ngay'),
        danhMuc: findCol('danh m'),
        noiDung: findCol('nội dung', 'noi dung'),
        soTien: findCol('số tiền', 'so tien', 'tiền'),
        ncc: findCol('cung cấp', 'cung cap', 'ncc'),
        ghiChu: findCol('ghi chú', 'ghi chu'),
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

        rows.push({
          ngayPhatSinh: parseDateCell(get(ci.ngay)),
          ngayGoc: String(get(ci.ngay)),
          danhMuc: String(get(ci.danhMuc) || '').trim(),
          noiDung: String(get(ci.noiDung) || '').trim(),
          soTien: Number.isFinite(soTien) ? soTien : 0,
          nhaCungCap: ci.ncc >= 0 ? String(get(ci.ncc) || '').trim() : '',
          ghiChu: ci.ghiChu >= 0 ? String(get(ci.ghiChu) || '').trim() : '',
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
  const availableYears = [...new Set(proposals.map(p => new Date(p.ngayPhatSinh).getFullYear()))].sort((a, b) => b - a);
  const availableCreators = [...new Map(proposals.map(p => [p.nguoiTao.id, p.nguoiTao])).values()];

  // Lọc dữ liệu hiển thị trên Client
  const filteredProposals = proposals.filter((p) => {
    if (filterTrangThai && p.trangThai !== filterTrangThai) return false;
    if (filterNguonTien && p.nguonTien !== filterNguonTien) return false;

    const propDate = new Date(p.ngayPhatSinh);
    if (filterThang && propDate.getMonth() + 1 !== Number(filterThang)) return false;
    if (filterNam && propDate.getFullYear() !== Number(filterNam)) return false;
    if (filterDanhMuc && p.danhMucId !== filterDanhMuc) return false;
    if (filterNguoiTao && p.nguoiTao.id !== filterNguoiTao) return false;

    // Tìm kiếm theo mã phiếu, nội dung, NCC
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const matchMa = p.maPhieu.toLowerCase().includes(q);
      const matchNoi = p.noiDung.toLowerCase().includes(q);
      const matchNcc = p.nhaCungCap?.tenNCC?.toLowerCase().includes(q);
      if (!matchMa && !matchNoi && !matchNcc) return false;
    }

    return true;
  });

  // Tổng kết phiếu đang hiển thị
  const tongTienHienThi = filteredProposals.reduce((sum, p) => sum + p.soTien, 0);

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
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {user.role === 'OWNER' && (
              <button onClick={() => setIsImportOpen(true)} className="btn btn-secondary" title="Nhập phiếu chi cũ từ file Excel">
                <Upload size={18} />
                <span>Nhập từ Excel</span>
              </button>
            )}
            <button onClick={handleOpenAdd} className="btn btn-primary">
              <PlusCircle size={20} />
              <span>Tạo đề xuất chi</span>
            </button>
          </div>
        </div>

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

          {/* Hàng 2: Các filter dropdown */}
          <div className={styles.filterGroup} style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className={styles.filterItem} style={{ minWidth: '180px', flex: 1 }}>
              <label className="form-label">Trạng thái</label>
              <select className="form-control" value={filterTrangThai} onChange={(e) => setFilterTrangThai(e.target.value)}>
                <option value="">-- Tất cả --</option>
                <option value="CHO_THANH_TOAN">Chờ thanh toán</option>
                <option value="CHO_HOAN_UNG">Chờ hoàn ứng</option>
                <option value="DA_THANH_TOAN">Đã thanh toán</option>
                <option value="HUY">Đã hủy</option>
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '160px', flex: 1 }}>
              <label className="form-label">Nguồn tiền</label>
              <select className="form-control" value={filterNguonTien} onChange={(e) => setFilterNguonTien(e.target.value)}>
                <option value="">-- Tất cả --</option>
                <option value="TIEN_SHOP">🏦 Tiền Shop</option>
                <option value="TIEN_CA_NHAN">👤 Cá nhân ứng</option>
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '100px', flex: '0 1 120px' }}>
              <label className="form-label">Năm</label>
              <select className="form-control" value={filterNam} onChange={(e) => setFilterNam(e.target.value)}>
                <option value="">Tất cả</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '100px', flex: '0 1 110px' }}>
              <label className="form-label">Tháng</label>
              <select className="form-control" value={filterThang} onChange={(e) => setFilterThang(e.target.value)}>
                <option value="">Tất cả</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem} style={{ minWidth: '180px', flex: 1 }}>
              <label className="form-label">Danh mục</label>
              <select className="form-control" value={filterDanhMuc} onChange={(e) => setFilterDanhMuc(e.target.value)}>
                <option value="">-- Tất cả --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.tenDanhMuc}</option>
                ))}
              </select>
            </div>

            {(user.role === 'OWNER' || user.role === 'MANAGER') && (
              <div className={styles.filterItem} style={{ minWidth: '180px', flex: 1 }}>
                <label className="form-label">Người đề xuất</label>
                <select className="form-control" value={filterNguoiTao} onChange={(e) => setFilterNguoiTao(e.target.value)}>
                  <option value="">-- Tất cả --</option>
                  {availableCreators.map((nv) => (
                    <option key={nv.id} value={nv.id}>{nv.tenNgan || nv.hoTen}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Proposals Table */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          {dataLoading ? (
            <div className={styles.loaderSmall}>Đang tải dữ liệu đề xuất...</div>
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
                  {filteredProposals.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontStyle: 'italic' }}>
                        Không tìm thấy đề xuất phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
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
                    <tr style={{ background: 'rgba(96,165,250,0.08)', borderTop: '2px solid rgba(96,165,250,0.3)' }}>
                      <td colSpan={5} style={{ fontWeight: '700', color: '#60a5fa', padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                        TỔNG: {filteredProposals.length} phiếu
                      </td>
                      <td style={{ fontWeight: '800', color: '#34d399', fontSize: '1rem', padding: '0.75rem 1rem' }}>
                        {formatVND(tongTienHienThi)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
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
                      <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: '#10b981', fontWeight: '600' }}>
                        = {Number(soTien).toLocaleString('vi-VN')} ₫
                      </div>
                    )}
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
                    <label className="form-label" htmlFor="ghiChu">
                      Nội dung CK {nhaCungCapId && <span style={{ color: '#ef4444' }}>*</span>}
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
                      <small style={{ color: '#f59e0b', marginTop: '0.25rem', display: 'block' }}>
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
              <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: '#60a5fa' }}>Cách dùng:</strong> Tải file mẫu → điền dữ liệu → tải file lên.
                Phiếu nhập sẽ ở trạng thái <strong style={{ color: '#34d399' }}>Đã thanh toán (Lịch sử)</strong>,
                <strong> không cần duyệt</strong> và <strong>không trừ số dư quỹ</strong>.
                Cột <em>Danh mục</em> phải khớp đúng tên danh mục CHI (xem sheet "DanhMuc hợp lệ" trong file mẫu).
              </div>

              <button type="button" onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ marginBottom: '1.25rem' }}>
                <Download size={18} />
                <span>Tải file Excel mẫu</span>
              </button>

              {/* Chọn file */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Chọn file Excel (.xlsx) đã điền</label>
                <label className={styles.uploadBox} style={{ cursor: 'pointer' }}>
                  <FileSpreadsheet size={28} style={{ color: '#34d399' }} />
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
                  <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    Xem trước: {importRows.length} dòng
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
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map((r, i) => {
                          const badDate = !r.ngayPhatSinh;
                          const badTien = !(r.soTien > 0);
                          return (
                            <tr key={i}>
                              <td style={{ color: badDate ? '#ef4444' : 'inherit' }}>{badDate ? `⚠️ ${r.ngayGoc || 'trống'}` : new Date(r.ngayPhatSinh).toLocaleDateString('vi-VN')}</td>
                              <td>{r.danhMuc || <span style={{ color: '#ef4444' }}>⚠️ trống</span>}</td>
                              <td style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.noiDung}>{r.noiDung || <span style={{ color: '#ef4444' }}>⚠️ trống</span>}</td>
                              <td style={{ color: badTien ? '#ef4444' : '#34d399', fontWeight: '600' }}>{badTien ? '⚠️ 0' : r.soTien.toLocaleString('vi-VN')}</td>
                              <td>{r.nhaCungCap || '—'}</td>
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
                      <div style={{ fontWeight: '700', color: '#f59e0b', marginBottom: '0.35rem' }}>
                        {importResult.errors.length} dòng bị bỏ qua do lỗi:
                      </div>
                      <div style={{ maxHeight: '180px', overflow: 'auto', fontSize: '0.82rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                        {importResult.errors.map((er, i) => (
                          <div key={i} style={{ color: '#fca5a5', padding: '0.15rem 0' }}>
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

                {selectedProp.trangThai === 'HUY' && selectedProp.ghiChu ? (
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Lý do hủy:</span>
                    <span className={styles.detailValue} style={{
                      color: '#ef4444',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
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
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chủ tài khoản</div>
                          <div style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.95rem' }}>{selectedProp.nhaCungCap.tenTaiKhoan || selectedProp.nhaCungCap.tenNCC}</div>
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

      {/* CANCEL MODAL — Nhập lý do hủy */}
      {cancelModal.open && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal({ open: false, id: '', maPhieu: '' })}>
          <div
            className={`${styles.modalContent} glass-card`}
            style={{ maxWidth: '480px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem', color: '#ef4444' }}>Hủy đề xuất {cancelModal.maPhieu}</h3>
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
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
