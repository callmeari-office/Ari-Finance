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
  CalendarRange
} from 'lucide-react';
import { useState, useEffect } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) return;
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/de-xuat?limit=1000');
        if (!res.ok) return;
        const data = await res.json();
        const count = (data.data || []).filter(
          (p) => p.trangThai === 'CHO_THANH_TOAN' || p.trangThai === 'CHO_HOAN_UNG'
        ).length;
        setPendingCount(count);
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

  const menuItems = [
    {
      key: 'tongQuan',
      name: 'Tổng quan',
      path: '/',
      icon: LayoutDashboard,
      roles: ['OWNER', 'MANAGER', 'STAFF'],
    },
    {
      key: 'deXuat',
      name: 'Đề xuất chi phí',
      path: '/de-xuat',
      icon: FileText,
      roles: ['OWNER', 'MANAGER', 'STAFF'],
    },
    {
      key: 'duyet',
      name: 'Duyệt đề xuất',
      path: '/de-xuat/duyet',
      icon: CheckSquare,
      roles: ['OWNER'],
    },
    {
      key: 'thuChi',
      name: 'Giao dịch Thu - Chi',
      path: '/thu-chi',
      icon: DollarSign,
      roles: ['OWNER'],
    },
    {
      key: 'quy',
      name: 'Thông tin Quỹ',
      path: '/quy',
      icon: Wallet,
      roles: ['OWNER'],
    },
    {
      key: 'keHoach',
      name: 'Kế hoạch chi phí',
      path: '/ke-hoach',
      icon: CalendarRange,
      roles: ['OWNER', 'MANAGER'],
    },
    {
      key: 'baoCao',
      name: 'Báo cáo Thu - Chi',
      path: '/bao-cao',
      icon: BarChart3,
      roles: ['OWNER'],
    },
    {
      key: 'nhanSu',
      name: 'Nhân sự',
      path: '/nhan-su',
      icon: Users,
      roles: ['OWNER'],
    },
    {
      key: 'ncc',
      name: 'Nhà cung cấp',
      path: '/ncc',
      icon: Store,
      roles: ['OWNER', 'MANAGER', 'STAFF'],
    },
    {
      key: 'quyen',
      name: 'Quản lý Quyền',
      path: '/quyen',
      icon: Lock,
      roles: ['OWNER'],
    },
    {
      key: 'cauHinh',
      name: 'Cấu hình',
      path: '/cau-hinh',
      icon: Settings,
      roles: ['OWNER'],
    },
  ];

  const allowedMenuItems = menuItems.filter(item => {
    if (user.permissions && typeof user.permissions[item.key] !== 'undefined') {
      return !!user.permissions[item.key];
    }
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Toggle Header */}
      <header className={styles.mobileHeader}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <div className={styles.brandText}>
            <span className={styles.appName}>Ari-Finance</span>
            <span className={styles.appSub}>Quản lý thu chi</span>
          </div>
        </div>
        <button onClick={toggleSidebar} className={styles.toggleBtn}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay on mobile */}
      {isOpen && <div className={styles.overlay} onClick={toggleSidebar}></div>}

      {/* Main Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className={styles.logoImg} />
            <div className={styles.brandText}>
              <span className={styles.appName}>Ari-Finance</span>
              <span className={styles.appSub}>Quản lý thu chi</span>
            </div>
          </div>
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
              {user.role === 'OWNER' ? 'Chủ shop (Owner)' : user.role === 'MANAGER' ? 'Quản lý (Manager)' : 'Nhân viên (Staff)'}
            </p>
          </div>
          {(user.role === 'OWNER' || user.role === 'MANAGER') && pendingCount > 0 && (
            <Link href="/de-xuat/duyet" style={{ position: 'relative', marginLeft: 'auto', color: 'var(--text-muted)' }} title={`${pendingCount} đề xuất chờ duyệt`}>
              <Bell size={18} />
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: '#fff', borderRadius: '999px',
                fontSize: '0.65rem', fontWeight: '700', lineHeight: 1,
                padding: '2px 5px', minWidth: '16px', textAlign: 'center'
              }}>{pendingCount}</span>
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

        {/* Logout Section */}
        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
