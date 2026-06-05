'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Heart } from 'lucide-react';
import styles from './Sidebar.module.css';

/**
 * Nút chuyển đổi giao diện: Sáng (Light) -> Tối (Dark) -> Hồng ARI (Pink).
 * - Lưu lựa chọn vào localStorage('ari-theme') để giữ nguyên sau khi F5.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const current =
      document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    let next;
    if (theme === 'light') {
      next = 'dark';
    } else if (theme === 'dark') {
      next = 'pink';
    } else {
      next = 'light';
    }
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('ari-theme', next);
    } catch {
      // localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua an toàn.
    }
  };

  const getThemeConfig = () => {
    if (theme === 'light') {
      return { label: 'Chế độ Tối', Icon: Moon, title: 'Chuyển sang chế độ Tối' };
    } else if (theme === 'dark') {
      return { label: 'Chế độ Hồng ARI', Icon: Heart, title: 'Chuyển sang chế độ Hồng ARI' };
    } else {
      return { label: 'Chế độ Sáng', Icon: Sun, title: 'Chuyển sang chế độ Sáng' };
    }
  };

  const { label, Icon, title } = getThemeConfig();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={styles.themeToggle}
      title={title}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}
