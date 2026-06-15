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
  Repeat,
  AlertTriangle,
  Clock,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import PushToggle from './PushToggle';
import BottomNav from './BottomNav';
import { useConfirm } from './ConfirmDialog';
import { canViewMenu } from '@/lib/roles';
import { formatDate } from '@/lib/date';
import styles from './Sidebar.module.css';

const TAG_STYLE = {
  QUAN_TRONG: { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5', label: 'Quan trọng' },
  NHAC_NHO:   { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', label: 'Nhắc nhở' },
  THONG_BAO:  { bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc', label: 'Thông báo' },
};

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const showConfirm = useConfirm();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [tbList, setTbList] = useState([]);
  const [nhacHan, setNhacHan] = useState([]);
  const [hasQuanTrong, setHasQuanTrong] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const panelWrapRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      try {
        const promises = [fetch('/api/thong-bao-noi-bo')];
        if (user.role === 'OWNER' || user.role === 'MANAGER') {
          promises.push(fetch('/api/canh-bao'));
        }
        const [resTb, resCb] = await Promise.all(promises);
        if (resTb && resTb.ok) {
          const list = await resTb.json();
          setTbList(Array.isArray(list) ? list : []);
          setHasQuanTrong(Array.isArray(list) && list.some((t) => t.tag === 'QUAN_TRONG'));
        }
        if (resCb && resCb.ok) {
          const cb = await resCb.json();
          setPendingCount(cb.pendingCount || 0);
          setNhacHan(Array.isArray(cb.nhacHan) ? cb.nhacHan.slice(0, 5) : []);
        }
      } catch {}
    };
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close panel on click outside
  useEffect(() => {
    if (!showNotifPanel) return;
    const handleOutside = (e) => {
      if (panelWrapRef.current && !panelWrapRef.current.contains(e.target)) {
        setShowNotifPanel(false);
      }
    };
    // mousedown so it fires before click events bubble
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showNotifPanel]);

  const handleLogout = async () => {
    const ok = await showConfirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi Ari Finance?',
      confirmLabel: 'Đăng xuất',
      cancelLabel: 'Ở lại',
    });
    if (!ok) return;
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
      router.refresh();
    }
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  if (!user) return null;

  const isOwnerOrManager = user.role === 'OWNER' || user.role === 'MANAGER';
  const bellBadge = tbList.length + (isOwnerOrManager ? nhacHan.length : 0);
  const bellRed = hasQuanTrong || nhacHan.some((n) => n.quaHan);

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

  // BottomNav — primary 4 items + "Báo cáo" (fixed 5th slot)
  const PRIMARY_KEYS = ['tongQuan', 'deXuat', 'duyet', 'quy', 'loiNhuan'];
  const bnItems = [
    ...PRIMARY_KEYS
      .filter(key => allowedMenuItems.some(m => m.key === key))
      .slice(0, 4)
      .map(key => {
        const it = menuItems.find(m => m.key === key);
        const Icon = it.icon;
        const SHORT = {
          tongQuan: 'Tổng quan', deXuat: 'Đề xuất', duyet: 'Duyệt',
          quy: 'Quỹ', baoCao: 'Báo cáo', loiNhuan: 'Lợi nhuận',
        };
        return {
          key: it.key,
          label: SHORT[it.key] || it.name,
          icon: <Icon size={22} />,
          badge: it.key === 'duyet' && pendingCount > 0 ? pendingCount : undefined,
        };
      }),
    // Slot thứ 5: "Báo cáo" nếu có quyền, ngược lại "Khác" mở menu đầy đủ
    // (tránh đưa người dùng tới trang họ không được xem).
    allowedMenuItems.some((m) => m.key === 'baoCao')
      ? { key: 'baoCao', label: 'Báo cáo', icon: <BarChart3 size={22} /> }
      : { key: '__more', label: 'Khác', icon: <Menu size={22} /> },
  ];

  const activeBottomKey = (() => {
    if (pathname === '/') return 'tongQuan';
    if (pathname.startsWith('/de-xuat/duyet')) return 'duyet';
    if (pathname.startsWith('/de-xuat')) return 'deXuat';
    if (pathname.startsWith('/quy')) return 'quy';
    if (pathname.startsWith('/bao-cao')) return 'baoCao';
    if (pathname.startsWith('/loi-nhuan')) return 'loiNhuan';
    return '';
  })();

  return (
    <>
      {/* Mobile Toggle Header */}
      <header className={`${styles.mobileHeader} print-hide`}>
        <Link href="/" className={styles.brand} onClick={() => setIsOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
          <div className={styles.brandText}>
            <span className={styles.appName}>ARI Finance</span>
            <span className={styles.appSub}>Quản lý tài chính</span>
          </div>
        </Link>
        <div className={styles.mobileHeaderRight}>
          <button
            className={styles.mobileBell}
            onClick={() => {
              if (!isOpen) setIsOpen(true);
              setShowNotifPanel((v) => !v);
            }}
            title="Thông báo"
          >
            <Bell size={20} />
            {bellBadge > 0 && (
              <span className={`${styles.mobileBellBadge} ${bellRed ? styles.mobileBellBadgeRed : ''}`}>
                {bellBadge > 99 ? '99+' : bellBadge}
              </span>
            )}
          </button>
          <button onClick={toggleSidebar} className={styles.toggleBtn}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay on mobile */}
      {isOpen && <div className={styles.overlay} onClick={toggleSidebar}></div>}

      {/* Main Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''} print-hide`}>
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

        {/* User Card + Notification panel wrapper */}
        <div ref={panelWrapRef}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>
              <User size={18} />
            </div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user.tenNgan || user.hoTen}</p>
              <p className={styles.userRole}>
                {user.role === 'OWNER'
                  ? 'Chủ shop (Owner)'
                  : user.role === 'MANAGER'
                  ? 'Quản lý (Manager)'
                  : user.role === 'LEADER'
                  ? 'Trưởng nhóm (Leader)'
                  : 'Nhân viên (Staff)'}
              </p>
            </div>

            {/* Bell button */}
            <button
              onClick={() => setShowNotifPanel((v) => !v)}
              title="Thông báo"
              style={{
                position: 'relative',
                marginLeft: 'auto',
                background: showNotifPanel ? 'rgba(99,77,62,0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '5px',
                borderRadius: '8px',
                lineHeight: 0,
                flexShrink: 0,
              }}
            >
              <Bell size={18} />
              {bellBadge > 0 && (
                <span className={`${styles.bellBadge} ${bellRed ? styles.bellBadgeRed : ''}`}>
                  {bellBadge}
                </span>
              )}
            </button>
          </div>

          {/* Notification Panel */}
          {showNotifPanel && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                marginBottom: '0.75rem',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(99,77,62,0.12)',
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.875rem',
                  borderBottom: '1px solid var(--border)',
                  background: 'rgba(99,77,62,0.03)',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--brand-brown)' }}>
                  Thông báo hệ thống
                </span>
                <button
                  onClick={() => setShowNotifPanel(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    lineHeight: 0,
                    padding: '2px',
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* nhacHan items (OWNER/MANAGER) */}
              {isOwnerOrManager && nhacHan.length > 0 && (
                <>
                  {nhacHan.map((item) => (
                    <Link
                      key={item.id}
                      href={`/de-xuat/duyet`}
                      onClick={() => setShowNotifPanel(false)}
                      style={{
                        display: 'block',
                        padding: '0.625rem 0.875rem',
                        borderBottom: '1px solid var(--border)',
                        textDecoration: 'none',
                        background: item.quaHan ? 'rgba(239,68,68,0.03)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,77,62,0.04)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = item.quaHan
                          ? 'rgba(239,68,68,0.03)'
                          : 'transparent')
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ marginTop: '1px', flexShrink: 0 }}>
                          {item.quaHan ? (
                            <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />
                          ) : (
                            <Clock size={13} style={{ color: 'var(--warning)' }} />
                          )}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              marginBottom: '1px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                padding: '1px 5px',
                                borderRadius: '999px',
                                background: item.quaHan ? '#fef2f2' : '#fffbeb',
                                color: item.quaHan ? '#b91c1c' : '#92400e',
                                border: `1px solid ${item.quaHan ? '#fca5a5' : '#fcd34d'}`,
                                flexShrink: 0,
                              }}
                            >
                              {item.quaHan
                                ? `Quá hạn ${Math.abs(item.soNgay)} ngày`
                                : item.soNgay === 0
                                ? 'Hôm nay'
                                : `Còn ${item.soNgay} ngày`}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.78rem',
                              fontWeight: '600',
                              color: 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.maPhieu} — {item.noiDung}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {Number(item.soTien).toLocaleString('vi-VN')}đ
                            {item.nhaCungCap ? ` · ${item.nhaCungCap}` : ''}
                          </p>
                        </div>
                        <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {/* ThongBaoNoiBo items */}
              <div style={{ maxHeight: nhacHan.length > 0 ? '180px' : '260px', overflowY: 'auto' }}>
                {tbList.length === 0 && nhacHan.length === 0 ? (
                  <p
                    style={{
                      padding: '1rem 0.875rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      margin: 0,
                    }}
                  >
                    Không có thông báo nào
                  </p>
                ) : tbList.length > 0 ? (
                  tbList.map((tb) => {
                    const ts = TAG_STYLE[tb.tag] || TAG_STYLE.THONG_BAO;
                    return (
                      <div
                        key={tb.id}
                        style={{
                          padding: '0.625rem 0.875rem',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.2rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.6rem',
                              fontWeight: '700',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: ts.bg,
                              color: ts.color,
                              border: `1px solid ${ts.border}`,
                              flexShrink: 0,
                            }}
                          >
                            {ts.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              color: 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {tb.tieuDe}
                          </span>
                        </div>
                        {tb.noiDung && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                            }}
                          >
                            {tb.noiDung}
                          </p>
                        )}
                        {tb.hetHan && (
                          <span
                            style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}
                          >
                            Hết hạn:{' '}
                            {formatDate(tb.hetHan)}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : null}
              </div>

              {/* Footer: link to dashboard if there's anything */}
              {(tbList.length > 0 || nhacHan.length > 0) && (
                <Link
                  href="/"
                  onClick={() => setShowNotifPanel(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    borderTop: '1px solid var(--border)',
                    background: 'rgba(99,77,62,0.02)',
                  }}
                >
                  Xem tất cả ở Tổng quan
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={styles.navMenu}>
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            const showPending = item.key === 'duyet' && isOwnerOrManager && pendingCount > 0;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={20} className={styles.navIcon} />
                <span style={{ flex: 1 }}>{item.name}</span>
                {showPending && (
                  <span className={styles.navBadge}>{pendingCount}</span>
                )}
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
          <button
            type="button"
            className={styles.navItem}
            onClick={() => {
              setIsOpen(false);
              window.dispatchEvent(new CustomEvent('ari:show-onboarding', { detail: { role: user.role } }));
            }}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            <HelpCircle size={20} className={styles.navIcon} />
            <span>Xem lại hướng dẫn</span>
          </button>
          <ThemeToggle />
          {(user?.role === 'OWNER' || user?.role === 'MANAGER') && <PushToggle compact />}
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* BottomNav — chỉ hiển thị trên mobile (≤768px), xem BottomNav.module.css */}
      <BottomNav
        items={bnItems}
        value={activeBottomKey}
        onChange={(key) => {
          if (key === '__more') {
            setIsOpen(true);
            return;
          }
          const item = menuItems.find(m => m.key === key);
          if (item) {
            router.push(item.path);
            setIsOpen(false);
          }
        }}
      />
    </>
  );
}
