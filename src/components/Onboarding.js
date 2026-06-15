'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FileText, Bell, ShieldCheck, Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import AriCameo from './AriCameo';
import styles from './Onboarding.module.css';

const STORAGE_KEY = 'ari-onboarding-v1';

// Các trang KHÔNG hiện onboarding (chưa đăng nhập / màn xác thực)
const HIDDEN_PATHS = ['/login', '/dat-lai-mat-khau', '/doi-mat-khau'];

function buildSteps(role) {
  const laNhanVien = role === 'STAFF' || role === 'LEADER';

  const welcome = {
    icon: <Sparkles size={26} />,
    title: 'Chào bạn, Ari đây!',
    body: laNhanVien
      ? 'Đây là nơi bạn gửi đề xuất chi phí cho shop. Ari đã làm mọi thứ thật gọn — bạn chỉ cần vài bước là xong. Để Ari dẫn bạn đi một vòng nhanh nhé.'
      : 'Đây là góc tài chính của Call Me Ari — đề xuất, duyệt chi, theo dõi quỹ và lãi/lỗ. Để Ari dẫn bạn đi một vòng nhanh nhé.',
  };

  const taoDeXuat = {
    icon: <FileText size={26} />,
    title: 'Tạo đề xuất chi phí',
    body: laNhanVien
      ? 'Bấm nút “Tạo đề xuất chi phí” (hoặc nút tròn hồng ở góc dưới khi dùng điện thoại). Ari sẽ hỏi từng bước dễ hiểu: ai trả khoản này, chi cho việc gì, bao nhiêu tiền.'
      : 'Vào mục “Đề xuất chi phí” để tạo phiếu. Mỗi phiếu sẽ chờ duyệt rồi tự sinh phiếu thu-chi và cập nhật số dư quỹ.',
  };

  const theoDoi = {
    icon: <Bell size={26} />,
    title: laNhanVien ? 'Theo dõi phiếu của bạn' : 'Việc cần xử lý',
    body: laNhanVien
      ? 'Sau khi gửi, bạn xem phiếu của mình ở trang chủ và mục “Đề xuất”. Chuông 🔔 phía trên sẽ báo khi có cập nhật. Bạn luôn biết phiếu đang ở bước nào.'
      : 'Chuông 🔔 và mục “Cần xử lý” ở trang chủ gom các phiếu chờ duyệt và nhắc hạn thanh toán, để bạn không bỏ sót khoản nào.',
  };

  const anTam = {
    icon: <ShieldCheck size={26} />,
    title: 'Cứ yên tâm thao tác',
    body: 'Không sợ bấm sai đâu! Trước mỗi thao tác quan trọng, Ari luôn hỏi lại bằng lời dễ hiểu để bạn xác nhận. Có gì chưa rõ, bấm dấu “?” cạnh mỗi mục là Ari giải thích ngay.',
  };

  return [welcome, taoDeXuat, theoDoi, anTam];
}

export default function Onboarding() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [role, setRole] = useState(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (HIDDEN_PATHS.includes(pathname)) return;
    let done = false;
    try { done = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* ignore */ }
    if (done) return;

    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || !data.authenticated) return;
        setRole(data.user?.role || 'STAFF');
        setShow(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  // Cho phép mở lại hướng dẫn từ nút "Xem lại hướng dẫn" (Sidebar) ở mọi vai trò
  useEffect(() => {
    const onShow = (e) => {
      if (e?.detail?.role) setRole(e.detail.role);
      setStep(0);
      setShow(true);
    };
    window.addEventListener('ari:show-onboarding', onShow);
    return () => window.removeEventListener('ari:show-onboarding', onShow);
  }, []);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  const steps = buildSteps(role);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Hướng dẫn nhanh">
      <div className={styles.card}>
        <button className={styles.skip} onClick={finish} type="button">Bỏ qua</button>

        <div className={styles.cameo}>
          <AriCameo size={64} />
        </div>

        <div className={styles.iconBadge}>{current.icon}</div>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.dots} aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.actions}>
          {step > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} /> Quay lại
            </button>
          ) : <span />}

          {isLast ? (
            <button type="button" className="btn btn-primary" onClick={finish}>
              <Check size={16} /> Bắt đầu dùng
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Tiếp theo <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
