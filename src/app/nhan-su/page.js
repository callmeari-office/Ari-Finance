'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  AlertCircle,
  Key
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './nhan-su.module.css';

export default function NhanSuPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Personnel Data States
  const [employees, setEmployees] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPhongBan, setFilterPhongBan] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState('');

  // Form Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('ADD'); // 'ADD', 'EDIT', 'PASSWORD'
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Selected Employee for edit/password
  const [selectedEmp, setSelectedEmp] = useState(null);

  // Form Inputs
  const [hoTen, setHoTen] = useState('');
  const [tenNgan, setTenNgan] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('STAFF');
  const [viTri, setViTri] = useState('');
  const [phongBan, setPhongBan] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [trangThai, setTrangThai] = useState('ACTIVE');

  useEffect(() => {
    // 1. Check Auth & Role
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
          if (data.user.role !== 'OWNER') {
            alert('Bạn không có quyền truy cập trang quản lý nhân sự.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch personnel list
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
      const res = await fetch('/api/nhan-su');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (e) {
      console.error('Error fetching employees:', e);
    } finally {
      setDataLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormType('ADD');
    setSelectedEmp(null);
    setHoTen('');
    setTenNgan('');
    setUsername('');
    setEmail('');
    setPhone('');
    setRole('STAFF');
    setViTri('');
    setPhongBan('');
    setGhiChu('');
    setMatKhau('');
    setTrangThai('ACTIVE');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);

  };

  const handleOpenEdit = (emp) => {
    setFormType('EDIT');
    setSelectedEmp(emp);
    setHoTen(emp.hoTen);
    setTenNgan(emp.tenNgan || '');
    setUsername(emp.username);
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setRole(emp.role);
    setViTri(emp.viTri || '');
    setPhongBan(emp.phongBan || '');
    setGhiChu(emp.ghiChu || '');
    setMatKhau(''); // Không đổi mật khẩu tại đây
    setTrangThai(emp.trangThai);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);

  };

  const handleOpenPassword = (emp) => {
    setFormType('PASSWORD');
    setSelectedEmp(emp);
    setMatKhau('');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Validations
    if (formType === 'ADD' && (!hoTen || !username || !matKhau || !role)) {
      setFormError('Vui lòng nhập đầy đủ các thông tin bắt buộc (*).');
      return;
    }
    if (formType === 'EDIT' && (!hoTen || !role)) {
      setFormError('Vui lòng nhập họ tên và vai trò.');
      return;
    }
    if (formType === 'PASSWORD' && !matKhau) {
      setFormError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    setFormLoading(true);

    try {
      let url = '/api/nhan-su';
      let method = 'POST';
      let payload = {};

      if (formType === 'ADD') {
        payload = { hoTen, tenNgan, username, email, phone, role, viTri, phongBan, ghiChu, matKhau, trangThai };
      } else if (formType === 'EDIT') {
        url = `/api/nhan-su/${selectedEmp.id}`;
        method = 'PUT';
        payload = { hoTen, tenNgan, email, phone, phongBan, viTri, ghiChu, role, trangThai };
      } else if (formType === 'PASSWORD') {
        url = `/api/nhan-su/${selectedEmp.id}`;
        method = 'PUT';
        payload = { matKhau };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu nhân sự thất bại.');

      setFormSuccess(data.message || 'Lưu thành công!');
      fetchData(); // Reload table

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (emp) => {
    if (emp.id === user.id) {
      alert('Không thể tự xóa tài khoản của chính mình.');
      return;
    }

    const confirmMsg = `Bạn có chắc chắn muốn XÓA nhân viên "${emp.hoTen}" [${emp.id}]?\nCảnh báo: Hành động này có thể thất bại nếu tài khoản này có phiếu đề xuất chi đã lập trong lịch sử.`;
    if (confirm(confirmMsg)) {
      try {
        const res = await fetch(`/api/nhan-su/${emp.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Xóa thất bại.');

        alert(`Đã xóa nhân viên "${emp.hoTen}" thành công.`);
        fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Perform Client-side Filtering
  const filteredEmployees = employees.filter((emp) => {
    // 1. Text Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.hoTen.toLowerCase().includes(q);
      const matchTenNgan = emp.tenNgan && emp.tenNgan.toLowerCase().includes(q);
      const matchUser = emp.username.toLowerCase().includes(q);
      const matchId = emp.id.toLowerCase().includes(q);
      if (!matchName && !matchTenNgan && !matchUser && !matchId) return false;
    }

    // 2. Role Filter
    if (filterRole && emp.role !== filterRole) return false;

    // 3. Department (phongBan) Filter
    if (filterPhongBan && emp.phongBan !== filterPhongBan) return false;

    // 4. Status Filter
    if (filterTrangThai && emp.trangThai !== filterTrangThai) return false;

    return true;
  });

  // Extract unique departments for filter dropdown
  const departments = [...new Set(employees.map(e => e.phongBan).filter(Boolean))];

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang xác thực thông tin nhân sự...</p>
      </div>
    );
  }

  const getRoleBadgeClass = (r) => {
    switch (r) {
      case 'OWNER':
        return 'badge-cancelled'; // pink/red
      case 'MANAGER':
        return 'badge-pending'; // orange/brown
      case 'LEADER':
        return 'badge-paid'; // green
      case 'STAFF':
      default:
        return 'badge-reimburse'; // blue/ghi
    }
  };

  const getRoleText = (r) => {
    if (r === 'OWNER') return 'GIÁM ĐỐC';
    if (r === 'MANAGER') return 'QUẢN LÝ';
    if (r === 'LEADER') return 'TRƯỞNG NHÓM';
    return 'NHÂN VIÊN';
  };

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Quản Lý Nhân Sự</h1>
            <p className={styles.pageDesc}>Thiết lập thông tin tài khoản, phòng ban, vị trí và vai trò nhân viên shop</p>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <Plus size={20} />
            <span>Thêm Nhân Viên</span>
          </button>
        </div>

        {/* Filter Card */}
        <div className={styles.filterCard}>
          <div className={styles.filterGroup}>
            <div className={`${styles.filterItem} ${styles.searchIconWrapper}`} style={{ flex: 2 }}>
              <Search className={styles.searchIcon} size={16} />
              <input 
                type="text"
                placeholder="Tìm tên, username, mã nhân viên..."
                className="form-control searchInput"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className={styles.filterItem}>
              <select 
                className="form-control"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="">Tất cả quyền</option>
                <option value="OWNER">OWNER (Giám đốc)</option>
                <option value="MANAGER">MANAGER (Quản lý)</option>
                <option value="LEADER">LEADER (Trưởng nhóm)</option>
                <option value="STAFF">STAFF (Nhân viên)</option>
              </select>
            </div>

            <div className={styles.filterItem}>
              <select 
                className="form-control"
                value={filterPhongBan}
                onChange={(e) => setFilterPhongBan(e.target.value)}
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterItem}>
              <select 
                className="form-control"
                value={filterTrangThai}
                onChange={(e) => setFilterTrangThai(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">ACTIVE (Hoạt động)</option>
                <option value="INACTIVE">INACTIVE (Khóa)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className={styles.employeeTableCard}>
          {dataLoading ? (
            <div className={styles.emptyState}>Đang tải danh sách nhân sự...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className={styles.emptyState}>Không tìm thấy nhân viên nào phù hợp với bộ lọc.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Nhân viên</th>
                    <th>Tên viết tắt</th>
                    <th>Email</th>
                    <th>SĐT</th>
                    <th>Username</th>
                    <th>Quyền</th>
                    <th>Vị trí</th>
                    <th>Phòng ban</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 'bold', color: '#634d3e' }}>{emp.id}</td>
                      <td>
                        <span style={{ fontWeight: '600' }}>{emp.hoTen}</span>
                      </td>

                      <td style={{ fontWeight: '600', color: 'var(--brand-accent)' }}>{emp.tenNgan || '---'}</td>
                      <td>{emp.email}</td>
                      <td>{emp.phone || '---'}</td>
                      <td style={{ fontStyle: 'italic', fontWeight: '500' }}>{emp.username}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(emp.role)}`}>
                          {getRoleText(emp.role)}
                        </span>
                      </td>
                      <td>{emp.viTri || '---'}</td>
                      <td>{emp.phongBan || '---'}</td>
                      <td>
                        {emp.trangThai === 'ACTIVE' ? (
                          <span className="badge badge-paid" style={{ color: '#4b6656', background: 'var(--success-bg)' }}>Active</span>
                        ) : (
                          <span className="badge badge-cancelled" style={{ color: '#8c5353', background: 'var(--danger-bg)' }}>Inactive</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className={styles.actionButtons}>
                          <button 
                            onClick={() => handleOpenEdit(emp)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Sửa thông tin"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleOpenPassword(emp)}
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Đổi mật khẩu"
                            style={{ color: 'var(--warning)' }}
                          >
                            <Key size={15} />
                          </button>
                          {emp.id !== user.id && (
                            <button 
                               onClick={() => handleDelete(emp)}
                               className={`${styles.actionBtn} ${styles.deleteBtn}`}
                               title="Xóa nhân sự"
                            >
                              <Trash2 size={15} />
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

        {/* MODAL FORM: THÊM / SỬA / ĐỔI MẬT KHẨU */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-card`}>
              <div className={styles.modalHeader}>
                <h2>
                  {formType === 'ADD' && 'Thêm Nhân Viên Mới'}
                  {formType === 'EDIT' && `Cập nhật Nhân Viên: ${selectedEmp?.hoTen}`}
                  {formType === 'PASSWORD' && `Đổi Mật Khẩu: ${selectedEmp?.hoTen}`}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div className={`${styles.alert} ${styles.errorAlert}`}>
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className={`${styles.alert} ${styles.successAlert}`}>
                  <Check size={18} />
                  <span>{formSuccess}</span>
                </div>
              )}

              {formType === 'PASSWORD' ? (
                // FORM ĐỔI MẬT KHẨU
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className="form-group">
                    <label className="form-label">Mật khẩu mới *</label>
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu mới..."
                      className="form-control"
                      value={matKhau}
                      onChange={(e) => setMatKhau(e.target.value)}
                      disabled={formLoading}
                      required
                    />
                  </div>

                  <div className={styles.formActions}>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                      Hủy bỏ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                      {formLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                    </button>
                  </div>
                </form>
              ) : (
                // FORM THÊM MỚI HOẶC CẬP NHẬT THÔNG TIN
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Họ tên *</label>
                      <input 
                        type="text" 
                        placeholder="Nhập họ và tên..."
                        className="form-control"
                        value={hoTen}
                        onChange={(e) => setHoTen(e.target.value)}
                        disabled={formLoading}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Tên ngắn / Tên viết tắt</label>
                      <input 
                        type="text" 
                        placeholder="Ví dụ: Trúc Linh, Bảo Nam..."
                        className="form-control"
                        value={tenNgan}
                        onChange={(e) => setTenNgan(e.target.value)}
                        disabled={formLoading}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Tên đăng nhập (Username) *</label>
                      <input 
                        type="text" 
                        placeholder="Tên đăng nhập trơn..."
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={formLoading || formType === 'EDIT'}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Email liên hệ</label>
                      <input 
                        type="email" 
                        placeholder="email@demo.vn"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={formLoading}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Số điện thoại</label>
                      <input 
                        type="text" 
                        placeholder="Nhập số điện thoại..."
                        className="form-control"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={formLoading}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Vai Trò Hệ Thống *</label>
                      <select
                        className="form-control"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={formLoading || (selectedEmp?.id === user.id)} // Không tự giáng chức mình
                      >
                        <option value="STAFF">STAFF (Nhân viên)</option>
                        <option value="LEADER">LEADER (Trưởng nhóm)</option>
                        <option value="MANAGER">MANAGER (Quản lý)</option>
                        <option value="OWNER">OWNER (Giám đốc)</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Vị trí công việc</label>
                      <input 
                        type="text" 
                        placeholder="Ví dụ: Giám đốc, Kế toán..."
                        className="form-control"
                        value={viTri}
                        onChange={(e) => setViTri(e.target.value)}
                        disabled={formLoading}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Phòng ban</label>
                      <input 
                        type="text" 
                        placeholder="Ví dụ: KẾ TOÁN, FINANCE & IT..."
                        className="form-control"
                        value={phongBan}
                        onChange={(e) => setPhongBan(e.target.value)}
                        disabled={formLoading}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Trạng Thái</label>
                      <select
                        className="form-control"
                        value={trangThai}
                        onChange={(e) => setTrangThai(e.target.value)}
                        disabled={formLoading || (selectedEmp?.id === user.id)} // Không tự khóa mình
                      >
                        <option value="ACTIVE">Hoạt động (Active)</option>
                        <option value="INACTIVE">Khóa (Inactive)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      {formType === 'ADD' ? (
                        <>
                          <label className="form-label">Mật khẩu khởi tạo *</label>
                          <input 
                            type="password" 
                            placeholder="Nhập mật khẩu đăng nhập..."
                            className="form-control"
                            value={matKhau}
                            onChange={(e) => setMatKhau(e.target.value)}
                            disabled={formLoading}
                            required
                          />
                        </>
                      ) : (
                        <div style={{ visibility: 'hidden' }}>
                          <label className="form-label">Dãn cách</label>
                          <input className="form-control" disabled />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.formActions}>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={formLoading}>
                      Hủy bỏ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                      {formLoading ? 'Đang lưu...' : 'Lưu Nhân Viên'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
