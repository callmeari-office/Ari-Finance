'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Petals.module.css';

// Bảng màu cánh hoa pastel ARI (hồng phấn → kem → mận nhạt)
const PETAL_COLORS = [
  { outer: '#E89BB0', inner: '#FFF2F6' },
  { outer: '#F2B8CB', inner: '#FFF7FA' },
  { outer: '#E6A2C5', inner: '#FFF0F7' },
  { outer: '#DBA785', inner: '#FFF6EE' }, // chút ánh kem nâu cho ấm
];

export default function PetalsTransition() {
  const [isPink, setIsPink] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsPink(theme === 'pink');
    };
    checkTheme();

    // Theo dõi đổi theme để rắc cánh hoa khi bật sang Chế độ Ari
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          checkTheme();
          setTrigger((t) => t + 1);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Lắng nghe tin vui (duyệt phiếu xong...) -> nở rộ cánh hoa chúc mừng
    const onCelebrate = () => {
      setCelebrating(true);
      setTrigger((t) => t + 1);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCelebrating(false), 7000);
    };
    window.addEventListener('ari:celebrate', onCelebrate);

    return () => {
      observer.disconnect();
      window.removeEventListener('ari:celebrate', onCelebrate);
      clearTimeout(timerRef.current);
    };
  }, []);

  // Chỉ rơi khi đang ở Chế độ Ari, hoặc khi có khoảnh khắc chúc mừng (mọi chế độ)
  const show = isPink || celebrating;
  if (!show) return null;

  // Lễ hội thì nhiều cánh hơn nhưng vẫn giới hạn để giữ máy nhẹ
  const count = celebrating ? 16 : 7;

  const petals = Array.from({ length: count }).map((_, idx) => {
    const left = 4 + Math.random() * 92;
    const delay = Math.random() * (celebrating ? 1.2 : 2.5);
    const duration = 4.5 + Math.random() * 3.8;
    const size = 12 + Math.random() * 14;
    const rotate = Math.random() * 360;
    const sway = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 60);
    const color = PETAL_COLORS[idx % PETAL_COLORS.length];
    const round = Math.random() < 0.35; // ~1/3 cánh dạng tròn mềm
    return { id: `${trigger}-${idx}`, left, delay, duration, size, rotate, sway, color, round };
  });

  return (
    <div className={styles.container} key={trigger} aria-hidden="true">
      {petals.map((p) => (
        <div
          key={p.id}
          className={styles.petal}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            transform: `rotate(${p.rotate}deg)`,
            '--sway': `${p.sway}px`,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            {p.round ? (
              <>
                {/* Cánh tròn mềm (kiểu hoa mẫu đơn) */}
                <ellipse cx="12" cy="13" rx="8" ry="9" fill={p.color.outer} fillOpacity="0.7" />
                <ellipse cx="12" cy="13.5" rx="5" ry="6" fill={p.color.inner} fillOpacity="0.55" />
              </>
            ) : (
              <>
                {/* Cánh anh đào có khía */}
                <path d="M12 2C12 2 6 8.5 6 13C6 17.5 9 21 12 21C15 21 18 17.5 18 13C18 8.5 12 2 12 2Z" fill={p.color.outer} fillOpacity="0.7" />
                <path d="M12 4C12 4 8 9.5 8 13C8 16.5 10 19 12 19C14 19 16 16.5 16 13C16 9.5 12 4 12 4Z" fill={p.color.inner} fillOpacity="0.55" />
              </>
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}
