'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import styles from './HelpTip.module.css';

/**
 * Nút "?" nhỏ giải thích thuật ngữ tại chỗ — thân thiện với người dùng không
 * rành công nghệ (ngại hỏi người thật, để app trả lời giúp).
 *
 * Dùng: <HelpTip text="Hoàn ứng nghĩa là bạn đã trả tiền trước, shop sẽ trả lại cho bạn." />
 *
 * - Bấm/chạm để mở (tốt cho mobile, không dựa vào hover).
 * - Tự đóng khi bấm ra ngoài hoặc nhấn Esc.
 * - Theme-aware (dùng biến CSS, chạy đúng cả 3 theme).
 */
export default function HelpTip({ text, label = 'Giải thích', size = 15 }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        aria-label={label}
        aria-expanded={open}
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <span className={styles.bubble} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
