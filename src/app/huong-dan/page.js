'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  RefreshCw,
  LogIn,
  FilePlus2,
  Bell,
  ChevronRight,
  CheckSquare,
  BarChart3,
  Wallet,
  Building2,
  HandCoins,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import styles from './huong-dan.module.css';

// Chip trạng thái — dùng biến semantic để đúng cả 3 theme
function StatusChip({ type, children }) {
  const map = {
    success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
    info: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  };
  const c = map[type] || map.info;
  return (
    <span className={styles.statusChip} style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
}

function Arrow() {
  return (
    <span className={styles.statusArrow} aria-hidden="true">
      <ChevronRight size={16} />
    </span>
  );
}

export default function HuongDanPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const replayTour = () => {
    window.dispatchEvent(
      new CustomEvent('ari:show-onboarding', { detail: { role: user?.role } })
    );
  };

  if (loading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}></div>
        <p>Đang mở hướng dẫn...</p>
      </div>
    );
  }

  const isOwnerManager = user.role === 'OWNER' || user.role === 'MANAGER';

  return (
    <div className="layout-wrapper">
      <Sidebar user={user} />

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              <BookOpen size={26} /> Hướng dẫn sử dụng
            </h1>
            <p className={styles.pageDesc}>Vài phút để bạn dùng app thật thoải mái — cứ từ từ nhé.</p>
          </div>
          <button onClick={replayTour} className={`btn btn-secondary ${styles.replayBtn}`}>
            <RefreshCw size={16} />
            <span>Xem lại tour chào mừng</span>
          </button>
        </div>

        {/* ===== Mục 1: Bắt đầu nhanh ===== */}
        <section className={`glass-card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>1</span> Bắt đầu nhanh
          </h2>
          <p className={styles.lead}>Chỉ ba bước là bạn đã quen tay với Ari Finance.</p>
          <div className={styles.flowRow}>
            <div className={styles.flowStep}>
              <span className={styles.flowIcon}><LogIn size={22} /></span>
              <span className={styles.flowLabel}>Đăng nhập bằng tài khoản được cấp</span>
            </div>
            <div className={styles.flowArrow} aria-hidden="true"><ChevronRight size={20} /></div>
            <div className={styles.flowStep}>
              <span className={styles.flowIcon}><FilePlus2 size={22} /></span>
              <span className={styles.flowLabel}>Tạo đề xuất chi phí khi cần chi tiền</span>
            </div>
            <div className={styles.flowArrow} aria-hidden="true"><ChevronRight size={20} /></div>
            <div className={styles.flowStep}>
              <span className={styles.flowIcon}><Bell size={22} /></span>
              <span className={styles.flowLabel}>Theo dõi phiếu & nhận thông báo</span>
            </div>
          </div>
        </section>

        {/* ===== Mục 2: Tạo đề xuất & trạng thái phiếu ===== */}
        <section className={`glass-card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>2</span> Cách tạo đề xuất & hiểu trạng thái phiếu
          </h2>
          <p className={styles.lead}>
            Bấm nút <strong>“Tạo đề xuất chi phí”</strong> ở Trang chủ (hoặc nút tròn hồng góc dưới khi dùng điện thoại), rồi làm theo các bước:
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepText}>Chọn <strong>“Ai trả khoản này?”</strong> (xem giải thích bên dưới).</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepText}>Nhập <strong>danh mục</strong>, <strong>số tiền</strong> và <strong>nội dung chi</strong>. Số tiền sẽ được đọc thành chữ để bạn kiểm tra cho chắc.</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepText}>Ari hỏi lại bằng lời dễ hiểu để bạn <strong>xác nhận</strong> rồi mới gửi. Không lo bấm nhầm.</span>
            </div>
          </div>

          {/* Khối "Ai trả khoản này?" — theo ý bổ sung của chủ shop */}
          <div className={styles.payerGuide}>
            <div className={styles.payerItem}>
              <div className={styles.payerHead}><Building2 size={17} /> Shop trả</div>
              <div className={styles.payerFlow}>
                Shop sẽ chi khoản này. Phiếu vào trạng thái <strong>Chờ thanh toán</strong> → quản lý duyệt → <strong>Đã chi</strong>.
              </div>
            </div>
            <div className={styles.payerItem}>
              <div className={styles.payerHead}><Wallet size={17} /> Shop đã trả rồi</div>
              <div className={styles.payerFlow}>
                Khoản này shop đã trả, bạn chỉ ghi nhận lại. Phiếu là <strong>Đã thanh toán sẵn</strong>, chờ quản lý duyệt để vào sổ.
              </div>
            </div>
            <div className={styles.payerItem}>
              <div className={styles.payerHead}><HandCoins size={17} /> Mình ứng trước</div>
              <div className={styles.payerFlow}>
                Bạn bỏ tiền túi trả trước. Phiếu vào trạng thái <strong>Chờ hoàn ứng</strong> → quản lý duyệt → <strong>Đã hoàn ứng cho bạn</strong>.
              </div>
            </div>
          </div>

          {/* Sơ đồ luồng trạng thái */}
          <div className={styles.statusFlow}>
            <StatusChip type="success">Đã gửi</StatusChip>
            <Arrow />
            <StatusChip type="warning">Chờ duyệt</StatusChip>
            <Arrow />
            <StatusChip type="info">Đã duyệt</StatusChip>
            <Arrow />
            <StatusChip type="success">Đã chi / Đã hoàn ứng</StatusChip>
          </div>

          <div className={styles.noteBox}>
            <AlertTriangle size={18} />
            <span>Cứ yên tâm thao tác: trước mỗi lần gửi đều có bước xác nhận. Nếu có hóa đơn, chụp rõ và đính kèm để quản lý duyệt nhanh hơn.</span>
          </div>

          <div className={styles.imgSlot}>
            <ImageIcon size={22} />
            <span className={styles.imgSlotHint}>Ảnh minh họa màn tạo phiếu (có thể bổ sung sau)</span>
          </div>
        </section>

        {/* ===== Mục 3: Duyệt & báo cáo (chỉ chủ shop / quản lý) ===== */}
        {isOwnerManager && (
          <section className={`glass-card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>3</span> Duyệt phiếu & xem báo cáo
              <span className={styles.sectionBadge}>Chủ shop / Quản lý</span>
            </h2>
            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepNum}><CheckSquare size={14} /></span>
                <span className={styles.stepText}>Vào <strong>Duyệt đề xuất</strong>: tích chọn các phiếu rồi duyệt; hệ thống tự sinh phiếu chi và cập nhật số dư quỹ.</span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}><Wallet size={14} /></span>
                <span className={styles.stepText}>Vào <strong>Thông tin Quỹ</strong> để xem số dư từng quỹ theo thời gian thực.</span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}><BarChart3 size={14} /></span>
                <span className={styles.stepText}>Vào <strong>Báo cáo</strong> và <strong>Lợi nhuận</strong> để xem thu-chi và lãi/lỗ theo tháng.</span>
              </div>
            </div>
            <div className={styles.noteBox}>
              <AlertTriangle size={18} />
              <span>Chuông 🔔 và khối “Cần xử lý” ở Trang chủ gom các phiếu chờ duyệt và nhắc hạn thanh toán — ghé thường xuyên để không bỏ sót.</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
