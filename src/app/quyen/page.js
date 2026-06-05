'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  Shield, 
  Check, 
  AlertCircle,
  Users,
  Settings,
  ArrowRight,
  Info,
  LayoutDashboard,
  FileText,
  CheckSquare,
  DollarSign,
  Wallet
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { defaultMenuAllowed } from '@/lib/roles';
import styles from './quyen.module.css';

export default function QuyenPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core States
  const [rolesQuyens, setRolesQuyens] = useState([]);
  const [nhanViens, setNhanViens] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Active Selected Role
  const [activeRole, setActiveRole] = useState('MANAGER'); // Mặc định Sales Admin

  // Menu checked states for the active role
  const [menuPermissions, setMenuPermissions] = useState({
    tongQuan: true,
    deXuat: true,
    duyet: false,
    thuChi: false,
    quy: false,
    keHoach: false,
    doanhThu: false,
    loiNhuan: false,
    baoCao: false,
    ncc: true,
    nhanSu: false,
    quyen: false,
    cauHinh: false
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Define actual system menus mapping
  const systemMenus = [
    { key: 'tongQuan', name: 'Tổng quan (Dashboard)', path: '/', desc: 'Xem biểu đồ tổng kết doanh số, chi phí và trạng thái shop' },
    { key: 'deXuat', name: 'Đề xuất chi phí', path: '/de-xuat', desc: 'Lập, quản lý và theo dõi các đề xuất chi tiêu nội bộ' },
    { key: 'duyet', name: 'Duyệt đề xuất', path: '/de-xuat/duyet', desc: 'Chủ shop duyệt chi tiền mặt (TH1) hoặc hoàn ứng gộp (TH3)' },
    { key: 'thuChi', name: 'Giao dịch Thu - Chi', path: '/thu-chi', desc: 'Lớp ghi nhận dòng tiền thực tế tác động trực tiếp vào các quỹ' },
    { key: 'quy', name: 'Thông tin Quỹ', path: '/quy', desc: 'Theo dõi số dư realtime chi tiết của các quỹ tiền' },
    { key: 'keHoach', name: 'Kế hoạch chi phí', path: '/ke-hoach', desc: 'Lập kế hoạch chi phí cả năm theo danh mục và so sánh với thực tế' },
    { key: 'doanhThu', name: 'Kế hoạch doanh thu', path: '/doanh-thu', desc: 'Lập chỉ tiêu & nhập doanh thu thực tế theo kênh bán, xem Dashboard so sánh' },
    { key: 'doanhThuDBThang', name: '↳ Doanh thu · Dashboard Tháng', path: '/doanh-thu', desc: 'Cho phép xem tab "DB Tháng" trong Kế hoạch doanh thu (chỉ hiệu lực khi đã bật xem Kế hoạch doanh thu)', sub: true },
    { key: 'doanhThuDBNam', name: '↳ Doanh thu · Dashboard Năm', path: '/doanh-thu', desc: 'Cho phép xem tab "DB Năm" trong Kế hoạch doanh thu (chỉ hiệu lực khi đã bật xem Kế hoạch doanh thu)', sub: true },
    { key: 'loiNhuan', name: 'Lợi nhuận (Lãi/Lỗ)', path: '/loi-nhuan', desc: 'Xem lãi/lỗ theo tháng (Doanh thu − Chi phí), biểu đồ xu hướng và đối chiếu kế hoạch' },
    { key: 'baoCao', name: 'Báo cáo Thu - Chi', path: '/bao-cao', desc: 'Xem phân tích doanh thu, cơ cấu chi phí và đối soát thu chi của shop' },
    { key: 'dinhKy', name: 'Chi phí định kỳ', path: '/dinh-ky', desc: 'Quản lý mẫu phiếu chi lặp lại hàng tháng (thuê mặt bằng, dịch vụ...)' },
    { key: 'ncc', name: 'Nhà cung cấp', path: '/ncc', desc: 'Quản lý danh sách nhà cung cấp, tài khoản ngân hàng và mã QR' },
    { key: 'nhanSu', name: 'Nhân sự', path: '/nhan-su', desc: 'Quản lý tài khoản, thêm nhân viên, đổi mật khẩu và cấp role' },
    { key: 'quyen', name: 'Quản lý Quyền', path: '/quyen', desc: 'Cấu hình ẩn/hiện các menu hệ thống theo từng vai trò' },
    { key: 'cauHinh', name: 'Cấu hình', path: '/cau-hinh', desc: 'Thiết lập danh mục Thu-Chi, nhóm chi phí và phân quyền' },
  ];

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
            alert('Bạn không có quyền truy cập trang phân quyền hệ thống.');
            router.push('/');
            return;
          }
          setUser(data.user);
          setLoading(false);
          // 2. Fetch permissions & personnel
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
      // Fetch permissions
      const pRes = await fetch('/api/quyen');
      let loadedRoles = [];
      if (pRes.ok) {
        loadedRoles = await pRes.json();
        setRolesQuyens(loadedRoles);
      }

      // Fetch users to show counts
      const uRes = await fetch('/api/nhan-su');
      if (uRes.ok) {
        const uData = await uRes.json();
        setNhanViens(uData);
      }

      // Sync menuPermissions state for selected role
      const currentRole = loadedRoles.find(r => r.role === activeRole);
      if (currentRole) {
        try {
          const parsed = JSON.parse(currentRole.permissions);
          // Map dynamic permissions to our flat structure
          const mappedPerms = {};
          systemMenus.forEach(menu => {
            // Check flat key first, or look for old structure properties
            if (typeof parsed[menu.key] === 'boolean') {
              mappedPerms[menu.key] = parsed[menu.key];
            } else if (parsed[menu.key] && typeof parsed[menu.key].xem === 'boolean') {
              mappedPerms[menu.key] = parsed[menu.key].xem;
            } else {
              // Không có override -> dùng mặc định theo vai trò (khớp với Sidebar)
              mappedPerms[menu.key] = defaultMenuAllowed(activeRole, menu.key);
            }
          });
          setMenuPermissions(mappedPerms);
        } catch(e) {
          console.error('Error parsing permissions:', e);
        }
      }
    } catch (e) {
      console.error('Error loading permissions:', e);
    } finally {
      setDataLoading(false);
    }
  };

  // Sync menu checked state when active role changes
  useEffect(() => {
    if (rolesQuyens.length > 0) {
      const currentRole = rolesQuyens.find(r => r.role === activeRole);
      if (currentRole) {
        try {
          const parsed = JSON.parse(currentRole.permissions);
          const mappedPerms = {};
          systemMenus.forEach(menu => {
            if (typeof parsed[menu.key] === 'boolean') {
              mappedPerms[menu.key] = parsed[menu.key];
            } else if (parsed[menu.key] && typeof parsed[menu.key].xem === 'boolean') {
              mappedPerms[menu.key] = parsed[menu.key].xem;
            } else {
              // Không có override -> dùng mặc định theo vai trò (khớp với Sidebar)
              mappedPerms[menu.key] = defaultMenuAllowed(activeRole, menu.key);
            }
          });
          setMenuPermissions(mappedPerms);
        } catch(e) {
          // Set defaults
          const defaults = {};
          systemMenus.forEach(m => {
            defaults[m.key] = defaultMenuAllowed(activeRole, m.key);
          });
          setMenuPermissions(defaults);
        }
      }
    }
  }, [activeRole, rolesQuyens]);

  // Toggle switch/checkbox state
  const handleToggleMenu = (menuKey) => {
    setMenuPermissions(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const handleSavePermissions = async () => {
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);

    try {
      const res = await fetch('/api/quyen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: activeRole,
          permissions: menuPermissions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu phân quyền thất bại.');

      setFormSuccess(`Đã lưu cấu hình phân quyền vai trò ${activeRole} thành công! Sidebar sẽ tự động điều chỉnh hiển thị.`);
      
      // Update local rolesQuyens state
      setRolesQuyens(prev => {
        return prev.map(r => {
          if (r.role === activeRole) {
            return {
              ...r,
              permissions: JSON.stringify(menuPermissions)
            };
          }
          return r;
        });
      });

      // Reload window after short timeout so Sidebar updates in-place if they edited their own role
      if (activeRole === user.role) {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch(err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const countRoleUsers = (role) => {
    return nhanViens.filter(u => u.role === role).length;
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang tải thông tin phân quyền...</p>
      </div>
    );
  }

  // Visual text helper for roles
  const getRoleMeta = (role) => {
    switch (role) {
      case 'OWNER':
        return {
          title: 'Giám đốc (OWNER)',
          desc: 'Quản trị viên tối cao, toàn quyền hệ thống',
        };
      case 'MANAGER':
        return {
          title: 'Sales Admin (MANAGER)',
          desc: 'Quản lý bán hàng, kế toán trưởng',
        };
      case 'LEADER':
        return {
          title: 'Trưởng nhóm (LEADER)',
          desc: 'Trưởng nhóm tác nghiệp — quyền cơ sở giống Nhân viên, có thể nâng thêm',
        };
      case 'STAFF':
      default:
        return {
          title: 'Nhân viên kế toán / Tác nghiệp (STAFF)',
          desc: 'Tác nghiệp lập đề xuất chi, làm báo cáo',
        };
    }
  };

  const activeMeta = getRoleMeta(activeRole);

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1>Quản Lý Quyền Hệ Thống</h1>
            <p className={styles.pageDesc}>Thiết lập quyền truy cập / hiển thị các Menu tính năng thực tế cho từng vai trò</p>
          </div>
        </div>

        {dataLoading ? (
          <div className={styles.loaderContainer} style={{ minHeight: '300px' }}>
            <div className={styles.spinner}></div>
            <p>Đang tải cấu hình...</p>
          </div>
        ) : (
          <div className={styles.splitLayout}>
            {/* LEFT COLUMN: ROLE SELECTION */}
            <div className={styles.leftPanel}>
              <div className={styles.panelTitle}>
                <Users size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--primary)' }} />
                <span>Vai Trò Hệ Thống</span>
              </div>
              
              <div className={styles.roleList}>
                {rolesQuyens.map((rq) => {
                  const meta = getRoleMeta(rq.role);
                  const isActive = activeRole === rq.role;
                  return (
                    <div 
                      key={rq.role} 
                      className={`${styles.roleItem} ${isActive ? styles.activeRole : ''}`}
                      onClick={() => setActiveRole(rq.role)}
                    >
                      <div>
                        <p className={styles.roleName}>{meta.title}</p>
                        <p className={styles.roleDesc}>{meta.desc}</p>
                      </div>
                      <span className={styles.roleCountBadge}>{countRoleUsers(rq.role)} NV</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: SIMPLE MENU CHECKLIST */}
            <div className={styles.rightPanel}>
              <div className={styles.rightHeader}>
                <div>
                  <h2 className={styles.selectedRoleTitle}>{activeMeta.title}</h2>
                  <p className={styles.selectedRoleDesc}>Bật/tắt các Menu hiển thị tương ứng ở thanh Sidebar</p>
                </div>
                <button 
                  onClick={handleSavePermissions} 
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  <Check size={18} />
                  <span>{formLoading ? 'Đang lưu...' : 'Lưu Phân Quyền'}</span>
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

              <div className="table-responsive">
                <table className={styles.matrixTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Tên Menu</th>
                      <th style={{ width: '20%' }}>Đường Dẫn</th>
                      <th style={{ width: '35%' }}>Mô Tả Tính Năng</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>Trạng Thái Hiển Thị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemMenus.map((menu) => {
                      const isAllowed = menuPermissions[menu.key] || false;
                      return (
                        <tr key={menu.key}>
                          <td style={{ fontWeight: menu.sub ? 500 : 'bold', color: menu.sub ? 'var(--text-muted)' : 'var(--brand-brown)', paddingLeft: menu.sub ? '1.75rem' : undefined, fontSize: menu.sub ? '0.9rem' : undefined }}>{menu.name}</td>
                          <td>
                            <code style={{ background: 'rgba(99, 77, 62, 0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                              {menu.path}
                            </code>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{menu.desc}</td>
                          <td style={{ textAlign: 'center' }}>
                            <label className={styles.switchToggle}>
                              <input 
                                type="checkbox"
                                checked={isAllowed}
                                onChange={() => handleToggleMenu(menu.key)}
                                disabled={activeRole === 'OWNER'} // Khóa phân quyền Owner vì Owner luôn full quyền
                              />
                              <span className={styles.slider}></span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(99,77,62,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Lưu ý:</strong> Quyền của Giám đốc (OWNER) được giữ cố định hiển thị tất cả các Menu để đảm bảo tính toàn vẹn của hệ thống quản trị.
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
