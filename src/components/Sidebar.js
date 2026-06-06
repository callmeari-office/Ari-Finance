'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  DollarSign,
  Wallet,
  LogOut,
  User,
  Menu,
  X,
  Settings,
  Lock,
  Users,
  BarChart3,
  Store,
  Bell,
  CalendarRange,
  TrendingUp,
  KeyRound,
  ScrollText,
  Scale,
  Repeat
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import PushToggle from './PushToggle';
import { canViewMenu } from '@/lib/roles';
import styles from './Sidebar.module.css';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [canhBaoCount, setCanhBaoCount] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) return;
    const fetchPending = async () => {
      try {
        // Chỉ gọi /api/canh-bao (đã trả sẵn pendingCount đếm nhẹ) — không kéo cả 1000 phiếu nữa.
        const resCb = await fetch('/api/canh-bao');
        if (resCb.ok) {
          const cb = await resCb.json();
          setPendingCount(cb.pendingCount || 0);
          setCanhBaoCount(cb.tongSo || 0);
        }
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    }
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  if (!user) return null;

  // Quyền hiển thị từng menu lấy từ canViewMenu (roles.js) — nguồn sự thật duy nhất:
  // OWNER full → permissions override (trang /quyen) → mặc định DEFAULT_MENU_ROLES.
  const menuItems = [
    { key: 'tongQuan', name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { key: 'deXuat', name: 'Đề xuất chi phí', path: '/de-xuat', icon: FileText },
    { key: 'duyet', name: 'Duyệt đề xuất', path: '/de-xuat/duyet', icon: CheckSquare },
    { key: 'thuChi', name: 'Giao dịch Thu - Chi', path: '/thu-chi', icon: DollarSign },
    { key: 'quy', name: 'Thông tin Quỹ', path: '/quy', icon: Wallet },
    { key: 'keHoach', name: 'Kế hoạch chi phí', path: '/ke-hoach', icon: CalendarRange },
    { key: 'doanhThu', name: 'Kế hoạch doanh thu', path: '/doanh-thu', icon: TrendingUp },
    { key: 'loiNhuan', name: 'Lợi nhuận (Lãi/Lỗ)', path: '/loi-nhuan', icon: Scale },
    { key: 'baoCao', name: 'Báo cáo Thu - Chi', path: '/bao-cao', icon: BarChart3 },
    { key: 'dinhKy', name: 'Chi phí định kỳ', path: '/dinh-ky', icon: Repeat },
    { key: 'nhanSu', name: 'Nhân sự', path: '/nhan-su', icon: Users },
    { key: 'ncc', name: 'Nhà cung cấp', path: '/ncc', icon: Store },
    { key: 'quyen', name: 'Quản lý Quyền', path: '/quyen', icon: Lock },
    { key: 'cauHinh', name: 'Cấu hình', path: '/cau-hinh', icon: Settings },
    { key: 'nhatKy', name: 'Nhật ký hệ thống', path: '/nhat-ky', icon: ScrollText },
  ];

  const allowedMenuItems = menuItems.filter((item) => canViewMenu(user, item.key));

  return (
    <>
      {/* Mobile Toggle Header */}
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.brand} onClick={() => setIsOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <div className={styles.brandText}>
            <span className={styles.appName}>ARI Finance</span>
            <span className={styles.appSub}>Quản lý tài chính</span>
          </div>
        </Link>
        <button onClick={toggleSidebar} className={styles.toggleBtn}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay on mobile */}
      {isOpen && <div className={styles.overlay} onClick={toggleSidebar}></div>}

      {/* Main Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.brand} onClick={() => setIsOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className={styles.logoImg} />
            <div className={styles.brandText}>
              <span className={styles.appName}>ARI Finance</span>
              <span className={styles.appSub}>Quản lý tài chính</span>
            </div>
          </Link>
          <span className={styles.subtitle}>Call Me Ari</span>
        </div>

        {/* User Card info */}
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            <User size={18} />
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user.tenNgan || user.hoTen}</p>
            <p className={styles.userRole}>
              {user.role === 'OWNER' ? 'Chủ shop (Owner)' : user.role === 'MANAGER' ? 'Quản lý (Manager)' : user.role === 'LEADER' ? 'Trưởng nhóm (Leader)' : 'Nhân viên (Staff)'}
            </p>
          </div>
          {(user.role === 'OWNER' || user.role === 'MANAGER') && (pendingCount + canhBaoCount) > 0 && (
            <Link href="/" style={{ position: 'relative', marginLeft: 'auto', color: 'var(--text-muted)' }} title={`${pendingCount} đề xuất chờ duyệt · ${canhBaoCount} cảnh báo cần chú ý`}>
              <Bell size={18} />
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: '#fff', borderRadius: '999px',
                fontSize: '0.65rem', fontWeight: '700', lineHeight: 1,
                padding: '2px 5px', minWidth: '16px', textAlign: 'center'
              }}>{pendingCount + canhBaoCount}</span>
            </Link>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={styles.navMenu}>
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={20} className={styles.navIcon} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout + Theme Section */}
        <div className={styles.sidebarFooter}>
          <Link
            href="/doi-mat-khau"
            className={`${styles.navItem} ${pathname === '/doi-mat-khau' ? styles.active : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <KeyRound size={20} className={styles.navIcon} />
            <span>Đổi mật khẩu</span>
          </Link>
          <ThemeToggle />
          {(user?.role === 'OWNER' || user?.role === 'MANAGER') && <PushToggle compact />}
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
