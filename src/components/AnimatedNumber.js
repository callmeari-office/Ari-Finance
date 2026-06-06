'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — số đếm tăng dần mượt (count-up) như mở hộp nữ trang.
 * Nhẹ: chỉ dùng requestAnimationFrame, tự dừng, tôn trọng prefers-reduced-motion.
 *
 * Props:
 *  - value: số đích
 *  - duration: thời lượng ms (mặc định 900)
 *  - format: hàm định dạng số -> chuỗi (mặc định toLocaleString vi-VN)
 *  - className
 */
export default function AnimatedNumber({
  value = 0,
  duration = 900,
  format = (n) => (n || 0).toLocaleString('vi-VN'),
  className,
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — chậm dần về cuối
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(Math.round(display))}</span>;
}
